// Changing a table: every function takes the table's data and returns the fields that change (a patch), or null when the change
// cannot be made. Pure functions, unit-tested; the Studio, the right panel and the page all edit through them.
import { plainText } from "@/app/_lib/richText";
import { createSheet, adjustFormula, isError, isFormula, shiftFormula } from "./formula";
import { parseNumber } from "./format";
import { MAX_COLS, MAX_ROWS, clampRange, intersects, keyOf, parseKey, type CellPos, type CellRange } from "./refs";
import { colsOf, hEdgeShown, isCovered, mergeRange as rangeOfMerge, rowsOf, styleAt, vEdgeShown, type TableCellStyle, type TableData, type TableMerge } from "./model";

export type TablePatch = Partial<TableData>;

export const blankCells = (rows: number, cols: number): string[][] => Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));

const clone = (cells: string[][]) => cells.map((row) => [...row]);
const average = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : 1);

// ---- size ----

/** The table at another size: what still fits stays (text, merges that still fit, looks, sizes) */
export function resizeTable(t: TableData, rows: number, cols: number): TablePatch {
  const nr = Math.max(1, Math.min(Math.round(rows), MAX_ROWS));
  const nc = Math.max(1, Math.min(Math.round(cols), MAX_COLS));
  const cells = Array.from({ length: nr }, (_, r) => Array.from({ length: nc }, (_, c) => t.cells[r]?.[c] ?? ""));
  const patch: TablePatch = { cells };
  if (t.merges) {
    const merges = t.merges.flatMap((m) => {
      if (m.r >= nr || m.c >= nc) return [];
      const rs = Math.min(m.rs, nr - m.r);
      const cs = Math.min(m.cs, nc - m.c);
      return rs * cs > 1 ? [{ ...m, rs, cs }] : [];
    });
    patch.merges = merges.length ? merges : undefined;
  }
  if (t.cellStyles) {
    const kept = Object.entries(t.cellStyles).filter(([k]) => {
      const { r, c } = parseKey(k);
      return r < nr && c < nc;
    });
    patch.cellStyles = kept.length ? Object.fromEntries(kept) : undefined;
  }
  if (t.colWidths) {
    const old = t.colWidths;
    patch.colWidths = nc === old.length ? old : nc < old.length ? old.slice(0, nc) : [...old, ...Array.from({ length: nc - old.length }, () => average(old))];
  }
  if (t.rowHeights) patch.rowHeights = Array.from({ length: nr }, (_, r) => t.rowHeights?.[r] ?? 0);
  return patch;
}

// ---- text ----

export function setCell(t: TableData, r: number, c: number, raw: string): TablePatch | null {
  if (r < 0 || c < 0 || r >= rowsOf(t) || c >= colsOf(t) || isCovered(t, r, c)) return null;
  if (t.cells[r][c] === raw) return null;
  const cells = clone(t.cells);
  cells[r][c] = raw;
  return { cells };
}

/** The text of a range of cells, as typed (formulas as formulas) */
export const textOf = (t: TableData, g: CellRange): string[][] =>
  Array.from({ length: g.r1 - g.r0 + 1 }, (_, i) => Array.from({ length: g.c1 - g.c0 + 1 }, (_, j) => t.cells[g.r0 + i]?.[g.c0 + j] ?? ""));

/** Empties the cells of a range (their looks stay) */
export function clearRange(t: TableData, g: CellRange): TablePatch | null {
  const cells = clone(t.cells);
  let changed = false;
  for (let r = g.r0; r <= g.r1; r++)
    for (let c = g.c0; c <= g.c1; c++) {
      if (cells[r]?.[c]) {
        cells[r][c] = "";
        changed = true;
      }
    }
  return changed ? { cells } : null;
}

/**
 * Puts a block of text at a cell (a paste). The table grows to hold it, up to its limits. `from`: where the block was copied
 * from in this same table, so that the formulas in it follow (a formula copied one row down looks one row further down).
 */
