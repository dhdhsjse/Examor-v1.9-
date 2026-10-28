"use client";

import type Konva from "konva";
import { Maximize, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Circle, Group, Layer, Line, Rect, Stage } from "react-konva";
import { bondDrawing } from "@/app/_lib/chemistry/bondGeometry";
import { drawingBounds, generateRing } from "@/app/_lib/chemistry/geometry";
import { atomNear, planBond } from "@/app/_lib/chemistry/graphOps";
import { electronClick } from "@/app/_lib/chemistry/electrons";
import { pairClick } from "@/app/_lib/chemistry/lonePairs";
import { countOf, selectInRect, union, type Rect as WorldRect } from "@/app/_lib/chemistry/selection";
import { TOOL_HINTS } from "@/app/_lib/chemistry/strings";
import type { AtomNode } from "@/app/_lib/chemistry/types";
import ShapeDrawSurface from "@/app/_components/shapes/ShapeDrawSurface";
import StudioShapes from "@/app/_components/shapes/StudioShapes";
import { useT } from "@/app/_lib/uiLang";
import { BUTTON_FACTOR, GRID, fitView, panBy, scrollRanges, snapToGrid, thumb, toWorld, viewMinFromThumb, wheelFactor, wheelScroll, zoomAt, type ScrollRanges, type Size, type View } from "@/app/_lib/chemistry/viewport";
import AnnotationEditor from "./AnnotationEditor";
import AnnotationLayer, { type AnnotationInteraction } from "./AnnotationLayer";
import MoleculeRenderer, { ACCENT, type Interaction } from "./MoleculeRenderer";
import type { MoleculeStudioState } from "./useMoleculeStudio";

const MAJOR = 5 * GRID; // graph paper: a thin line every GRID units, a stronger one every 5th
const MINOR_COLOR = "#e9eef5";
const MAJOR_COLOR = "#cfd9e6";
const MIN_VISIBLE_GAP = 7; // thin lines closer than this (on screen) are left out
const PLACE_CLEARANCE = 10; // a new atom is not placed within this distance of another one
const GROUP_REACH = 30; // a group is attached to the atom this near the click (a click on the atom itself is within 16)
const GHOST_OPACITY = 0.4;
const WORLD_EDGE = 100000; // the Shapes tool's sheet reaches this far from the origin each way
const TARGET_RING = 18;

interface Props {
  studio: MoleculeStudioState;
  /** The student's view: the masks applied, and the drawing only looked at (it can still be scrolled and zoomed). */
  student?: boolean;
}

type PointerEvent = Konva.KonvaEventObject<MouseEvent | TouchEvent>;

// A bond being drawn: the atom it started from and where the mouse is (drawing units).
type Drawing = { sourceId: string; x: number; y: number };
// Atoms and texts being moved together (a selection, or Shift + drag for a whole molecule): which, and where the
// one that is held was last seen (the others follow by the difference).
type GroupDrag = { atoms: ReadonlySet<string>; notes: ReadonlySet<string>; last: { x: number; y: number } };
const NONE: ReadonlySet<string> = new Set();
// A rubber band smaller than this (in screen pixels) is a click on the paper.
const MIN_BAND_PX = 4;

