// The probabilities of a tree as numbers: what the teacher typed on a branch ("0.3", "0,3", "1/4", "25 %") read as an exact
// fraction, the probability of a path (the product along it), the check that the branches from a node add up to 1, and the
// branch left blank worked out from the others. Pure functions, unit-tested.
import type { ProbNode } from "./types";

/** An exact fraction n / d, d > 0, reduced. */
export type Rational = { n: number; d: number };

const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
};

export const rational = (n: number, d: number): Rational => {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
};

const mul = (a: Rational, b: Rational) => rational(a.n * b.n, a.d * b.d);
const add = (a: Rational, b: Rational) => rational(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Rational, b: Rational) => add(a, { n: -b.n, d: b.d });

/** A decimal number as typed ("0,35", ".5", "2") as a fraction, or null. */
function decimal(s: string): Rational | null {
  const m = /^(-?)(\d*)(?:[.,](\d+))?$/.exec(s);
  if (!m || (!m[2] && !m[3])) return null;
  const frac = m[3] ?? "";
  if (frac.length > 9) return null; // (beyond what a number holds exactly)
  const d = 10 ** frac.length;
  const n = Number((m[2] || "0") + frac);
  return rational(m[1] ? -n : n, d);
}

/** What is written on a branch, read as an exact fraction: "0.3", "0,3", "1/4", "3 / 8", "25 %", "25%". Null for anything else (a letter, an empty field). */
export function parseProb(text: string): Rational | null {
  const s = text.replace(/\s+/g, "").replace(/−/g, "-");
  if (!s) return null;
  if (s.endsWith("%")) {
    const v = decimal(s.slice(0, -1));
    return v && rational(v.n, v.d * 100);
  }
  const slash = s.split("/");
  if (slash.length === 2) {
    const a = decimal(slash[0]);
    const b = decimal(slash[1]);
    if (!a || !b || b.n === 0) return null;
    return rational(a.n * b.d, a.d * b.n);
  }
  return slash.length === 1 ? decimal(s) : null;
}

/** "a/b" typed on a branch: shown as a fraction one over the other. */
export const isFraction = (text: string) => /^\s*-?\d+\s*\/\s*\d+\s*$/.test(text);

/** How the numbers of a tree are written: as fractions when the teacher wrote fractions, with a comma when they wrote commas. */
export type NumberStyle = { fraction: boolean; comma: boolean };

export function numberStyle(texts: string[]): NumberStyle {
  return { fraction: texts.some(isFraction), comma: texts.some((t) => /\d,\d/.test(t)) };
}

/** A fraction written the way the tree writes its numbers: "3/20", or "0.15" (four decimals at most, a comma if asked). */
export function formatRational(r: Rational, style: NumberStyle): string {
  if (style.fraction) return r.d === 1 ? String(r.n) : `${r.n}/${r.d}`;
  const v = Math.round((r.n / r.d) * 10000) / 10000;
  const s = String(v);
  return style.comma ? s.replace(".", ",") : s;
}

/** The probability of a path: the product of its branches (null when one of them is not a number). */
export function pathProbability(probs: string[]): Rational | null {
  let r: Rational = { n: 1, d: 1 };
  for (const p of probs) {
    const v = parseProb(p);
    if (!v) return null;
    r = mul(r, v);
  }
  return r;
}

/** Every probability written in a tree (its numbers' style is read from them). */
export function treeTexts(root: ProbNode): string[] {
  const out: string[] = [];
  const walk = (n: ProbNode) => n.children.forEach((c) => (out.push(c.prob), walk(c)));
  walk(root);
  return out;
}

/** The branches from a node that do not add up to 1 (only where all of them are numbers): the node, and what they add up to. */
export function badSums(root: ProbNode): { node: ProbNode; sum: Rational }[] {
  const out: { node: ProbNode; sum: Rational }[] = [];
  const walk = (n: ProbNode) => {
    if (n.children.length) {
      const values = n.children.map((c) => parseProb(c.prob));
      if (values.every((v): v is Rational => !!v)) {
        const sum = values.reduce(add, { n: 0, d: 1 });
        if (sum.n !== sum.d) out.push({ node: n, sum });
      }
    }
    n.children.forEach(walk);
  };
  walk(root);
  return out;
}

/** The tree with each branch left blank worked out, where it is the only blank one among its siblings and the others are numbers (1 − the others). */
export function fillMissing(root: ProbNode): ProbNode {
  const style = numberStyle(treeTexts(root));
  const walk = (n: ProbNode): ProbNode => {
    let children = n.children;
    const blank = children.filter((c) => !c.prob.trim());
    if (children.length >= 2 && blank.length === 1) {
      const others = children.filter((c) => c !== blank[0]).map((c) => parseProb(c.prob));
      if (others.every((v): v is Rational => !!v)) {
        const rest = sub({ n: 1, d: 1 }, others.reduce(add, { n: 0, d: 1 }));
        if (rest.n >= 0) children = children.map((c) => (c === blank[0] ? { ...c, prob: formatRational(rest, style) } : c));
      }
    }
    return { ...n, children: children.map(walk) };
  };
  return walk(root);
}
