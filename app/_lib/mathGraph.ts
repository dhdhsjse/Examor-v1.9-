// What a function graph can show beyond its curves: the derivative, tangents at chosen points, asymptotes found from the limits of a
// curve, and the changes the Function Studio makes to the lists of a graph block (functions, their options, lines). Pure functions (no
// React, no DOM), unit-tested (__tests__/math-graph.test.ts).
import { tryCompile, type Fn } from "./graphMath";
import type { GraphBlock, GraphCurveOptions, GraphLine } from "./types";

export const MAX_FUNCTIONS = Number.POSITIVE_INFINITY; // (curves are unlimited: colors and letters cycle)
export const FUNCTION_NAMES = ["f", "g", "h", "k", "p", "q"];
// The first three are the ones the graph always had.
export const CURVE_PALETTE = ["#1d4ed8", "#dc2626", "#059669", "#7c3aed", "#d97706", "#0891b2"];

export type GraphData = Pick<GraphBlock, "functions" | "curves" | "lines" | "xMin" | "xMax" | "yMin" | "yMax" | "grid">;

export const nameOf = (i: number) => FUNCTION_NAMES[i] ?? `f${i + 1}`;
export const optionsOf = (g: Pick<GraphBlock, "curves">, i: number): GraphCurveOptions => g.curves?.[i] ?? {};
export const colorOf = (g: Pick<GraphBlock, "curves">, i: number) => optionsOf(g, i).color ?? CURVE_PALETTE[i % CURVE_PALETTE.length];

// ---- numbers ----

/** A number written for people: at most 3 decimals, a real minus sign, no trailing zeros (1.5, −2, 0.333). */
export function formatNum(v: number): string {
  if (!Number.isFinite(v)) return v > 0 ? "+∞" : v < 0 ? "−∞" : "?";
  const r = Math.round(v * 1000) / 1000;
  return (Object.is(r, -0) ? "0" : String(r)).replace("-", "−");
}

// A value read from a limit: a simple fraction if it is one (1/3, 5/2), else six decimals.
function clean(v: number): number {
  for (let d = 1; d <= 12; d++) {
    const k = Math.round(v * d);
    if (Math.abs(v - k / d) < 1e-7) return k / d + 0; // (+ 0: no −0)
  }
  return Math.round(v * 1e6) / 1e6 + 0;
}

// ---- derivative and tangent ----

/** f′ by a five-point difference (a one-sided one where f is not defined on a side), NaN where there is none. */
export function derivativeOf(fn: Fn, step = 1e-4): Fn {
  return (x) => {
    const h = step * Math.max(1, Math.abs(x));
    const [a, b, c, d] = [fn(x - 2 * h), fn(x - h), fn(x + h), fn(x + 2 * h)];
    if ([a, b, c, d].every(Number.isFinite)) return (a - 8 * b + 8 * c - d) / (12 * h);
    const y = fn(x);
    if (Number.isFinite(y) && Number.isFinite(c) && Number.isFinite(d)) return (-3 * y + 4 * c - d) / (2 * h); // (defined on the right only)
    if (Number.isFinite(y) && Number.isFinite(a) && Number.isFinite(b)) return (3 * y - 4 * b + a) / (2 * h); // (on the left only)
    return Number.NaN;
  };
}

export interface Tangent {
  /** Where it touches the curve */
  a: number;
  y: number;
  /** Its slope f′(a) and where it crosses the y axis: y = m·x + p */
  m: number;
  p: number;
}

/** The tangent of the curve at x = a (null where the curve or its slope is not defined). */
export function tangentAt(fn: Fn, a: number): Tangent | null {
  const y = fn(a);
  const m = derivativeOf(fn)(a);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  // The slope must be the same whatever the step (else it is vertical there: √x at 0), and the same on both sides (else a kink: |x| at 0).
  const fine = derivativeOf(fn, 1e-6)(a);
  if (!Number.isFinite(fine) || Math.abs(fine - m) > 1e-3 * (1 + Math.abs(fine))) return null;
  const h = 1e-6 * Math.max(1, Math.abs(a));
  const [left, right] = [(y - fn(a - h)) / h, (fn(a + h) - y) / h];
  if (Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) > 1e-3 * (1 + Math.abs(m))) return null;
  const snap = Math.abs(m - Math.round(m)) < 1e-6 ? Math.round(m) : m; // (a slope of exactly 2 is 2, not 1.9999999)
  return { a, y, m: snap, p: y - snap * a };
}

