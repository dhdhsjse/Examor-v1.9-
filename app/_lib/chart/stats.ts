// The statistics a chart needs: quartiles (the French lycée rule, and Excel's two), the five numbers of a box, trendlines (linear, exponential,
// logarithmic, polynomial, power, moving average) with their equation and R², and the classes of a histogram. Pure functions (no React, no
// DOM), unit-tested (__tests__/chart-stats.test.ts).
import { niceStep } from "@/app/_lib/graphMath";
import type { QuartileMethod, Trendline } from "./types";

export const sum = (v: readonly number[]) => v.reduce((s, x) => s + x, 0);
export const mean = (v: readonly number[]) => (v.length ? sum(v) / v.length : Number.NaN);
/** The standard deviation of the whole data (σ) */
export function stdev(v: readonly number[]): number {
  if (!v.length) return Number.NaN;
  const m = mean(v);
  return Math.sqrt(mean(v.map((x) => (x - m) ** 2)));
}

/** A number cleaned of the noise of floating point (0.1 + 0.2 → 0.3) */
export const tidy = (n: number) => Number(n.toPrecision(12));

// ---- quartiles and boxes ----

const sorted = (v: readonly number[]) => [...v].sort((a, b) => a - b);

/**
 * A quartile of data in order. "lycee": the smallest value such that at least a quarter (three quarters) of the data is at or under it, the
 * rule of the French and Algerian programmes (Q₁ = the term of rank ⌈n/4⌉); "inclusive" and "exclusive" are Excel's QUARTILE.INC and .EXC.
 */
export function quantile(sortedValues: readonly number[], p: number, method: QuartileMethod): number {
  const n = sortedValues.length;
  if (!n) return Number.NaN;
  if (method === "lycee") return sortedValues[Math.min(n - 1, Math.max(0, Math.ceil(n * p - 1e-9) - 1))];
  const pos = method === "inclusive" ? (n - 1) * p : (n + 1) * p - 1;
  const lo = Math.min(n - 1, Math.max(0, Math.floor(pos)));
  const hi = Math.min(n - 1, Math.max(0, Math.ceil(pos)));
  return sortedValues[lo] + (sortedValues[hi] - sortedValues[lo]) * (Math.min(n - 1, Math.max(0, pos)) - lo);
}

/** The median (the rule of the lycée is the usual one: the middle term, or the mean of the two middle ones) */
export function median(values: readonly number[]): number {
  const s = sorted(values);
  const n = s.length;
  if (!n) return Number.NaN;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

export interface BoxStats {
  n: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  /** The ends of the whiskers (the extremes, or with outliers apart the furthest data within 1.5 × the interquartile range) */
  low: number;
  high: number;
  outliers: number[];
}

export function boxStats(values: readonly number[], method: QuartileMethod, outliers = true): BoxStats | null {
  const s = sorted(values.filter(Number.isFinite));
  if (!s.length) return null;
  const q1 = quantile(s, 0.25, method);
  const q3 = quantile(s, 0.75, method);
  const med = median(s);
  const fence = 1.5 * (q3 - q1);
  const inside = outliers ? s.filter((x) => x >= q1 - fence && x <= q3 + fence) : s;
  return {
    n: s.length,
    min: s[0],
    q1,
    median: med,
    q3,
    max: s[s.length - 1],
    mean: mean(s),
    low: inside[0] ?? s[0],
    high: inside[inside.length - 1] ?? s[s.length - 1],
    outliers: outliers ? s.filter((x) => x < q1 - fence || x > q3 + fence) : [],
  };
}

// ---- trendlines ----

export interface Fit {
  kind: Trendline["kind"];
  predict: (x: number) => number;
  /** The coefficients: a polynomial from the highest power, y = a·x + b, a·eᵇˣ, a·ln x + b, a·xᵇ */
  coef: number[];
  r2: number;
}

type Pt = [number, number];

// Solves a·x = b (Gaussian elimination with pivoting); null if the matrix is singular.
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    if (Math.abs(m[p][c]) < 1e-12) return null;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = c + 1; r < n; r++) {
      const f = m[r][c] / m[c][c];
      for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = m[r][n];
    for (let k = r + 1; k < n; k++) s -= m[r][k] * x[k];
    x[r] = s / m[r][r];
  }
  return x;
}

