// The data of a table beyond its text: merged cells, the look of each cell, borders, banding, formulas. All of it optional, so a
// table made before they existed has none of it and is drawn exactly as it was (see isPlainTable). Pure types and helpers.
import type { ShapeItem } from "@/app/_lib/shapes/types";
import type { BlockFont } from "@/app/_lib/types";
import type { NumberFormat } from "./format";
import { keyOf, type CellRange } from "./refs";

export type TableAlign = "left" | "center" | "right";
export type TableVAlign = "top" | "middle" | "bottom";

/** The look of one cell (a missing field = the table's own look) */
export interface TableCellStyle {
  /** A font of the app's list (missing = the table's font) */
  font?: string;
  bold?: boolean;
  italic?: boolean;
  /** Text size in px (missing = the block's size) */
  size?: number;
  color?: string;
  fill?: string;
  align?: TableAlign;
  valign?: TableVAlign;
  fmt?: NumberFormat;
  /**
   * Edges drawn (true) or hidden (false), against the table's border style. Each edge of the grid belongs to one cell: the one
   * left of or above it (bR, bB); the edges on the table's left and top belong to the cells there (bL, bT).
   */
  bT?: boolean;
  bR?: boolean;
  bB?: boolean;
  bL?: boolean;
}

/** A merged cell: the top-left cell (r, c) and how many rows and columns it covers (the others are covered) */
export interface TableMerge {
  r: number;
  c: number;
  rs: number;
  cs: number;
}

/** Which lines are drawn where the cells do not say otherwise: all, the outside only, the horizontal ones, the vertical ones, none */
export type TableBorders = "grid" | "box" | "rows" | "columns" | "none";

/** The fields that make a table more than a grid of text */
export interface TableExtras {
  /** A cell whose text starts with "=" is a formula (off in tables made before formulas existed) */
  calc?: boolean;
  merges?: TableMerge[];
  /** By "r,c" (see keyOf) */
  cellStyles?: Record<string, TableCellStyle>;
  borders?: TableBorders;
  borderColor?: string;
  /** Fill of every second row of the body */
  banded?: string;
  /** Fill of the header row (missing = light grey) */
  headerFill?: string;
  /** Text color of the header row */
  headerColor?: string;
  /** The first column in bold, like a header */
  firstCol?: boolean;
  /** The columns in the other order: the first one on the side where the last one would be (A B C D… becomes …D C B A). The text keeps the direction of the exam. */
  flip?: boolean;
  /** Shapes drawn over the table, in px of the table's own box (Shapes in the Table Studio) */
  shapes?: ShapeItem[];
}

/** What the operations work on: the table without its place on the page */
export interface TableData extends TableExtras {
  cells: string[][];
  header: boolean;
  /** The font of the whole table (the block's own font: family, size, color…) */
  font?: BlockFont;
  colWidths?: number[];
  rowHeights?: number[];
}

export const EXTRA_FIELDS = ["calc", "merges", "cellStyles", "borders", "borderColor", "banded", "headerFill", "headerColor", "firstCol"] as const;

/** A table with none of the extras: it is laid out and drawn the way tables always were */
export const isPlainTable = (t: TableExtras) => !EXTRA_FIELDS.some((k) => {
  const v = t[k];
  return v !== undefined && v !== false && !(Array.isArray(v) && v.length === 0) && !(typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);
});

/** Fill of the header row when the table does not choose another */
export const TABLE_HEADER_FILL = "#f3f4f6";

export const rowsOf = (t: Pick<TableData, "cells">) => t.cells.length;
export const colsOf = (t: Pick<TableData, "cells">) => Math.max(1, t.cells[0]?.length ?? 1);

export const styleAt = (t: TableExtras, r: number, c: number): TableCellStyle => t.cellStyles?.[keyOf(r, c)] ?? {};

/** The merged cell that covers (r, c), if any (the anchor itself too) */
export const mergeAt = (t: TableExtras, r: number, c: number): TableMerge | undefined => t.merges?.find((m) => r >= m.r && r < m.r + m.rs && c >= m.c && c < m.c + m.cs);

/** Whether (r, c) is hidden under a merged cell (its top-left cell is another one) */
export const isCovered = (t: TableExtras, r: number, c: number) => {
  const m = mergeAt(t, r, c);
  return !!m && (m.r !== r || m.c !== c);
};

export const mergeRange = (m: TableMerge): CellRange => ({ r0: m.r, c0: m.c, r1: m.r + m.rs - 1, c1: m.c + m.cs - 1 });

/** The top-left cell of the merged cell that covers (r, c), or (r, c) itself */
export function anchorOf(t: TableExtras, r: number, c: number): { r: number; c: number } {
  const m = mergeAt(t, r, c);
  return m ? { r: m.r, c: m.c } : { r, c };
}

/** How a cell looks once the table's own rules (header, banded rows, bold first column) and the cell's own look are put together */
export interface CellLook {
  /** undefined = the table's font */
  family?: string;
  /** undefined = the block's own weight */
  bold?: boolean;
  italic?: boolean;
  size?: number;
  color?: string;
  fill?: string;
  align?: TableAlign;
  valign: TableVAlign;
}

export function cellLook(t: TableData, r: number, c: number): CellLook {
  const s = styleAt(t, r, c);
  const head = t.header && r === 0;
  const first = t.header ? 1 : 0;
  return {
    family: s.font,
    bold: s.bold ?? (head || (!!t.firstCol && c === 0) ? true : undefined),
    italic: s.italic,
    size: s.size,
    color: s.color ?? (head ? t.headerColor : undefined),
    fill: s.fill ?? (head ? (t.headerFill ?? TABLE_HEADER_FILL) : t.banded && r >= first && (r - first) % 2 === 1 ? t.banded : undefined),
    align: s.align ?? (head ? "center" : undefined),
    valign: s.valign ?? "middle",
  };
}

/** Whether the first column is on the right: the exam is written right to left, unless the table is flipped (then the other way round) */
export const tableMirrored = (t: Pick<TableExtras, "flip">, examRtl: boolean) => examRtl !== !!t.flip;

/** Which of the lines between cells a border style draws */
export function presetEdge(kind: TableBorders | undefined, horizontal: boolean, outer: boolean): boolean {
  switch (kind ?? "grid") {
    case "grid":
      return true;
    case "box":
      return outer;
    case "rows":
      return horizontal || outer;
    case "columns":
      return !horizontal || outer;
    default:
      return false;
  }
}

/** Whether the horizontal line `i` (0 = the top of the table, rows = the bottom) is drawn at column `c` */
export function hEdgeShown(t: TableExtras, rows: number, i: number, c: number): boolean {
  const flag = i === 0 ? styleAt(t, 0, c).bT : styleAt(t, i - 1, c).bB;
  return flag ?? presetEdge(t.borders, true, i === 0 || i === rows);
}

/** Whether the vertical line `j` (0 = the left of the table, cols = the right) is drawn at row `r` */
export function vEdgeShown(t: TableExtras, cols: number, j: number, r: number): boolean {
  const flag = j === 0 ? styleAt(t, r, 0).bL : styleAt(t, r, j - 1).bR;
  return flag ?? presetEdge(t.borders, false, j === 0 || j === cols);
}