/** y = 2x + 1 written out (the line of a tangent or an oblique asymptote). */
export function lineText(m: number, p: number): string {
  const mm = formatNum(m);
  const pp = formatNum(Math.abs(p));
  const slope = mm === "1" ? "x" : mm === "−1" ? "−x" : mm === "0" ? "" : `${mm}x`;
  if (!slope) return `y = ${formatNum(p)}`;
  return Math.abs(p) < 5e-4 ? `y = ${slope}` : `y = ${slope} ${p < 0 ? "−" : "+"} ${pp}`;
}

// ---- asymptotes ----

export interface Asymptotes {
  /** x = c */
  vertical: number[];
  /** y = L, towards +∞ or −∞ */
  horizontal: number[];
  /** y = m·x + p */
  oblique: { m: number; p: number }[];
}

// Does |f| grow without bound as x goes to c from one side? Judged by three distances: 1e-3, 1e-6, 1e-9 (1/x: 10³ 10⁶ 10⁹; ln x: 7, 14, 21).
function diverges(fn: Fn, c: number, side: 1 | -1): boolean {
  const v = [1e-3, 1e-6, 1e-9].map((d) => Math.abs(fn(c + side * d)));
  return v.every(Number.isFinite) && v[2] > 10 && v[2] > v[1] + 2 && v[1] > v[0] + 2;
}

// The point of [lo, hi] where f is largest in absolute value, found by looking closer and closer (a pole between two samples).
function steepest(fn: Fn, lo: number, hi: number): number {
  let a = lo;
  let b = hi;
  for (let round = 0; round < 14; round++) {
    const n = 20;
    let best = a;
    let top = -1;
    for (let i = 0; i <= n; i++) {
      const x = a + ((b - a) * i) / n;
      const y = Math.abs(fn(x));
      if (Number.isFinite(y) && y > top) {
        top = y;
        best = x;
      }
    }
    const w = (b - a) / n;
    a = Math.max(lo, best - w);
    b = Math.min(hi, best + w);
  }
  return (a + b) / 2;
}

// Where a finite and a non-finite value meet: the edge of the domain, or a pole that a sample landed on.
function boundary(fn: Fn, finite: number, other: number): number {
  let a = finite;
  let b = other;
  for (let i = 0; i < 80; i++) {
    const m = (a + b) / 2;
    if (Number.isFinite(fn(m))) a = m;
    else b = m;
  }
  return a;
}

/** The vertical asymptotes of the curve on [xMin, xMax]. */
function poles(fn: Fn, xMin: number, xMax: number): number[] {
  const N = 1200;
  const xs = Array.from({ length: N + 1 }, (_, i) => xMin + ((xMax - xMin) * i) / N);
  const ys = xs.map(fn);
  const found: number[] = [];
  const add = (c: number) => {
    const r = clean(c);
    if (r >= xMin - 1e-9 && r <= xMax + 1e-9 && !found.some((f) => Math.abs(f - r) < 1e-6 * (1 + Math.abs(r)))) found.push(r);
  };
  const test = (c: number) => diverges(fn, c, 1) || diverges(fn, c, -1);
  for (let i = 0; i < N; i++) {
    const [y0, y1] = [ys[i], ys[i + 1]];
    const f0 = Number.isFinite(y0);
    const f1 = Number.isFinite(y1);
    if (f0 !== f1) {
      const c = boundary(fn, f0 ? xs[i] : xs[i + 1], f0 ? xs[i + 1] : xs[i]);
      if (test(c)) add(c);
    } else if (f0 && f1 && ((y0 < 0 && y1 > 0) || (y0 > 0 && y1 < 0)) && Math.min(Math.abs(y0), Math.abs(y1)) > 1) {
      const c = steepest(fn, xs[i], xs[i + 1]);
      if (test(c)) add(c);
    } else if (f0 && f1 && i > 0 && Number.isFinite(ys[i - 1]) && Math.abs(y0) > 20 && Math.abs(y0) > Math.abs(ys[i - 1]) && Math.abs(y0) >= Math.abs(y1)) {
      const c = steepest(fn, xs[i - 1], xs[i + 1]);
      if (test(c)) add(c);
    }
  }
  return found.sort((a, b) => a - b);
}

