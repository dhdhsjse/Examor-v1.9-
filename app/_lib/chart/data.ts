// From the table of a chart to what is drawn: the categories, the series and their numbers (Excel's "Select data": the series in the columns or
// in the rows, a first row of names, a first column of categories), and for the kinds that need it the classes of a histogram, the rows of a
// waterfall, the boxes. Pure functions (no React, no DOM), unit-tested (__tests__/chart-data.test.ts).
import { parseNumber } from "@/app/_lib/table/format";
import { isFormula } from "@/app/_lib/table/formula";
import { tableSheet } from "@/app/_lib/table/display";
import { plainText } from "@/app/_lib/richText";
import { binLabel, binValues, boxStats, type Bin, type BoxStats } from "./stats";
import type { ChartConfig, ChartData, SeriesStyle } from "./types";

export interface Words {
  series: string;
  category: string;
  /** Waterfall legend */
  up: string;
  down: string;
  total: string;
  /** The names of the trendlines (Excel's: Linear, Exponential…) */
  trend: Record<"linear" | "exp" | "log" | "poly" | "power" | "moving", string>;
}
export const WORDS_FR: Words = { series: "Série", category: "Catégorie", up: "Hausse", down: "Baisse", total: "Total", trend: { linear: "Linéaire", exp: "Exponentielle", log: "Logarithmique", poly: "Polynomiale", power: "Puissance", moving: "Moyenne mobile" } };
export const WORDS_AR: Words = { series: "السلسلة", category: "الفئة", up: "زيادة", down: "نقصان", total: "المجموع", trend: { linear: "خطي", exp: "أسي", log: "لوغاريتمي", poly: "متعدد الحدود", power: "قوة", moving: "متوسط متحرك" } };

/** What the cells hold: their text, and their number where they are one (a formula is worked out) */
export interface Cells {
  text: string[][];
  num: (number | null)[][];
}

/** The table as text and numbers, the series in the columns (a table of series in the rows is turned round). */
export function readCells(data: ChartData): Cells {
  const sheet = tableSheet({ cells: data.cells, calc: data.calc });
  const rows = data.cells.length;
  const cols = Math.max(0, ...data.cells.map((r) => r.length));
  const text: string[][] = [];
  const num: (number | null)[][] = [];
  for (let r = 0; r < rows; r++) {
    text.push([]);
    num.push([]);
    for (let c = 0; c < cols; c++) {
      const raw = data.cells[r]?.[c] ?? "";
      const v = sheet.value(r, c);
      if (typeof v === "number") {
        num[r].push(v);
        text[r].push(data.calc && isFormula(raw) ? String(Math.round(v * 1e6) / 1e6) : plainText(raw).trim());
      } else if (typeof v === "string") {
        num[r].push(parseNumber(v));
        text[r].push(v);
      } else {
        num[r].push(null);
        text[r].push(typeof v === "boolean" ? String(v) : "");
      }
    }
  }
  if (data.seriesIn === "rows") {
    const t = Array.from({ length: cols }, (_, c) => Array.from({ length: rows }, (_, r) => text[r][c]));
    const n = Array.from({ length: cols }, (_, c) => Array.from({ length: rows }, (_, r) => num[r][c]));
    return { text: t, num: n };
  }
  return { text, num };
}

export interface ModelSeries {
  /** Its place among the series of the table (the one the settings of the series are kept under) */
  index: number;
  name: string;
  values: (number | null)[];
  style: SeriesStyle;
}

export interface ChartModel {
  categories: string[];
  /** The x values of a scatter (null = the places 1, 2, 3…) */
  xs: number[] | null;
  /** Every series of the table that has anything in it, the hidden ones too */
  series: ModelSeries[];
  /** There is nothing to draw: no category and no number */
  empty: boolean;
}

