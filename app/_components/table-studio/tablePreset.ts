import type { BlockPatch } from "@/app/_lib/useExam";
import type { TableBlock } from "@/app/_lib/types";
import { blankCells } from "@/app/_lib/table";
import type { StudioTable } from "./useTableStudio";

// The fields of a table block that the Studio makes and changes (everything but its place on the page)
const FIELDS = ["cells", "header", "font", "colWidths", "rowHeights", "calc", "merges", "cellStyles", "borders", "borderColor", "banded", "headerFill", "headerColor", "firstCol", "flip", "shapes"] as const;

/** A new table: five rows of four cells, with a header row */
export const blankStudioTable = (width: number): StudioTable => ({ cells: blankCells(5, 4), header: true, width });

/** The table of a block, for the Studio to work on (a copy: the block is changed only by Update) */
export function studioTableOf(b: TableBlock): StudioTable {
  const out: Record<string, unknown> = { width: b.layout.width };
  for (const k of FIELDS) if (b[k] !== undefined) out[k] = structuredClone(b[k]);
  return out as unknown as StudioTable;
}

/** What Update puts in the block: every field of the table, and a field the table has no more is taken off (undefined) */
export function tablePatch(t: StudioTable): BlockPatch {
  const patch: Record<string, unknown> = { layout: { width: t.width } };
  for (const k of FIELDS) patch[k] = t[k];
  return patch as unknown as BlockPatch;
}