// The drawing area: graph paper, scroll wheel zoom (around the cursor), middle-button pan, and the tools:
// click to place an atom, a ring, a group, a text or an arrow (snapped to the paper), drag to move an atom
// (Shift: the whole molecule; a selection moves together), drag on the paper to select what is inside a frame,
// drag from an atom to draw a bond, click a bond to change its order, click with the eraser to delete.
// Until the teacher moves the view, the drawing is centred as it was when it was opened; give the
// component a new `key` for a new drawing. Editing never moves the view.
export default function StudioCanvas({ studio, student = false }: Props) {
  const t = useT();
  const { graph, activeTool, activeElement, activeBondType, activeRing, selection } = studio;
  const { select, selectOnly, toggleSelected, clearSelection, setElementOf, addAtom, moveAtom, moveGroup, moleculeOf, claim, deleteAtom } = studio;
  const { addBond, addBondedCarbon, cycleBondType, setTypeOfBond, deleteBond, addRing, attachTemplate, placeTemplate } = studio;
  const { addAnnotation, updateAnnotation, deleteAnnotation, startGesture, finishGesture, stepPairsOf } = studio;
  const { placeElectronAt, removeElectronNearOf, removeElectronOf } = studio;
  const { placePairAt, removePairNearOf, removePairOf, grabPair, turnPair } = studio;
  const box = useRef<HTMLDivElement>(null);
  const groupDrag = useRef<GroupDrag | null>(null);
  const justBanded = useRef(false); // a frame was just drawn: the click that follows it is not a click on the paper
  const selectedAtoms = useMemo(() => new Set(selection.atoms), [selection.atoms]);
  const selectedBonds = useMemo(() => new Set(selection.bonds), [selection.bonds]);
  const selectedNotes = useMemo(() => new Set(selection.notes), [selection.notes]);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const [custom, setView] = useState<View | null>(null);
  const [panning, setPanning] = useState(false);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null); // where the next atom or ring would go
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const [band, setBand] = useState<{ rect: WorldRect; shift: boolean } | null>(null); // the frame being drawn to select
  const [editing, setEditing] = useState<{ id: string; isNew: boolean } | null>(null); // the text or arrow being typed in
  const [opened] = useState(() => drawingBounds(graph));
  const view = custom ?? fitView(opened, size);
  const editedNote = editing ? graph.annotations.find((n) => n.id === editing.id) : undefined;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Esc drops the bond being drawn. It is marked as handled so that the Studio does not also close:
  // the listener is a capture one, so it runs before the Studio's whichever was registered first.
  useEffect(() => {
    if (!drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setDrawing(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [drawing]);

  // The mouse in the drawing's units, as the stage sees it (null if the stage has no pointer).
  const worldPointer = (stage: Konva.Stage) => {
    const p = stage.getPointerPosition();
    return p ? toWorld(view, p.x, p.y) : null;
  };
  const snappedPointer = (stage: Konva.Stage) => {
    const w = worldPointer(stage);
    return w && { x: snapToGrid(w.x), y: snapToGrid(w.y) };
  };

  // The wheel scrolls the paper (Shift: sideways; a trackpad also scrolls sideways by itself). Ctrl or Cmd with the
  // wheel, or a pinch on a trackpad (which arrives as Ctrl + wheel), zooms around the cursor.
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const p = e.target.getStage()?.getPointerPosition();
      if (p) setView(zoomAt(view, p.x, p.y, wheelFactor(e.evt.deltaY)));
      return;
    }
    const { dx, dy } = wheelScroll(e.evt);
    setView(panBy(view, dx, dy));
  };

  // The scrollbars: the range is the drawing with a margin (and wherever the view is); it is frozen while a thumb is
  // dragged, or the range would grow under the thumb as the view leaves the drawing.
  const bounds = useMemo(() => drawingBounds(graph), [graph]);
  const [frozen, setFrozen] = useState<ScrollRanges | null>(null);
  const ranges = frozen ?? scrollRanges(view, size, bounds);
  const worldW = size.w / view.scale;
  const worldH = size.h / view.scale;
  const thumbX = thumb(ranges.x, -view.x / view.scale, worldW);
  const thumbY = thumb(ranges.y, -view.y / view.scale, worldH);
  const scrollTo = (axis: "x" | "y", start: number) => {
    const min = viewMinFromThumb(ranges[axis], axis === "x" ? worldW : worldH, start);
    setView(axis === "x" ? { ...view, x: -min * view.scale } : { ...view, y: -min * view.scale });
  };
  const holdRange = () => setFrozen(scrollRanges(view, size, bounds));
  const freeRange = () => setFrozen(null);

  // Middle button: the drawing follows the mouse until the button is released (even outside the area).
  const onMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Select tool, left button, on the bare paper: the start of a frame that selects what it takes in
    if (!student && e.evt.button === 0 && activeTool === "select" && e.target === e.target.getStage()) {
      const w = worldPointer(e.target.getStage()!);
      if (w) setBand({ rect: { x0: w.x, y0: w.y, x1: w.x, y1: w.y }, shift: e.evt.shiftKey });
      return;
    }
    if (e.evt.button !== 1) return;
    e.evt.preventDefault(); // no auto-scroll cursor
    const start = { x: e.evt.clientX, y: e.evt.clientY, view };
    setPanning(true);
    setGhost(null);
    setDrawing(null);
    const move = (m: MouseEvent) => setView({ ...start.view, x: start.view.x + m.clientX - start.x, y: start.view.y + m.clientY - start.y });
    const up = () => {
      setPanning(false);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  // A click on the bare paper (a click on an atom, a bond, a text or an arrow never reaches the stage: it stops the event).
  const onStageClick = (e: PointerEvent) => {
    if (student || ("button" in e.evt && e.evt.button !== 0)) return; // the middle button pans; the right one is not ours
    const stage = e.target.getStage();
    if (!stage || e.target !== stage) return;
    if (activeTool === "select") {
      const shift = "shiftKey" in e.evt && e.evt.shiftKey;
      if (!justBanded.current && !shift) clearSelection(); // (the click that ends a frame is not a click on the paper)
      return;
    }
    const at = snappedPointer(stage);
    const raw = worldPointer(stage);
    if (!at || !raw) return;
    if (activeTool === "atom") {
      if (!atomNear(graph, at.x, at.y, PLACE_CLEARANCE)) addAtom(at.x, at.y);
    } else if (activeTool === "ring") {
      addRing(at.x, at.y); // the tool goes back to Select by itself
    } else if (activeTool === "template") {
      const near = atomNear(graph, raw.x, raw.y, GROUP_REACH);
      if (near) attachTemplate(near.id);
      else placeTemplate(at.x, at.y);
    } else if (activeTool === "text" || activeTool === "arrow") {
      setEditing({ id: addAnnotation(activeTool, at.x, at.y), isNew: true }); // typed at once
    }
  };

  // The mouse moves: the bond being drawn follows it; with the atom or ring tool a ghost shows where a click
  // would put one (gone over an atom, while panning or with another tool).
  const onStageMove = (e: PointerEvent) => {
    const stage = e.target.getStage();
    if (!stage || student) return;
    if (drawing) {
      const w = worldPointer(stage);
      if (w) setDrawing({ ...drawing, x: w.x, y: w.y });
      return;
    }
    if (band) {
      const w = worldPointer(stage);
      if (w) setBand({ ...band, rect: { ...band.rect, x1: w.x, y1: w.y } });
      return;
    }
    const ghosting = (activeTool === "atom" || activeTool === "ring") && !panning && e.target === stage;
    const at = ghosting ? snappedPointer(stage) : null;
    setGhost((g) => (g?.x === at?.x && g?.y === at?.y ? g : at));
  };

  // The button goes up: the bond being drawn is made, on the atom under the mouse or on a new carbon.
  const onStageUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (band && e.evt.button === 0) {
      const { rect, shift } = band;
      setBand(null);
      if (Math.hypot(rect.x1 - rect.x0, rect.y1 - rect.y0) * view.scale >= MIN_BAND_PX) {
        const taken = selectInRect(graph, rect);
        select(shift ? union(selection, taken) : taken);
        justBanded.current = true;
        setTimeout(() => (justBanded.current = false), 0); // (the click comes right after this, in the same event)
      }
      return;
    }
    if (!drawing || e.evt.button !== 0) return;
    const stage = e.target.getStage();
    const w = stage && worldPointer(stage);
    setDrawing(null);
    const plan = w && planBond(graph, drawing.sourceId, w.x, w.y);
    if (!plan) return;
    if (plan.targetId) addBond(drawing.sourceId, plan.targetId);
    else addBondedCarbon(drawing.sourceId, plan.end.x, plan.end.y);
  };

  const interaction = useMemo<Interaction>(
    () => ({
      tool: activeTool,
      selectedAtoms,
      selectedBonds,
      onClick: (id, shift, deg) => {
        if (activeTool === "erase") deleteAtom(id);
        else if (activeTool === "select") {
          if (shift) toggleSelected("atoms", id);
          else selectOnly("atoms", id);
        } else if (activeTool === "electron") {
          // beside the atom: a single electron put there (Shift: the nearest one taken away)
          if (deg !== null) (shift ? removeElectronNearOf : placeElectronAt)(id, deg);
        } else if (activeTool === "pair") {
          // beside the atom: a pair put there (Shift: the nearest one taken away); on the symbol: one more, placed automatically (Shift: one less)
          if (deg === null) stepPairsOf([id], shift ? -1 : 1);
          else if (shift) removePairNearOf(id, deg);
          else placePairAt(id, deg);
        }
        else if (activeTool === "template") attachTemplate(id);
        else if (activeTool === "atom") setElementOf([id], activeElement); // the atom takes the element in hand
      },
      previewPair: (id, deg) => pairClick(graph, id, deg),
      onPairClick: (id, mark) => {
        if (activeTool === "pair" || activeTool === "erase") removePairOf(id, mark);
        else if (activeTool === "select") selectOnly("atoms", id);
      },
      previewElectron: (id, deg) => electronClick(graph, id, deg),
      onElectronClick: (id, index) => {
        if (activeTool === "electron" || activeTool === "erase") removeElectronOf(id, index);
        else if (activeTool === "select") selectOnly("atoms", id);
      },
      onPairGrab: grabPair,
      onPairTurn: turnPair,
      onPairDrop: finishGesture,
      onPress: (id) => {
        const atom = graph.atoms.find((a) => a.id === id);
        if (activeTool === "bond" && atom) setDrawing({ sourceId: id, x: atom.x, y: atom.y });
      },
      // Shift: the whole molecule comes with the atom (a ring is moved by any of its atoms). An atom of a selection
      // of several things: they all move. Otherwise the atom alone (and an automatic hydrogen becomes the teacher's).
      onDragStart: (id, wholeMolecule) => {
        startGesture();
        const atom = graph.atoms.find((a) => a.id === id);
        if (!atom) return;
        const last = { x: atom.x, y: atom.y };
        if (wholeMolecule) {
          selectOnly("atoms", id);
          groupDrag.current = { atoms: moleculeOf(id), notes: NONE, last };
        } else if (selectedAtoms.has(id) && countOf(selection) > 1) {
          groupDrag.current = { atoms: selectedAtoms, notes: selectedNotes, last };
        } else {
          selectOnly("atoms", id);
          claim(id);
          groupDrag.current = null;
        }
      },
      onMove: (id, x, y) => {
        const drag = groupDrag.current;
        if (!drag) return moveAtom(id, x, y);
        moveGroup(drag.atoms, drag.notes, x - drag.last.x, y - drag.last.y);
        drag.last = { x, y };
      },
      onDragEnd: () => {
        groupDrag.current = null;
        finishGesture();
      },
      onBondClick: (id, shift) => {
        if (activeTool === "select") {
          if (shift) toggleSelected("bonds", id);
          else {
            selectOnly("bonds", id);
            cycleBondType(id);
          }
        } else if (activeTool === "erase") deleteBond(id);
        else if (activeTool === "bond") setTypeOfBond(id, activeBondType);
      },
    }),
    [activeTool, activeBondType, activeElement, placeElectronAt, removeElectronNearOf, removeElectronOf, stepPairsOf, placePairAt, removePairNearOf, removePairOf, grabPair, turnPair, graph, selectedAtoms, selectedBonds, selectedNotes, selection, deleteAtom, selectOnly, toggleSelected, setElementOf, attachTemplate, startGesture, finishGesture, claim, moleculeOf, moveAtom, moveGroup, cycleBondType, deleteBond, setTypeOfBond],
  );

  // A text or arrow of a selection of several things takes them all along; alone, it moves by itself.
  const grabNote = useCallback(
    (id: string) => {
      startGesture();
      const note = graph.annotations.find((n) => n.id === id);
      if (note && selectedNotes.has(id) && countOf(selection) > 1) {
        groupDrag.current = { atoms: selectedAtoms, notes: selectedNotes, last: { x: note.x, y: note.y } };
      } else {
        selectOnly("notes", id);
        groupDrag.current = null;
      }
    },
    [startGesture, graph.annotations, selectedNotes, selectedAtoms, selection, selectOnly],
  );
  const releaseNote = useCallback(() => {
    groupDrag.current = null;
    finishGesture();
  }, [finishGesture]);
  const moveNote = useCallback(
    (id: string, x: number, y: number) => {
      const drag = groupDrag.current;
      if (!drag) return updateAnnotation(id, { x, y });
      moveGroup(drag.atoms, drag.notes, x - drag.last.x, y - drag.last.y);
      drag.last = { x, y };
    },
    [updateAnnotation, moveGroup],
  );

  const noteInteraction = useMemo<AnnotationInteraction>(
    () => ({
      tool: activeTool,
      selectedIds: selectedNotes,
      editingId: editing?.id ?? null,
      onSelect: (id, shift) => (shift ? toggleSelected("notes", id) : selectOnly("notes", id)),
      // (these three only run from the drag events of Konva, never while rendering: they use the drag ref)
      /* eslint-disable react-hooks/refs */
      onGrab: grabNote,
      onRelease: releaseNote,
      onMove: moveNote,
      /* eslint-enable react-hooks/refs */
      onResize: (id, width) => updateAnnotation(id, { width }),
      onEdit: (id) => {
        selectOnly("notes", id);
        setEditing({ id, isNew: false });
      },
      onErase: deleteAnnotation,
    }),
    [activeTool, selectedNotes, editing?.id, toggleSelected, selectOnly, grabNote, releaseNote, moveNote, updateAnnotation, deleteAnnotation],
  );

  // The text is typed (or given up): an empty text goes away, an empty arrow label is just no label.
  const finishEditing = (text: string | null) => {
    const note = editedNote;
    setEditing(null);
    if (note) {
      if (text === null) {
        if (editing?.isNew && note.type === "text" && !note.text) deleteAnnotation(note.id);
      } else if (note.type === "text" && !text.trim()) deleteAnnotation(note.id);
      else updateAnnotation(note.id, { text });
    }
    finishGesture(); // a new text or arrow opened one: placing it and typing it are one step (none if it was given up)
  };

  // What the bond being drawn would do, and the dashed drawing of it.
  const preview = useMemo(() => {
    const source = drawing && graph.atoms.find((a) => a.id === drawing.sourceId);
    const plan = drawing && planBond(graph, drawing.sourceId, drawing.x, drawing.y);
    if (!source || !plan) return null;
    const lines = bondDrawing(source, plan.end, activeBondType).lines;
    const end: AtomNode = { id: "ghost-end", element: "C", x: plan.end.x, y: plan.end.y, charge: 0, hidden: false };
    return { lines, plan, endGraph: plan.targetId ? null : { atoms: [end], bonds: [], annotations: [] } };
  }, [drawing, graph, activeBondType]);

  // The paper follows the view: grid lines are CSS gradients moved and scaled with it.
  const paper = useMemo(() => {
    const layers: { gap: number; color: string }[] = [{ gap: MAJOR, color: MAJOR_COLOR }];
    if (GRID * view.scale >= MIN_VISIBLE_GAP) layers.unshift({ gap: GRID, color: MINOR_COLOR });
    const lines = layers.flatMap((l) => (["right", "bottom"] as const).map((to) => ({ image: `linear-gradient(to ${to}, ${l.color} 1px, transparent 1px)`, gap: l.gap * view.scale })));
    return {
      backgroundColor: "#ffffff",
      backgroundImage: lines.map((l) => l.image).join(","),
      backgroundSize: lines.map((l) => `${l.gap}px ${l.gap}px`).join(","),
      backgroundPosition: `${view.x}px ${view.y}px`,
    };
  }, [view.x, view.y, view.scale]);

  // The faded atom or ring that follows the mouse.
  const ghostGraph = useMemo(() => {
    if (!ghost || (activeTool !== "atom" && activeTool !== "ring")) return null; // (the position outlives the tool that set it)
    if (activeTool === "ring") return { ...generateRing(ghost.x, ghost.y, activeRing.sides, activeRing.isAromatic), annotations: [] };
    if (atomNear(graph, ghost.x, ghost.y, PLACE_CLEARANCE)) return null;
    const atom: AtomNode = { id: "ghost", element: activeElement, x: ghost.x, y: ghost.y, charge: 0, hidden: false };
    return { atoms: [atom], bonds: [], annotations: [] };
  }, [ghost, graph, activeElement, activeTool, activeRing]);

  const target = preview?.plan.targetId ? graph.atoms.find((a) => a.id === preview.plan.targetId) : undefined;
  const zoomBy = (factor: number) => setView(zoomAt(view, size.w / 2, size.h / 2, factor));
  const percent = Math.round(view.scale * 100);
  const cursor = panning ? "grabbing" : activeTool === "select" || activeTool === "erase" ? "default" : activeTool === "text" ? "text" : "crosshair";

  return (
    <div ref={box} data-testid="studio-canvas" role="group" aria-label={t("Drawing area")} className="relative h-full w-full overflow-hidden" style={{ ...paper, cursor }}>
      {size.w > 0 && size.h > 0 && (
        <Stage
          width={size.w}
          height={size.h}
          x={view.x}
          y={view.y}
          scaleX={view.scale}
          scaleY={view.scale}
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseUp={onStageUp}
          onClick={onStageClick}
          onTap={onStageClick}
          onMouseMove={onStageMove}
          onMouseLeave={() => {
            setGhost(null);
            setDrawing(null); // the button may be released outside the area: the bond is dropped
            setBand(null); // and so is a frame
          }}
        >
          <Layer listening={!student}>
            <AnnotationLayer annotations={graph.annotations} interaction={noteInteraction} />
            <MoleculeRenderer graph={graph} interaction={student ? undefined : interaction} student={student} />
            {/* the shapes drawn over the molecule */}
            <StudioShapes
              shapes={graph.shapes ?? []}
              selectedId={studio.selectedShape?.id ?? null}
              interactive={!student && activeTool === "select"}
              scale={view.scale}
              onSelect={studio.selectShape}
              onChange={studio.changeShape}
              onGrab={studio.startGesture}
              onRelease={studio.finishGesture}
            />
            {ghostGraph && (
              <Group listening={false} opacity={GHOST_OPACITY}>
                <MoleculeRenderer graph={ghostGraph} />
              </Group>
            )}
            {/* with the Shapes tool: drag to draw the shape chosen in the gallery (the paper has no edge) */}
            {!student && activeTool === "shape" && <ShapeDrawSurface x={-WORLD_EDGE} y={-WORLD_EDGE} width={2 * WORLD_EDGE} height={2 * WORLD_EDGE} shape={studio.shapeKind} onDraw={studio.drawShape} />}
            {band && (
              <Rect
                x={Math.min(band.rect.x0, band.rect.x1)}
                y={Math.min(band.rect.y0, band.rect.y1)}
                width={Math.abs(band.rect.x1 - band.rect.x0)}
                height={Math.abs(band.rect.y1 - band.rect.y0)}
                fill="rgba(79,70,229,0.08)"
                stroke={ACCENT}
                strokeWidth={1 / view.scale}
                dash={[6 / view.scale, 4 / view.scale]}
                listening={false}
              />
            )}
            {preview && (
              <Group listening={false}>
                {preview.lines.map((l, i) => (
                  <Line key={i} points={[l.x1, l.y1, l.x2, l.y2]} stroke={ACCENT} strokeWidth={1.6} dash={[6, 5]} lineCap="round" />
                ))}
                {preview.endGraph && (
                  <Group opacity={GHOST_OPACITY}>
                    <MoleculeRenderer graph={preview.endGraph} />
                  </Group>
                )}
                {target && <Circle x={target.x} y={target.y} radius={TARGET_RING} stroke={ACCENT} strokeWidth={2} />}
              </Group>
            )}
          </Layer>
        </Stage>
      )}

      {editedNote && <AnnotationEditor key={editedNote.id} note={editedNote} view={view} onDone={finishEditing} />}

      <p data-testid="tool-hint" className="pointer-events-none absolute start-3 top-3 rounded-lg bg-white/90 px-2.5 py-1.5 text-xs text-muted shadow-sm">
        {student ? t("Student view: this is what the students will see") : t(TOOL_HINTS[activeTool])}
      </p>

      <div className="absolute bottom-4 start-3 flex items-center gap-0.5 rounded-xl border border-line bg-white/95 p-1 shadow-sm">
        <ZoomButton label={t("Zoom out")} onClick={() => zoomBy(1 / BUTTON_FACTOR)} icon={<Minus size={15} />} />
        <button onClick={() => zoomBy(1 / view.scale)} title={t("Zoom to {percent}%", { percent: 100 })} className="min-w-12 rounded-lg px-1.5 py-1 text-center text-xs font-medium tabular-nums text-ink hover:bg-subtle">
          {percent}%
        </button>
        <ZoomButton label={t("Zoom in")} onClick={() => zoomBy(BUTTON_FACTOR)} icon={<Plus size={15} />} />
        <div className="mx-0.5 h-5 w-px bg-line" />
        <ZoomButton label={t("Fit to the drawing")} onClick={() => setView(fitView(drawingBounds(graph), size))} icon={<Maximize size={14} />} />
      </div>
      {thumbX && <Scrollbar axis="x" thumb={thumbX} onHold={holdRange} onScroll={(s) => scrollTo("x", s)} onFree={freeRange} label={t("Scroll sideways")} />}
      {thumbY && <Scrollbar axis="y" thumb={thumbY} onHold={holdRange} onScroll={(s) => scrollTo("y", s)} onFree={freeRange} label={t("Scroll up and down")} />}
      <p className="pointer-events-none absolute bottom-4 end-4 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] text-faint">{t("Wheel: scroll · Shift: sideways · Ctrl: zoom")}</p>
    </div>
  );
}

