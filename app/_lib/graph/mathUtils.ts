// The curves of the graph paper: what each function is, its parameters and sensible starting values for the paper it is put
// on, how it is evaluated, and how it is sampled into polylines (in pixels of the paper) that stop exactly at the paper's
// edge. Pure functions (no React), unit-tested.
import type { DataPoint, FunctionType, GraphConfig, GraphFunction } from "./types";

export type ParamSpec = { key: string; /** how the parameter is written in the inspector */ label: string };
export type FunctionSpec = {
  type: FunctionType;
  /** The English name (the key of the translations in graph/strings.ts) */
  name: string;
  /** The formula as text */
  formula: string;
  params: ParamSpec[];
};

export const FUNCTION_SPECS: Record<FunctionType, FunctionSpec> = {
  linear: { type: "linear", name: "Linear", formula: "y = a·x + b", params: [{ key: "a", label: "a" }, { key: "b", label: "b" }] },
  quadratic: { type: "quadratic", name: "Parabola", formula: "y = a·x² + b·x + c", params: [{ key: "a", label: "a" }, { key: "b", label: "b" }, { key: "c", label: "c" }] },
  exponential: { type: "exponential", name: "Exponential", formula: "y = A·e^(−x/τ) + y₀", params: [{ key: "A", label: "A" }, { key: "tau", label: "τ" }, { key: "y0", label: "y₀" }] },
  logarithmic: { type: "logarithmic", name: "Logarithmic", formula: "y = a·ln(x) + b", params: [{ key: "a", label: "a" }, { key: "b", label: "b" }] },
  data: { type: "data", name: "Measurements", formula: "", params: [] },
  sigmoid: { type: "sigmoid", name: "Sigmoid", formula: "y = y min + (y max − y min) / (1 + e^(−k·(x − x₀)))", params: [{ key: "ymin", label: "y min" }, { key: "ymax", label: "y max" }, { key: "k", label: "k" }, { key: "x0", label: "x₀" }] },
};

/** The functions of the palette (a series of measured points is not one: it is added from its own button). */
export const FUNCTION_TYPES = (Object.keys(FUNCTION_SPECS) as FunctionType[]).filter((t) => t !== "data");
/** A curve with a formula (so it can carry a tangent, a triangle or a point), as opposed to a series of measured points. */
export const isMathFunction = (fn: GraphFunction) => fn.type !== "data";

/** The colours curves are given in turn: the first is black, the next ones are easy to tell apart on paper. */
export const CURVE_COLORS = ["#000000", "#dc2626", "#2563eb", "#16a34a", "#d97706", "#7c3aed"];
export const DEFAULT_STROKE = 2;
export const MIN_STROKE = 1;
export const MAX_STROKE = 8;

/** Evaluates a function at a given x (NaN or ±Infinity where it is not defined). */
export function evaluateFunction(fn: GraphFunction, x: number): number {
  const p = fn.params;
  switch (fn.type) {
    case "linear":
      return p.a * x + p.b;
    case "quadratic":
      return p.a * x * x + p.b * x + p.c;
    case "exponential":
      return p.tau === 0 ? Number.NaN : p.A * Math.exp(-x / p.tau) + p.y0; // (τ = 0 is a division by zero, not a step)
    case "logarithmic":
      return p.a * Math.log(x) + p.b;
    case "sigmoid":
      // the logistic function, as in a titration curve
      return p.ymin + (p.ymax - p.ymin) / (1 + Math.exp(-p.k * (x - p.x0)));
    default:
      return Number.NaN;
  }
}

/** The slope of the curve at x: the exact derivative (NaN where the function is not defined). */
export function getSlopeAt(fn: GraphFunction, x: number): number {
  const p = fn.params;
  switch (fn.type) {
    case "linear":
      return p.a;
    case "quadratic":
      return 2 * p.a * x + p.b;
    case "exponential":
      return p.tau === 0 ? Number.NaN : (-p.A / p.tau) * Math.exp(-x / p.tau);
    case "logarithmic":
      return x > 0 ? p.a / x : Number.NaN;
    case "sigmoid": {
      const e = Math.exp(-p.k * (x - p.x0));
      return Number.isFinite(e) ? ((p.ymax - p.ymin) * p.k * e) / (1 + e) ** 2 : 0; // (far from the step the curve is flat)
    }
    default:
      return Number.NaN;
  }
}