/** The horizontal and oblique asymptotes, from the curve far out on each side. */
function atInfinity(fn: Fn): Pick<Asymptotes, "horizontal" | "oblique"> {
  const horizontal: number[] = [];
  const oblique: { m: number; p: number }[] = [];
  for (const s of [1, -1]) {
    const a = fn(s * 1e5);
    const b = fn(s * 1e7);
    if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-4 * (1 + Math.abs(b))) {
      const L = clean(b);
      if (!horizontal.some((h) => Math.abs(h - L) < 1e-9)) horizontal.push(L);
      continue;
    }
    // y = m·x + p: the slope is the same far out and nearer, and what is left is the same too
    const slope = (X: number) => (fn(2 * X) - fn(X)) / X;
    const m1 = slope(s * 1e4);
    const m2 = slope(s * 1e6);
    if (!Number.isFinite(m1) || !Number.isFinite(m2) || Math.abs(m1 - m2) > 1e-3 * (1 + Math.abs(m2)) || Math.abs(m2) < 1e-6) continue;
    const m = clean(m2);
    const p1 = fn(s * 1e5) - m * s * 1e5;
    const p2 = fn(s * 1e6) - m * s * 1e6;
    if (!Number.isFinite(p1) || !Number.isFinite(p2) || Math.abs(p1 - p2) > 1e-2 * (1 + Math.abs(p2))) continue;
    const p = Math.round(p2 * 1e4) / 1e4;
    if (!oblique.some((o) => Math.abs(o.m - m) < 1e-9 && Math.abs(o.p - p) < 1e-3)) oblique.push({ m, p });
  }
  return { horizontal, oblique };
}

/** The asymptotes of the curve: vertical ones inside [xMin, xMax], horizontal and oblique ones at the ends (±∞). */
export function findAsymptotes(fn: Fn, xMin: number, xMax: number): Asymptotes {
  return { vertical: poles(fn, xMin, xMax), ...atInfinity(fn) };
}

/** Every asymptote as the line it is drawn as. */
export function asymptoteLines(a: Asymptotes): GraphLine[] {
  return [...a.vertical.map((c): GraphLine => ({ kind: "v", a: c })), ...a.horizontal.map((b): GraphLine => ({ kind: "h", b })), ...a.oblique.map((o): GraphLine => ({ kind: "o", m: o.m, p: o.p }))];
}

export function lineLabel(l: GraphLine): string {
  return l.kind === "v" ? `x = ${formatNum(l.a)}` : l.kind === "h" ? `y = ${formatNum(l.b)}` : lineText(l.m, l.p);
}

// ---- the window ----

/** A y range that shows the curves on [xMin, xMax] (the middle of what they do: a pole does not stretch it). */
export function fitY(fns: Fn[], xMin: number, xMax: number): { yMin: number; yMax: number } | null {
  const ys: number[] = [];
  for (const fn of fns)
    for (let i = 0; i <= 400; i++) {
      const y = fn(xMin + ((xMax - xMin) * i) / 400);
      if (Number.isFinite(y)) ys.push(y);
    }
  if (ys.length < 2) return null;
  ys.sort((a, b) => a - b);
  const at = (q: number) => ys[Math.min(ys.length - 1, Math.max(0, Math.round(q * (ys.length - 1))))];
  let lo = at(0.03);
  let hi = at(0.97);
  if (hi - lo < 1e-6) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.12;
  return { yMin: Math.floor((lo - pad) * 2) / 2, yMax: Math.ceil((hi + pad) * 2) / 2 };
}

/** The window after zooming by `factor` (< 1 closer) about the point (cx, cy) of the graph. */
export function zoomWindow(w: Pick<GraphData, "xMin" | "xMax" | "yMin" | "yMax">, factor: number, cx: number, cy: number) {
  return { xMin: cx + (w.xMin - cx) * factor, xMax: cx + (w.xMax - cx) * factor, yMin: cy + (w.yMin - cy) * factor, yMax: cy + (w.yMax - cy) * factor };
}

// ---- changing the lists of a graph (each returns the fields that change) ----

type Changes = Partial<Pick<GraphBlock, "functions" | "curves" | "lines">>;

