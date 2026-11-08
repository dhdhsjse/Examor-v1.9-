// Drawing a table on the page (Insert → Draw a table): a box drawn on the paper is a table of one cell, and straight lines drawn across it
// cut its cells; a line is rubbed out, cells are merged and split. Every cell stays a rectangle of the table's grid (a merged cell for what
// spans several of its rows or columns), so a drawn table is an ordinary table: the right panel and the Table Studio change it like any
// other. A line drawn part of the way across a cell cuts the whole cell (a cell is never an L).
//
// Pure functions on the table's data and its sizes in px. The sizes are in the table's own order: `u` is the distance from the side of its
// first column (the left, or the right of a table that reads right to left), `y` from its top. The page's layer (workspace/TableDrawLayer)
// turns the mouse into these calls.
import { TABLE_MIN_COL, TABLE_MIN_ROW } from "@/app/_lib/blockLayout";
import { EDGE_FIELDS, colsOf, hEdgeShown, mergeAt, rowsOf, styleAt, vEdgeShown, type TableCellStyle, type TableData, type TableMerge } from "./model";
import { insertLines, mergeCells, wholeMerges, type TablePatch } from "./ops";
import { MAX_COLS, MAX_ROWS, clampRange, keyOf, type CellRange } from "./refs";

/** The sizes of a table as it is drawn: the width of each column and the height of each row, in px, in the table's own order */
export interface Frame {
  colW: number[];
  rowH: number[];
}

/** "h": a horizontal line (it cuts rows), "v": a vertical one (it cuts columns) */
export type LineAxis = "h" | "v";

/**
 * A straight line drawn on a table. "h": at y = `at`, from u = `from` to u = `to`; "v": at u = `at`, from y = `from` to y = `to`.
 * `from === to` (a click): the one cell there.
 */
export interface Stroke {
  axis: LineAxis;
  at: number;
  from: number;
  to: number;
}

export type Pt = { u: number; y: number };

/** A cell of the table (a merged one once): its top-left grid cell and how many rows and columns it covers */
export interface Cell {
  r: number;
  c: number;
  rs: number;
  cs: number;
}

export interface Rect {
  u0: number;
  u1: number;
  y0: number;
  y1: number;
}

/** How far (px) a line goes to a line of the grid that is already there */
export const SNAP = 8;

/** Where each line of the grid is: 0, then the end of each size */
export function stops(sizes: number[]): number[] {
  const out = [0];
  for (const s of sizes) out.push(out[out.length - 1] + s);
  return out;
}

/** Every cell of the table, a merged one once (by its top-left grid cell), row by row */
export function cellsOf(t: TableData): Cell[] {
  const out: Cell[] = [];
  for (let r = 0; r < rowsOf(t); r++)
    for (let c = 0; c < colsOf(t); c++) {
      const m = mergeAt(t, r, c);
      if (!m) out.push({ r, c, rs: 1, cs: 1 });
      else if (m.r === r && m.c === c) out.push({ r, c, rs: m.rs, cs: m.cs });
    }
  return out;
}

export function cellRect(f: Frame, cell: Cell): Rect {
  const X = stops(f.colW);
  const Y = stops(f.rowH);
  return { u0: X[cell.c], u1: X[Math.min(cell.c + cell.cs, f.colW.length)], y0: Y[cell.r], y1: Y[Math.min(cell.r + cell.rs, f.rowH.length)] };
}

export const cellRange = (cell: Cell): CellRange => ({ r0: cell.r, c0: cell.c, r1: cell.r + cell.rs - 1, c1: cell.c + cell.cs - 1 });

/** The cell under a point of the table (null outside it) */
export function cellAtPoint(t: TableData, f: Frame, p: Pt): Cell | null {
  const X = stops(f.colW);
  const Y = stops(f.rowH);
  if (p.u < 0 || p.y < 0 || p.u > X[X.length - 1] || p.y > Y[Y.length - 1]) return null;
  const c = Math.max(0, Math.min(f.colW.length - 1, X.findIndex((x, i) => i > 0 && p.u <= x) - 1));
  const r = Math.max(0, Math.min(f.rowH.length - 1, Y.findIndex((y, i) => i > 0 && p.y <= y) - 1));
  const m = mergeAt(t, r, c);
  return m ? { r: m.r, c: m.c, rs: m.rs, cs: m.cs } : { r, c, rs: 1, cs: 1 };
}

