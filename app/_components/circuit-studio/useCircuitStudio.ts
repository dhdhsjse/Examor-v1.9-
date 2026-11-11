"use client";

import { useCallback, useState } from "react";
import { GRID, pathLength, routeNext, type P, type Section, type SnapTarget } from "@/app/_lib/circuit/geometry";
import { addComponent, addWire, labelsNumbered, moveComponent, moveWire, newComponentOnWire, numberLabels, removeComponent, removeWire, removeWireSection, resizeArea, rotateComponent, unnumberLabels, updateComponent } from "@/app/_lib/circuit/ops";
import { DEFAULT_CIRCUIT_CONFIG, type CircuitComponent, type CircuitConfig, type ComponentType } from "@/app/_lib/circuit/types";
import { eraseStrokes } from "@/app/_lib/ink/eraser";
import { FREEHAND_ID, addShape, duplicateShape, isLine, newShapeId, removeShape, reorderShape, updateShape, type Order, type ShapeItem } from "@/app/_lib/shapes";
import type { ShapePatch } from "@/app/_components/shapes/StudioShapes";
import { canRedoStudio, canUndoStudio, editStudioHistory, isStudioDirty, redoStudioHistory, startStudioHistory, undoStudioHistory, type StudioHistory } from "@/app/_lib/studioHistory";

/** The tool in hand: select and move, the tools of the floating bar (draw, a shape, a text box, the eraser), draw wires, or put a component of a kind. */
export type CircuitTool = "select" | "draw" | "shape" | "textbox" | "eraser" | "wire" | ComponentType;

const BAR_TOOLS = ["select", "draw", "shape", "textbox", "eraser"] as const;
/** The tools of the floating bar (the others are tiles of the left panel). */
export type BarTool = (typeof BAR_TOOLS)[number];
export const isBarTool = (t: CircuitTool): t is BarTool => (BAR_TOOLS as readonly string[]).includes(t);
/** A component tile is in hand: a click puts one. */
export const isPlaceTool = (t: CircuitTool): t is ComponentType => !isBarTool(t) && t !== "wire";

// A text box drawn on the sheet that was left empty goes away (it would be an invisible box).
const emptyTextBox = (s: ShapeItem | undefined) => !!s && !s.text?.trim() && s.fill === null && s.stroke === null;

/** A wire being drawn: its corners so far, and the way the terminal it started on points. */
export type WireDraft = { points: number[]; startDir?: P };

/** What is selected: a component, a shape, or a wire (with the section of it clicked: Delete takes only that section away). */
type Selection = { kind: "component" | "shape"; id: string } | { kind: "wire"; id: string; section?: Section };

