// The kinds of chart the Studio offers (the list of Excel's Insert Chart, minus what an exam never needs: maps, stock, surface, treemap and
// sunburst), their variants, the sample table each starts from, and the default look. Pure functions, unit-tested.
import type { Lang } from "@/app/_lib/types";
import { CHART_FAMILIES, type AxisOptions, type ChartConfig, type ChartData, type ChartFamily, type DataLabels } from "./types";

export interface VariantDef {
  id: string;
  /** English name (the key of the translations) */
  label: string;
}

export interface FamilyDef {
  id: ChartFamily;
  /** English name (the key of the translations) */
  label: string;
  variants: VariantDef[];
}

export const FAMILIES: readonly FamilyDef[] = [
  {
    id: "column",
    label: "Column",
    variants: [
      { id: "clustered", label: "Clustered Column" },
      { id: "stacked", label: "Stacked Column" },
      { id: "stacked100", label: "100% Stacked Column" },
    ],
  },
  {
    id: "line",
    label: "Line",
    variants: [
      { id: "line", label: "Line" },
      { id: "stacked", label: "Stacked Line" },
      { id: "stacked100", label: "100% Stacked Line" },
      { id: "markers", label: "Line with Markers" },
      { id: "stackedMarkers", label: "Stacked Line with Markers" },
      { id: "stacked100Markers", label: "100% Stacked Line with Markers" },
    ],
  },
  {
    id: "pie",
    label: "Pie",
    variants: [
      { id: "pie", label: "Pie" },
      { id: "doughnut", label: "Doughnut" },
    ],
  },
  {
    id: "bar",
    label: "Bar",
    variants: [
      { id: "clustered", label: "Clustered Bar" },
      { id: "stacked", label: "Stacked Bar" },
      { id: "stacked100", label: "100% Stacked Bar" },
    ],
  },
  {
    id: "area",
    label: "Area",
    variants: [
      { id: "area", label: "Area" },
      { id: "stacked", label: "Stacked Area" },
      { id: "stacked100", label: "100% Stacked Area" },
    ],
  },
  {
    id: "scatter",
    label: "X Y (Scatter)",
    variants: [
      { id: "markers", label: "Scatter" },
      { id: "smoothMarkers", label: "Scatter with Smooth Lines and Markers" },
      { id: "smooth", label: "Scatter with Smooth Lines" },
      { id: "linesMarkers", label: "Scatter with Straight Lines and Markers" },
      { id: "lines", label: "Scatter with Straight Lines" },
    ],
  },
  {
    id: "radar",
    label: "Radar",
    variants: [
      { id: "radar", label: "Radar" },
      { id: "markers", label: "Radar with Markers" },
      { id: "filled", label: "Filled Radar" },
    ],
  },
  {
    id: "histogram",
    label: "Histogram",
    variants: [
      { id: "raw", label: "Histogram" },
      { id: "classes", label: "Histogram of classes" },
    ],
  },
  {
    id: "box",
    label: "Box & Whisker",
    variants: [
      { id: "vertical", label: "Box and Whisker" },
      { id: "horizontal", label: "Horizontal Box and Whisker" },
    ],
  },
  { id: "waterfall", label: "Waterfall", variants: [{ id: "waterfall", label: "Waterfall" }] },
  { id: "funnel", label: "Funnel", variants: [{ id: "funnel", label: "Funnel" }] },
  {
    id: "combo",
    label: "Combo",
    variants: [
      { id: "columnLine", label: "Clustered Column - Line" },
      { id: "columnLineSecondary", label: "Clustered Column - Line on Secondary Axis" },
      { id: "areaColumn", label: "Stacked Area - Clustered Column" },
      { id: "custom", label: "Custom Combination" },
    ],
  },
];

export const familyDef = (id: ChartFamily): FamilyDef => FAMILIES.find((f) => f.id === id) ?? FAMILIES[0];
export const variantDef = (family: ChartFamily, id: string): VariantDef => familyDef(family).variants.find((v) => v.id === id) ?? familyDef(family).variants[0];

/** Whether the variant adds the series up (stacked) or up to 100 % */
export const isStacked = (variant: string) => variant.startsWith("stacked");
export const isPercentStacked = (variant: string) => variant.startsWith("stacked100");

// ---- sample data ----

const WORDS = {
  fr: { category: "Catégorie", series: "Série", title: "Titre du graphique", marks: "Notes", start: "Début", end: "Fin", count: "Effectif", amount: "Montant", total: "Total", classLabel: "Classe", sales: "Ventes" },
  ar: { category: "الفئة", series: "السلسلة", title: "عنوان الرسم", marks: "النقط", start: "البداية", end: "النهاية", count: "التكرار", amount: "المبلغ", total: "المجموع", classLabel: "القسم", sales: "المبيعات" },
};