/** The sizes of a new table drawn as a box on the page: one cell, as big as the box */
export const drawnTablePreset = (width: number, height: number) => ({
  cells: [[""]],
  header: false,
  colWidths: [width],
  rowHeights: [height],
  width,
  height,
});

// ---- the axis of a line, in one way of writing ----

// A horizontal line cuts rows: its "across" lines are the rows, its "along" ones the columns. A vertical line is the other way round.
const across = (f: Frame, axis: LineAxis) => (axis === "h" ? f.rowH : f.colW);
const along = (f: Frame, axis: LineAxis) => (axis === "h" ? f.colW : f.rowH);
const startOf = (cell: Cell, axis: LineAxis) => (axis === "h" ? cell.r : cell.c);
const spanOf = (cell: Cell, axis: LineAxis) => (axis === "h" ? cell.rs : cell.cs);
const alongStart = (cell: Cell, axis: LineAxis) => (axis === "h" ? cell.c : cell.r);
const alongSpan = (cell: Cell, axis: LineAxis) => (axis === "h" ? cell.cs : cell.rs);
const minSize = (axis: LineAxis) => (axis === "h" ? TABLE_MIN_ROW : TABLE_MIN_COL);

// ---- cutting ----

/** What a line drawn on a table does: where it goes once snapped, the cells it cuts, and the pieces of line the table gets */
export interface CutPlan {
  axis: LineAxis;
  /** Where the line goes (px across), once snapped to a line of the grid or kept off the edges of its row (column) */
  at: number;
  /** The line of the grid it is on, or null: a new one, that splits the grid's row (column) `split` */
  line: number | null;
  split: number | null;
  /** The cells it cuts in two */
  cells: Cell[];
  /** The pieces of the line (px along): one per cell it cuts, and the hidden pieces of a line of the grid it goes over (they are drawn again) */
  segments: [number, number][];
  /** On a line of the grid: the grid cells along it whose piece of line is hidden and is drawn again */
  reveal: number[];
  /** The table has as many rows (columns) as it can have: the line cannot be drawn */
  full: boolean;
}

