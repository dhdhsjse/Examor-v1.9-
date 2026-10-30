// The curves of the graph paper: what each function is, its parameters and sensible starting values for the paper it is put
// on, how it is evaluated, and how it is sampled into polylines (in pixels of the paper) that stop exactly at the paper's
// edge. Pure functions (no React), unit-tested.
import { tryCompile, type Fn } from "../graphMath";
import type { DataPoint, FunctionType, GraphConfig, GraphFunction } from "./types";

export type ParamSpec = {
  key: string;
  /** how the parameter is written in the inspector */
  label: string;
  /** what it is, as a hint on the field (English text: the key of the translations) */
  title?: string;
  /** a choice between values instead of a number: their English names */
  options?: { value: number; label: string }[];
};
export type FunctionSpec = {
  type: FunctionType;
  /** The English name (the key of the translations in graph/strings.ts) */
  name: string;
  /** The formula as text */
  formula: string;
  params: ParamSpec[];
  /** A line of help under the parameters (English text: the key of the translations) */
  note?: string;
};

export const FUNCTION_SPECS: Record<FunctionType, FunctionSpec> = {
  linear: { type: "linear", name: "Linear", formula: "y = a·x + b", params: [{ key: "a", label: "a" }, { key: "b", label: "b" }] },
  quadratic: { type: "quadratic", name: "Parabola", formula: "y = a·x² + b·x + c", params: [{ key: "a", label: "a" }, { key: "b", label: "b" }, { key: "c", label: "c" }] },
  exponential: { type: "exponential", name: "Exponential", formula: "y = A·e^(−x/τ) + y₀", params: [{ key: "A", label: "A" }, { key: "tau", label: "τ" }, { key: "y0", label: "y₀" }] },
  logarithmic: { type: "logarithmic", name: "Logarithmic", formula: "y = a·ln(x) + b", params: [{ key: "a", label: "a" }, { key: "b", label: "b" }] },
  sigmoid: { type: "sigmoid", name: "Sigmoid", formula: "y = y min + (y max − y min) / (1 + e^(−k·(x − x₀)))", params: [{ key: "ymin", label: "y min" }, { key: "ymax", label: "y max" }, { key: "k", label: "k" }, { key: "x0", label: "x₀" }] },
  oscillation: {
    type: "oscillation",
    name: "Oscillation",
    formula: "y = A·e^(−(x−x₀)/τ)·cos(2π(x−x₀)/T + φ) + y₀",
    params: [
      { key: "A", label: "A", title: "Amplitude" },
      { key: "T", label: "T", title: "Period" },
      { key: "tau", label: "τ", title: "Damping time (0 = no damping)" },
      { key: "phi", label: "φ", title: "Phase, in degrees" },
      { key: "y0", label: "y₀", title: "The value it oscillates around" },
      { key: "x0", label: "x₀", title: "Where it starts" },
    ],
    note: "τ = 0 is an oscillation that does not fade. The curve starts at x₀: nothing is drawn before it.",
  },
  titration: {
    type: "titration",
    name: "Titration",
    formula: "pH of the mixture when x of titrant has been added",
    params: [
      { key: "pKa", label: "pKa", title: "pKa of the acid (of the conjugate acid, for a base)" },
      { key: "C", label: "C", title: "Concentration of the solution being titrated (mol/L)" },
      { key: "V0", label: "V₀", title: "Volume of that solution (in the unit of x)" },
      { key: "Ct", label: "Cₜ", title: "Concentration of the titrant (mol/L)" },
      {
        key: "kind",
        label: "Titration of",
        title: "What is being titrated",
        options: [
          { value: 0, label: "An acid by a strong base" },
          { value: 1, label: "A base by a strong acid" },
        ],
      },
    ],
    note: "x is the volume of titrant added. A strong acid has a pKa of −2 or less, a strong base 14 or more.",
  },
  formula: { type: "formula", name: "Formula", formula: "y = f(x)", params: [], note: "Write it with x or t, e.g. 5*exp(-t/40)*cos(2*pi*t/12). Known: e, pi, sin, cos, tan, exp, ln, log, sqrt, abs." },
  data: { type: "data", name: "Measurements", formula: "", params: [] },
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

// ---- formulas typed by the teacher ----

/** The letters a formula may be written in: x, or t for a time. */
export const FORMULA_VARIABLES = ["x", "t"];
const compiled = new Map<string, Fn | null>();

/** The function of a formula text, or null when it cannot be read (a curve is sampled many times: each text is read once). */
export function compileExpression(src: string): Fn | null {
  const known = compiled.get(src);
  if (known !== undefined) return known;
  if (compiled.size >= 100) compiled.clear();
  const { fn } = tryCompile(src, FORMULA_VARIABLES);
  compiled.set(src, fn);
  return fn;
}

/** What is wrong with a formula text (English, as graphMath.ts words it), or null. */
export const expressionError = (src: string): string | null => tryCompile(src, FORMULA_VARIABLES).error;

// ---- titration ----

const KW = 1e-14;

/**
 * The pH after `v` of a titrant has been added: the charge balance of the mixture solved for the pH. The balance goes down as the
 * pH goes up, so a bisection finds its zero, whatever the acid (a strong one: a very low pKa) or the concentrations.
 *   acid HA (C, V₀) + strong base (Cₜ, v):  [Na⁺] + [H₃O⁺] = [A⁻] + [OH⁻]
 *   base B (C, V₀) + strong acid (Cₜ, v):   [BH⁺] + [H₃O⁺] = [Cl⁻] + [OH⁻]
 */
export function titrationPh(p: Record<string, number>, v: number): number {
  const { pKa, C, V0, Ct } = p;
  if (!(C > 0) || !(V0 > 0) || !(Ct > 0) || !Number.isFinite(pKa) || !(v >= 0)) return Number.NaN;
  const Ka = 10 ** -pKa;
  const total = V0 + v;
  const analyte = (C * V0) / total; // its concentration once diluted
  const titrant = (Ct * v) / total;
  const residual =
    p.kind === 1
      ? (pH: number) => {
          const h = 10 ** -pH;
          return (analyte * h) / (Ka + h) + h - titrant - KW / h;
        }
      : (pH: number) => {
          const h = 10 ** -pH;
          return titrant + h - (analyte * Ka) / (Ka + h) - KW / h;
        };
  let lo = -1;
  let hi = 15;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (residual(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Where a titration reaches its equivalence: the volume, the pH there, and the pH at half of it (the pKa of a weak acid). Null if it cannot be worked out. */
export function titrationInfo(p: Record<string, number>): { ve: number; phE: number; phHalf: number } | null {
  const ve = (p.C * p.V0) / p.Ct;
  const phE = titrationPh(p, ve);
  const phHalf = titrationPh(p, ve / 2);
  return Number.isFinite(ve) && Number.isFinite(phE) && Number.isFinite(phHalf) ? { ve, phE, phHalf } : null;
}

// ---- oscillation ----

function oscillation(p: Record<string, number>, x: number): number {
  const u = x - p.x0;
  if (!(u >= 0) || p.T === 0) return Number.NaN; // (before its start; a period of 0 is a division by zero)
  const decay = p.tau > 0 ? Math.exp(-u / p.tau) : 1; // (τ of 0 or less: it does not fade)
  return p.A * decay * Math.cos((2 * Math.PI * u) / p.T + (p.phi * Math.PI) / 180) + p.y0;
}

/** Evaluates a function at a given x (NaN or ±Infinity where it is not defined, and NaN outside the range it is drawn on). */
export function evaluateFunction(fn: GraphFunction, x: number): number {
  if ((fn.from !== undefined && x < fn.from) || (fn.to !== undefined && x > fn.to)) return Number.NaN;
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
    case "oscillation":
      return oscillation(p, x);
    case "titration":
      return titrationPh(p, x);
    case "formula": {
      const f = compileExpression(fn.expression ?? "");
      return f ? f(x) : Number.NaN;
    }
    default:
      return Number.NaN;
  }
}

// What a curve with no simple derivative has: the slope of the chord across a tiny step (one-sided at the end of its range).
function numericSlope(fn: GraphFunction, x: number): number {
  const h = 1e-6 * Math.max(1, Math.abs(x));
  const before = evaluateFunction(fn, x - h);
  const after = evaluateFunction(fn, x + h);
  if (Number.isFinite(before) && Number.isFinite(after)) return (after - before) / (2 * h);
  const here = evaluateFunction(fn, x);
  if (Number.isFinite(here) && Number.isFinite(after)) return (after - here) / h;
  if (Number.isFinite(here) && Number.isFinite(before)) return (here - before) / h;
  return Number.NaN;
}

/** The slope of the curve at x: the exact derivative where there is a simple one (NaN where the function is not defined). */
export function getSlopeAt(fn: GraphFunction, x: number): number {
  if (!Number.isFinite(evaluateFunction(fn, x))) return Number.NaN;
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
    case "oscillation": {
      const u = x - p.x0;
      const w = (2 * Math.PI) / p.T;
      const theta = w * u + (p.phi * Math.PI) / 180;
      const rate = p.tau > 0 ? 1 / p.tau : 0;
      const decay = p.tau > 0 ? Math.exp(-u / p.tau) : 1;
      return p.A * decay * (-rate * Math.cos(theta) - w * Math.sin(theta));
    }
    case "titration":
    case "formula":
      return numericSlope(fn, x);
    default:
      return Number.NaN;
  }
}

/** A number as it is written on an axis or a label: no float noise, a real minus sign, a decimal comma when asked. */
export function formatNumber(v: number, comma = false): string {
  const r = Math.round(Number(v.toPrecision(10)) * 1e9) / 1e9;
  const text = String(r === 0 ? 0 : r).replace("-", "−");
  return comma ? text.replace(".", ",") : text;
}

/** Rounds to 3 significant digits, so that starting values read as numbers a person would type. */
const nice = (v: number) => (Number.isFinite(v) && v !== 0 ? Number(v.toPrecision(3)) : 0);

/** "x" shifted to start at x₀, written the way it is typed in a formula: (x-2), (x+5), x. */
const shifted = (x0: number) => (x0 === 0 ? "x" : x0 > 0 ? `(x-${x0})` : `(x+${-x0})`);

/** A formula that shows on this paper: an oscillation that fades, across the middle. */
export function defaultExpression(c: GraphConfig): string {
  const W = c.xMax - c.xMin;
  const H = c.yMax - c.yMin;
  const x0 = nice(c.xMin);
  const y0 = nice(c.yMin + H / 2);
  const wave = `${nice(0.4 * H)}*exp(-${shifted(x0)}/${nice(W / 3)})*cos(2*pi*${shifted(x0)}/${nice(W / 6)})`;
  return y0 === 0 ? wave : y0 > 0 ? `${y0}+${wave}` : `${wave}-${-y0}`;
}

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
    case "formula":
      return {};
    case "sigmoid":
      return { ymin: nice(c.yMin + 0.1 * H), ymax: nice(c.yMax - 0.1 * H), k: nice(12 / W), x0: nice(xc) };
    case "oscillation":
      return { A: nice(0.4 * H), T: nice(W / 6), tau: nice(W / 3), phi: 0, y0: nice(c.yMin + H / 2), x0: nice(c.xMin) };
    case "titration": {
      // a weak acid and a strong base of the same concentration, equivalent in the middle of the paper
      const ve = c.xMax > 0 ? Math.max(xc, c.xMax / 2) : 1;
      return { pKa: 4.75, C: 0.1, V0: nice(ve), Ct: 0.1, kind: 0 };
    }
  }
}

