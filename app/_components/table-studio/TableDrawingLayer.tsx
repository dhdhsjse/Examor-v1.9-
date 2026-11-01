"use client";

import type Konva from "konva";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Group, Layer, Rect, Stage } from "react-konva";
import { InkStroke } from "@/app/_components/shapes/InkGraphic";
import ShapeDrawSurface from "@/app/_components/shapes/ShapeDrawSurface";
import StudioShapes, { type ShapePatch } from "@/app/_components/shapes/StudioShapes";
import { fontStack } from "@/app/_lib/fonts";
import { InkCapture, finishInk, inkToShape, type InkPoint } from "@/app/_lib/ink/engine";
import { eraserCursor, eraserPoints, type EraserSettings } from "@/app/_lib/ink/eraser";
import type { InkTools } from "@/app/_lib/ink/useInkTools";
import { DEFAULT_FONT_SIZE, DEFAULT_TEXT_COLOR, FREEHAND_ID, SHAPE_FONT, newShapeId, newShapeItem, type DrawnBox, type ShapeItem, type ShapeStyle } from "@/app/_lib/shapes";

/** The tools of the Studio's floating bar */
export type TableTool = "select" | "draw" | "shape" | "textbox" | "eraser";

const ROOM_BELOW = 200; // page px of empty room under the rows while a drawing tool is in hand (a shape may go below the table)
const ACCENT = "#4f46e5";
// The text box being drawn: a dashed frame (the box itself has no fill and no outline: only its text is on the page)
const TEXTBOX_FRAME: Partial<ShapeStyle> = { fill: null, stroke: ACCENT, strokeWidth: 1, dash: "dashed" };

type Props = {
  /** The table's width and the height of its rows, page px */
  width: number;
  rowsHeight: number;
  /** Screen px per page px (the cells under it are drawn at this scale) */
  scale: number;
  shapes: readonly ShapeItem[];
  tool: TableTool;
  /** The shape the Shapes tool draws */
  shapeKind: string;
  ink: InkTools;
  /** How a new text box writes (the table's font and size, the exam's side) */
  textStyle: Partial<ShapeStyle>;
  selectedId: string | null;
  /** The shape whose text is being typed (on the table, in place) */
  editingId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: ShapePatch, key: string) => void;
  onAdd: (item: ShapeItem) => void;
  /** How the eraser rubs and how big it is */
  eraser: EraserSettings;
  /** The shapes rubbed out so far by one stroke of the stroke eraser (`gesture` names it: one step of the undo) */
  onErase: (ids: ReadonlySet<string>, gesture: string) => void;
  /** The real eraser went along `path` (page px of the table, `radius` around it): the drawings it touches are cut there */
  onEraseInk: (path: { x: number; y: number }[], radius: number, gesture: string) => void;
  onEdit: (id: string | null) => void;
};

