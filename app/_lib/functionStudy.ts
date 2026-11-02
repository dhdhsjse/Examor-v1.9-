// The study of a function typed as an equation (Properties of an equation, or of a formula in a text box): its graph, and the table
// of the first derivative test (where f' is positive or negative, so where f increases or decreases). The LaTeX of the equation is
// read into the plain formula the graphs already understand (graphMath.ts); everything else is found numerically, sampling the
// function, so it works for any formula the teacher types, not only polynomials.

import { tryCompile, type Fn } from "./graphMath";
import type { Lang } from "./types";

// ---------------------------------------------------------------- LaTeX → formula

const FUNCTION_NAMES = ["arctan", "sqrt", "sin", "cos", "tan", "exp", "ln", "log", "abs"];

/** The name and variable of "f(x) = …" (f and x when the equation does not say). */
export function functionName(latex: string): { name: string; variable: string } {
  const m = /^\s*([a-zA-Z])\s*(?:\\left)?\s*\(\s*([a-zA-Z])\s*(?:\\right)?\s*\)\s*=/.exec(latex);
  return m ? { name: m[1], variable: m[2] } : { name: "f", variable: "x" };
}

/** The right-hand side of "f(x) = …" / "y = …" (the whole equation when it has no "="). */
function rightSide(latex: string): string {
  const i = latex.indexOf("=");
  return i >= 0 ? latex.slice(i + 1) : latex;
}

/** The formula of a LaTeX equation, in the syntax of graphMath.ts ("\frac{x^2-1}{x+2}" → "((x^(2)-1)/(x+2))"). */
export function latexToFormula(latex: string): string {
  const { variable } = functionName(latex);
  let s = rightSide(latex)
    .replace(/\{,\}/g, ".") // MathLive's decimal comma
    .replace(/\\(left|right|displaystyle|big|Big|bigg|Bigg)(?![a-zA-Z])/g, "")
    .replace(/\\[,:;! ]/g, " ")
    .replace(/~/g, " ")
    .replace(/\\placeholder(\[[^\]]*\])?\{\}/g, "")
    .replace(/\\(lvert|rvert|vert|mid)(?![a-zA-Z])/g, "|");
  // The formula is always in x for the graphs.
  if (variable !== "x") s = s.replace(new RegExp(`(?<![a-zA-Z\\\\])${variable}(?![a-zA-Z])`, "g"), "x");
  return convert(s).replace(/\s+/g, " ").trim();
}

// Reads one group after a command: {…}, or a single character / command.
function readGroup(s: string, i: number): { body: string; end: number; braced: boolean } {
  while (s[i] === " ") i++;
  if (s[i] === "{") {
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === "{") depth++;
      else if (s[j] === "}" && --depth === 0) return { body: s.slice(i + 1, j), end: j + 1, braced: true };
    }
    return { body: s.slice(i + 1), end: s.length, braced: true };
  }
  if (s[i] === "\\") {
    const m = /^\\[a-zA-Z]+/.exec(s.slice(i));
    const len = m ? m[0].length : 2;
    return { body: s.slice(i, i + len), end: i + len, braced: false };
  }
  return { body: s[i] ?? "", end: i + 1, braced: false };
}

