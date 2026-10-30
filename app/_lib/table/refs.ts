// Cell addresses of the table: A1 names, ranges, and the "r,c" keys the table's styles are stored under. Pure functions.

/** What the Table Studio and the panel allow (the Studio is for exam tables, not for data) */
export const MAX_ROWS = 40;
export const MAX_COLS = 16;

export type CellPos = { r: number; c: number };
/** A rectangle of cells, both corners included, `r0 <= r1` and `c0 <= c1` */
export type CellRange = { r0: number; c0: number; r1: number; c1: number };

/** 0 → A, 25 → Z, 26 → AA */
export function colName(c: number): string {
  let s = "";
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** A → 0, Z → 25, AA → 26 */
export const colIndex = (name: string): number => [...name.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

export const cellName = (r: number, c: number) => `${colName(c)}${r + 1}`;

export const keyOf = (r: number, c: number) => `${r},${c}`;

export function parseKey(key: string): CellPos {
  const [r, c] = key.split(",").map(Number);
  return { r, c };
}

export type ParsedRef = CellPos & { absR: boolean; absC: boolean };
const REF = /^(\$?)([A-Za-z]{1,2})(\$?)(\d{1,3})$/;

/** "B3", "$B$3" → the cell and which of its parts are fixed (null if it is not a cell name) */
export function parseRef(text: string): ParsedRef | null {
  const m = REF.exec(text.trim());
  if (!m) return null;
  const r = Number(m[4]) - 1;
  return r < 0 ? null : { r, c: colIndex(m[2]), absC: m[1] === "$", absR: m[3] === "$" };
}

export const formatRef = (p: ParsedRef) => `${p.absC ? "$" : ""}${colName(p.c)}${p.absR ? "$" : ""}${p.r + 1}`;

export function normRange(a: CellPos, b: CellPos): CellRange {
  return { r0: Math.min(a.r, b.r), c0: Math.min(a.c, b.c), r1: Math.max(a.r, b.r), c1: Math.max(a.c, b.c) };
}

export const inRange = (g: CellRange, r: number, c: number) => r >= g.r0 && r <= g.r1 && c >= g.c0 && c <= g.c1;

export const rangeSize = (g: CellRange) => ({ rows: g.r1 - g.r0 + 1, cols: g.c1 - g.c0 + 1 });

export const isSingleCell = (g: CellRange) => g.r0 === g.r1 && g.c0 === g.c1;

export function rangeCells(g: CellRange): CellPos[] {
  const out: CellPos[] = [];
  for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) out.push({ r, c });
  return out;
}

/** "B2", or "B2:C4" for more than one cell */
export const rangeName = (g: CellRange) => (isSingleCell(g) ? cellName(g.r0, g.c0) : `${cellName(g.r0, g.c0)}:${cellName(g.r1, g.c1)}`);

export const intersects = (a: CellRange, b: CellRange) => a.r0 <= b.r1 && b.r0 <= a.r1 && a.c0 <= b.c1 && b.c0 <= a.c1;

export const clampRange = (g: CellRange, rows: number, cols: number): CellRange => ({
  r0: Math.max(0, Math.min(g.r0, rows - 1)),
  c0: Math.max(0, Math.min(g.c0, cols - 1)),
  r1: Math.max(0, Math.min(g.r1, rows - 1)),
  c1: Math.max(0, Math.min(g.c1, cols - 1)),
});