/** What a line drawn on a table would do (null: it cuts no cell, e.g. drawn on a line that is already there or outside the table) */
export function planCut(t: TableData, f: Frame, s: Stroke, snap = SNAP): CutPlan | null {
  const sizes = across(f, s.axis);
  const P = stops(sizes);
  const n = sizes.length;
  const end = P[n];
  if (![s.at, s.from, s.to].every(Number.isFinite) || s.at < 0 || s.at > end) return null;
  let at = s.at;
  let line: number | null = null;
  let split: number | null = null;
  let best = snap + 1;
  for (let k = 1; k < n; k++) {
    const d = Math.abs(P[k] - s.at);
    if (d <= snap && d < best) {
      best = d;
      line = k;
    }
  }
  // An erased outside border can be drawn back, too.
  if (s.at === 0 || s.at === end) line = s.at === 0 ? 0 : n;
  if (line !== null) at = P[line];
  else {
    const i = Math.max(0, P.findIndex((p, k) => k > 0 && s.at < p) - 1);
    const lo = P[i] + minSize(s.axis);
    const hi = P[i + 1] - minSize(s.axis);
    if (lo <= hi) {
      at = Math.max(lo, Math.min(hi, s.at));
      split = i;
    } else {
      // (the row is too small to be cut: the line goes to the nearest of its edges inside the table, if any)
      const inner = [i, i + 1].filter((k) => k > 0 && k < n).sort((a, b) => Math.abs(P[a] - s.at) - Math.abs(P[b] - s.at));
      if (!inner.length) return null;
      line = inner[0];
      at = P[line];
    }
  }
  const A = stops(along(f, s.axis));
  const lo = Math.min(s.from, s.to);
  const hi = Math.max(s.from, s.to);
  const click = hi - lo < 1;
  const cells = cellsOf(t).filter((cell) => {
    const a0 = P[startOf(cell, s.axis)];
    const a1 = P[startOf(cell, s.axis) + spanOf(cell, s.axis)];
    if (!(a0 < at - 0.5 && a1 > at + 0.5)) return false; // (the line does not go through it)
    const b0 = A[alongStart(cell, s.axis)];
    const b1 = A[alongStart(cell, s.axis) + alongSpan(cell, s.axis)];
    if (click) return lo >= b0 && (lo < b1 || (b1 === A[A.length - 1] && lo === b1));
    return Math.min(b1, hi) - Math.max(b0, lo) >= Math.min(12, (b1 - b0) / 2);
  });
  // drawn over a line of the grid that is hidden (rubbed out between cells that could not be merged): it is drawn again
  const reveal: number[] = [];
  if (line !== null) {
    for (let j = 0; j < A.length - 1; j++) {
      const hit = click ? lo >= A[j] && (lo < A[j + 1] || (j === A.length - 2 && lo === A[j + 1])) : Math.min(A[j + 1], hi) - Math.max(A[j], lo) >= Math.min(12, (A[j + 1] - A[j]) / 2);
      if (!hit) continue;
      const a = s.axis === "h" ? mergeAt(t, line - 1, j) : mergeAt(t, j, line - 1);
      const b = s.axis === "h" ? mergeAt(t, line, j) : mergeAt(t, j, line);
      if (a && a === b) continue; // (inside a merged cell: that one is cut)
      if (!(s.axis === "h" ? hEdgeShown(t, rowsOf(t), line, j) : vEdgeShown(t, colsOf(t), line, j))) reveal.push(j);
    }
  }
  if (!cells.length && !reveal.length) return null;
  const segments = [
    ...cells.map((cell): [number, number] => [A[alongStart(cell, s.axis)], A[alongStart(cell, s.axis) + alongSpan(cell, s.axis)]]),
    ...reveal.map((j): [number, number] => [A[j], A[j + 1]]),
  ];
  const full = split !== null && n + 1 > (s.axis === "h" ? MAX_ROWS : MAX_COLS);
  return { axis: s.axis, at, line, split, cells, segments, reveal, full };
}

/** The table's data with a patch put in it */
const withPatch = (t: TableData, p: TablePatch): TableData => ({ ...t, ...p });

type Styles = Record<string, TableCellStyle>;

// Sets (or, undefined, takes off) some fields of the look of one grid cell
function putStyle(styles: Styles, key: string, patch: Partial<TableCellStyle>) {
  const s: TableCellStyle = { ...styles[key], ...patch };
  for (const k of Object.keys(s) as (keyof TableCellStyle)[]) if (s[k] === undefined) delete s[k];
  if (Object.keys(s).length) styles[key] = s;
  else delete styles[key];
}

const lookOnly = (s: TableCellStyle): TableCellStyle => {
  const out = { ...s };
  for (const f of EDGE_FIELDS) delete out[f];
  return out;
};

/** The fields a drawing operation changes, from the table it made and its sizes */
function resultOf(t: TableData, f: Frame): TablePatch {
  const styles = t.cellStyles && Object.keys(t.cellStyles).length ? t.cellStyles : undefined;
  return { cells: t.cells, merges: t.merges?.length ? t.merges : undefined, cellStyles: styles, colWidths: [...f.colW], rowHeights: [...f.rowH] };
}

/**
 * Splits row (column) `i` of the grid in two, the first part `first` px: a new line of the grid that nothing is drawn on yet. Every cell of
 * that row covers both parts (a merged cell), so the table looks the same; formulas and looks follow (insertLines).
 */