const grid = (header: string[], rows: (string | number)[][]): string[][] => [header, ...rows.map((r) => r.map(String))];

/** The table a new chart of this kind starts from (Excel's Category 1…4 and Series 1…3, or what the kind needs) */
export function sampleData(family: ChartFamily, variant: string, lang: Lang = "fr"): ChartData {
  const w = WORDS[lang === "ar" ? "ar" : "fr"];
  const cat = (n: number) => `${w.category} ${n}`;
  const ser = (n: number) => `${w.series} ${n}`;
  const basic = (series: number): ChartData => ({
    cells: grid(
      ["", ...Array.from({ length: series }, (_, i) => ser(i + 1))],
      [
        [cat(1), 4.3, 2.4, 2],
        [cat(2), 2.5, 4.4, 2],
        [cat(3), 3.5, 1.8, 3],
        [cat(4), 4.5, 2.8, 5],
      ].map((r) => r.slice(0, series + 1)),
    ),
    calc: true,
    header: true,
    labels: true,
  });
  switch (family) {
    case "pie":
      return { cells: grid(["", w.sales], [[cat(1), 8.2], [cat(2), 3.2], [cat(3), 1.4], [cat(4), 1.2]]), calc: true, header: true, labels: true };
    case "scatter":
      return {
        cells: grid(["x", ser(1), ser(2)], [[1, 1.2, 5], [2, 2.1, 4.1], [3, 2.9, 3.2], [4, 4.2, 2.2], [5, 4.8, 1.5], [6, 6.1, 0.9]]),
        calc: true,
        header: true,
        labels: true,
      };
    case "radar":
      return {
        cells: grid(["", ser(1), ser(2)], [[cat(1), 4, 2], [cat(2), 3, 4.5], [cat(3), 5, 3], [cat(4), 2.5, 4], [cat(5), 4, 1.5]]),
        calc: true,
        header: true,
        labels: true,
      };
    case "histogram":
      return variant === "classes"
        ? { cells: grid([w.start, w.end, w.count], [[0, 4, 2], [4, 8, 5], [8, 12, 11], [12, 16, 9], [16, 20, 3]]), calc: true, header: true, labels: false }
        : {
            cells: grid([w.marks], [8, 12, 15, 9, 11, 13, 10, 14, 7, 16, 12, 11, 9, 13, 15, 10, 12, 8, 14, 11, 17, 12, 10, 13, 6, 12, 15, 11, 9, 14].map((v) => [v])),
            calc: true,
            header: true,
            labels: false,
          };
    case "box":
      return {
        cells: grid(
          [`${w.classLabel} A`, `${w.classLabel} B`, `${w.classLabel} C`],
          [
            [8, 5, 11],
            [10, 9, 12],
            [11, 10, 13],
            [12, 11, 13],
            [12, 12, 14],
            [13, 12, 15],
            [14, 13, 15],
            [14, 14, 16],
            [15, 15, 17],
            [17, 19, 18],
          ],
        ),
        calc: true,
        header: true,
        labels: false,
      };
    case "waterfall":
      return {
        cells: grid(["", w.amount], [[lang === "ar" ? "البداية" : "Départ", 100], [lang === "ar" ? "مبيعات" : "Ventes", 60], [lang === "ar" ? "مشتريات" : "Achats", -45], [lang === "ar" ? "مصاريف" : "Frais", -20], [w.total, 95]]),
        calc: true,
        header: true,
        labels: true,
      };
    case "funnel":
      return {
        cells: grid(["", w.count], [[lang === "ar" ? "زيارات" : "Visites", 1000], [lang === "ar" ? "مسجلون" : "Inscrits", 620], [lang === "ar" ? "تجارب" : "Essais", 340], [lang === "ar" ? "مشتريات" : "Achats", 120]]),
        calc: true,
        header: true,
        labels: true,
      };
    default:
      return basic(3);
  }
}

// ---- defaults ----

export const defaultAxis = (): AxisOptions => ({ show: true, title: "", min: null, max: null, unit: null, minorUnit: null, format: {}, log: false, reverse: false, labelAngle: "auto", ticks: "out", every: null, line: true });

export const defaultLabels = (): DataLabels => ({ show: false, value: true, category: false, series: false, percent: false, position: "auto", separator: "; ", format: {}, size: 11, bold: false, color: null });

/** The size a chart of this kind starts at on the page (px) */
export const defaultSize = (family: ChartFamily): { width: number; height: number } => (family === "pie" || family === "radar" ? { width: 460, height: 340 } : { width: 560, height: 360 });