// The state of the Circuit Studio: the circuit, with its own undo and redo (the exam's own undo history gets one step when the
// circuit is inserted or updated), what is selected, the tool in hand, the rotation a component about to be placed will have,
// and the wire being drawn. The edits themselves are pure functions in _lib/circuit/ops.ts.
export function useCircuitStudio(initial: CircuitConfig = DEFAULT_CIRCUIT_CONFIG) {
  const [history, setHistory] = useState<StudioHistory<CircuitConfig>>(() => startStudioHistory(initial));
  const [selection, setSelection] = useState<Selection | null>(null);
  const [tool, setToolState] = useState<CircuitTool>("select");
  const [pendingRotation, setPendingRotation] = useState(0); // (the turn of the next component placed: R turns it before the click)
  const [draft, setDraft] = useState<WireDraft | null>(null);
  const [shapeKind, setShapeKind] = useState("rect"); // (the shape the Shapes tool draws)
  const [textId, setTextId] = useState<string | null>(null); // the drawing whose text is being typed
  const config = history.present;

  // Edits are made on the latest circuit (two quick ones must not undo each other); `key` names what changed, so that a drag or a
  // typed field is one step of the undo.
  const change = useCallback((fn: (c: CircuitConfig) => CircuitConfig, key: string) => setHistory((h) => editStudioHistory(h, fn(h.present), key, Date.now())), []);

  const selectedComponent = selection?.kind === "component" ? (config.components.find((c) => c.id === selection.id) ?? null) : null;
  const selectedWire = selection?.kind === "wire" ? (config.wires.find((w) => w.id === selection.id) ?? null) : null; // (what undo took away is no longer selected)
  // (a section that is no longer on the wire, after an undo, is not selected)
  const selectedSection = selection?.kind === "wire" && selection.section && selectedWire && selection.section.b <= pathLength(selectedWire.points) + 0.5 ? selection.section : null;
  const selectedShape = selection?.kind === "shape" ? ((config.shapes ?? []).find((s) => s.id === selection.id) ?? null) : null;

  // ---- tools ----

  const setTool = useCallback((next: CircuitTool) => {
    setToolState(next);
    setDraft(null);
    setPendingRotation(0); // (each tool starts unturned)
    if (next !== "select") setSelection(null);
  }, []);
  const selectComponent = useCallback((id: string | null) => setSelection(id ? { kind: "component", id } : null), []);
  const selectWire = useCallback((id: string | null, section?: Section | null) => setSelection(id ? { kind: "wire", id, ...(section ? { section } : {}) } : null), []);
  const clearSelection = useCallback(() => setSelection(null), []);

  // ---- shapes ----

  // A shape chosen in the gallery: the next drag on the drawing draws it (the pencil of the gallery is the Draw tool).
  const pickShape = useCallback((shape: string) => {
    if (shape === FREEHAND_ID) return setTool("draw");
    setShapeKind(shape);
    setTool("shape");
  }, [setTool]);
  const selectShape = useCallback((id: string | null) => setSelection(id ? { kind: "shape", id } : null), []);
  // A drawing of the floating bar (a stroke, a shape, a text box) put on the sheet.
  const addDrawing = useCallback(
    (item: ShapeItem) => {
      change((c) => ({ ...c, shapes: addShape(c.shapes, item) }), `add:${item.id}`);
      if (tool === "draw") return; // (the brush stays in hand: a drawing is many strokes)
      setSelection({ kind: "shape", id: item.id });
      setToolState("select"); // (like PowerPoint: one shape, then the Select tool is back)
      if (tool === "textbox") setTextId(item.id); // (a text box: type in it at once)
    },
    [tool, change],
  );
  const changeShape = useCallback((id: string, patch: ShapePatch, key: string) => change((c) => ({ ...c, shapes: updateShape(c.shapes, id, patch) }), key), [change]);
  const orderShape = useCallback((id: string, order: Order) => change((c) => ({ ...c, shapes: reorderShape(c.shapes, id, order) }), `order:${id}:${Date.now()}`), [change]);
  const duplicateShapeOf = useCallback(
    (id: string) => {
      const { copy } = duplicateShape(config.shapes, id);
      if (!copy) return;
      change((c) => ({ ...c, shapes: addShape(c.shapes, copy) }), `dup:${copy.id}`);
      setSelection({ kind: "shape", id: copy.id });
    },
    [config.shapes, change],
  );
  const eraseShapes = useCallback((ids: ReadonlySet<string>, gesture: string) => change((c) => {
    const left = (c.shapes ?? []).filter((s) => !ids.has(s.id));
    return { ...c, shapes: left.length ? left : undefined };
  }, gesture), [change]);
  // the real eraser: the drawings it went over are cut there (worked out from the sheet as it is at each move)
  const eraseInk = useCallback((path: { x: number; y: number }[], radius: number, gesture: string) => change((c) => {
    const left = eraseStrokes(c.shapes ?? [], path, radius, newShapeId);
    return left ? { ...c, shapes: left.length ? left : undefined } : c;
  }, gesture), [change]);
  const deleteShape = useCallback((id: string, key = `remove:${id}`) => {
    change((c) => {
      const left = removeShape(c.shapes, id);
      return { ...c, shapes: left.length ? left : undefined };
    }, key);
    setSelection(null);
  }, [change]);
  const editText = useCallback((id: string | null) => {
    const typed = (config.shapes ?? []).find((s) => s.id === textId);
    setTextId(id);
    if (!id && typed && emptyTextBox(typed)) deleteShape(typed.id, `add:${typed.id}`); // (the same step of the undo as drawing it)
  }, [config.shapes, textId, deleteShape]);
  const nudgeShape = useCallback((id: string, dx: number, dy: number) => change((c) => ({ ...c, shapes: (c.shapes ?? []).map((s) => (s.id === id ? { ...s, x: s.x + dx, y: s.y + dy } : s)) }), `shape-move:${id}`), [change]);

  // ---- components ----

  // A click with a component tool in hand: one is put there (the tool stays in hand: a circuit has several), and selected.
  const placeComponent = useCallback(
    (type: ComponentType, x: number, y: number) => {
      const c = newComponentOnWire(config, type, x, y, pendingRotation);
      change((cfg) => addComponent(cfg, c), `add:${c.id}`);
      setSelection({ kind: "component", id: c.id });
    },
    [config, pendingRotation, change],
  );

  const moveComponentTo = useCallback((id: string, x: number, y: number) => change((c) => moveComponent(c, id, x, y), `move:${id}`), [change]);
  const nudge = useCallback((id: string, dx: number, dy: number) => change((c) => {
    const at = c.components.find((k) => k.id === id);
    return at ? moveComponent(c, id, at.x + dx * GRID, at.y + dy * GRID) : c;
  }, `move:${id}`), [change]);

  // R: turns the selected component (the one just placed, too: no need to take the Select tool for it), and the component about to be
  // placed follows it; with nothing selected, the component about to be placed, or else the selected shape.
  const rotate = useCallback(
    (by = 90) => {
      const placing = isPlaceTool(tool);
      const turned = (r: number) => (((r + by) % 360) + 360) % 360;
      if (selectedComponent) {
        change((c) => rotateComponent(c, selectedComponent.id, by), `rotate:${selectedComponent.id}`);
        if (placing) setPendingRotation(turned(selectedComponent.rotation));
      } else if (placing) setPendingRotation(turned);
      else if (selectedShape && !isLine(selectedShape)) changeShape(selectedShape.id, { rotation: ((((selectedShape.rotation ?? 0) + by) % 360) + 360) % 360 || undefined }, `shape-turn:${selectedShape.id}:${Date.now()}`);
    },
    [tool, selectedComponent, selectedShape, change, changeShape],
  );

  // A component turned on the drawing itself (its turn handle, or a right-click), whatever the tool in hand: it is selected too.
  const rotateComponentBy = useCallback(
    (id: string, by = 90) => {
      setSelection({ kind: "component", id });
      change((c) => rotateComponent(c, id, by), `rotate:${id}`);
    },
    [change],
  );

  const updateComponentProps = useCallback(
    (id: string, patch: Partial<Pick<CircuitComponent, "label" | "value" | "closed" | "showValue" | "labelSide">>) => change((c) => updateComponent(c, id, patch), `comp:${id}:${Object.keys(patch).sort().join(",")}`),
    [change],
  );

  // ---- wires ----

  const finishWire = useCallback(
    (extra?: number[]) => {
      if (!draft) return;
      const points = extra ?? draft.points;
      const wire = { id: crypto.randomUUID(), points };
      if (points.length >= 4) {
        change((c) => addWire(c, points, wire.id), `wire:${wire.id}`);
        setSelection({ kind: "wire", id: wire.id });
      }
      setDraft(null);
    },
    [draft, change],
  );

  // A click with the wire tool: the first one starts a wire, the next ones carry it on (an L-shape between corners, or more), and a
  // click on a terminal or on another wire ends it there. Shift takes the other way round for the next leg.
  const wireClick = useCallback(
    (target: SnapTarget, flip: boolean) => {
      if (!draft) {
        setDraft({ points: [target.point.x, target.point.y], startDir: target.outward });
        return;
      }
      const last = { x: draft.points[draft.points.length - 2], y: draft.points[draft.points.length - 1] };
      if (Math.abs(last.x - target.point.x) < 0.5 && Math.abs(last.y - target.point.y) < 0.5) return; // (a double click lands twice on one point)
      const points = routeNext(draft.points, draft.startDir, target.point, flip);
      if (target.connects) finishWire(points);
      else setDraft({ ...draft, points });
    },
    [draft, finishWire],
  );

  const cancelWire = useCallback(() => setDraft(null), []);
  const moveWireBy = useCallback((id: string, dx: number, dy: number) => change((c) => moveWire(c, id, dx, dy), `wire-move:${id}`), [change]);

  // ---- the whole circuit ----

  // Delete: the selected component or shape; for a wire, the section of it that was clicked (the whole wire when none was).
  const deleteSelected = useCallback(() => {
    if (!selection) return;
    if (selection.kind === "component") change((c) => removeComponent(c, selection.id), `remove:${selection.id}`);
    else if (selection.kind === "shape") return deleteShape(selection.id);
    else if (selectedSection) change((c) => removeWireSection(c, selection.id, selectedSection), `cut:${selection.id}:${Date.now()}`);
    else change((c) => removeWire(c, selection.id), `remove:${selection.id}`);
    setSelection(null);
  }, [selection, selectedSection, change, deleteShape]);

  // The whole wire, even with a section of it selected.
  const deleteWire = useCallback((id: string) => {
    change((c) => removeWire(c, id), `remove:${id}`);
    setSelection(null);
  }, [change]);

  // The labels numbered (R, R → R1, R2), or, when they already are, back to their plain letters: the button is a toggle.
  const numbered = labelsNumbered(config);
  const numberTheLabels = useCallback(() => change((c) => (labelsNumbered(c) ? unnumberLabels(c) : numberLabels(c)), `number:${Date.now()}`), [change]);

  const setArea = useCallback((width: number, height: number) => change((c) => resizeArea(c, width, height), "area"), [change]);

  const undo = useCallback(() => setHistory(undoStudioHistory), []);
  const redo = useCallback(() => setHistory(redoStudioHistory), []);

  return {
    config,
    selectedComponent,
    selectedWire,
    selectedShape,
    selectedSection,
    shapeKind,
    pickShape,
    selectShape,
    addDrawing,
    textId,
    editText,
    eraseShapes,
    eraseInk,
    deleteShape,
    changeShape,
    orderShape,
    duplicateShapeOf,
    nudgeShape,
    selectComponent,
    selectWire,
    clearSelection,
    tool,
    setTool,
    pendingRotation,
    placeComponent,
    moveComponentTo,
    nudge,
    rotate,
    rotateComponentBy,
    updateComponentProps,
    draft,
    wireClick,
    finishWire: () => finishWire(),
    cancelWire,
    moveWireBy,
    deleteSelected,
    deleteWire,
    setArea,
    numbered,
    numberTheLabels,
    undo,
    redo,
    canUndo: canUndoStudio(history),
    canRedo: canRedoStudio(history),
    dirty: isStudioDirty(history),
    empty: config.components.length === 0 && config.wires.length === 0 && !config.shapes?.length,
  };
}

export type CircuitStudioState = ReturnType<typeof useCircuitStudio>;