export function pasteMatrix(t: TableData, at: CellPos, matrix: string[][], from?: CellPos): { patch: TablePatch; range: CellRange } | null {
  if (!matrix.length || !matrix[0].length) return null;
  const rows = Math.min(Math.max(rowsOf(t), at.r + matrix.length), MAX_ROWS);
  const cols = Math.min(Math.max(colsOf(t), at.c + Math.max(...matrix.map((m) => m.length))), MAX_COLS);
  const grown = rows !== rowsOf(t) || cols !== colsOf(t) ? resizeTable(t, rows, cols) : {};
  const cells = (grown.cells ?? clone(t.cells)).map((row) => [...row]);
  const placed: TableData = { ...t, ...grown, cells };
  let lastR = at.r;
  let lastC = at.c;
  matrix.forEach((line, i) =>
    line.forEach((raw, j) => {
      const r = at.r + i;
      const c = at.c + j;
      if (r >= rows || c >= cols || isCovered(placed, r, c)) return;
      cells[r][c] = from && isFormula(raw) ? shiftFormula(raw, at.r - from.r, at.c - from.c) : raw;
      lastR = Math.max(lastR, r);
      lastC = Math.max(lastC, c);
    }),
  );
  return { patch: { ...grown, cells }, range: { r0: at.r, c0: at.c, r1: lastR, c1: lastC } };
}

// ---- rows and columns ----

type Axis = "row" | "col";

const styleKeys = (t: TableData) => Object.entries(t.cellStyles ?? {});

/** Inserts `count` empty rows (or columns) before line `at`; the new ones look like the line before them */
export function insertLines(t: TableData, axis: Axis, at: number, count = 1): TablePatch | null {
  const row = axis === "row";
  const size = row ? rowsOf(t) : colsOf(t);
  if (at < 0 || at > size || count < 1 || size + count > (row ? MAX_ROWS : MAX_COLS)) return null;
  const adjust = (raw: string) => (isFormula(raw) ? adjustFormula(raw, { axis, at, count, kind: "insert" }) : raw);
  const cells = row
    ? [...t.cells.slice(0, at), ...Array.from({ length: count }, () => Array.from({ length: colsOf(t) }, () => "")), ...t.cells.slice(at)].map((line) => line.map(adjust))
    : t.cells.map((line) => [...line.slice(0, at), ...Array.from({ length: count }, () => ""), ...line.slice(at)].map(adjust));
  const patch: TablePatch = { cells };
  if (t.merges) {
    patch.merges = t.merges.map((m) => {
      const start = row ? m.r : m.c;
      const span = row ? m.rs : m.cs;
      if (start >= at) return row ? { ...m, r: m.r + count } : { ...m, c: m.c + count };
      if (at < start + span) return row ? { ...m, rs: m.rs + count } : { ...m, cs: m.cs + count }; // (inserted inside it: it grows)
      return m;
    });
  }
  if (t.cellStyles) {
    const next: Record<string, TableCellStyle> = {};
    for (const [k, s] of styleKeys(t)) {
      const p = parseKey(k);
      const v = row ? p.r : p.c;
      next[row ? keyOf(v >= at ? v + count : v, p.c) : keyOf(p.r, v >= at ? v + count : v)] = s;
    }
    // the new lines are dressed like the one before (or after, for the first)
    const model = at > 0 ? at - 1 : at; // (a line of the old table)
    for (const [k, s] of styleKeys(t)) {
      const p = parseKey(k);
      if ((row ? p.r : p.c) !== model) continue;
      for (let i = 0; i < count; i++) {
        const nk = row ? keyOf(at + i, p.c) : keyOf(p.r, at + i);
        next[nk] = { ...s, bT: undefined, bB: undefined, bL: undefined, bR: undefined };
        for (const f of ["bT", "bB", "bL", "bR"] as const) if (next[nk][f] === undefined) delete next[nk][f];
      }
    }
    patch.cellStyles = next;
  }
  if (row && t.rowHeights) patch.rowHeights = [...t.rowHeights.slice(0, at), ...Array.from({ length: count }, () => 0), ...t.rowHeights.slice(at)];
  if (!row && t.colWidths) patch.colWidths = [...t.colWidths.slice(0, at), ...Array.from({ length: count }, () => average(t.colWidths ?? [])), ...t.colWidths.slice(at)];
  return patch;
}