/** A number as it is written on an axis or a label: no float noise, a real minus sign. */
export function formatNumber(v: number): string {
  const r = Math.round(Number(v.toPrecision(10)) * 1e9) / 1e9;
  return String(r === 0 ? 0 : r).replace("-", "\u2212");
}

/** Rounds to 3 significant digits, so that starting values read as numbers a person would type. */
const nice = (v: number) => (Number.isFinite(v) && v !== 0 ? Number(v.toPrecision(3)) : 0);

/**
 * Starting parameters for a new curve of this type that shows up on the paper as it is now (an exponential decay that starts
 * near the top left, a parabola opening downwards like a projectile's path, a titration-like sigmoid across the middle…).
 */
export function defaultParams(type: FunctionType, c: GraphConfig): Record<string, number> {
  const W = c.xMax - c.xMin;
  const H = c.yMax - c.yMin;
  const xc = (c.xMin + c.xMax) / 2;
  switch (type) {
    case "linear": {
      const a = H / W; // from the bottom left corner to the top right one
      return { a: nice(a), b: nice(c.yMin - a * c.xMin) };
    }
    case "quadratic": {
      const a = (-0.8 * H) / (W / 2) ** 2; // vertex at the middle, near the top, and 10 % of the height above the bottom at the edges
      const vertex = c.yMin + 0.9 * H;
      return { a: nice(a), b: nice(-2 * a * xc), c: nice(a * xc * xc + vertex) };
    }
    case "exponential": {
      const tau = W / 4;
      return { A: nice(0.9 * H * Math.exp(c.xMin / tau)), tau: nice(tau), y0: nice(c.yMin) };
    }
    case "logarithmic": {
      if (!(c.xMax > 0)) return { a: 1, b: 0 };
      const low = c.xMin > 0 ? c.xMin : c.xMax / 20; // (ln is only defined for x > 0)
      const a = (0.8 * H) / (Math.log(c.xMax) - Math.log(low) || 1);
      return { a: nice(a), b: nice(c.yMin + 0.1 * H - a * Math.log(low)) };
    }
    case "data":
      return {};
    case "sigmoid":
      return { ymin: nice(c.yMin + 0.1 * H), ymax: nice(c.yMax - 0.1 * H), k: nice(12 / W), x0: nice(xc) };
  }
}

/** A new curve for this paper, in the next colour of the palette. */
export function newFunction(type: FunctionType, c: GraphConfig): GraphFunction {
  return { id: crypto.randomUUID(), type, color: CURVE_COLORS[c.functions.length % CURVE_COLORS.length], strokeWidth: DEFAULT_STROKE, params: defaultParams(type, c) };
}

/** A new, empty series of measured points, in the next colour of the palette. */
export function newDataSeries(c: GraphConfig, points: DataPoint[] = []): GraphFunction {
  return { id: crypto.randomUUID(), type: "data", color: CURVE_COLORS[c.functions.length % CURVE_COLORS.length], strokeWidth: DEFAULT_STROKE, params: {}, points, showPoints: true, lineStyle: "none" };
}

/** The points of a series, in the order of x (so that a line joining them never doubles back). */
export const sortedPoints = (fn: GraphFunction): DataPoint[] => [...(fn.points ?? [])].filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)).sort((a, b) => a.x - b.x);

/**
 * Values pasted from a spreadsheet or typed in a list: one point per line, x and y separated by a tab, a semicolon, spaces or
 * (when nothing else is there) a comma; a decimal comma is read too ("1,5;2,25"). Lines that are not two numbers (a header,
 * a blank) are counted in `rejected`.
 */
export function parseDataText(text: string): { points: { x: number; y: number }[]; rejected: number } {
  const points: { x: number; y: number }[] = [];
  let rejected = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let parts: string[];
    if (/[;\t]/.test(line)) parts = line.split(/[;\t]+/);
    else if (/\s/.test(line)) parts = line.split(/\s+/);
    else parts = line.split(",");
    parts = parts.map((s) => s.trim()).filter(Boolean);
    const [x, y] = parts.map((s) => Number(s.replace(",", ".")));
    if (parts.length === 2 && Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
    else rejected++;
  }
  return { points, rejected };
}

export type P = { x: number; y: number };

// (the same mapping as grid.ts#graphToPxY: grid.ts uses this file for the curves of its scene, so it is not imported from there)
const pxY = (y: number, c: GraphConfig) => c.height - ((y - c.yMin) / (c.yMax - c.yMin)) * c.height;