export function splitGrid(t: TableData, f: Frame, axis: LineAxis, i: number, first: number): { table: TableData; frame: Frame } | null {
  const size = across(f, axis)[i];
  if (!Number.isInteger(i) || !Number.isFinite(first) || !size || first < minSize(axis) - 0.01 || size - first < minSize(axis) - 0.01) return null;
  const rowAxis = axis === "h";
  const ins = insertLines(t, rowAxis ? "row" : "col", i + 1, 1);
  if (!ins) return null;
  const merges: TableMerge[] = (t.merges ?? []).map((m) => {
    const start = rowAxis ? m.r : m.c;
    const end = start + (rowAxis ? m.rs : m.cs) - 1;
    if (start > i) return rowAxis ? { ...m, r: m.r + 1 } : { ...m, c: m.c + 1 };
    if (end >= i) return rowAxis ? { ...m, rs: m.rs + 1 } : { ...m, cs: m.cs + 1 };
    return { ...m };
  });
  const n = rowAxis ? colsOf(t) : rowsOf(t);
  const styles: Styles = { ...(ins.cellStyles ?? {}) };
  for (let j = 0; j < n; j++) {
    const [r, c] = rowAxis ? [i, j] : [j, i];
    if (!mergeAt(t, r, c)) merges.push(rowAxis ? { r, c, rs: 2, cs: 1 } : { r, c, rs: 1, cs: 2 });
    // the lines of the old row's cells: its sides go on along the new part, its far edge is now the new part's
    const s = styleAt(t, r, c);
    const newKey = rowAxis ? keyOf(i + 1, j) : keyOf(j, i + 1);
    const oldKey = keyOf(r, c);
    if (rowAxis) {
      putStyle(styles, newKey, { bL: s.bL, bR: s.bR, bB: s.bB, lL: s.lL, lR: s.lR, lB: s.lB });
      putStyle(styles, oldKey, { bB: undefined, lB: undefined });
    } else {
      putStyle(styles, newKey, { bT: s.bT, bB: s.bB, bR: s.bR, lT: s.lT, lB: s.lB, lR: s.lR });
      putStyle(styles, oldKey, { bR: undefined, lR: undefined });
    }
  }
  const sizes = [...across(f, axis)];
  sizes.splice(i, 1, first, sizes[i] - first);
  const frame: Frame = rowAxis ? { colW: [...f.colW], rowH: sizes } : { colW: sizes, rowH: [...f.rowH] };
  return { table: withPatch(t, { ...ins, merges, cellStyles: styles }), frame };
}

// Cuts a merged cell along line `k` of the grid (a line that goes through it): two cells, the second one empty and dressed like the first,
// and the line between them drawn.
function cutCell(t: TableData, m: TableMerge, k: number, axis: LineAxis): TableData {
  const rowAxis = axis === "h";
  const first: TableMerge = rowAxis ? { ...m, rs: k - m.r } : { ...m, cs: k - m.c };
  const second: TableMerge = rowAxis ? { r: k, c: m.c, rs: m.r + m.rs - k, cs: m.cs } : { r: m.r, c: k, rs: m.rs, cs: m.c + m.cs - k };
  const merges = [...(t.merges ?? []).filter((x) => x !== m), ...[first, second].filter((x) => x.rs * x.cs > 1)];
  const styles: Styles = { ...(t.cellStyles ?? {}) };
  putStyle(styles, keyOf(second.r, second.c), lookOnly(styleAt(t, m.r, m.c)));
  const rows = rowsOf(t);
  const cols = colsOf(t);
  if (rowAxis) {
    for (let c = m.c; c < m.c + m.cs; c++) if (!hEdgeShown(t, rows, k, c)) putStyle(styles, keyOf(k - 1, c), { bB: true });
  } else {
    for (let r = m.r; r < m.r + m.rs; r++) if (!vEdgeShown(t, cols, k, r)) putStyle(styles, keyOf(r, k - 1), { bR: true });
  }
  return withPatch(t, { merges, cellStyles: styles });
}

