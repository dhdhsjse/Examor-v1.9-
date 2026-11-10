"use client";

import { useMemo, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { layoutTable } from "@/app/_lib/blockLayout";
import { anchorOf, clearRange, colsOf, isFixedTable, rowsOf, setStyle, wholeMerges } from "@/app/_lib/table";
import { useT } from "@/app/_lib/uiLang";
import { TABLE_MIN_COL, TABLE_MIN_ROW } from "@/app/_lib/blockLayout";
import { cutSpots, magnet } from "@/app/_lib/table/equal";
import { SNAP, cellAtPoint, cutTable, edgeAt, eraseEdge, hiddenEdges, planCut, stops, type Cell, type CutPlan, type EdgeHit, type Frame, type LineAxis, type Pt, type Stroke } from "@/app/_lib/table/draw";
import { pageAt, type PageBox } from "@/app/_lib/pageStack";
import type { Block, ExamMeta, TableBlock } from "@/app/_lib/types";
import type { BlockPatch } from "@/app/_lib/useExam";
import type { DrawnBox } from "../canvas/ExamCanvas";
import { cellSel, clampSel, rangeSel, selRange } from "../table/tableSel";
import { setTableSel, useTableSel } from "../table/tableSelStore";
import { useTableGuide } from "../table/tableGuideStore";
import { copyTableCells, pasteTableCells } from "../table/tableClipboard";

// What a press on a table does while the table tools are in hand (the floating bar of the tables, TableDrawBar):
// "draw" = the pen: a drag on the paper draws a new table (a box), a drag on a table draws a line across it (horizontal or vertical, the way the
// mouse went); "erase" = a click on a line rubs it out; "cells" = a drag selects cells (the right panel, Merge and Split work on them), a
// double-click types in a cell; "fill" = the bucket: a click colors the cell under it, a drag every cell it goes over.
export type TableDrawMode = "draw" | "erase" | "cells" | "fill";

const ACCENT = "var(--color-accent)";
const ERASE = "#ef4444";
/** A smaller box is taken for a click */
const MIN_BOX = { width: 40, height: 28 };

/** A table the tools can change: not fixed like a picture (shapes over it), not turned, not in a text box */
export function isDrawable(b: Block | undefined, blocks: Block[]): b is TableBlock {
  if (!b || b.type !== "table" || isFixedTable(b) || b.layout.rotation) return false;
  return !(b.meta?.slot && blocks.some((o) => o.id === b.meta?.slot));
}

/** A table on the canvas: where its box is (px of the canvas), the side its first column is on, and its sizes as drawn */
export interface TableGeo {
  b: TableBlock;
  left: number;
  top: number;
  w: number;
  h: number;
  mirror: boolean;
  frame: Frame;
}

export function tableGeo(b: TableBlock, boxes: PageBox[], pageIndex: number, meta: ExamMeta): TableGeo {
  const L = layoutTable(b, meta);
  const box = boxes[pageIndex] ?? boxes[0];
  return { b, left: box.left + b.layout.x, top: box.top + b.layout.y, w: b.layout.width, h: L.height, mirror: L.mirror, frame: { colW: L.colW, rowH: L.rows.map((r) => r.height) } };
}

const toLocal = (g: TableGeo, x: number, y: number): Pt => ({ u: g.mirror ? g.w - (x - g.left) : x - g.left, y: y - g.top });
const toX = (g: TableGeo, u: number) => g.left + (g.mirror ? g.w - u : u);

/** A line of the table (axis, across, from, to) as the canvas's [x1, y1, x2, y2] */
function lineXY(g: TableGeo, axis: LineAxis, at: number, from: number, to: number): [number, number, number, number] {
  return axis === "h" ? [toX(g, from), g.top + at, toX(g, to), g.top + at] : [toX(g, at), g.top + from, toX(g, at), g.top + to];
}

type Drag =
  | { kind: "box"; page: number; x0: number; y0: number; x1: number; y1: number }
  | { kind: "line"; id: string; start: Pt; end: Pt }
  | { kind: "erase"; id: string; table: TableBlock; patch: BlockPatch | null; lines: [number, number, number, number][] }
  | { kind: "cells"; id: string; anchor: { r: number; c: number } }
  | { kind: "fill"; id: string; cells: Cell[] };

let counter = 0;
const nextKey = (name: string) => `${name}:${++counter}`;

// The line a drag of the pen on a table draws, along the way the mouse went (a click draws nothing)
function strokeOf(start: Pt, end: Pt): Stroke | null {
  const du = end.u - start.u;
  const dy = end.y - start.y;
  if (Math.hypot(du, dy) < 4) return null;
  return Math.abs(du) >= Math.abs(dy) ? { axis: "h", at: start.y, from: start.u, to: end.u } : { axis: "v", at: start.u, from: start.y, to: end.y };
}

// The magnet (_lib/table/equal): a new line close to where it would give a row (column) the size of another one, or cut it in two equal
// halves, goes there. Not on a line of the grid already (planCut puts it on that line), nor with Alt held.
function equalize(g: TableGeo, s: Stroke | null, free = false, zoom = 1): { s: Stroke | null; marks: [number, number][] } {
  if (!s || free) return { s, marks: [] };
  const sizes = s.axis === "h" ? g.frame.rowH : g.frame.colW;
  const P = stops(sizes);
  if (P.some((p) => Math.abs(p - s.at) <= SNAP)) return { s, marks: [] };
  const i = P.findIndex((p, k) => k > 0 && s.at < p) - 1;
  if (i < 0) return { s, marks: [] };
  const spot = magnet(s.at, cutSpots(sizes, i, s.axis === "h" ? TABLE_MIN_ROW : TABLE_MIN_COL), 6 / Math.max(0.1, zoom));
  return { s: { ...s, at: spot.at }, marks: spot.marks };
}

// A point of the table moved onto the line of the grid near it (within SNAP), for the dot that shows where a line would start
function snapPoint(f: Frame, p: Pt): Pt {
  const near = (v: number, P: number[]) => P.reduce((best, x) => (Math.abs(x - v) < Math.abs(best - v) ? x : best), Infinity);
  const X = stops(f.colW);
  const Y = stops(f.rowH);
  const u = near(p.u, X);
  const y = near(p.y, Y);
  return { u: Math.abs(u - p.u) <= SNAP ? u : p.u, y: Math.abs(y - p.y) <= SNAP ? y : p.y };
}

interface Props {
  blocks: Block[];
  meta: ExamMeta;
  /** The id of each page, in order (a block's page is found by it) */
  pageIds: string[];
  boxes: PageBox[];
  zoom: number;
  width: number;
  height: number;
  /** null: the tools are not in hand (only the selected cells of the selected table are shown) */
  mode: TableDrawMode | null;
  /** The color of the bucket (undefined: it takes the fill off) */
  fill: string | undefined;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onPatch: (id: string, patch: BlockPatch, key: string) => void;
  /** A box drawn on the paper with the pen: a new table of one cell */
  onCreate: (box: DrawnBox) => void;
  /** A click on the paper away from the tables: the tools are put down */
  onExit: () => void;
  onEditCell: (id: string, r: number, c: number) => void;
  /** Something to tell (the table cannot take another line) */
  onMessage: (message: string) => void;
}

// Over the pages, while the table tools are in hand: draws what a press would do (the line a drag would draw, the line a click would rub out)
// and turns the mouse into the operations of _lib/table/draw. Every change is one block update, so one step of the exam's undo.
export default function TableDrawLayer({ blocks, meta, pageIds, boxes, zoom, width, height, mode, fill, selectedId, onSelect, onPatch, onCreate, onExit, onEditCell, onMessage }: Props) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const guide = useTableGuide(); // a line of the selected table dragged on the page (TableHandles)
  const [free, setFree] = useState(false); // Alt held: lines go exactly where they are put (no magnet)
  const pointer = useRef<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [picked] = useTableSel(selectedId ?? undefined);
  const selected = blocks.find((b) => b.id === selectedId);
  const sel = selected?.type === "table" ? clampSel(picked, rowsOf(selected), colsOf(selected)) : null;

  const geos = useMemo(() => {
    const out: TableGeo[] = [];
    for (const b of blocks) {
      const page = pageIds.indexOf(b.layout.pageId);
      if (page >= 0 && isDrawable(b, blocks)) out.push(tableGeo(b, boxes, page, meta));
    }
    return out.sort((a, b) => Number(!!b.b.behind) - Number(!!a.b.behind) || (a.b.layout.z ?? 0) - (b.b.layout.z ?? 0));
  }, [blocks, pageIds, boxes, meta]);
  const guides = useMemo(() => new Map(geos.map((g) => [g.b.id, hiddenEdges(g.b, g.frame)])), [geos]);
  const byId = (id: string) => geos.find((g) => g.b.id === id);
  // the table under a point (the one on top), with a few px around its outline
  const tableAt = (x: number, y: number, tol = 6) => [...geos].reverse().find((g) => x >= g.left - tol && x <= g.left + g.w + tol && y >= g.top - tol && y <= g.top + g.h + tol);

  // the cell under a point of the table (a point just outside its outline: the cell next to it)
  const cellUnder = (g: TableGeo, p: Pt) => cellAtPoint(g.b, g.frame, { u: Math.max(0, Math.min(g.w - 0.5, p.u)), y: Math.max(0, Math.min(g.h - 0.5, p.y)) });

  const pointOf = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  };

  // Keys belong to the focused worksheet layer, never to a panel input or an open Studio.
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (drag) cancel();
      else onExit();
      return;
    }
    if (drag && (e.ctrlKey || e.metaKey) && ["z", "y"].includes(e.key.toLowerCase())) cancel();
    if (mode !== "cells") return;
    const g = selectedId ? byId(selectedId) : undefined;
    if (!g) return;
    const handled = () => { e.preventDefault(); e.stopPropagation(); };
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
      handled();
      setTableSel(g.b.id, rangeSel({ r0: 0, c0: 0, r1: rowsOf(g.b) - 1, c1: colsOf(g.b) - 1 }));
    } else if (e.key === "Delete" || e.key === "Backspace") {
      handled();
      if (!sel) return;
      const patch = clearRange(g.b, wholeMerges(g.b, selRange(sel)));
      if (patch) onPatch(g.b.id, patch as BlockPatch, nextKey("table-clear"));
    } else if (sel && e.key === "Enter") {
      handled();
      const p = anchorOf(g.b, sel.focus.r, sel.focus.c);
      onEditCell(g.b.id, p.r, p.c);
    } else if (sel && e.key.startsWith("Arrow")) {
      handled();
      const current = wholeMerges(g.b, selRange(cellSel(sel.focus.r, sel.focus.c)));
      const left = g.mirror ? "ArrowRight" : "ArrowLeft";
      const right = g.mirror ? "ArrowLeft" : "ArrowRight";
      const r = e.key === "ArrowUp" ? current.r0 - 1 : e.key === "ArrowDown" ? current.r1 + 1 : sel.focus.r;
      const c = e.key === left ? current.c0 - 1 : e.key === right ? current.c1 + 1 : sel.focus.c;
      const next = anchorOf(g.b, Math.max(0, Math.min(rowsOf(g.b) - 1, r)), Math.max(0, Math.min(colsOf(g.b) - 1, c)));
      setTableSel(g.b.id, { anchor: e.shiftKey ? sel.anchor : next, focus: next });
    }
  };

  const clipboard = (e: ReactClipboardEvent, action: "copy" | "cut" | "paste") => {
    if (mode !== "cells") return;
    e.preventDefault();
    e.stopPropagation();
    const g = selectedId ? byId(selectedId) : undefined;
    if (!g || !sel) return;
    const range = wholeMerges(g.b, selRange(sel));
    if (action === "paste") {
      const out = pasteTableCells(g.b, { r: range.r0, c: range.c0 }, e.clipboardData.getData("text/plain"));
      if (!out) return;
      onPatch(g.b.id, out.patch as BlockPatch, nextKey("table-paste"));
      setTableSel(g.b.id, rangeSel(out.range));
    } else {
      e.clipboardData.setData("text/plain", copyTableCells(g.b, range, meta.lang));
      if (action === "cut") {
        const patch = clearRange(g.b, range);
        if (patch) onPatch(g.b.id, patch as BlockPatch, nextKey("table-cut"));
      }
    }
  };

  // An eraser gesture is previewed, then committed once on release. Escape/cancel changes nothing.
  const erase = (g: TableGeo, p: Pt, d: Extract<Drag, { kind: "erase" }>) => {
    g = { ...g, b: d.table };
    const hit = edgeAt(g.b, g.frame, p, 6 / Math.min(1, zoom));
    if (!hit) return d;
    const out = eraseEdge(g.b, g.frame, hit);
    if (!out) return d;
    const at = stops(hit.axis === "h" ? g.frame.rowH : g.frame.colW)[hit.k];
    return { ...d, table: { ...g.b, ...out.patch }, patch: out.patch as BlockPatch, lines: [...d.lines, lineXY(g, hit.axis, at, hit.from, hit.to)] };
  };

  const down = (e: ReactPointerEvent) => {
    if (!mode || e.button !== 0 || !e.isPrimary || pointer.current !== null) return;
    e.preventDefault();
    ref.current?.focus({ preventScroll: true });
    const { x, y } = pointOf(e);
    const g = tableAt(x, y);
    if (g) {
      if (g.b.id !== selectedId) onSelect(g.b.id);
      const p = toLocal(g, x, y);
      if (mode === "erase") {
        const d: Drag = { kind: "erase", id: g.b.id, table: g.b, patch: null, lines: [] };
        setDrag(erase(g, p, d));
      } else if (mode === "cells") {
        const cell = cellUnder(g, p);
        if (!cell) return;
        const anchor = e.shiftKey && g.b.id === selectedId && sel ? sel.anchor : { r: cell.r, c: cell.c };
        setTableSel(g.b.id, { anchor, focus: { r: cell.r, c: cell.c } });
        setDrag({ kind: "cells", id: g.b.id, anchor });
      } else if (mode === "fill") {
        const cell = cellUnder(g, p);
        if (!cell) return;
        setDrag({ kind: "fill", id: g.b.id, cells: [cell] });
      } else {
        const start = snapPoint(g.frame, p);
        setDrag({ kind: "line", id: g.b.id, start, end: start });
      }
    } else if (mode === "draw") {
      const page = pageAt(y, boxes);
      const box = boxes[page];
      if (!box || x < box.left || x > box.left + box.width || y < box.top || y > box.top + box.height) return void exitAway();
      setDrag({ kind: "box", page, x0: x, y0: y, x1: x, y1: y });
    } else return void exitAway();
    pointer.current = e.pointerId;
    ref.current?.setPointerCapture(e.pointerId);
  };

  const exitAway = () => {
    onSelect(null);
    onExit();
  };

  const move = (e: ReactPointerEvent) => {
    if (e.altKey !== free) setFree(e.altKey);
    if (!mode || (pointer.current !== null && pointer.current !== e.pointerId)) return;
    const { x, y } = pointOf(e);
    setHover({ x, y });
    if (!drag) return;
    if (drag.kind === "box") {
      const box = boxes[drag.page];
      setDrag({ ...drag, x1: Math.max(box.left, Math.min(box.left + box.width, x)), y1: Math.max(box.top, Math.min(box.top + box.height, y)) });
    } else if (drag.kind === "line") {
      const g = byId(drag.id);
      if (g) setDrag({ ...drag, end: toLocal(g, x, y) });
    } else if (drag.kind === "erase") {
      const g = byId(drag.id);
      if (g) setDrag(erase(g, toLocal(g, x, y), drag));
    } else if (drag.kind === "cells") {
      const g = byId(drag.id);
      if (!g) return;
      const cell = cellUnder(g, toLocal(g, x, y));
      if (cell) setTableSel(g.b.id, { anchor: drag.anchor, focus: { r: cell.r + cell.rs - 1 >= drag.anchor.r ? cell.r + cell.rs - 1 : cell.r, c: cell.c + cell.cs - 1 >= drag.anchor.c ? cell.c + cell.cs - 1 : cell.c } });
    } else if (drag.kind === "fill") {
      const g = byId(drag.id);
      const cell = g && cellUnder(g, toLocal(g, x, y));
      if (cell && !drag.cells.some((c) => c.r === cell.r && c.c === cell.c)) setDrag({ ...drag, cells: [...drag.cells, cell] });
    }
  };

  const up = (e: ReactPointerEvent) => {
    if (pointer.current !== e.pointerId) return;
    const d = drag;
    setDrag(null);
    pointer.current = null;
    if (ref.current?.hasPointerCapture(e.pointerId)) ref.current.releasePointerCapture(e.pointerId);
    if (!d) return;
    if (d.kind === "box") {
      const box = boxes[d.page];
      const p = pointOf(e);
      const x1 = Math.max(box.left, Math.min(box.left + box.width, p.x));
      const y1 = Math.max(box.top, Math.min(box.top + box.height, p.y));
      const w = Math.abs(x1 - d.x0);
      const h = Math.abs(y1 - d.y0);
      if (w < MIN_BOX.width || h < MIN_BOX.height) return;
      onCreate({ pageIndex: d.page, x: Math.min(d.x0, x1) - box.left, y: Math.min(d.y0, y1) - box.top, width: Math.round(w), height: Math.round(h) });
    } else if (d.kind === "line") {
      const g = byId(d.id);
      const p = pointOf(e);
      const s = g && equalize(g, strokeOf(d.start, toLocal(g, p.x, p.y)), e.altKey, zoom).s;
      if (!g || !s) return;
      const plan = planCut(g.b, g.frame, s);
      if (plan?.full) return onMessage("The table already has as many rows or columns as it can have");
      const out = cutTable(g.b, g.frame, s);
      if (out) {
        onPatch(g.b.id, out.patch as BlockPatch, nextKey("table-line"));
        setTableSel(g.b.id, null);
      }
    } else if (d.kind === "erase" && d.patch) {
      onPatch(d.id, d.patch, nextKey("table-erase"));
      setTableSel(d.id, null);
    } else if (d.kind === "fill") {
      // (previewed while dragging, then one change: one step of the undo, and Esc changes nothing)
      const g = byId(d.id);
      if (!g) return;
      let table = g.b;
      let changed = false;
      for (const c of d.cells) {
        const patch = setStyle(table, { r0: c.r, c0: c.c, r1: c.r + c.rs - 1, c1: c.c + c.cs - 1 }, { fill });
        if (patch) {
          table = { ...table, ...patch };
          changed = true;
        }
      }
      if (changed) onPatch(d.id, { cellStyles: table.cellStyles } as BlockPatch, nextKey("table-fill"));
      setTableSel(d.id, null);
    }
  };

  const cancel = () => {
    const id = pointer.current;
    pointer.current = null;
    setDrag(null);
    if (id !== null && ref.current?.hasPointerCapture(id)) ref.current.releasePointerCapture(id);
  };

  const dbl = (e: React.MouseEvent) => {
    if (mode !== "cells" && mode !== "draw") return;
    const { x, y } = pointOf(e);
    const g = tableAt(x, y, 0);
    if (!g) return;
    const cell = cellAtPoint(g.b, g.frame, toLocal(g, x, y));
    if (cell) onEditCell(g.b.id, cell.r, cell.c);
  };

  // ---- what is drawn ----

  const k = 1 / zoom; // (lines and dots keep their size on the screen)
  const lines: React.ReactNode[] = [];

  // the lines that are not drawn, dotted, so the cells can be seen (only while the tools are in hand)
  if (mode)
    for (const g of geos) {
      lines.push(<rect key={`o${g.b.id}`} x={g.left} y={g.top} width={g.w} height={g.h} fill="none" stroke={ACCENT} strokeOpacity={g.b.id === selectedId ? 0.35 : 0.18} strokeWidth={k} strokeDasharray={`${4 * k} ${3 * k}`} />);
      guides.get(g.b.id)?.forEach(([axis, at, from, to], i) => {
        const [x1, y1, x2, y2] = lineXY(g, axis, at, from, to);
        lines.push(<line key={`h${g.b.id}-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-faint)" strokeWidth={k} strokeDasharray={`${1.5 * k} ${2.5 * k}`} />);
      });
    }

  // the selected cells
  const selGeo = selectedId ? geos.find((g) => g.b.id === selectedId) : undefined;
  if (selGeo && sel) {
    const g = wholeMerges(selGeo.b, selRange(sel));
    const X = stops(selGeo.frame.colW);
    const Y = stops(selGeo.frame.rowH);
    const xa = toX(selGeo, X[g.c0]);
    const xb = toX(selGeo, X[Math.min(g.c1 + 1, X.length - 1)]);
    lines.push(
      <rect key="sel" data-testid="table-cell-selection" x={Math.min(xa, xb)} y={selGeo.top + Y[g.r0]} width={Math.abs(xb - xa)} height={Y[Math.min(g.r1 + 1, Y.length - 1)] - Y[g.r0]} fill={ACCENT} fillOpacity={0.1} stroke={ACCENT} strokeWidth={2 * k} />,
    );
  }

  // "=" on the rows (columns) of the same size the magnet gives: before the rows, above the columns
  const showMarks = (g: TableGeo, axis: LineAxis, marks: [number, number][]) =>
    marks.forEach(([a, b], i) => {
      const m = (a + b) / 2;
      const [x, y] = axis === "h" ? [g.left - 9 * k, g.top + m] : [toX(g, m), g.top - 9 * k];
      for (const d of [-1.6, 1.6]) lines.push(<line key={`eq${i}${d}`} data-testid="table-equal-mark" x1={x - 3.5 * k} y1={y + d * k} x2={x + 3.5 * k} y2={y + d * k} stroke={ACCENT} strokeWidth={1.4 * k} />);
    });
  // the line dragged by its handle, and the "=" of the rows (columns) of the same size
  const guideGeo = guide && geos.find((g) => g.b.id === guide.id);
  if (guide && guideGeo) {
    const g = guideGeo;
    const [x1, y1, x2, y2] = guide.vertical ? [g.left + guide.at, g.top, g.left + guide.at, g.top + g.h] : [g.left, g.top + guide.at, g.left + g.w, g.top + guide.at];
    lines.push(<line key="guide" data-testid="table-drag-guide" x1={x1} y1={y1} x2={x2} y2={y2} stroke={ACCENT} strokeWidth={2 * k} />);
    guide.marks.forEach(([a, b], i) => {
      const m = (a + b) / 2;
      const [x, y] = guide.vertical ? [g.left + m, g.top - 9 * k] : [g.left - 9 * k, g.top + m];
      for (const d of [-1.6, 1.6]) lines.push(<line key={`geq${i}${d}`} data-testid="table-equal-mark" x1={x - 3.5 * k} y1={y + d * k} x2={x + 3.5 * k} y2={y + d * k} stroke={ACCENT} strokeWidth={1.4 * k} />);
    });
  }
  // a cell the bucket would color
  const paintCell = (key: string, g: TableGeo, c: Cell, opacity: number) => {
    const X = stops(g.frame.colW);
    const Y = stops(g.frame.rowH);
    const xa = toX(g, X[c.c]);
    const xb = toX(g, X[c.c + c.cs]);
    lines.push(<rect key={key} data-testid="table-fill-preview" x={Math.min(xa, xb)} y={g.top + Y[c.r]} width={Math.abs(xb - xa)} height={Y[c.r + c.rs] - Y[c.r]} fill={fill ?? "#ffffff"} fillOpacity={opacity} stroke={ACCENT} strokeWidth={1.5 * k} />);
  };
  const dot = (key: string, x: number, y: number, color = ACCENT) => <circle key={key} cx={x} cy={y} r={3.5 * k} fill={color} stroke="white" strokeWidth={k} />;
  const showPlan = (g: TableGeo, plan: CutPlan | null, s: Stroke) => {
    const bad = !plan || plan.full;
    // the stroke as drawn, and where it starts
    const [sx1, sy1, sx2, sy2] = lineXY(g, s.axis, s.at, s.from, s.to);
    lines.push(<line key="raw" x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke={bad ? ERASE : ACCENT} strokeOpacity={0.45} strokeWidth={1.5 * k} strokeDasharray={`${5 * k} ${4 * k}`} />);
    lines.push(dot("start", sx1, sy1, bad ? ERASE : ACCENT));
    if (!plan || plan.full) return;
    // the line the table will get: across the whole of each cell it cuts
    plan.segments.forEach(([a, b], i) => {
      const [x1, y1, x2, y2] = lineXY(g, plan.axis, plan.at, a, b);
      lines.push(<line key={`p${i}`} data-testid="table-line-preview" x1={x1} y1={y1} x2={x2} y2={y2} stroke={ACCENT} strokeWidth={2 * k} strokeLinecap="round" />);
    });
  };

  if (drag?.kind === "fill") {
    const g = geos.find((x) => x.b.id === drag.id);
    if (g) drag.cells.forEach((c) => paintCell(`fill-${c.r}-${c.c}`, g, c, 0.75));
  } else if (drag?.kind === "erase") {
    drag.lines.forEach(([x1, y1, x2, y2], i) => lines.push(<line key={`rub-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ERASE} strokeWidth={3 * k} strokeLinecap="round" />));
  } else if (drag?.kind === "box") {
    const x = Math.min(drag.x0, drag.x1);
    const y = Math.min(drag.y0, drag.y1);
    lines.push(<rect key="box" data-testid="table-box-preview" x={x} y={y} width={Math.abs(drag.x1 - drag.x0)} height={Math.abs(drag.y1 - drag.y0)} fill={ACCENT} fillOpacity={0.04} stroke={ACCENT} strokeWidth={2 * k} />);
    lines.push(dot("b0", drag.x0, drag.y0), dot("b1", drag.x1, drag.y1));
  } else if (drag?.kind === "line") {
    const g = geos.find((x) => x.b.id === drag.id);
    const eq = g && equalize(g, strokeOf(drag.start, drag.end), free, zoom);
    if (g && eq?.s) {
      showPlan(g, planCut(g.b, g.frame, eq.s), eq.s);
      showMarks(g, eq.s.axis, eq.marks);
    }
  } else if (!drag && hover && mode) {
    const g = tableAt(hover.x, hover.y, mode === "erase" ? 6 : 0);
    if (g) {
      const p = toLocal(g, hover.x, hover.y);
      if (mode === "fill") {
        const cell = cellUnder(g, p);
        if (cell) paintCell("fill-hover", g, cell, 0.45);
      } else if (mode === "erase") {
        const hit: EdgeHit | null = edgeAt(g.b, g.frame, p, 6 / Math.min(1, zoom));
        if (hit) {
          const [x1, y1, x2, y2] = lineXY(g, hit.axis, (hit.axis === "h" ? stops(g.frame.rowH) : stops(g.frame.colW))[hit.k], hit.from, hit.to);
          lines.push(<line key="erase" data-testid="table-erase-preview" x1={x1} y1={y1} x2={x2} y2={y2} stroke={ERASE} strokeWidth={3 * k} strokeLinecap="round" />);
        }
      } else if (mode === "draw") {
        const q = snapPoint(g.frame, p);
        lines.push(dot("hover", toX(g, q.u), g.top + q.y));
      }
    }
  }

  const cursor = !mode ? undefined : mode === "erase" || mode === "fill" ? "pointer" : mode === "cells" ? "cell" : "crosshair";
  return (
    <div
      ref={ref}
      data-testid="table-draw-layer"
      data-table-grid={mode === "cells" ? "worksheet" : undefined}
      tabIndex={mode ? 0 : -1}
      aria-label={t("Table drawing area")}
      className={`absolute inset-0 z-20 outline-none ${mode ? "focus-visible:ring-2 focus-visible:ring-accent" : "pointer-events-none"}`}
      style={{ cursor, touchAction: mode ? "none" : undefined }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={dbl}
      onKeyDown={onKey}
      onCopy={(e) => clipboard(e, "copy")}
      onCut={(e) => clipboard(e, "cut")}
      onPaste={(e) => clipboard(e, "paste")}
    >
      <svg width={width} height={height} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
        {lines}
      </svg>
    </div>
  );
}
