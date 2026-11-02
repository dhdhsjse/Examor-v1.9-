import type { BlockPatch } from "@/app/_lib/useExam";
import type { TableBlock } from "@/app/_lib/types";
import { blankCells, isFixedTable } from "@/app/_lib/table";
import type { StudioTable } from "./useTableStudio";

// The fields of a table block that the Studio makes and changes (everything but its place on the page)
const FIELDS = ["cells", "header", "font", "colWidths", "rowHeights", "calc", "merges", "cellStyles", "borders", "borderColor", "banded", "headerFill", "headerColor", "firstCol", "flip", "shapes"] as const;

/** How the Studio opens on a table: on its cells (the default), or on its shapes and pictures, with a shape ready to draw or a picture to put */
export interface TableStudioStart {
  view?: "cells" | "shapes";
  shape?: string;
  picture?: { src: string; ratio: number };
}

/** A new table: five rows of four cells, with a header row */
export const blankStudioTable = (width: number): StudioTable => ({ cells: blankCells(5, 4), header: true, width });

/** The table of a block, for the Studio to work on (a copy: the block is changed only by Update) */
export function studioTableOf(b: TableBlock): StudioTable {
  const out: Record<string, unknown> = { width: b.layout.width };
  for (const k of FIELDS) if (b[k] !== undefined) out[k] = structuredClone(b[k]);
  return out as unknown as StudioTable;
}

/** The Studio's table as a block (not on a page: at 0, 0), to lay it out and draw it. `shapes: false` leaves its shapes and pictures out (a canvas that draws them itself, to handle them). */
export function studioBlock(t: StudioTable, id: string, shapes = true): TableBlock {
  const { width, shapes: over, ...data } = t;
  return { ...data, ...(shapes && over ? { shapes: over } : {}), id, type: "table", layout: { pageId: "p", x: 0, y: 0, width, height: 0 } };
}

/** The width the shapes and pictures of a table were put in: the Studio's width (a table without any has none: it is laid out at the block's own width) */
const baseOf = (t: StudioTable) => (isFixedTable(t) ? t.width : undefined);

/** What a new table block starts from: every field of the table, and the width its shapes and pictures were put in */
export const tablePreset = (t: StudioTable): StudioTable & { base?: number } => ({ ...t, base: baseOf(t) });

/** What Update puts in the block: every field of the table, and a field the table has no more is taken off (undefined) */
export function tablePatch(t: StudioTable): BlockPatch {
  const patch: Record<string, unknown> = { layout: { width: t.width }, base: baseOf(t) };
  for (const k of FIELDS) patch[k] = t[k];
  return patch as unknown as BlockPatch;
}