/**
 * The part of the segment p→q that lies on the paper (0 ≤ x ≤ width, 0 ≤ y ≤ height; Liang–Barsky), or null if none of it does.
 * A point that is already on the paper comes back unchanged, to the bit.
 */
export function clipSegment(p: P, q: P, width: number, height: number): [P, P] | null {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  let t0 = 0;
  let t1 = 1;
  for (const [pp, qq] of [[-dx, p.x], [dx, width - p.x], [-dy, p.y], [dy, height - p.y]] as const) {
    if (pp === 0) {
      if (qq < 0) return null; // parallel to an edge and outside it
    } else {
      const r = qq / pp;
      if (pp < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  return [{ x: p.x + t0 * dx, y: p.y + t0 * dy }, { x: p.x + t1 * dx, y: p.y + t1 * dy }];
}

export type CurveStatus = "ok" | "outside" | "undefined";
export type Curve = { segments: number[][]; status: CurveStatus };

/**
 * The curve as polylines (flat x, y lists in pixels of the paper): one sample per pixel of the paper's width, cut where the
 * function is not defined (the log at x ≤ 0, a division by zero) and clipped exactly at the top and the bottom of the paper, so a
 * curve that leaves the paper and comes back is two lines, never one line across it. `status` says why there is nothing to see:
 * "undefined" = no value at all on this paper, "outside" = defined, but not between yMin and yMax.
 */
/** The points of a data series that are on the paper, in pixels of the paper. */
export function dataDots(fn: GraphFunction, c: GraphConfig): { id: string; x: number; y: number }[] {
  const dots = sortedPoints(fn).map((p) => ({ id: p.id, x: ((p.x - c.xMin) / (c.xMax - c.xMin)) * c.width, y: pxY(p.y, c) }));
  return dots.filter((d) => d.x >= -1e-6 && d.x <= c.width + 1e-6 && d.y >= -1e-6 && d.y <= c.height + 1e-6);
}

// A data series: its points joined by straight lines when asked (cut at the edge of the paper, like a curve).
function sampleData(fn: GraphFunction, c: GraphConfig): Curve {
  const pts = sortedPoints(fn).map((p) => ({ x: ((p.x - c.xMin) / (c.xMax - c.xMin)) * c.width, y: pxY(p.y, c) }));
  const segments: number[][] = [];
  if (fn.lineStyle === "straight") {
    let run: number[] = [];
    for (let i = 1; i < pts.length; i++) {
      const clipped = clipSegment(pts[i - 1], pts[i], c.width, c.height);
      if (!clipped) {
        if (run.length >= 4) segments.push(run);
        run = [];
        continue;
      }
      const [a, b] = clipped;
      if (run.length === 0 || run[run.length - 2] !== a.x || run[run.length - 1] !== a.y) {
        if (run.length >= 4) segments.push(run);
        run = [a.x, a.y];
      }
      run.push(b.x, b.y);
    }
    if (run.length >= 4) segments.push(run);
  }
  const seen = dataDots(fn, c).length > 0 || segments.length > 0;
  return { segments, status: pts.length === 0 || seen ? "ok" : "outside" };
}

export function sampleCurve(fn: GraphFunction, c: GraphConfig): Curve {
  if (fn.type === "data") return sampleData(fn, c);
  const n = Math.max(2, Math.round(c.width));
  const segments: number[][] = [];
  let run: number[] = [];
  const flush = () => {
    if (run.length >= 4) segments.push(run);
    run = [];
  };
  let prev: P | null = null;
  let anyValue = false;
  for (let i = 0; i <= n; i++) {
    const x = c.xMin + (i / n) * (c.xMax - c.xMin);
    const y = evaluateFunction(fn, x);
    if (!Number.isFinite(y)) {
      flush();
      prev = null;
      continue;
    }
    anyValue = true;
    const p: P = { x: (i / n) * c.width, y: pxY(y, c) };
    if (prev) {
      const clipped = clipSegment(prev, p, c.width, c.height);
      if (!clipped) flush();
      else {
        const [a, b] = clipped;
        if (run.length === 0 || run[run.length - 2] !== a.x || run[run.length - 1] !== a.y) {
          flush(); // (the previous point was cut: this is another piece)
          run = [a.x, a.y];
        }
        run.push(b.x, b.y);
      }
    }
    prev = p;
  }
  flush();
  return { segments, status: segments.length ? "ok" : anyValue ? "outside" : "undefined" };
}