function convert(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\") {
      const m = /^\\([a-zA-Z]+)/.exec(s.slice(i));
      if (!m) {
        i += 2; // "\{" "\}" and the like
        continue;
      }
      const name = m[1];
      i += m[0].length;
      if (name === "frac" || name === "dfrac" || name === "tfrac" || name === "cfrac") {
        const a = readGroup(s, i);
        const b = readGroup(s, a.end);
        i = b.end;
        out += `((${convert(a.body)})/(${convert(b.body)}))`;
      } else if (name === "sqrt") {
        let n: string | null = null;
        if (s[i] === "[") {
          const close = s.indexOf("]", i);
          n = s.slice(i + 1, close < 0 ? s.length : close);
          i = close < 0 ? s.length : close + 1;
        }
        const a = readGroup(s, i);
        i = a.end;
        out += n ? `((${convert(a.body)})^(1/(${convert(n)})))` : `sqrt(${convert(a.body)})`;
      } else if (name === "operatorname" || name === "mathrm" || name === "text" || name === "mathit" || name === "textrm") {
        const a = readGroup(s, i);
        i = a.end;
        const word = a.body.trim();
        if (name === "text" && !FUNCTION_NAMES.includes(word)) continue; // a word of text, not math
        out += ` ${word === "e" ? "e" : word} `;
      } else if (name === "exponentialE") out += " e ";
      else if (name === "pi") out += " pi ";
      else if (name === "cdot" || name === "times" || name === "ast") out += "*";
      else if (name === "div") out += "/";
      else if (name === "arctan" || name === "tan" || name === "sin" || name === "cos" || name === "ln" || name === "log" || name === "exp") out += ` ${name} `;
      else if (name === "lbrace" || name === "lparen") out += "(";
      else if (name === "rbrace" || name === "rparen") out += ")";
      // any other command (a style, a space…) is left out
    } else if (c === "{") {
      const a = readGroup(s, i);
      i = a.end;
      out += `(${convert(a.body)})`;
    } else if (c === "^") {
      const a = readGroup(s, i + 1);
      i = a.end;
      out += a.braced || a.body.startsWith("\\") ? `^(${convert(a.body)})` : `^${a.body}`;
    } else if (c === "_") {
      i = readGroup(s, i + 1).end; // an index: not part of the value
    } else if (c === "}") {
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** The function of a LaTeX equation, or why it cannot be read. */
export function compileLatex(latex: string): { fn: Fn | null; formula: string; error: string | null } {
  const formula = latexToFormula(latex);
  if (!formula) return { fn: null, formula, error: "Type a function first, e.g. f(x) = x^2 - 2x" };
  const { fn, error } = tryCompile(formula);
  if (fn && !/x/.test(formula)) return { fn: null, formula, error: "The equation has no x: there is no function to study" };
  return { fn, formula, error };
}

// ---------------------------------------------------------------- numerical study

const ok = (v: number) => Number.isFinite(v);
const BIG = 1e6;

const derivative = (fn: Fn) => (x: number) => {
  const h = 1e-5 * Math.max(1, Math.abs(x));
  const a = fn(x - h);
  const b = fn(x + h);
  return (b - a) / (2 * h);
};

// A number close to a simple one (an integer, a half, a third…) becomes it: 1.9999998 → 2.
function tidy(x: number): number {
  for (const d of [1, 2, 3, 4, 5, 6, 8, 10, 100]) {
    const r = Math.round(x * d) / d;
    if (Math.abs(r - x) < 1e-5 * Math.max(1, Math.abs(x))) return r + 0; // (+ 0: never −0)
  }
  return x;
}

function bisect(g: (x: number) => number, a: number, b: number): number {
  let ga = g(a);
  for (let k = 0; k < 80; k++) {
    const m = (a + b) / 2;
    const gm = g(m);
    if (!ok(gm)) return m;
    if (Math.sign(gm) === Math.sign(ga)) {
      a = m;
      ga = gm;
    } else b = m;
  }
  return (a + b) / 2;
}

// The x in [a, b] where `g` is smallest (golden section).
function argMin(g: (x: number) => number, a: number, b: number): number {
  const r = (Math.sqrt(5) - 1) / 2;
  let c = b - r * (b - a);
  let d = a + r * (b - a);
  for (let k = 0; k < 80; k++) {
    if (g(c) < g(d)) b = d;
    else a = c;
    c = b - r * (b - a);
    d = a + r * (b - a);
  }
  return (a + b) / 2;
}

// The edge between where `fn` is defined and where it is not, between `inside` (defined) and `outside`.
function domainEdge(fn: Fn, inside: number, outside: number): number {
  let a = inside;
  let b = outside;
  for (let k = 0; k < 80; k++) {
    const m = (a + b) / 2;
    if (ok(fn(m))) a = m;
    else b = m;
  }
  return tidy(a);
}

/** One of the remarkable values of x in the table, in increasing order. */
export interface StudyPoint {
  x: number; // ±Infinity for the ends of ℝ
  kind: "end" | "critical" | "pole" | "edge"; // an end of the interval · f' = 0 · f not defined (a vertical asymptote) · the edge of the domain
  // f at that point, or its limits from the left and from the right (±Infinity). An "edge" or "end" has the one on its inner side.
  left?: number;
  right?: number;
  value?: number;
}

export interface FunctionStudy {
  points: StudyPoint[];
  // Between two consecutive points: the sign of f' (1 = increasing, -1 = decreasing).
  signs: (1 | -1)[];
}

/** Where to study the function: the whole domain (ℝ, as far as it goes), or a closed interval. */
export interface StudyRange {
  from?: number;
  to?: number;
}

const FAR = 100; // ℝ is studied on [-FAR, FAR], the limits further out
const SAMPLES = 20000;

function limitAt(fn: Fn, x: number, side: -1 | 1): number {
  // Approaching x from one side: the last values decide.
  const vals = [1e-3, 1e-5, 1e-7].map((h) => fn(x + side * h));
  const last = vals[2];
  if (!ok(last)) return NaN;
  if (Math.abs(last) > BIG || (Math.abs(vals[2]) > Math.abs(vals[1]) * 5 && Math.abs(vals[1]) > Math.abs(vals[0]) * 5)) return Math.sign(last) * Infinity;
  return tidy(last);
}

function limitAtInfinity(fn: Fn, side: -1 | 1): number {
  const a = fn(side * 1e4);
  const b = fn(side * 1e6);
  const c = fn(side * 1e8);
  if (!ok(c) && !ok(b)) return NaN;
  const last = ok(c) ? c : b;
  if (Math.abs(last) > BIG && Math.abs(last) >= Math.abs(a)) return Math.sign(last) * Infinity;
  if (Math.abs(b - c) < 1e-3 * Math.max(1, Math.abs(c))) return tidy(Math.round(c * 1e6) / 1e6);
  return NaN; // no limit (it keeps waving, like sin)
}

/** The points and the variations of `fn` over `range` (missing ends = the domain's, as far as ±∞). */
export function studyFunction(fn: Fn, range: StudyRange = {}): FunctionStudy {
  const lo = range.from ?? -FAR;
  const hi = range.to ?? FAR;
  const step = (hi - lo) / SAMPLES;
  const d = derivative(fn);
  const xs: number[] = [];
  for (let i = 0; i <= SAMPLES; i++) xs.push(lo + i * step);
  const fs = xs.map(fn);

  const points: StudyPoint[] = [];
  const pushPoint = (p: StudyPoint) => {
    if (!points.some((q) => Math.abs(q.x - p.x) < step * 2)) points.push(p);
  };

  // Where the function starts and stops being defined, and its vertical asymptotes.
  for (let i = 0; i < SAMPLES; i++) {
    const a = fs[i];
    const b = fs[i + 1];
    if (ok(a) && !ok(b)) {
      const e = domainEdge(fn, xs[i], xs[i + 1]);
      // defined again just after: a hole or a pole (1/x), else the domain stops (√(1 − x))
      const back = fs.slice(i + 1, i + 6).some(ok);
      if (back) pushPoint({ x: e, kind: "pole", left: limitAt(fn, e, -1), right: limitAt(fn, e, 1) });
      else pushPoint({ x: e, kind: "edge", value: tidy(fn(e)), left: limitAt(fn, e, -1) });
    } else if (!ok(a) && ok(b)) {
      const e = domainEdge(fn, xs[i + 1], xs[i]);
      const before = fs.slice(Math.max(0, i - 5), i + 1).some(ok);
      if (before) pushPoint({ x: e, kind: "pole", left: limitAt(fn, e, -1), right: limitAt(fn, e, 1) });
      else pushPoint({ x: e, kind: "edge", value: tidy(fn(e)), right: limitAt(fn, e, 1) });
    } else if (ok(a) && ok(b) && Math.sign(a) !== Math.sign(b) && Math.abs(b - a) > 1e3 * Math.max(step, 1e-9)) {
      // a jump across a value that is not sampled exactly (1/(x − 0.3)): f grows without end in between
      const m = argMin((x) => -Math.abs(fn(x)), xs[i], xs[i + 1]);
      if (Math.abs(fn(m)) > BIG / 100 || !ok(fn(m))) {
        const e = tidy(m);
        pushPoint({ x: e, kind: "pole", left: limitAt(fn, e, -1), right: limitAt(fn, e, 1) });
      }
    }
  }

  // Where f' is 0: its sign changes, or it only touches 0 (x³ at 0).
  const ds = xs.map((x, i) => (ok(fs[i]) ? d(x) : NaN));
  const nearPole = (x: number) => points.some((p) => p.kind !== "critical" && Math.abs(p.x - x) < step * 3);
  for (let i = 1; i < SAMPLES; i++) {
    const [a, b, c] = [ds[i - 1], ds[i], ds[i + 1]];
    if (!ok(a) || !ok(b) || !ok(c)) continue;
    let x: number | null = null;
    if (b === 0) x = xs[i];
    else if (Math.sign(b) !== Math.sign(c) && c !== 0) x = bisect(d, xs[i], xs[i + 1]);
    else if (Math.abs(b) <= Math.abs(a) && Math.abs(b) < Math.abs(c)) {
      const m = argMin((t) => Math.abs(d(t)), xs[i - 1], xs[i + 1]);
      if (Math.abs(d(m)) < 1e-6) x = m;
    }
    if (x === null || nearPole(x)) continue;
    const e = tidy(x);
    if (!ok(fn(e)) || Math.abs(d(e)) > 1e-3 * Math.max(1, Math.abs(fn(e)))) continue; // (a corner, |x|: no tangent)
    pushPoint({ x: e, kind: "critical", value: tidy(fn(e)) });
  }

  // The two ends: ±∞ when the function is defined that far, else the end of the interval asked for.
  const definedAt = (x: number) => ok(fn(x));
  if (!points.some((p) => p.kind === "edge" && p.right !== undefined) && definedAt(lo + step)) {
    if (range.from === undefined) pushPoint({ x: -Infinity, kind: "end", value: limitAtInfinity(fn, -1) });
    else pushPoint({ x: lo, kind: "end", value: tidy(fn(lo)) });
  }
  if (!points.some((p) => p.kind === "edge" && p.left !== undefined) && definedAt(hi - step)) {
    if (range.to === undefined) pushPoint({ x: Infinity, kind: "end", value: limitAtInfinity(fn, 1) });
    else pushPoint({ x: hi, kind: "end", value: tidy(fn(hi)) });
  }
  points.sort((p, q) => p.x - q.x);

  // The sign of f' between two points: at a point inside.
  const signs = points.slice(1).map((p, k) => {
    const a = points[k].x;
    const b = p.x;
    const at = !ok(a) && !ok(b) ? 0 : !ok(a) ? b - 1 : !ok(b) ? a + 1 : (a + b) / 2;
    const v = d(at);
    return (v >= 0 ? 1 : -1) as 1 | -1;
  });
  return { points, signs };
}

// ---------------------------------------------------------------- graph

/** The window of a graph of `fn` that shows its remarkable points (and some room around them). */
export function graphWindow(fn: Fn, study?: FunctionStudy): { xMin: number; xMax: number; yMin: number; yMax: number } {
  const finite = (study?.points ?? []).filter((p) => ok(p.x)).map((p) => p.x);
  let xMin = -5;
  let xMax = 5;
  if (finite.length) {
    const a = Math.min(...finite);
    const b = Math.max(...finite);
    const pad = Math.max(2, (b - a) * 0.4);
    xMin = Math.min(-1, Math.floor(a - pad));
    xMax = Math.max(1, Math.ceil(b + pad));
  }
  const ys: number[] = [];
  for (let i = 0; i <= 400; i++) {
    const y = fn(xMin + ((xMax - xMin) * i) / 400);
    if (ok(y)) ys.push(y);
  }
  ys.sort((a, b) => a - b);
  let yMin = -5;
  let yMax = 5;
  if (ys.length) {
    // (the ends of the curve near an asymptote would squash the rest: the extreme 5 % are left out)
    const q = (t: number) => ys[Math.min(ys.length - 1, Math.max(0, Math.round(t * (ys.length - 1))))];
    const pole = (study?.points ?? []).some((p) => p.kind === "pole");
    const a = pole ? q(0.05) : ys[0];
    const b = pole ? q(0.95) : ys[ys.length - 1];
    const pad = Math.max(1, (b - a) * 0.15);
    yMin = Math.floor(Math.min(a - pad, -1));
    yMax = Math.ceil(Math.max(b + pad, 1));
  }
  return { xMin, xMax, yMin, yMax };
}

// ---------------------------------------------------------------- table

export interface DerivativeTableOptions {
  name: string; // f
  variable: string; // x
  lang: Lang;
  blank?: boolean; // only the x row: the student fills the signs and the arrows
  words?: boolean; // "increasing" / "decreasing" instead of arrows
}

const MINUS = "−";

/** A value as printed in the table: −∞, 2, −1,5, 0,33 (a French decimal comma, except in Arabic exams). */
export function formatValue(v: number | undefined, lang: Lang): string {
  if (v === undefined || Number.isNaN(v)) return "";
  if (v === Infinity) return "+∞";
  if (v === -Infinity) return `${MINUS}∞`;
  const r = Math.round(v * 100) / 100;
  const s = String(Math.abs(r) < 1e-9 ? 0 : r).replace("-", MINUS);
  return lang === "fr" ? s.replace(".", ",") : s;
}

const WORDS: Record<Lang, { up: string; down: string }> = {
  fr: { up: "croissante", down: "décroissante" },
  ar: { up: "تزايدية", down: "تناقصية" },
};

/** The cells of the first derivative test table (one column per point and one between each two), and the looks of its cells. */
export function derivativeTable(study: FunctionStudy, o: DerivativeTableOptions) {
  const { points, signs } = study;
  const fx = `${o.name}(${o.variable})`;
  const fpx = `${o.name}'(${o.variable})`;
  const rowX: string[] = [o.variable];
  const rowD: string[] = [fpx];
  const rowF: string[] = [fx];
  points.forEach((p, k) => {
    rowX.push(formatValue(p.x, o.lang));
    if (o.blank) {
      rowD.push("");
      rowF.push("");
    } else {
      rowD.push(p.kind === "critical" ? "0" : p.kind === "pole" ? "‖" : "");
      if (p.kind === "pole") rowF.push(`${formatValue(p.left, o.lang)} ‖ ${formatValue(p.right, o.lang)}`);
      else rowF.push(formatValue(p.value, o.lang));
    }
    if (k < signs.length) {
      rowX.push("");
      const up = signs[k] > 0;
      rowD.push(o.blank ? "" : up ? "+" : MINUS);
      rowF.push(o.blank ? "" : o.words ? WORDS[o.lang][up ? "up" : "down"] : up ? "↗" : "↘");
    }
  });
  const cells = [rowX, rowD, rowF];
  const cols = rowX.length;
  // Centered everywhere; between the points of the x and f(x) rows no line, as tables of variations are drawn.
  const cellStyles: Record<string, { align: "center"; valign: "middle"; bold?: boolean; size?: number; bR?: boolean }> = {};
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < cols; c++) {
      const st: (typeof cellStyles)[string] = { align: "center", valign: "middle" };
      if (c === 0) st.bold = true;
      if (r !== 1 && c > 0 && c < cols - 1) st.bR = false;
      if (r === 2 && c > 0 && (c - 1) % 2 === 1 && !o.words) st.size = 20; // the arrows, bigger
      cellStyles[`${r},${c}`] = st;
    }
  }
  const labelShare = 1.4;
  const colWidths = [labelShare, ...Array.from({ length: cols - 1 }, () => 1)].map((w, _i, all) => w / all.reduce((a, b) => a + b, 0));
  return { cells, cellStyles, colWidths, rowHeights: [0, 0, 44] };
}