/** Draws the line of a plan on the table: the new table and its sizes (null when it cannot be drawn: the table is full) */
export function applyCut(t: TableData, f: Frame, plan: CutPlan): { table: TableData; frame: Frame } | null {
  if (plan.full) return null;
  let table = t;
  let frame = f;
  let k = plan.line;
  if (plan.split !== null) {
    const P = stops(across(f, plan.axis));
    const grown = splitGrid(t, f, plan.axis, plan.split, plan.at - P[plan.split]);
    if (!grown) return null;
    table = grown.table;
    frame = grown.frame;
    k = plan.split + 1;
  }
  if (k === null) return null;
  // (the cells cut keep their place along the line: a grid split across it does not move them)
  for (const cell of plan.cells) {
    const m = plan.axis === "h" ? mergeAt(table, k - 1, cell.c) : mergeAt(table, cell.r, k - 1);
    if (!m) continue;
    const start = plan.axis === "h" ? m.r : m.c;
    const span = plan.axis === "h" ? m.rs : m.cs;
    if (start < k && start + span > k) table = cutCell(table, m, k, plan.axis);
  }
  if (plan.reveal.length) {
    const styles: Styles = { ...(table.cellStyles ?? {}) };
    for (const j of plan.reveal) {
      if (plan.axis === "h") putStyle(styles, keyOf(Math.max(0, k - 1), j), k === 0 ? { bT: true } : { bB: true });
      else putStyle(styles, keyOf(j, Math.max(0, k - 1)), k === 0 ? { bL: true } : { bR: true });
    }
    table = withPatch(table, { cellStyles: styles });
  }
  return { table, frame };
}

/** A line drawn on a table: the fields that change (null: it cuts nothing, or the table is full — see planCut) */
export function cutTable(t: TableData, f: Frame, s: Stroke, snap = SNAP): { patch: TablePatch; frame: Frame } | null {
  const plan = planCut(t, f, s, snap);
  const done = plan && applyCut(t, f, plan);
  return done ? { patch: resultOf(done.table, done.frame), frame: done.frame } : null;
}

// ---- merging, rubbing out, splitting ----

/**
 * The same merge as Table Studio: the anchor keeps its content, including formulas. Keep the underlying grid so Split and formula
 * references still work exactly as they do in the Studio. `cell`: the merged cell in the new table.
 */
export function mergeRange(t: TableData, f: Frame, g: CellRange): { patch: TablePatch; frame: Frame; cell: Cell } | null {
  const range = wholeMerges(t, clampRange(g, rowsOf(t), colsOf(t)));
  if (cellsOf(t).filter((cell) => cell.r >= range.r0 && cell.r <= range.r1 && cell.c >= range.c0 && cell.c <= range.c1).length < 2) return null;
  const merged = mergeCells(t, range);
  if (!merged) return null;
  const cell = { r: range.r0, c: range.c0, rs: range.r1 - range.r0 + 1, cs: range.c1 - range.c0 + 1 };
  return { patch: resultOf(withPatch(t, merged.patch), f), frame: f, cell };
}

/** A line of the table under the mouse: which line of the grid, the cells on both sides of it (null outside the table), and its piece (px along) */
export interface EdgeHit {
  axis: LineAxis;
  /** The line of the grid (0 = the top or the start side, rows / columns = the far side) */
  k: number;
  before: Cell | null;
  after: Cell | null;
  from: number;
  to: number;
  /** It is drawn (a hidden one between two cells can still be rubbed out: the cells are merged) */
  shown: boolean;
}