/** Deletes `count` rows (or columns) from line `at` on (a table keeps at least one of each) */
export function deleteLines(t: TableData, axis: Axis, at: number, count = 1): TablePatch | null {
  const row = axis === "row";
  const size = row ? rowsOf(t) : colsOf(t);
  const n = Math.min(count, size - at);
  if (at < 0 || at >= size || n < 1 || size - n < 1) return null;
  const adjust = (raw: string) => (isFormula(raw) ? adjustFormula(raw, { axis, at, count: n, kind: "delete" }) : raw);
  const cells = row ? [...t.cells.slice(0, at), ...t.cells.slice(at + n)].map((line) => line.map(adjust)) : t.cells.map((line) => [...line.slice(0, at), ...line.slice(at + n)].map(adjust));
  const patch: TablePatch = { cells };
  const remap = (v: number, part: "start" | "end") => (v < at ? v : v >= at + n ? v - n : part === "start" ? at : at - 1);
  if (t.merges) {
    const merges = t.merges.flatMap((m) => {
      const start = row ? m.r : m.c;
      const span = row ? m.rs : m.cs;
      const a = remap(start, "start");
      const b = remap(start + span - 1, "end");
      if (b < a) return [];
      const next = row ? { ...m, r: a, rs: b - a + 1 } : { ...m, c: a, cs: b - a + 1 };
      return next.rs * next.cs > 1 ? [next] : [];
    });
    patch.merges = merges.length ? merges : undefined;
  }
  if (t.cellStyles) {
    const next: Record<string, TableCellStyle> = {};
    for (const [k, s] of styleKeys(t)) {
      const p = parseKey(k);
      const v = row ? p.r : p.c;
      if (v >= at && v < at + n) continue;
      const nv = v >= at + n ? v - n : v;
      next[row ? keyOf(nv, p.c) : keyOf(p.r, nv)] = s;
    }
    patch.cellStyles = Object.keys(next).length ? next : undefined;
  }
  if (row && t.rowHeights) patch.rowHeights = [...t.rowHeights.slice(0, at), ...t.rowHeights.slice(at + n)];
  if (!row && t.colWidths) patch.colWidths = [...t.colWidths.slice(0, at), ...t.colWidths.slice(at + n)];
  return patch;
}

// ---- merged cells ----

/** The range with every merged cell it touches made whole (a merge cannot be cut in two) */
export function wholeMerges(t: TableData, g: CellRange): CellRange {
  let out = g;
  for (let again = true; again; ) {
    again = false;
    for (const m of t.merges ?? []) {
      const mg = rangeOfMerge(m);
      if (!intersects(out, mg)) continue;
      const grown = { r0: Math.min(out.r0, mg.r0), c0: Math.min(out.c0, mg.c0), r1: Math.max(out.r1, mg.r1), c1: Math.max(out.c1, mg.c1) };
      if (grown.r0 !== out.r0 || grown.c0 !== out.c0 || grown.r1 !== out.r1 || grown.c1 !== out.c1) {
        out = grown;
        again = true;
      }
    }
  }
  return out;
}

/** Merges the cells of a range into one (the top-left cell keeps its text; the others are emptied) */
export function mergeCells(t: TableData, g: CellRange): { patch: TablePatch; range: CellRange } | null {
  const range = wholeMerges(t, clampRange(g, rowsOf(t), colsOf(t)));
  if (range.r0 === range.r1 && range.c0 === range.c1) return null;
  const inside = (m: TableMerge) => intersects(range, rangeOfMerge(m));
  const merges = [...(t.merges ?? []).filter((m) => !inside(m)), { r: range.r0, c: range.c0, rs: range.r1 - range.r0 + 1, cs: range.c1 - range.c0 + 1 }];
  const cells = clone(t.cells);
  for (let r = range.r0; r <= range.r1; r++) for (let c = range.c0; c <= range.c1; c++) if (r !== range.r0 || c !== range.c0) cells[r][c] = "";
  return { patch: { merges, cells }, range };
}

/** Splits the merged cells a range touches */
export function unmergeCells(t: TableData, g: CellRange): TablePatch | null {
  const touched = (t.merges ?? []).filter((m) => intersects(g, rangeOfMerge(m)));
  if (!touched.length) return null;
  const merges = (t.merges ?? []).filter((m) => !touched.includes(m));
  return { merges: merges.length ? merges : undefined };
}