// What is drawn over the cells of the Table Studio: the drawings and shapes of the table, where the page puts them (in page px of
// the table's box; the cells under it are drawn at the same scale), and the tools of the floating bar working on them: the brush,
// pencil and highlighter of the page, the shapes, text boxes and the eraser. With the Select tool it lets the mouse through to the
// cells, except over a shape (it is then picked, moved, turned…); with any other tool it takes the mouse everywhere on the table.
export default function TableDrawingLayer(props: Props) {
  const { width, rowsHeight, scale: s, shapes, tool, shapeKind, ink, eraser, textStyle, selectedId, editingId, onSelect, onChange, onAdd, onErase, onEraseInk, onEdit } = props;
  const stageRef = useRef<Konva.Stage>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const [over, setOver] = useState(false); // (the Select tool) the mouse is over a shape or a handle
  const [live, setLive] = useState<{ points: InkPoint[]; tool: InkTools["tool"]; color: string; size: number } | null>(null);
  const selecting = tool === "select";
  const lowest = Math.ceil(Math.max(0, ...shapes.map((sh) => sh.y + sh.h)));
  const height = Math.max(rowsHeight, lowest) + (selecting ? 0 : ROOM_BELOW);

  // With the Select tool, whether the mouse is over something of the drawing decides who gets it: the drawing or the cells.
  useEffect(() => {
    if (!selecting) return;
    const move = (e: PointerEvent) => {
      if (e.buttons) return; // (a drag goes on with whoever it started on)
      const stage = stageRef.current;
      if (!stage) return;
      const r = stage.container().getBoundingClientRect();
      let hit = false;
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        stage.setPointersPositions(e);
        const p = stage.getPointerPosition();
        hit = !!p && !!stage.getIntersection(p);
      }
      setOver(hit);
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [selecting]);

  // The pointer in page px of the table, kept on the drawing.
  const pointer = (e: PointerEvent) => {
    const stage = stageRef.current;
    stage?.setPointersPositions(e);
    const p = layerRef.current?.getRelativePointerPosition();
    return p ? { x: Math.min(Math.max(p.x, 0), width), y: Math.min(Math.max(p.y, 0), height) } : null;
  };

  // The brush, pencil or highlighter: the stroke follows the pointer, steadied as on the page (InkCapture), shown as it will be,
  // and becomes a shape of the table when let go (it stays in hand: a drawing is many strokes).
  const startInk = (e: PointerEvent) => {
    const hand = { tool: ink.tool, ...ink.settings[ink.tool] };
    const p0 = pointer(e);
    if (!p0) return;
    const capture = new InkCapture(p0.x, p0.y, hand.smoothing, s, e.timeStamp, e.pointerType === "pen" ? e.pressure : undefined);
    let frame = 0;
    const show = () => {
      frame = 0;
      setLive({ points: finishInk(capture.points, hand.tool, hand.smoothing), tool: hand.tool, color: hand.color, size: hand.size });
    };
    const follow = (ev: PointerEvent) => {
      const all = ev.getCoalescedEvents?.() ?? [];
      for (const c of all.length ? all : [ev]) {
        const p = pointer(c);
        if (p) capture.add(p.x, p.y, c.timeStamp, c.pointerType === "pen" ? c.pressure : undefined);
      }
      if (!frame) frame = requestAnimationFrame(show);
    };
    const release = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", follow);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      cancelAnimationFrame(frame);
      setLive(null);
      const p = pointer(ev);
      if (p) capture.end(p.x, p.y);
      const box = inkToShape(finishInk(capture.points, hand.tool, hand.smoothing), hand.size);
      // (made here, not by newShapeItem: a stroke's box is the stroke's, even thinner than the smallest shape)
      if (box) onAdd({ id: newShapeId(), shape: FREEHAND_ID, ink: hand.tool, stroke: hand.color, strokeWidth: hand.size, ...box });
    };
    window.addEventListener("pointermove", follow);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    show();
  };

  // The eraser: every drawing or shape it rubs goes, until it is let go (one step of the undo).
  const startErase = (e: PointerEvent) => {
    const gesture = `erase:${newShapeId()}`;
    const gone = new Set<string>();
    let last: { x: number; y: number } | null = null;
    const rub = (ev: PointerEvent) => {
      const stage = stageRef.current;
      if (!stage) return;
      stage.setPointersPositions(ev);
      const p = stage.getPointerPosition();
      if (!p) return;
      const from = last ?? p;
      last = p;
      if (eraser.mode === "partial") {
        // the real eraser: the way it went, in the table's page px (the stage is drawn `s` times bigger)
        onEraseInk([from, p].map((q) => ({ x: q.x / s, y: q.y / s })), eraser.size / 2 / s, gesture);
        return;
      }
      const before = gone.size;
      for (const q of eraserPoints(from, p, eraser.size / 2)) {
        const id = stage.getIntersection(q)?.findAncestor((n: Konva.Node) => n.id().startsWith("shape-"), true)?.id();
        if (id) gone.add(id.slice("shape-".length));
      }
      if (gone.size > before) onErase(new Set(gone), gesture);
    };
    const release = () => {
      window.removeEventListener("pointermove", rub);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
    window.addEventListener("pointermove", rub);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    rub(e);
  };

  const drawBox = (box: DrawnBox, style?: Partial<ShapeStyle>) => {
    if (tool === "textbox") onAdd(newShapeItem("rect", box, { ...textStyle, fill: null, stroke: null, text: "" }));
    else onAdd(newShapeItem(shapeKind, box, style));
  };

  const editing = shapes.find((sh) => sh.id === editingId);
  const cursor = tool === "eraser" ? eraserCursor(eraser.size) : selecting ? undefined : "crosshair";
  const box: CSSProperties = { width: width * s, height: height * s, cursor, pointerEvents: selecting && !over ? "none" : "auto" };

  return (
    <div
      dir="ltr"
      data-testid="table-drawing"
      className="relative"
      style={box}
      // The drawing is not the grid: the keys (Delete, the arrows…) go to the Studio, not to the cells.
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
        e.preventDefault();
        e.stopPropagation();
        (document.activeElement as HTMLElement | null)?.blur?.();
      }}
    >
      <Stage
        ref={stageRef}
        width={width * s}
        height={height * s}
        scaleX={s}
        scaleY={s}
        onPointerDown={(e) => {
          if (e.evt.button !== 0) return;
          if (tool === "draw") startInk(e.evt);
          else if (tool === "eraser") startErase(e.evt);
          else if (selecting && e.target === e.target.getStage()) onSelect(null);
        }}
      >
        <Layer ref={layerRef}>
          {/* the room under the rows where a drawing may go too (on the page the table gets taller) */}
          {!selecting && height > rowsHeight && (
            <Rect y={rowsHeight} width={width} height={height - rowsHeight} fill="rgba(79,70,229,0.03)" stroke="#c7d2fe" strokeWidth={1 / s} dash={[6 / s, 4 / s]} listening={false} />
          )}
          <StudioShapes
            // (the text being typed is shown by its box on the table, not twice)
            shapes={editing ? shapes.map((sh) => (sh.id === editing.id ? { ...sh, text: undefined } : sh)) : shapes}
            selectedId={selectedId}
            interactive={selecting}
            hittable={tool === "eraser" && eraser.mode === "stroke"}
            scale={s}
            onSelect={onSelect}
            onChange={onChange}
            onEdit={onEdit}
          />
          {(tool === "shape" || tool === "textbox") && (
            <ShapeDrawSurface width={width} height={height} shape={tool === "textbox" ? "rect" : shapeKind} style={tool === "textbox" ? TEXTBOX_FRAME : undefined} onDraw={drawBox} />
          )}
          {live && live.points.length > 0 && (
            <Group listening={false}>
              <InkStroke tool={live.tool} points={live.points} color={live.color} size={live.size} />
            </Group>
          )}
        </Layer>
      </Stage>

      {editing && <TextEditor key={editing.id} item={editing} scale={s} onChange={(text) => onChange(editing.id, { text }, `shape-text:${editing.id}`)} onDone={() => onEdit(null)} />}
    </div>
  );
}