/** The line of the table under a point (within `tol` px), the nearest one */
export function edgeAt(t: TableData, f: Frame, p: Pt, tol = 6): EdgeHit | null {
  const X = stops(f.colW);
  const Y = stops(f.rowH);
  const rows = rowsOf(t);
  const cols = colsOf(t);
  let best = null as (EdgeHit & { d: number }) | null;
  const consider = (axis: LineAxis) => {
    const P = axis === "h" ? Y : X;
    const A = axis === "h" ? X : Y;
    const pos = axis === "h" ? p.y : p.u;
    const at = axis === "h" ? p.u : p.y;
    if (at < 0 || at > A[A.length - 1]) return;
    const j = Math.max(0, Math.min(A.length - 2, A.findIndex((a, i) => i > 0 && at <= a) - 1));
    for (let k = 0; k < P.length; k++) {
      const d = Math.abs(P[k] - pos);
      if (d > tol || (best && d >= best.d)) continue;
      const n = P.length - 1;
      const cellAt = (i: number) => {
        if (i < 0 || i >= n) return null;
        const [r, c] = axis === "h" ? [i, j] : [j, i];
        const m = mergeAt(t, r, c);
        return m ? { r: m.r, c: m.c, rs: m.rs, cs: m.cs } : { r, c, rs: 1, cs: 1 };
      };
      const before = cellAt(k - 1);
      const after = cellAt(k);
      if (before && after && before.r === after.r && before.c === after.c) continue; // (inside a merged cell: no line there)
      const piece = (cell: Cell) => [A[alongStart(cell, axis)], A[alongStart(cell, axis) + alongSpan(cell, axis)]];
      const [a0, a1] = before && after ? [Math.max(piece(before)[0], piece(after)[0]), Math.min(piece(before)[1], piece(after)[1])] : piece((before ?? after)!);
      const shown = axis === "h" ? hEdgeShown(t, rows, k, j) : vEdgeShown(t, cols, k, j);
      best = { axis, k, before, after, from: a0, to: a1, shown, d };
    }
  };
  consider("h");
  consider("v");
  if (!best) return null;
  const { d: _d, ...hit } = best;
  void _d;
  return hit;
}

/**
 * Rubs out a line of the table. Cells that make a rectangle together are merged with Table Studio's anchor-content rule; otherwise
 * (and on the table's outline) the piece of line is hidden and the cells stay as they are.
 */
export function eraseEdge(t: TableData, f: Frame, hit: EdgeHit): { patch: TablePatch; frame: Frame } | null {
  const { axis, before, after } = hit;
  if (before && after && alongStart(before, axis) === alongStart(after, axis) && alongSpan(before, axis) === alongSpan(after, axis)) {
    const g: CellRange = { r0: Math.min(before.r, after.r), c0: Math.min(before.c, after.c), r1: Math.max(before.r + before.rs, after.r + after.rs) - 1, c1: Math.max(before.c + before.cs, after.c + after.cs) - 1 };
    const done = mergeRange(t, f, g);
    return done && { patch: done.patch, frame: done.frame };
  }
  if (!hit.shown) return null;
  const A = stops(along(f, axis));
  const styles: Styles = { ...(t.cellStyles ?? {}) };
  for (let j = 0; j < A.length - 1; j++) {
    if (A[j] < hit.from - 0.5 || A[j + 1] > hit.to + 0.5) continue;
    if (axis === "h") putStyle(styles, hit.k === 0 ? keyOf(0, j) : keyOf(hit.k - 1, j), hit.k === 0 ? { bT: false, lT: undefined } : { bB: false, lB: undefined });
    else putStyle(styles, hit.k === 0 ? keyOf(j, 0) : keyOf(j, hit.k - 1), hit.k === 0 ? { bL: false, lL: undefined } : { bR: false, lR: undefined });
  }
  return { patch: resultOf(withPatch(t, { cellStyles: styles }), f), frame: f };
}

/**
 * Splits each cell of a range into `cols` columns and `rows` rows of the same size. A merged cell split into as many columns (rows) as it
 * covers is cut along the grid's own lines (it is unmerged). An impossible split is rejected as a whole: no partial edits or unequal
 * pieces when the requested number cannot fit the minimum cell sizes or the table limits.
 */