/** A new curve for this paper, in the next colour of the palette. */
export function newFunction(type: FunctionType, c: GraphConfig): GraphFunction {
  const fn: GraphFunction = { id: crypto.randomUUID(), type, color: CURVE_COLORS[c.functions.length % CURVE_COLORS.length], strokeWidth: DEFAULT_STROKE, params: defaultParams(type, c) };
  return type === "formula" ? { ...fn, expression: defaultExpression(c) } : fn;
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

// ---- a smooth line through measured points ----

/**
 * The monotone cubic (Fritsch–Carlson) through points with increasing x: it goes through every point and never overshoots them,
 * so a smooth line drawn through noisy measurements does not wiggle between them. NaN outside the points.
 */
export function monotoneCurve(points: P[]): (x: number) => number {
  const n = points.length;
  if (n === 0) return () => Number.NaN;
  if (n === 1) return (x) => (x === points[0].x ? points[0].y : Number.NaN);
  const h: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(points[i + 1].x - points[i].x);
    d.push((points[i + 1].y - points[i].y) / h[i]);
  }
  // the slope at each point: a harmonic mean of the neighbouring chords (0 at a turning point), the ends from three points
  const m: number[] = new Array(n);
  if (n === 2) m[0] = m[1] = d[0];
  else {
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (h[i - 1] + h[i])) / ((2 * h[i] + h[i - 1]) / d[i - 1] + (h[i] + 2 * h[i - 1]) / d[i]);
    const end = (h0: number, h1: number, d0: number, d1: number) => {
      const s = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
      if (Math.sign(s) !== Math.sign(d0)) return 0;
      return Math.sign(d0) !== Math.sign(d1) && Math.abs(s) > 3 * Math.abs(d0) ? 3 * d0 : s;
    };
    m[0] = end(h[0], h[1], d[0], d[1]);
    m[n - 1] = end(h[n - 2], h[n - 3], d[n - 2], d[n - 3]);
  }
  return (x) => {
    if (!(x >= points[0].x && x <= points[n - 1].x)) return Number.NaN;
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (points[mid].x <= x) lo = mid;
      else hi = mid;
    }
    const t = (x - points[lo].x) / h[lo];
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * points[lo].y + (t3 - 2 * t2 + t) * h[lo] * m[lo] + (-2 * t3 + 3 * t2) * points[hi].y + (t3 - t2) * h[lo] * m[hi];
  };
}