const tidyCurves = (curves: GraphCurveOptions[], n: number): GraphCurveOptions[] | undefined => {
  const out = curves.slice(0, n).map((c) => {
    const o: GraphCurveOptions = { ...c };
    if (!o.hidden) delete o.hidden;
    if (!o.derivative) delete o.derivative;
    if (!o.asymptotes) delete o.asymptotes;
    if (!o.tangents?.length) delete o.tangents;
    if (o.color === undefined) delete o.color;
    return o;
  });
  while (out.length && !Object.keys(out[out.length - 1]).length) out.pop();
  return out.length ? out : undefined;
};

const padded = (g: Pick<GraphBlock, "functions" | "curves">): GraphCurveOptions[] => g.functions.map((_, i) => ({ ...optionsOf(g, i) }));

export function addFunction(g: Pick<GraphBlock, "functions" | "curves">, formula = ""): Changes | null {
  if (g.functions.length >= MAX_FUNCTIONS) return null;
  return { functions: [...g.functions, formula], curves: tidyCurves(padded(g), g.functions.length + 1) };
}

export function removeFunction(g: Pick<GraphBlock, "functions" | "curves">, i: number): Changes {
  const curves = padded(g).filter((_, k) => k !== i);
  return { functions: g.functions.filter((_, k) => k !== i), curves: tidyCurves(curves, g.functions.length - 1) };
}

export function setFormula(g: Pick<GraphBlock, "functions">, i: number, formula: string): Changes {
  return { functions: g.functions.map((f, k) => (k === i ? formula : f)) };
}

export function setCurve(g: Pick<GraphBlock, "functions" | "curves">, i: number, patch: Partial<GraphCurveOptions>): Changes {
  const curves = padded(g);
  curves[i] = { ...curves[i], ...patch };
  return { curves: tidyCurves(curves, g.functions.length) };
}

/** A tangent at x = a (nothing changes if there is one there already). */
export function addTangent(g: Pick<GraphBlock, "functions" | "curves">, i: number, a: number): Changes | null {
  const have = optionsOf(g, i).tangents ?? [];
  if (have.some((t) => Math.abs(t - a) < 1e-9)) return null;
  return setCurve(g, i, { tangents: [...have, a] });
}

export function moveTangent(g: Pick<GraphBlock, "functions" | "curves">, i: number, k: number, a: number): Changes {
  return setCurve(g, i, { tangents: (optionsOf(g, i).tangents ?? []).map((t, j) => (j === k ? a : t)) });
}

export function removeTangent(g: Pick<GraphBlock, "functions" | "curves">, i: number, k: number): Changes {
  return setCurve(g, i, { tangents: (optionsOf(g, i).tangents ?? []).filter((_, j) => j !== k) });
}

export const addLine = (g: Pick<GraphBlock, "lines">, line: GraphLine): Changes => ({ lines: [...(g.lines ?? []), line] });
export const setLine = (g: Pick<GraphBlock, "lines">, i: number, line: GraphLine): Changes => ({ lines: (g.lines ?? []).map((l, k) => (k === i ? line : l)) });
export function removeLine(g: Pick<GraphBlock, "lines">, i: number): Changes {
  const lines = (g.lines ?? []).filter((_, k) => k !== i);
  return { lines: lines.length ? lines : undefined };
}

// ---- what to draw ----

export interface CurveDrawing {
  /** The curve itself, and what belongs to it (null where there is a formula that cannot be read, or a hidden curve) */
  fn: Fn | null;
  derivative: Fn | null;
  tangents: Tangent[];
  asymptotes: GraphLine[];
}

/** What every curve of the graph draws: its function, derivative, tangents and asymptotes (computed only for what is asked). */
export function drawingsOf(g: GraphData): CurveDrawing[] {
  return g.functions.map((src, i) => {
    const o = optionsOf(g, i);
    const { fn } = tryCompile(src);
    if (!fn || o.hidden) return { fn: null, derivative: null, tangents: [], asymptotes: [] };
    return {
      fn,
      derivative: o.derivative ? derivativeOf(fn) : null,
      tangents: (o.tangents ?? []).flatMap((a) => tangentAt(fn, a) ?? []),
      asymptotes: o.asymptotes ? asymptoteLines(findAsymptotes(fn, g.xMin, g.xMax)) : [],
    };
  });
}
