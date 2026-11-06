// A chart of the Chart Studio: one list of values with their names, drawn as bars, sticks, a histogram, a line, an area or a (half) pie. Kept
// on the image block of the chart (`chartStudio`) so the Studio can open it again; the picture itself is drawn from it (render.ts).
import type { ShapeItem } from "@/app/_lib/shapes";

/** bar: vertical bars · hbar: horizontal bars · stick: a thin stick per value (diagramme en bâtons) · histogram: bars side by side with no
 *  gap, one per class · line · area: a line with the room under it filled · pie · halfpie: a half disc (diagramme semi-circulaire) */
export type ChartKind = "bar" | "hbar" | "stick" | "histogram" | "line" | "area" | "pie" | "halfpie";

export const CHART_KINDS: ChartKind[] = ["bar", "hbar", "stick", "histogram", "line", "area", "pie", "halfpie"];

/** A pie or a half pie: no axes, the slices take the palette */
export const isRoundChart = (kind: ChartKind) => kind === "pie" || kind === "halfpie";

/** One value of the chart and its name ("Monday", "[0;10[", "Red"…); `value` null = not filled in yet */
export interface ChartRow {
  label: string;
  value: number | null;
}

export interface ChartConfig {
  kind: ChartKind;
  title: string;
  rows: ChartRow[];
  /** The name of the axis under the chart and of the one on its left (not for a pie) */
  xTitle: string;
  yTitle: string;
  /** The color of the bars, sticks, line or area (a pie takes the palette) */
  color: string;
  /** The value written on each bar, point or slice (a slice: its share in %) */
  showValues: boolean;
  /** Lines at each step of the scale (not for a pie) */
  grid: boolean;
  /** Size of the picture, in page pixels */
  width: number;
  height: number;
  /** What was drawn over the chart with the floating tool bar (strokes, shapes, text boxes), in page px of the picture */
  shapes?: ShapeItem[];
}

/** Colors offered for the bars and the line; the slices of a pie take them in turn. Black and grey print well in black and white. */
export const CHART_COLORS = ["#2563eb", "#dc2626", "#059669", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#4b5563", "#111827"];

export const MIN_CHART_SIZE = 200;
export const MAX_CHART_SIZE = 794;

/** A new chart: four bars to fill in */
export function newChart(): ChartConfig {
  return {
    kind: "bar",
    title: "",
    rows: [
      { label: "A", value: 4 },
      { label: "B", value: 7 },
      { label: "C", value: 3 },
      { label: "D", value: 5 },
    ],
    xTitle: "",
    yTitle: "",
    color: CHART_COLORS[0],
    showValues: false,
    grid: true,
    width: 480,
    height: 320,
  };
}

/** A chart read from a block, or null when what is saved is not one (a chart from an older Chart Studio: it stays a plain picture) */
export function readChart(saved: unknown): ChartConfig | null {
  if (!saved || typeof saved !== "object") return null;
  const s = saved as Partial<ChartConfig>;
  if (!Array.isArray(s.rows) || !CHART_KINDS.includes(s.kind as ChartKind)) return null;
  const base = newChart();
  return {
    ...base,
    ...s,
    rows: s.rows.map((r) => ({ label: String(r?.label ?? ""), value: typeof r?.value === "number" && Number.isFinite(r.value) ? r.value : null })),
    shapes: Array.isArray(s.shapes) && s.shapes.length ? s.shapes : undefined,
  } as ChartConfig;
}