/** Points with the same x become one, at their mean y (a curve through a series needs one value for each x). */
function mergeSameX(points: DataPoint[]): P[] {
  const out: { x: number; sum: number; n: number }[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && last.x === p.x) {
      last.sum += p.y;
      last.n++;
    } else out.push({ x: p.x, sum: p.y, n: 1 });
  }
  return out.map((o) => ({ x: o.x, y: o.sum / o.n }));
}

// ---- sampling ----

/** The points of a data series that are on the paper, in pixels of the paper. */
export function dataDots(fn: GraphFunction, c: GraphConfig): { id: string; x: number; y: number }[] {
  const dots = sortedPoints(fn).map((p) => ({ id: p.id, x: ((p.x - c.xMin) / (c.xMax - c.xMin)) * c.width, y: pxY(p.y, c) }));
  return dots.filter((d) => d.x >= -1e-6 && d.x <= c.width + 1e-6 && d.y >= -1e-6 && d.y <= c.height + 1e-6);
}

/**
 * Any function of x as polylines (flat x, y lists in pixels of the paper): one sample per pixel of the paper's width (and one
 * exactly at each of `breaks`, where a curve begins or ends), cut where the function is not defined (the log at x ≤ 0, a division by
 * zero) and clipped exactly at the top and the bottom of the paper, so a curve that leaves the paper and comes back is two
 * lines, never one line across it.
 */
