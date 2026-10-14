// Reads a formula typed by the teacher ("x^2 - 2", "2x+1", "sin(x)", "f(x) = 1/x")
// and turns it into a function we can draw. No eval(): a tiny parser of our own.

export type Fn = (x: number) => number;

const FUNCS: Record<string, Fn> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sqrt: Math.sqrt,
  racine: Math.sqrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  arctan: Math.atan,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };
// Longest names first, so "exp" is not read as "e" + "x" + "p".
const NAMES = [...Object.keys(FUNCS), ...Object.keys(CONSTS), "x"].sort((a, b) => b.length - a.length);

type Token = { t: "num"; v: number } | { t: "name"; v: string } | { t: "op"; v: string };

function tokenize(src: string): Token[] {
  const s = src
    .replace(/^\s*([a-zA-Z]\s*\(\s*x\s*\)|y)\s*=/, "") // drop "f(x) =" or "y ="
    .replace(/(\d),(\d)/g, "$1.$2") // French decimal comma: 0,5
    .replace(/[−–]/g, "-")
    .replace(/×|·/g, "*")
    .replace(/÷/g, "/")
    .replace(/π/g, "pi")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/√/g, "sqrt")
    .toLowerCase();

  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " ") {
      i++;
    } else if (/[\d.]/.test(c)) {
      const m = /^\d*\.?\d+|^\d+\.?/.exec(s.slice(i))!;
      out.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
    } else if (/[a-z]/.test(c)) {
      const name = NAMES.find((n) => s.startsWith(n, i));
      if (!name) throw new Error(`Unknown name “${/^[a-z]+/.exec(s.slice(i))![0]}”`);
      out.push({ t: "name", v: name });
      i += name.length;
    } else if ("+-*/^()|".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
    } else {
      throw new Error(`Unexpected “${c}”`);
    }
  }
  return out;
}

// Recursive-descent parser. Each function returns a ready-to-run closure.
export function compileFunction(src: string): Fn {
  const tokens = tokenize(src);
  if (!tokens.length) throw new Error("Type a formula, e.g. x^2 - 2");
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.t === "op" && peek()!.v === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new Error(`Missing “${v}”`);
    pos++;
  };

  // a + b - c
  function expr(): Fn {
    let left = term();
    while (isOp("+") || isOp("-")) {
      const op = tokens[pos++].v;
      const l = left;
      const r = term();
      left = op === "+" ? (x) => l(x) + r(x) : (x) => l(x) - r(x);
    }
    return left;
  }

  // a * b / c, and "2x", "3(x+1)", "x sin(x)" (multiplication without a sign)
  function term(): Fn {
    let left = unary();
    for (;;) {
      const tk = peek();
      if (isOp("*") || isOp("/")) {
        const op = tokens[pos++].v;
        const l = left;
        const r = unary();
        left = op === "*" ? (x) => l(x) * r(x) : (x) => l(x) / r(x);
      } else if (tk && (tk.t === "num" || tk.t === "name" || (tk.t === "op" && tk.v === "("))) {
        const l = left;
        const r = power();
        left = (x) => l(x) * r(x);
      } else return left;
    }
  }

  // -a
  function unary(): Fn {
    if (isOp("-")) {
      pos++;
      const a = unary();
      return (x) => -a(x);
    }
    if (isOp("+")) {
      pos++;
      return unary();
    }
    return power();
  }

  // a ^ b (right to left: 2^3^2 = 2^9)
  function power(): Fn {
    const base = primary();
    if (!isOp("^")) return base;
    pos++;
    const exp = unary();
    return (x) => Math.pow(base(x), exp(x));
  }

  function primary(): Fn {
    const tk = peek();
    if (!tk) throw new Error("The formula ends too early");
    pos++;
    if (tk.t === "num") return () => tk.v;
    if (tk.t === "name") {
      if (tk.v === "x") return (x) => x;
      if (tk.v in CONSTS) return () => CONSTS[tk.v];
      const f = FUNCS[tk.v];
      const arg = primary(); // sin(x), sin x
      return (x) => f(arg(x));
    }
    if (tk.v === "(") {
      const inside = expr();
      expect(")");
      return inside;
    }
    if (tk.v === "|") {
      const inside = expr();
      expect("|");
      return (x) => Math.abs(inside(x));
    }
    throw new Error(`Unexpected “${tk.v}”`);
  }

  const fn = expr();
  if (pos < tokens.length) throw new Error(`Unexpected “${tokens[pos].v}”`);
  return fn;
}

// Returns the function, or the error message if the formula can't be read.
export function tryCompile(src: string): { fn: Fn | null; error: string | null } {
  try {
    return { fn: compileFunction(src), error: null };
  } catch (e) {
    return { fn: null, error: e instanceof Error ? e.message : String(e) };
  }
}

// A "round" distance between grid lines: 1, 2, 5, 10, 20...
export function niceStep(range: number, target = 10): number {
  const raw = Math.max(range, 1e-9) / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}