/** Least squares polynomial of a degree: the coefficients from the highest power down (null if there are too few points) */
function polyfit(pts: Pt[], degree: number): number[] | null {
  if (pts.length <= degree) return null;
  const scale = Math.max(...pts.map(([x]) => Math.abs(x)), 1e-9); // (x / scale keeps the matrix well conditioned)
  const A = Array.from({ length: degree + 1 }, () => new Array<number>(degree + 1).fill(0));
  const B = new Array<number>(degree + 1).fill(0);
  for (const [x0, y] of pts) {
    const x = x0 / scale;
    for (let i = 0; i <= degree; i++) {
      B[i] += y * x ** i;
      for (let j = 0; j <= degree; j++) A[i][j] += x ** (i + j);
    }
  }
  const c = solve(A, B);
  if (!c) return null;
  return c.map((v, i) => v / scale ** i).reverse();
}

const evalPoly = (coef: number[], x: number) => coef.reduce((acc, c) => acc * x + c, 0);

const r2Of = (ys: number[], predicted: number[]) => {
  const m = mean(ys);
  const tot = sum(ys.map((y) => (y - m) ** 2));
  const res = sum(ys.map((y, i) => (y - predicted[i]) ** 2));
  return tot < 1e-300 ? 1 : 1 - res / tot;
};

/** The trendline through the points (null when the kind cannot be fitted: a logarithm of a negative x, too few points…). */
export function fitTrend(points: readonly Pt[], t: Pick<Trendline, "kind" | "order">): Fit | null {
  const pts = points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pts.length < 2) return null;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const finish = (kind: Fit["kind"], coef: number[], predict: Fit["predict"], z: number[], zPredicted: number[]): Fit => ({ kind, coef, predict, r2: r2Of(z, zPredicted) });
  switch (t.kind) {
    case "linear":
    case "poly": {
      const degree = t.kind === "linear" ? 1 : Math.max(2, Math.min(6, Math.round(t.order)));
      const coef = polyfit(pts, degree);
      return coef && finish(t.kind, coef, (x) => evalPoly(coef, x), ys, xs.map((x) => evalPoly(coef, x)));
    }
    case "log": {
      if (xs.some((x) => x <= 0)) return null;
      const c = polyfit(pts.map(([x, y]) => [Math.log(x), y]), 1);
      return c && finish("log", c, (x) => c[0] * Math.log(x) + c[1], ys, xs.map((x) => c[0] * Math.log(x) + c[1]));
    }
    case "exp": {
      if (ys.some((y) => y <= 0)) return null;
      const c = polyfit(pts.map(([x, y]) => [x, Math.log(y)]), 1);
      if (!c) return null;
      const a = Math.exp(c[1]);
      return finish("exp", [a, c[0]], (x) => a * Math.exp(c[0] * x), ys.map(Math.log), xs.map((x) => c[0] * x + c[1]));
    }
    case "power": {
      if (xs.some((x) => x <= 0) || ys.some((y) => y <= 0)) return null;
      const c = polyfit(pts.map(([x, y]) => [Math.log(x), Math.log(y)]), 1);
      if (!c) return null;
      const a = Math.exp(c[1]);
      return finish("power", [a, c[0]], (x) => a * x ** c[0], ys.map(Math.log), xs.map((x) => c[0] * Math.log(x) + c[1]));
    }
    default:
      return null;
  }
}

/** A coefficient for an equation: four significant digits, no exponent unless it is tiny or huge, the decimal mark of the exam */
export function coefText(v: number, mark = ","): string {
  if (!Number.isFinite(v)) return "?";
  const a = Math.abs(v);
  let text = a !== 0 && (a >= 1e6 || a < 1e-4) ? v.toExponential(3).replace(/\.?0+e/, "e") : String(Number(v.toPrecision(4)));
  text = text.replace("-", "−");
  return mark === "," ? text.replace(".", ",") : text;
}

