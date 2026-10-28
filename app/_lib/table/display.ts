// What the cells of a table show: the text as typed, or the value of a formula or of a number with a format, written the way the
// exam's language writes it. The page (blockLayout) and the Studio's grid both read it, so they agree. Pure functions.
import { plainText } from "@/app/_lib/richText";
import { formatNumber } from "./format";
import { createSheet, isError, isFormula, type Sheet, type Value } from "./formula";
import { styleAt, type TableData } from "./model";

export const tableSheet = (t: Pick<TableData, "cells" | "calc">): Sheet => createSheet(t.cells, !!t.calc, plainText);

const truth = (v: boolean, lang: string) => (lang === "ar" ? (v ? "صحيح" : "خطأ") : v ? "VRAI" : "FAUX");

/** The text the cell at (r, c) shows (a text typed with styles keeps its style markers) */
export function shownText(t: TableData, sheet: Sheet, r: number, c: number, lang: string): string {
  const raw = t.cells[r]?.[c] ?? "";
  const fmt = styleAt(t, r, c).fmt;
  const formula = !!t.calc && isFormula(raw);
  if (!formula && !fmt) return raw;
  const v = sheet.value(r, c);
  if (isError(v)) return formula ? v.error : raw;
  if (typeof v === "number") return formatNumber(v, fmt, ",");
  if (!formula) return raw;
  if (typeof v === "boolean") return truth(v, lang);
  return v === null ? "" : v;
}

/** The value of a cell, for what a formula would see */
export const valueOf = (t: Pick<TableData, "cells" | "calc">, r: number, c: number): Value => tableSheet(t).value(r, c);

/** Every cell's shown text */
export function displayGrid(t: TableData, lang: string): string[][] {
  const sheet = tableSheet(t);
  return t.cells.map((row, r) => row.map((_, c) => shownText(t, sheet, r, c, lang)));
}

/** Whether the cell shows an error (#DIV/0!…) */
export const showsError = (shown: string) => /^#[A-Z/0]+[!?]?$/.test(shown) || shown === "#N/A";
