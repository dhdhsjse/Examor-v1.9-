import { normRange, type CellPos, type CellRange } from "@/app/_lib/table";

/** The selection of a table: where it started and the cell it reaches now (the active cell, which is what the formula bar shows) */
export type Sel = { anchor: CellPos; focus: CellPos };

export const cellSel = (r: number, c: number): Sel => ({ anchor: { r, c }, focus: { r, c } });
export const rangeSel = (g: CellRange): Sel => ({ anchor: { r: g.r0, c: g.c0 }, focus: { r: g.r1, c: g.c1 } });
export const selRange = (s: Sel): CellRange => normRange(s.anchor, s.focus);

/** The selection (null = no cell selected) kept inside a table that has `rows` × `cols` cells (the table may have got smaller) */
export function clampSel(s: Sel | null, rows: number, cols: number): Sel | null {
  if (!s) return null;
  const c = (p: CellPos): CellPos => ({ r: Math.max(0, Math.min(p.r, rows - 1)), c: Math.max(0, Math.min(p.c, cols - 1)) });
  return { anchor: c(s.anchor), focus: c(s.focus) };
}