/** A new chart of a kind, with its sample table and the usual look. `lang` is the language of the exam (its words and its decimal mark). */
export function defaultChart(family: ChartFamily = "column", variant?: string, lang: Lang = "fr"): ChartConfig {
  const v = variantDef(family, variant ?? familyDef(family).variants[0].id).id;
  const { width, height } = defaultSize(family);
  const stacked = isStacked(v);
  const config: ChartConfig = {
    family,
    variant: v,
    data: sampleData(family, v, lang),
    title: { text: WORDS[lang === "ar" ? "ar" : "fr"].title, show: true, position: "top", size: 16, bold: true, italic: false, color: "#1f2937", align: "center" },
    width,
    height,
    fontSize: 12,
    palette: "colorful",
    patterns: false,
    varyColors: family === "pie",
    background: "#ffffff",
    border: false,
    legend: { show: family !== "histogram" && family !== "waterfall", position: "bottom" },
    axes: { x: defaultAxis(), y: defaultAxis(), y2: { ...defaultAxis(), show: true } },
    grid: { y: true, yMinor: false, x: false, xMinor: false },
    labels: defaultLabels(),
    series: [],
    gap: family === "histogram" ? 0 : 80,
    overlap: stacked ? 100 : 0,
    dataTable: false,
    pie: { firstAngle: 0, hole: 55, explode: 0 },
    histogram: { bins: "auto", width: 2, count: 5, start: null, cumulative: false, polygon: false, relative: false, intervals: "french", axisLabels: "classes" },
    box: { method: "lycee", mean: true, outliers: true, points: false },
    waterfall: { totals: family === "waterfall" ? [0, 4] : [], connectors: true, up: "#2e8b57", down: "#c0392b", total: "#4472c4" },
    blank: false,
    decimalMark: ",",
  };
  if (family === "scatter") config.grid = { y: true, yMinor: false, x: true, xMinor: false };
  // (the line of a value axis is for the charts of numbers: a scatter, a histogram, a box; the others have their gridlines)
  config.axes.y.line = family === "scatter" || family === "histogram" || family === "box";
  config.axes.y2.line = false;
  if (family === "box") config.legend.show = false;
  if (family === "funnel") {
    config.legend.show = false;
    config.labels.show = true;
    config.axes.x.show = true;
  }
  if (family === "pie") config.legend.position = "right";
  return config;
}

// ---- reading a saved chart ----

const CHART_FAMILIES_SET = new Set<string>(CHART_FAMILIES);

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** A chart as it was saved, with every missing setting put back to its default (a chart from an earlier version opens as it was). */
export function normalizeChart(saved: unknown, lang: Lang = "fr"): ChartConfig {
  const s = obj(saved);
  const family = (CHART_FAMILIES_SET.has(s.family as string) ? s.family : "column") as ChartFamily;
  const base = defaultChart(family, typeof s.variant === "string" ? s.variant : undefined, lang);
  const merged = { ...base, ...(s as Partial<ChartConfig>) } as ChartConfig;
  const axes = obj(s.axes);
  return {
    ...merged,
    family,
    variant: base.variant,
    data: { ...base.data, ...obj(s.data), cells: Array.isArray(obj(s.data).cells) && (obj(s.data).cells as unknown[]).length ? (obj(s.data).cells as string[][]) : base.data.cells },
    title: { ...base.title, ...obj(s.title) },
    legend: { ...base.legend, ...obj(s.legend) },
    axes: { x: { ...base.axes.x, ...obj(axes.x) }, y: { ...base.axes.y, ...obj(axes.y) }, y2: { ...base.axes.y2, ...obj(axes.y2) } },
    grid: { ...base.grid, ...obj(s.grid) },
    labels: { ...base.labels, ...obj(s.labels) },
    pie: { ...base.pie, ...obj(s.pie) },
    histogram: { ...base.histogram, ...obj(s.histogram) },
    box: { ...base.box, ...obj(s.box) },
    waterfall: { ...base.waterfall, ...obj(s.waterfall) },
    series: Array.isArray(s.series) ? (s.series as ChartConfig["series"]) : [],
  };
}

/** The same chart as another kind (Change Chart Type): the table and the look stay; what belongs to the kind is set as the kind has it. */
export function changeKind(config: ChartConfig, family: ChartFamily, variant: string): ChartConfig {
  const fresh = defaultChart(family, variant);
  const v = fresh.variant;
  return {
    ...config,
    family,
    variant: v,
    overlap: isStacked(v) ? 100 : config.overlap === 100 ? 0 : config.overlap,
    gap: family === "histogram" ? 0 : config.family === "histogram" ? 80 : config.gap,
    varyColors: family === "pie" ? true : config.family === "pie" ? false : config.varyColors,
    legend: { ...config.legend, position: family === "pie" && config.family !== "pie" ? "right" : config.legend.position },
    waterfall: family === "waterfall" && !config.waterfall.totals.length ? fresh.waterfall : config.waterfall,
  };
}