/** The equation of a trendline: y = 2x + 1, y = 1,5e^0,3x, y = 2ln(x) + 1, y = 3x^2 … */
export function equationText(fit: Fit, mark = ","): string {
  const c = (v: number) => coefText(v, mark);
  const signed = (v: number, rest: string) => (v < 0 ? ` − ${c(-v)}${rest}` : ` + ${c(v)}${rest}`);
  switch (fit.kind) {
    case "linear": {
      const [a, b] = fit.coef;
      return `y = ${a === 1 ? "" : a === -1 ? "−" : c(a)}x${Math.abs(b) < 1e-12 ? "" : signed(b, "")}`;
    }
    case "poly": {
      const d = fit.coef.length - 1;
      return fit.coef.reduce((out, v, i) => {
        const p = d - i;
        const term = p === 0 ? "" : p === 1 ? "x" : `x^${p}`;
        if (i === 0) return `y = ${c(v)}${term}`;
        return out + signed(v, term);
      }, "");
    }
    case "log":
      return `y = ${c(fit.coef[0])}ln(x)${signed(fit.coef[1], "")}`;
    case "exp":
      return `y = ${c(fit.coef[0])}e^${c(fit.coef[1])}x`;
    case "power":
      return `y = ${c(fit.coef[0])}x^${c(fit.coef[1])}`;
    default:
      return "";
  }
}

/** The moving average of a series over `period` points (the points before the first full period have none) */
export function movingAverage(values: readonly (number | null)[], period: number): (number | null)[] {
  const n = Math.max(2, Math.round(period));
  return values.map((_, i) => {
    if (i < n - 1) return null;
    const w = values.slice(i - n + 1, i + 1);
    return w.every((v) => v !== null) ? mean(w as number[]) : null;
  });
}

// ---- histograms ----

export interface Bin {
  lo: number;
  hi: number;
  count: number;
}

/** The size of a class that suits the data: a nice number (1, 2, 5 × 10ⁿ) giving about Sturges' number of classes */
export function autoWidth(values: readonly number[]): number {
  const n = values.length;
  const range = Math.max(...values) - Math.min(...values);
  if (!n || range <= 0) return 1;
  return niceStep(range, Math.ceil(Math.log2(n) + 1));
}

/**
 * The classes of some values: "auto" (a nice width), "width" (the width given), "count" (that many classes between the extremes). The classes are
 * [lo; hi[ and the last also holds its upper end (a value on the limit goes to the class above, as in the programmes).
 */
export function binValues(values: readonly number[], opts: { bins: "auto" | "width" | "count"; width: number; count: number; start: number | null }): Bin[] {
  const v = values.filter(Number.isFinite);
  if (!v.length) return [];
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  let width: number;
  let start: number;
  if (opts.bins === "count") {
    const k = Math.max(1, Math.min(200, Math.round(opts.count)));
    width = hi > lo ? (hi - lo) / k : 1;
    start = opts.start ?? lo;
  } else {
    width = opts.bins === "width" && opts.width > 0 ? opts.width : autoWidth(v);
    start = opts.start ?? Math.floor(lo / width + 1e-9) * width;
  }
  const k = opts.bins === "count" ? Math.max(1, Math.min(200, Math.round(opts.count))) : Math.max(1, Math.min(500, Math.floor((hi - start) / width + 1e-9) + 1));
  const bins: Bin[] = Array.from({ length: k }, (_, i) => ({ lo: tidy(start + i * width), hi: tidy(start + (i + 1) * width), count: 0 }));
  for (const x of v) {
    let i = Math.floor((x - start) / width + 1e-9);
    if (i >= k) i = k - 1; // (the upper end of the last class)
    if (i >= 0) bins[i].count++;
  }
  return bins;
}

/** The name of a class: [8;12[ (French), 8–12, with the decimal mark of the exam; the last class is closed. */
export function binLabel(bin: Bin, last: boolean, style: "french" | "plain", mark = ","): string {
  const f = (n: number) => String(tidy(n)).replace("-", "−").replace(".", mark);
  return style === "french" ? `[${f(bin.lo)};${f(bin.hi)}${last ? "]" : "["}` : `${f(bin.lo)}–${f(bin.hi)}`;
}