/** Reads the series and the categories from the table of a chart. */
export function readModel(config: ChartConfig, words: Words = WORDS_FR): ChartModel {
  const { text, num } = readCells(config.data);
  const header = config.data.header !== false;
  const labels = config.data.labels !== false;
  const i0 = header ? 1 : 0;
  const j0 = labels ? 1 : 0;
  // the rows of the body, up to the last that has anything in it
  let n = Math.max(0, text.length - i0);
  while (n > 0 && text[i0 + n - 1].every((t, c) => t === "" && num[i0 + n - 1][c] === null)) n--;
  const cols = Math.max(0, ...text.map((r) => r.length));
  const categories = Array.from({ length: n }, (_, k) => (labels ? text[i0 + k][0] : "") || String(k + 1));
  const series: ModelSeries[] = [];
  let index = 0;
  for (let j = j0; j < cols; j++) {
    const values = Array.from({ length: n }, (_, k) => num[i0 + k][j] ?? null);
    const name = header ? text[0]?.[j] ?? "" : "";
    if (values.every((v) => v === null) && !name) continue;
    const style = config.series[index] ?? {};
    series.push({ index, name: style.name || name || `${words.series} ${index + 1}`, values, style });
    index++;
  }
  let xs: number[] | null = null;
  if (labels && n > 0) {
    const col = Array.from({ length: n }, (_, k) => num[i0 + k][0]);
    if (col.every((v) => v !== null)) xs = col as number[];
  }
  return { categories, xs, series, empty: n === 0 || series.length === 0 };
}

// ---- classes of a histogram ----

export interface ClassTable {
  bins: Bin[];
  /** The classes are not all as wide: the heights are the numbers per unit of width, so that the areas are the numbers */
  unequal: boolean;
  /** The number of data (the total of the classes) */
  total: number;
}

/** The classes of a histogram of raw values (one column of the table: the first series) */
export function rawBins(config: ChartConfig, model: ChartModel): ClassTable {
  const values = (model.series[0]?.values ?? []).filter((v): v is number => v !== null);
  const bins = binValues(values, config.histogram);
  return { bins, unequal: false, total: values.length };
}

/** The classes of a table of classes: the lower end, the upper end, the number (rows of the first three columns). */
export function classBins(config: ChartConfig): ClassTable {
  const { num } = readCells({ ...config.data, seriesIn: "columns" });
  const header = config.data.header !== false;
  const bins: Bin[] = [];
  for (const row of num.slice(header ? 1 : 0)) {
    const [lo, hi, count] = row;
    if (lo === null || hi === null || count === null || hi <= lo) continue;
    bins.push({ lo, hi, count });
  }
  bins.sort((a, b) => a.lo - b.lo);
  const widths = bins.map((b) => b.hi - b.lo);
  const unequal = widths.some((w) => Math.abs(w - widths[0]) > 1e-9 * Math.max(1, widths[0]));
  return { bins, unequal, total: bins.reduce((s, b) => s + b.count, 0) };
}

export const classTable = (config: ChartConfig, model: ChartModel): ClassTable => (config.variant === "classes" ? classBins(config) : rawBins(config, model));

/** The name of every class, for the axis and the table */
export const classLabels = (t: ClassTable, config: ChartConfig) => t.bins.map((b, i) => binLabel(b, i === t.bins.length - 1, config.histogram.intervals, config.decimalMark));

// ---- boxes ----

export interface BoxSeries {
  name: string;
  index: number;
  stats: BoxStats;
}

/** The box of every series with data in it (hidden series left out) */
export function boxSeries(config: ChartConfig, model: ChartModel): BoxSeries[] {
  return model.series.flatMap((s) => {
    if (s.style.hidden) return [];
    const stats = boxStats(s.values.filter((v): v is number => v !== null), config.box.method, config.box.outliers);
    return stats ? [{ name: s.name, index: s.index, stats }] : [];
  });
}

// ---- waterfall ----

export interface Step {
  label: string;
  /** What the step adds (negative: takes off); for a total, the total */
  value: number;
  total: boolean;
  /** The two ends of the bar */
  from: number;
  to: number;
}

/** The steps of a waterfall: each adds to the running total, except the ones marked as totals, which show it (or the value given there). */
export function waterfallSteps(config: ChartConfig, model: ChartModel): Step[] {
  const s = model.series[0];
  if (!s) return [];
  const steps: Step[] = [];
  let running = 0;
  s.values.forEach((v, i) => {
    const value = v ?? 0;
    const total = config.waterfall.totals.includes(i);
    if (total) {
      // a total with a number written is the number (it sets the running total), without one it is the running total
      const to = v === null ? running : value;
      steps.push({ label: model.categories[i], value: to, total: true, from: 0, to });
      running = to;
    } else {
      steps.push({ label: model.categories[i], value, total: false, from: running, to: running + value });
      running += value;
    }
  });
  return steps;
}

// ---- general ----

/** The numbers of a series that are there (no gaps) */
export const present = (v: readonly (number | null)[]): number[] => v.filter((x): x is number => x !== null && Number.isFinite(x));

/** The data of series that are drawn (not hidden) */
export const visible = (model: ChartModel) => model.series.filter((s) => !s.style.hidden);
