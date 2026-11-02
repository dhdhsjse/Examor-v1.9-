// What a series can have besides its shapes: labels on its points, a trendline with its equation, error bars. Pure functions.
import { valueText } from "../scale";
import { coefText, equationText, fitTrend, movingAverage, stdev, type Fit } from "../stats";
import type { DataLabels, ErrorBars, Trendline } from "../types";
import type { ModelSeries } from "../data";
import type { Ctx } from "./kit";

/** The labels of a series: the chart's, over which the series' own are laid */
export function labelsFor(ctx: Ctx, s: ModelSeries): DataLabels {
  return { ...ctx.c.labels, ...s.style.labels };
}

/** The text of one label: the parts that are on, in the order series, category, value, percent, with the separator. */
export function labelText(ctx: Ctx, o: DataLabels, parts: { series: string; category: string; value: number; share?: number }): string {
  const out: string[] = [];
  if (o.series) out.push(parts.series);
  if (o.category) out.push(parts.category);
  if (o.value) out.push(valueText(parts.value, o.format, ctx.mark));
  if (o.percent && parts.share !== undefined) out.push(valueText(parts.share, { percent: true, decimals: o.format.decimals ?? 0 }, ctx.mark));
  return out.join(o.separator);
}

// ---- error bars ----

/** How far the bar of a value goes from it (a fixed size, a percentage of the value, or some standard deviations of the series) */
export function errorSize(e: ErrorBars, value: number, all: readonly number[]): number {
  if (e.kind === "fixed") return Math.abs(e.value);
  if (e.kind === "percent") return Math.abs(value) * Math.abs(e.value) / 100;
  const sd = stdev(all);
  return Number.isFinite(sd) ? sd * Math.abs(e.value) : 0;
}

/** The two ends of an error bar: [low, high] */
export function errorEnds(e: ErrorBars, value: number, all: readonly number[]): [number, number] {
  const d = errorSize(e, value, all);
  return [e.direction === "plus" ? value : value - d, e.direction === "minus" ? value : value + d];
}

// ---- trendlines ----

export interface Trend {
  /** The line as points, in the x of the data */
  points: [number, number][];
  /** The text to write near its end (equation, R²), and the name in the legend */
  note: string;
  legend: string;
  fit: Fit | null;
}

/** The trendline of a series through its points (x, y): the points to draw (to its ends, with the forecast), the note and the legend name. */
export function trendOf(ctx: Ctx, t: Trendline, pts: readonly [number, number][], xRange: [number, number], name: string): Trend | null {
  const kind = ctx.words.trend[t.kind];
  if (t.kind === "moving") {
    const period = Math.max(2, Math.round(t.period));
    const avg = movingAverage(pts.map((p) => p[1]), period);
    const out = pts.flatMap((p, i): [number, number][] => (avg[i] === null ? [] : [[p[0], avg[i] as number]]));
    return out.length ? { points: out, note: "", legend: `${kind} (${period}) — ${name}`, fit: null } : null;
  }
  const fit = fitTrend(pts, t);
  if (!fit) return null;
  const lo = xRange[0] - Math.max(0, t.backward);
  const hi = xRange[1] + Math.max(0, t.forward);
  const N = 64;
  const points: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const x = lo + ((hi - lo) * i) / N;
    const y = fit.predict(x);
    if (Number.isFinite(y)) points.push([x, y]);
  }
  const bits: string[] = [];
  if (t.equation) bits.push(equationText(fit, ctx.mark));
  if (t.r2) bits.push(`R² = ${coefText(fit.r2, ctx.mark)}`);
  const degree = t.kind === "poly" ? ` (${Math.max(2, Math.min(6, Math.round(t.order)))})` : "";
  return { points, note: bits.join("   "), legend: `${kind}${degree} — ${name}`, fit };
}