// ---- looks ----

/** Sets some fields of the look of every cell of a range (an undefined field is taken off) */
export function setStyle(t: TableData, g: CellRange, patch: Partial<TableCellStyle>): TablePatch | null {
  const next = { ...(t.cellStyles ?? {}) };
  for (let r = g.r0; r <= g.r1; r++)
    for (let c = g.c0; c <= g.c1; c++) {
      const key = keyOf(r, c);
      const merged: TableCellStyle = { ...next[key], ...patch };
      for (const k of Object.keys(merged) as (keyof TableCellStyle)[]) if (merged[k] === undefined) delete merged[k];
      if (Object.keys(merged).length) next[key] = merged;
      else delete next[key];
    }
  const same = JSON.stringify(next) === JSON.stringify(t.cellStyles ?? {});
  return same ? null : { cellStyles: Object.keys(next).length ? next : undefined };
}

export type BorderSide = "top" | "bottom" | "left" | "right";
export type BorderMode = "all" | "outer" | "inner" | "none" | "reset" | BorderSide;

export interface BorderOptions {
  /** Each cell of the range on its own: a side is that side of every cell, not only of the range's outline */
  each?: boolean;
  /** Draw (true) or hide (false) the lines (default: draw, except for "none") */
  show?: boolean;
}

type Edge = { horizontal: boolean; line: number; at: number };

// The lines a side stands for: the range's outline on that side, or (`each`) that side of every cell of it. A horizontal line `line` is above
// row `line`, a vertical one is before column `line`; `at` is the column (or the row) it is in.
function sideEdges(g: CellRange, side: BorderSide, each: boolean): Edge[] {
  const out: Edge[] = [];
  if (side === "top" || side === "bottom") {
    const lines = each ? Array.from({ length: g.r1 - g.r0 + 1 }, (_, n) => g.r0 + n + (side === "bottom" ? 1 : 0)) : [side === "top" ? g.r0 : g.r1 + 1];
    for (const line of lines) for (let c = g.c0; c <= g.c1; c++) out.push({ horizontal: true, line, at: c });
  } else {
    const lines = each ? Array.from({ length: g.c1 - g.c0 + 1 }, (_, n) => g.c0 + n + (side === "right" ? 1 : 0)) : [side === "left" ? g.c0 : g.c1 + 1];
    for (const line of lines) for (let r = g.r0; r <= g.r1; r++) out.push({ horizontal: false, line, at: r });
  }
  return out;
}

/** Whether a side of a range is drawn (every line of it): a button of the side shows it, and takes it off when it is on */
export function isBorderOn(t: TableData, g: CellRange, side: BorderSide, each = false): boolean {
  const rows = rowsOf(t);
  const cols = colsOf(t);
  return sideEdges(g, side, each).every((e) => (e.horizontal ? hEdgeShown(t, rows, e.line, e.at) : vEdgeShown(t, cols, e.line, e.at)));
}

/**
 * Draws or hides the lines of a range. "left" is the edge of the first column (the start side of the grid). A side, "outer" and "inner" work on the
 * range as a whole, or (`each`) on each cell of it alone: the top of every cell, the four sides of every cell.
 */