function sampleWith(evaluate: (x: number) => number, c: GraphConfig, breaks: number[] = []): Curve {
  const n = Math.max(2, Math.round(c.width));
  const span = c.xMax - c.xMin;
  const samples: { x: number; px: number }[] = [];
  for (let i = 0; i <= n; i++) samples.push({ x: c.xMin + (i / n) * span, px: (i / n) * c.width });
  const extra = breaks.filter((b) => Number.isFinite(b) && b > c.xMin && b < c.xMax).map((b) => ({ x: b, px: ((b - c.xMin) / span) * c.width }));
  if (extra.length) samples.push(...extra.filter((e) => !samples.some((s) => Math.abs(s.px - e.px) < 1e-9)));
  if (samples.length > n + 1) samples.sort((a, b) => a.px - b.px);

  const segments: number[][] = [];
  let run: number[] = [];
  const flush = () => {
    if (run.length >= 4) segments.push(run);
    run = [];
  };
  let prev: P | null = null;
  let anyValue = false;
  for (const s of samples) {
    const y = evaluate(s.x);
    if (!Number.isFinite(y)) {
      flush();
      prev = null;
      continue;
    }
    anyValue = true;
    const p: P = { x: s.px, y: pxY(y, c) };
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

// A data series: its points joined by straight lines or a smooth curve when asked (cut at the edge of the paper, like a curve).
function sampleData(fn: GraphFunction, c: GraphConfig): Curve {
  const sorted = sortedPoints(fn);
  const pts = sorted.map((p) => ({ x: ((p.x - c.xMin) / (c.xMax - c.xMin)) * c.width, y: pxY(p.y, c) }));
  let segments: number[][] = [];
  if (fn.lineStyle === "smooth" && sorted.length >= 2) {
    const merged = mergeSameX(sorted);
    segments = sampleWith(monotoneCurve(merged), c, [merged[0].x, merged[merged.length - 1].x]).segments;
  } else if (fn.lineStyle === "straight" || fn.lineStyle === "smooth") {
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
  return sampleWith((x) => evaluateFunction(fn, x), c, [fn.from ?? Number.NaN, fn.to ?? Number.NaN]);
}

/**
 * The first x (from the left of [xMin, xMax]) where the curve has the value y, or null when it never does: how a mark on the y axis
 * finds the point of the curve it stands for. Looks at one x per pixel of the paper and where the range of the curve ends.
 */
export function solveForX(fn: GraphFunction, y: number, c: GraphConfig): number | null {
  const n = Math.max(2, Math.round(c.width));
  const xs = Array.from({ length: n + 1 }, (_, i) => c.xMin + (i / n) * (c.xMax - c.xMin));
  for (const edge of [fn.from, fn.to]) if (edge !== undefined && edge > c.xMin && edge < c.xMax) xs.push(edge);
  xs.sort((a, b) => a - b);
  let before = { x: xs[0], v: evaluateFunction(fn, xs[0]) - y };
  for (let i = 1; i < xs.length; i++) {
    const here = { x: xs[i], v: evaluateFunction(fn, xs[i]) - y };
    if (Number.isFinite(before.v) && Number.isFinite(here.v) && (before.v === 0 || before.v * here.v <= 0)) {
      if (before.v === 0) return before.x;
      let lo = before;
      let hi = here;
      for (let k = 0; k < 50; k++) {
        const mid = { x: (lo.x + hi.x) / 2, v: 0 };
        mid.v = evaluateFunction(fn, mid.x) - y;
        if (!Number.isFinite(mid.v)) break;
        if (lo.v * mid.v <= 0) hi = mid;
        else lo = mid;
      }
      return (lo.x + hi.x) / 2;
    }
    before = here;
  }
  return null;
}
