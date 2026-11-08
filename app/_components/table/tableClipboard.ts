import { plainText } from "@/app/_lib/richText";
import { colsOf, displayGrid, keyOf, parseTable, pasteMatrix, rowsOf, textOf, toTabText, type CellPos, type CellRange, type TableCellStyle, type TableData } from "@/app/_lib/table";
import type { Lang } from "@/app/_lib/types";

// One clipboard for the worksheet, properties grid and Studio. External applications get displayed text; inside the app, raw formulas
// and cell formatting survive and formula references shift to their destination, just as in the spreadsheet.
let held: { text: string; raw: string[][]; styles: (TableCellStyle | undefined)[][]; from: CellPos } | null = null;

export function copyTableCells(table: TableData, range: CellRange, lang: Lang): string {
  const shown = displayGrid(table, lang);
  const matrix = <T,>(read: (r: number, c: number) => T) => Array.from({ length: range.r1 - range.r0 + 1 }, (_, i) => Array.from({ length: range.c1 - range.c0 + 1 }, (_, j) => read(range.r0 + i, range.c0 + j)));
  const text = toTabText(matrix((r, c) => plainText(shown[r]?.[c] ?? "")));
  held = { text, raw: textOf(table, range), styles: matrix((r, c) => table.cellStyles?.[keyOf(r, c)]), from: { r: range.r0, c: range.c0 } };
  return text;
}

export function pasteTableCells(table: TableData, at: CellPos, text: string) {
  const own = held && held.text === text ? held : null;
  const result = pasteMatrix(table, at, own ? own.raw : parseTable(text), own?.from);
  if (!result || !own) return result;
  const patch = { ...result.patch };
  const next = { ...table, ...patch };
  const styles = { ...(patch.cellStyles ?? table.cellStyles ?? {}) };
  own.styles.forEach((row, i) => row.forEach((s, j) => {
    if (at.r + i >= rowsOf(next) || at.c + j >= colsOf(next)) return;
    const key = keyOf(at.r + i, at.c + j);
    if (s) styles[key] = { ...s };
    else delete styles[key];
  }));
  patch.cellStyles = Object.keys(styles).length ? styles : undefined;
  return { ...result, patch };
}