export function setBorders(t: TableData, g: CellRange, mode: BorderMode, options: BorderOptions = {}): TablePatch | null {
  const next: Record<string, TableCellStyle> = { ...(t.cellStyles ?? {}) };
  const put = (r: number, c: number, flag: "bT" | "bR" | "bB" | "bL", on: boolean | undefined) => {
    if (r < 0 || c < 0) return;
    const key = keyOf(r, c);
    const s: TableCellStyle = { ...next[key] };
    if (on === undefined) delete s[flag];
    else s[flag] = on;
    if (Object.keys(s).length) next[key] = s;
    else delete next[key];
  };
  // the horizontal line `i` (above row i) at column c, and the vertical line `j` (before column j) at row r
  const h = (i: number, c: number, on: boolean | undefined) => (i === 0 ? put(0, c, "bT", on) : put(i - 1, c, "bB", on));
  const v = (j: number, r: number, on: boolean | undefined) => (j === 0 ? put(r, 0, "bL", on) : put(r, j - 1, "bR", on));
  const show = options.show ?? mode !== "none";
  const set = (edges: Edge[], on: boolean | undefined) => edges.forEach((e) => (e.horizontal ? h(e.line, e.at, on) : v(e.line, e.at, on)));
  const everySide = (on: boolean | undefined) => (["top", "bottom", "left", "right"] as const).forEach((side) => set(sideEdges(g, side, true), on));

  if (mode === "all" || mode === "none" || mode === "reset") everySide(mode === "reset" ? undefined : mode === "none" ? false : show);
  else if (mode === "outer") {
    // the outline of the range, or (each) a box round every cell
    if (options.each) everySide(show);
    else for (const side of ["top", "bottom", "left", "right"] as const) set(sideEdges(g, side, false), show);
  }
  else if (mode === "inner") {
    for (let c = g.c0; c <= g.c1; c++) for (let i = g.r0 + 1; i <= g.r1; i++) h(i, c, show);
    for (let r = g.r0; r <= g.r1; r++) for (let j = g.c0 + 1; j <= g.c1; j++) v(j, r, show);
  } else set(sideEdges(g, mode, !!options.each), show);

  const same = JSON.stringify(next) === JSON.stringify(t.cellStyles ?? {});
  return same ? null : { cellStyles: Object.keys(next).length ? next : undefined };
}

// ---- sorting ----

/** Sorts the body rows (not the header) by a column; null if the table has merged cells in the way */
export function sortRows(t: TableData, col: number, dir: "asc" | "desc"): TablePatch | null {
  const first = t.header ? 1 : 0;
  const rows = rowsOf(t);
  if (rows - first < 2 || col < 0 || col >= colsOf(t)) return null;
  if ((t.merges ?? []).some((m) => m.r + m.rs > first && m.rs * m.cs > 1)) return null;
  const sheet = createSheet(t.cells, !!t.calc, (raw) => plainText(raw));
  const keys = Array.from({ length: rows - first }, (_, i) => {
    const v = sheet.value(first + i, col);
    return { from: first + i, v: isError(v) ? null : v };
  });
  const order = (a: (typeof keys)[number], b: (typeof keys)[number]) => {
    const empty = (x: (typeof keys)[number]) => x.v === null || x.v === "";
    if (empty(a) || empty(b)) return empty(a) === empty(b) ? 0 : empty(a) ? 1 : -1; // (the empty ones go last, whatever the direction)
    const sign = dir === "asc" ? 1 : -1;
    if (typeof a.v === "number" && typeof b.v === "number") return sign * (a.v - b.v);
    if (typeof a.v === "number") return -1;
    if (typeof b.v === "number") return 1;
    return sign * String(a.v).localeCompare(String(b.v), undefined, { numeric: true, sensitivity: "base" });
  };
  const sorted = [...keys].sort((a, b) => order(a, b) || a.from - b.from);
  if (sorted.every((k, i) => k.from === first + i)) return null;
  const cells = clone(t.cells);
  const heights = t.rowHeights ? [...t.rowHeights] : undefined;
  const styles: Record<string, TableCellStyle> = {};
  for (const [k, s] of styleKeys(t)) if (parseKey(k).r < first) styles[k] = s;
  sorted.forEach((k, i) => {
    const to = first + i;
    cells[to] = t.cells[k.from].map((raw) => (isFormula(raw) ? shiftFormula(raw, to - k.from, 0) : raw));
    if (heights) heights[to] = t.rowHeights?.[k.from] ?? 0;
    for (let c = 0; c < colsOf(t); c++) {
      const s = t.cellStyles?.[keyOf(k.from, c)];
      if (s) styles[keyOf(to, c)] = s;
    }
  });
  return { cells, rowHeights: heights, cellStyles: Object.keys(styles).length ? styles : undefined };
}

// ---- filling ----

// "Test 3" → ["Test ", 3]: a text that ends in a number
const TRAILING = /^(.*?)(\d+)$/;

