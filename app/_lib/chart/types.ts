// The data of a chart (Insert → Chart Studio): which kind it is, the table it is made from, and how it looks. Everything but the kind and the
// table is optional in a saved chart (`normalizeChart` puts the defaults back), so a chart saved by an earlier version still opens. Nothing
// here is React or the DOM: the Studio and the SVG picture both read it.
import type { NumberFormat } from "@/app/_lib/table/format";

export const CHART_FAMILIES = ["column", "bar", "line", "pie", "area", "scatter", "radar", "histogram", "box", "waterfall", "funnel", "combo"] as const;
export type ChartFamily = (typeof CHART_FAMILIES)[number];

export const PALETTES = ["colorful", "blue", "green", "orange", "purple", "red", "gray", "pastel"] as const;
export type PaletteId = (typeof PALETTES)[number];

export type Side = "top" | "bottom" | "left" | "right";
export type Dash = "solid" | "dashed" | "dotted";
export type MarkerShape = "circle" | "square" | "diamond" | "triangle" | "cross" | "x";
/** How a series of a combination (or of any chart that allows it) is drawn */
export type SeriesKind = "column" | "line" | "area";

/** The table the chart is made from, and how it is read: Excel's "Select data" (switch row/column, first row, first column). */
export interface ChartData {
  /** The cells as typed (a formula as a formula) */
  cells: string[][];
  /** A cell starting with = is worked out */
  calc?: boolean;
  /** Where the series are: in the columns (the default) or in the rows */
  seriesIn?: "columns" | "rows";
  /** The first row (or column, when the series are in the rows) holds the names of the series */
  header?: boolean;
  /** The first column (row) holds the names of the categories, or the x values of a scatter */
  labels?: boolean;
}

export interface ChartTitle {
  text: string;
  show: boolean;
  position: "top" | "bottom";
  size: number;
  bold: boolean;
  italic: boolean;
  color: string;
  align: "center" | "start";
}

export interface AxisOptions {
  show: boolean;
  title: string;
  /** The scale of a value axis: null = chosen from the data */
  min: number | null;
  max: number | null;
  /** The distance between the numbers (main) and between the fine lines */
  unit: number | null;
  minorUnit: number | null;
  /** How the numbers on the axis are written */
  format: NumberFormat;
  /** A logarithmic scale (positive numbers only) */
  log: boolean;
  /** The other way round (a category axis: the last category first; a value axis: downwards) */
  reverse: boolean;
  /** The tilt of the category names */
  labelAngle: "auto" | 0 | 45 | 90;
  /** The little lines at the numbers */
  ticks: "out" | "in" | "none";
  /** A category axis writes the name of one category in n (null = as many as fit) */
  every: number | null;
  /** The line of the axis itself */
  line: boolean;
}

export type LabelPosition = "auto" | "outside" | "inside" | "center" | "base" | "above" | "below" | "left" | "right";

export interface DataLabels {
  show: boolean;
  value: boolean;
  category: boolean;
  series: boolean;
  /** The share of the whole (pie, doughnut, funnel) */
  percent: boolean;
  position: LabelPosition;
  separator: string;
  format: NumberFormat;
  size: number;
  bold: boolean;
  /** null = the color that reads on what is behind it */
  color: string | null;
}

export type TrendKind = "linear" | "exp" | "log" | "poly" | "power" | "moving";

export interface Trendline {
  kind: TrendKind;
  /** The degree of a polynomial */
  order: number;
  /** The period of a moving average */
  period: number;
  /** How far the line goes on past the last x and before the first (in x units) */
  forward: number;
  backward: number;
  /** Write its equation, and R², on the chart */
  equation: boolean;
  r2: boolean;
  color: string | null;
  dash: Dash;
}

export interface ErrorBars {
  kind: "fixed" | "percent" | "stdev";
  /** The size: a number of units, a percentage, or a number of standard deviations */
  value: number;
  direction: "both" | "plus" | "minus";
  cap: boolean;
}

export interface SeriesStyle {
  /** A name that replaces the one of the table */
  name?: string;
  color?: string;
  hidden?: boolean;
  /** Combination charts: how this series is drawn, and whether on the second value axis */
  kind?: SeriesKind;
  secondary?: boolean;
  /** Lines: width, dashes, smoothness; markers */
  width?: number;
  dash?: Dash;
  smooth?: boolean;
  marker?: MarkerShape | "none";
  markerSize?: number;
  /** The opacity of an area (and of a filled radar) */
  opacity?: number;
  /** Labels of this series only (over the chart's) */
  labels?: Partial<DataLabels>;
  trendline?: Trendline;
  error?: ErrorBars;
  /** A color of its own for some points (a bar, a slice), by their place; a slice can be pulled out */
  points?: Record<number, { color?: string; explode?: number; text?: string }>;
}

export type QuartileMethod = "lycee" | "inclusive" | "exclusive";

export interface ChartConfig {
  family: ChartFamily;
  /** Which of the family's kinds: see catalog.ts (clustered, stacked, stacked100, markers, doughnut…) */
  variant: string;
  data: ChartData;
  title: ChartTitle;
  /** The size of the picture in px */
  width: number;
  height: number;
  /** A font of the app's list (missing = the font of the exam) and the size of the text */
  fontFamily?: string;
  fontSize: number;
  palette: PaletteId;
  /** Hatchings instead of flat colors (what prints well in black and white) */
  patterns: boolean;
  /** A color for each point of a one-series chart (always on for a pie) */
  varyColors: boolean;
  background: string | null;
  border: boolean;
  /** `identify` (pie, doughnut): how the parts are told apart: by their color (the legend), by a number written in each part (the legend lists them), or by their name or a text of your own (`points[k].text`) written in it */
  legend: { show: boolean; position: Side; identify?: "color" | "number" | "name" | "text" };
  axes: { x: AxisOptions; y: AxisOptions; y2: AxisOptions };
  grid: { y: boolean; yMinor: boolean; x: boolean; xMinor: boolean };
  /** The labels of the chart (a series can have its own) */
  labels: DataLabels;
  /** What is special about each series, by its place in the table */
  series: SeriesStyle[];
  /** Columns and bars: the room between groups, and how much the bars of a group overlap (both in % of a bar) */
  gap: number;
  overlap: number;
  /** The table of the numbers under the chart */
  dataTable: boolean;
  /** `plain`: slices without color (white, outlined), for the parts told apart by what is written in them */
  pie: { firstAngle: number; hole: number; explode: number; plain?: boolean };
  histogram: { bins: "auto" | "width" | "count"; width: number; count: number; start: number | null; cumulative: boolean; polygon: boolean; relative: boolean; intervals: "french" | "plain"; axisLabels: "classes" | "limits" };
  box: { method: QuartileMethod; mean: boolean; outliers: boolean; points: boolean };
  waterfall: { totals: number[]; connectors: boolean; up: string; down: string; total: string };
  /** The picture for the students: the frame, the scale and the names, without the data (the correction sheet shows the whole chart) */
  blank: boolean;
  /** The decimal mark of the numbers */
  decimalMark: "," | ".";
}

export const MIN_CHART_SIZE = 160;
export const MAX_CHART_SIZE = 1600;