// Typing the text of a shape (a text box just drawn, or a shape double-clicked) on the table, in its box, in its font.
function TextEditor({ item, scale: s, onChange, onDone }: { item: ShapeItem; scale: number; onChange: (text: string) => void; onDone: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  const size = (item.fontSize ?? DEFAULT_FONT_SIZE) * s;
  return (
    <textarea
      ref={ref}
      data-testid="shape-text-editor"
      dir="auto"
      defaultValue={item.text ?? ""}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onDone}
      onKeyDown={(e) => {
        e.stopPropagation(); // (the keys are the text's: not the Studio's shortcuts)
        if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
          e.preventDefault();
          ref.current?.blur();
        }
      }}
      className="absolute resize-none overflow-hidden rounded-sm border border-dashed bg-white/85 p-0 outline-none"
      style={{
        left: item.x * s,
        top: item.y * s,
        width: item.w * s,
        height: item.h * s,
        transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
        borderColor: ACCENT,
        fontFamily: item.fontFamily ? fontStack(item.fontFamily) : SHAPE_FONT,
        fontSize: size,
        lineHeight: 1.2,
        fontWeight: item.bold ? 700 : 400,
        fontStyle: item.italic ? "italic" : "normal",
        color: item.textColor ?? DEFAULT_TEXT_COLOR,
        textAlign: item.textAlign ?? "center",
        pointerEvents: "auto",
      }}
    />
  );
}