// A scrollbar laid over the paper: a thumb that is dragged (pointer capture, so it follows the mouse out of the track).
function Scrollbar({ axis, thumb: t, onHold, onScroll, onFree, label }: { axis: "x" | "y"; thumb: { start: number; length: number }; onHold: () => void; onScroll: (start: number) => void; onFree: () => void; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ from: number; start: number } | null>(null);
  const vertical = axis === "y";
  const pos = (e: ReactPointerEvent) => (vertical ? e.clientY : e.clientX);
  const trackLength = () => (vertical ? track.current?.clientHeight : track.current?.clientWidth) || 1;
  return (
    <div ref={track} dir="ltr" title={label} data-testid={`scrollbar-${axis}`} className={`absolute z-10 ${vertical ? "bottom-4 right-0 top-0 w-3" : "bottom-0 left-0 right-4 h-3"}`}>
      <div
        className="absolute rounded-full bg-slate-400/50 hover:bg-slate-500/60 active:bg-slate-500/70"
        style={vertical ? { top: `${t.start * 100}%`, height: `${t.length * 100}%`, left: 2, right: 2 } : { left: `${t.start * 100}%`, width: `${t.length * 100}%`, top: 2, bottom: 2 }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { from: pos(e), start: t.start };
          onHold();
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const next = drag.current.start + (pos(e) - drag.current.from) / trackLength();
          onScroll(Math.min(1 - t.length, Math.max(0, next)));
        }}
        onPointerUp={() => {
          drag.current = null;
          onFree();
        }}
        onPointerCancel={() => {
          drag.current = null;
          onFree();
        }}
      />
    </div>
  );
}

function ZoomButton({ label, onClick, icon }: { label: string; onClick: () => void; icon: ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink">
      {icon}
    </button>
  );
}