/** The values that continue `source` for `count` more cells (a series of numbers, or numbered texts, else the same ones again) */
function continueSeries(source: string[], count: number, backwards: boolean): string[] {
  const n = source.length;
  const nums = source.map((s) => (isFormula(s) ? null : parseNumber(plainText(s))));
  if (nums.every((x) => x !== null) && n >= 2) {
    const step = (nums[n - 1]! - nums[0]!) / (n - 1);
    const arithmetic = nums.every((x, i) => i === 0 || Math.abs(x! - nums[i - 1]! - step) < 1e-9);
    if (arithmetic) {
      return Array.from({ length: count }, (_, k) => String(Math.round((backwards ? nums[0]! - step * (k + 1) : nums[n - 1]! + step * (k + 1)) * 1e10) / 1e10));
    }
  }
  if (n === 1) {
    const m = TRAILING.exec(source[0]);
    if (m && m[1].trim() !== "" && !isFormula(source[0]) && !plainText(source[0]).includes("⁅")) {
      const width = m[2].length;
      const base = Number(m[2]);
      return Array.from({ length: count }, (_, k) => m[1] + String(Math.max(0, base + (backwards ? -(k + 1) : k + 1))).padStart(m[2].startsWith("0") ? width : 0, "0"));
    }
  }
  return [];
}

/**
 * The fill handle: `source` is the selection, `to` the cell the handle was dragged to (below, above, right or left of it).
 * Numbers continue as a series, a text ending in a number counts on, anything else is copied (formulas follow their cells).
 */
export function fillRange(t: TableData, source: CellRange, to: CellPos): { patch: TablePatch; range: CellRange } | null {
  const rows = rowsOf(t);
  const cols = colsOf(t);
  const dr = to.r > source.r1 ? to.r - source.r1 : to.r < source.r0 ? to.r - source.r0 : 0;
  const dc = to.c > source.c1 ? to.c - source.c1 : to.c < source.c0 ? to.c - source.c0 : 0;
  if (!dr && !dc) return null;
  const vertical = Math.abs(dr) >= Math.abs(dc);
  const sign = (vertical ? dr : dc) > 0 ? 1 : -1;
  const count = Math.abs(vertical ? dr : dc);
  const cells = clone(t.cells);
  const styles = { ...(t.cellStyles ?? {}) };
  const size = vertical ? source.r1 - source.r0 + 1 : source.c1 - source.c0 + 1;
  const lines = vertical ? source.c1 - source.c0 + 1 : source.r1 - source.r0 + 1;
  for (let line = 0; line < lines; line++) {
    const at = (k: number) => (vertical ? { r: source.r0 + k, c: source.c0 + line } : { r: source.r0 + line, c: source.c0 + k });
    const original = Array.from({ length: size }, (_, k) => t.cells[at(k).r]?.[at(k).c] ?? "");
    const series = continueSeries(original, count, sign < 0);
    for (let k = 1; k <= count; k++) {
      // the k-th new cell, and which source cell it repeats
      const offset = sign > 0 ? size - 1 + k : -k;
      const dest = at(offset);
      if (dest.r < 0 || dest.c < 0 || dest.r >= rows || dest.c >= cols || isCovered(t, dest.r, dest.c)) continue;
      const src = at(((offset % size) + size) % size);
      const raw = t.cells[src.r]?.[src.c] ?? "";
      cells[dest.r][dest.c] = series.length ? series[k - 1] : isFormula(raw) ? shiftFormula(raw, dest.r - src.r, dest.c - src.c) : raw;
      const s = styleAt(t, src.r, src.c);
      if (Object.keys(s).length) styles[keyOf(dest.r, dest.c)] = { ...s };
    }
  }
  const range: CellRange = vertical
    ? { r0: Math.min(source.r0, source.r0 + (sign < 0 ? -count : 0)), r1: Math.max(source.r1, source.r1 + (sign > 0 ? count : 0)), c0: source.c0, c1: source.c1 }
    : { c0: Math.min(source.c0, source.c0 + (sign < 0 ? -count : 0)), c1: Math.max(source.c1, source.c1 + (sign > 0 ? count : 0)), r0: source.r0, r1: source.r1 };
  const bounded = clampRange(range, rows, cols);
  return { patch: { cells, cellStyles: Object.keys(styles).length ? styles : undefined }, range: bounded };
}