export function splitRange(t: TableData, f: Frame, g: CellRange, cols: number, rows: number): { patch: TablePatch; frame: Frame; area: Rect } | null {
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1 || cols > MAX_COLS || rows > MAX_ROWS) return null;
  const range = wholeMerges(t, clampRange(g, rowsOf(t), colsOf(t)));
  const targets = cellsOf(t).filter((cell) => cell.r >= range.r0 && cell.r + cell.rs - 1 <= range.r1 && cell.c >= range.c0 && cell.c + cell.cs - 1 <= range.c1);
  const X = stops(f.colW);
  const Y = stops(f.rowH);
  let table = t;
  let frame = f;
  let failed = false;
  let changed = false;
  const cut = (s: Stroke) => {
    const plan = planCut(table, frame, s, 1);
    if (!plan || plan.full || Math.abs(plan.at - s.at) > 0.01) return void (failed = true);
    const done = applyCut(table, frame, plan);
    if (!done) return void (failed = true);
    table = done.table;
    frame = done.frame;
    changed = true;
  };
  for (const cell of targets) {
    const r = cellRect(f, cell);
    if ((cols !== cell.cs && (r.u1 - r.u0) / cols < TABLE_MIN_COL - 0.01) || (rows !== cell.rs && (r.y1 - r.y0) / rows < TABLE_MIN_ROW - 0.01)) return null;
    const cuts = (n: number, own: number, P: number[], start: number, a: number, b: number) =>
      n === own ? P.slice(start + 1, start + own) : Array.from({ length: Math.max(0, n - 1) }, (_, i) => a + ((b - a) * (i + 1)) / n);
    for (const u of cuts(cols, cell.cs, X, cell.c, r.u0, r.u1)) cut({ axis: "v", at: u, from: r.y0 + 1, to: r.y1 - 1 });
    for (const y of cuts(rows, cell.rs, Y, cell.r, r.y0, r.y1)) cut({ axis: "h", at: y, from: r.u0 + 1, to: r.u1 - 1 });
    if (failed) return null;
  }
  if (!changed) return null;
  const area: Rect = { u0: X[range.c0], u1: X[range.c1 + 1], y0: Y[range.r0], y1: Y[range.r1 + 1] };
  return { patch: resultOf(table, frame), frame, area };
}

/** The cells of the grid inside a rectangle of px (the range of the cells whose middle is in it) */
export function rangeIn(t: TableData, f: Frame, area: Rect): CellRange | null {
  const inside = cellsOf(t).filter((cell) => {
    const r = cellRect(f, cell);
    const mu = (r.u0 + r.u1) / 2;
    const my = (r.y0 + r.y1) / 2;
    return mu > area.u0 && mu < area.u1 && my > area.y0 && my < area.y1;
  });
  if (!inside.length) return null;
  return {
    r0: Math.min(...inside.map((c) => c.r)),
    c0: Math.min(...inside.map((c) => c.c)),
    r1: Math.max(...inside.map((c) => c.r + c.rs - 1)),
    c1: Math.max(...inside.map((c) => c.c + c.cs - 1)),
  };
}

/**
 * The pieces of line between cells (and of the outline) that are not drawn: the table tools show them dotted, so the cells can be seen.
 * Each is [axis, at, from, to] in px of the table (at: across, from / to: along).
 */
export function hiddenEdges(t: TableData, f: Frame): [LineAxis, number, number, number][] {
  const X = stops(f.colW);
  const Y = stops(f.rowH);
  const rows = rowsOf(t);
  const cols = colsOf(t);
  const out: [LineAxis, number, number, number][] = [];
  for (let k = 0; k <= rows; k++)
    for (let c = 0; c < cols; c++) {
      const a = k > 0 && k < rows ? mergeAt(t, k - 1, c) : undefined;
      if (a && a === mergeAt(t, k, c)) continue;
      if (!hEdgeShown(t, rows, k, c)) out.push(["h", Y[k], X[c], X[c + 1]]);
    }
  for (let k = 0; k <= cols; k++)
    for (let r = 0; r < rows; r++) {
      const a = k > 0 && k < cols ? mergeAt(t, r, k - 1) : undefined;
      if (a && a === mergeAt(t, r, k)) continue;
      if (!vEdgeShown(t, cols, k, r)) out.push(["v", X[k], Y[r], Y[r + 1]]);
    }
  return out;
}
