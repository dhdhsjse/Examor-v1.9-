// The formulas of a table: "=SUM(B2:B4)/3", "=IF(A1>0; A1*2; 0)". A small Excel: numbers, text, cell references (A1, $A$1) and ranges
// (A1:B3), the operators + - * / ^ & % and the comparisons, parentheses, and about thirty functions, with their French names too.
// Arguments are separated by "," or ";" (decimals are written with a point inside a formula). Errors are values (#DIV/0!, #REF!…)
// that travel through the formulas that use them. Pure functions, unit-tested.
import { formatRef, parseRef, type ParsedRef } from "./refs";
import { parseNumber } from "./format";

export type FormulaError = { error: string };
/** What a cell is worth: a number, a text, a truth value, nothing (null), or an error */
export type Value = number | string | boolean | null | FormulaError;

export const isError = (v: unknown): v is FormulaError => typeof v === "object" && v !== null && "error" in v;
const err = (error: string): FormulaError => ({ error });
export const ERRORS = ["#DIV/0!", "#REF!", "#VALUE!", "#NAME?", "#N/A", "#NUM!", "#CIRC!", "#ERROR!"] as const;

// ---- reading the text ----

type Tok = { t: "num" | "str" | "ref" | "id" | "op" | "err"; v: string; i: number; j: number };

const NUM = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;
const REF_TOKEN = /^\$?[A-Za-z]{1,2}\$?\d{1,3}(?![A-Za-z0-9_(])/;
const ID = /^[A-Za-z_][A-Za-z0-9_.]*/;
const ERR_TOKEN = /^#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|CIRC!|ERROR!)/;

function tokenize(src: string): Tok[] | null {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    const ch = rest[0];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = ERR_TOKEN.exec(rest))) out.push({ t: "err", v: m[0], i, j: i + m[0].length });
    else if ((m = REF_TOKEN.exec(rest))) out.push({ t: "ref", v: m[0], i, j: i + m[0].length });
    else if ((m = NUM.exec(rest))) out.push({ t: "num", v: m[0], i, j: i + m[0].length });
    else if ((m = ID.exec(rest))) out.push({ t: "id", v: m[0], i, j: i + m[0].length });
    else if (ch === '"') {
      let j = i + 1;
      let text = "";
      for (; j < src.length; j++) {
        if (src[j] === '"') {
          if (src[j + 1] === '"') {
            text += '"';
            j++;
          } else break;
        } else text += src[j];
      }
      if (j >= src.length) return null; // (no closing quote)
      out.push({ t: "str", v: text, i, j: j + 1 });
      i = j + 1;
      continue;
    } else if (/^(<>|<=|>=)/.test(rest)) out.push({ t: "op", v: rest.slice(0, 2), i, j: i + 2 });
    else if ("+-*/^&=<>(),;:%".includes(ch)) out.push({ t: "op", v: ch, i, j: i + 1 });
    else return null;
    i = out[out.length - 1].j;
  }
  return out;
}

// ---- the tree ----

type Node =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "bool"; v: boolean }
  | { k: "err"; v: string }
  | { k: "ref"; ref: ParsedRef }
  | { k: "range"; a: ParsedRef; b: ParsedRef }
  | { k: "un"; op: "-" | "+"; x: Node }
  | { k: "pct"; x: Node }
  | { k: "bin"; op: string; a: Node; b: Node }
  | { k: "fn"; name: string; args: Node[] };

class Parser {
  private p = 0;
  constructor(private toks: Tok[]) {}
  private peek = () => this.toks[this.p];
  private is = (v: string) => this.peek()?.t === "op" && this.peek().v === v;
  private eat(v: string) {
    if (!this.is(v)) throw new Error("syntax");
    this.p++;
  }
  parse(): Node {
    const n = this.cmp();
    if (this.p < this.toks.length) throw new Error("syntax");
    return n;
  }
  private cmp(): Node {
    let a = this.concat();
    while (["=", "<>", "<", ">", "<=", ">="].some((o) => this.is(o))) {
      const op = this.toks[this.p++].v;
      a = { k: "bin", op, a, b: this.concat() };
    }
    return a;
  }
  private concat(): Node {
    let a = this.add();
    while (this.is("&")) {
      this.p++;
      a = { k: "bin", op: "&", a, b: this.add() };
    }
    return a;
  }
  private add(): Node {
    let a = this.mul();
    while (this.is("+") || this.is("-")) {
      const op = this.toks[this.p++].v;
      a = { k: "bin", op, a, b: this.mul() };
    }
    return a;
  }
  private mul(): Node {
    let a = this.unary();
    while (this.is("*") || this.is("/")) {
      const op = this.toks[this.p++].v;
      a = { k: "bin", op, a, b: this.unary() };
    }
    return a;
  }
  // (-2^2 is -4, as in mathematics, not 4 as in a spreadsheet)
  private unary(): Node {
    if (this.is("-") || this.is("+")) {
      const op = this.toks[this.p++].v as "-" | "+";
      return { k: "un", op, x: this.unary() };
    }
    return this.pow();
  }
  private pow(): Node {
    const a = this.postfix();
    if (this.is("^")) {
      this.p++;
      return { k: "bin", op: "^", a, b: this.unary() };
    }
    return a;
  }
  private postfix(): Node {
    let a = this.primary();
    while (this.is("%")) {
      this.p++;
      a = { k: "pct", x: a };
    }
    return a;
  }
  private primary(): Node {
    const t = this.toks[this.p++];
    if (!t) throw new Error("syntax");
    if (t.t === "num") return { k: "num", v: Number(t.v) };
    if (t.t === "str") return { k: "str", v: t.v };
    if (t.t === "err") return { k: "err", v: t.v };
    if (t.t === "ref") {
      const a = parseRef(t.v)!;
      if (this.is(":")) {
        this.p++;
        const u = this.toks[this.p++];
        const b = u?.t === "ref" ? parseRef(u.v) : null;
        if (!b) throw new Error("syntax");
        return { k: "range", a, b };
      }
      return { k: "ref", ref: a };
    }
    if (t.t === "id") {
      if (this.is("(")) {
        this.p++;
        const args: Node[] = [];
        if (!this.is(")")) {
          args.push(this.cmp());
          while (this.is(",") || this.is(";")) {
            this.p++;
            args.push(this.cmp());
          }
        }
        this.eat(")");
        return { k: "fn", name: t.v.toUpperCase(), args };
      }
      const up = t.v.toUpperCase();
      if (up === "TRUE" || up === "VRAI") return { k: "bool", v: true };
      if (up === "FALSE" || up === "FAUX") return { k: "bool", v: false };
      if (up === "PI") return { k: "num", v: Math.PI };
      return { k: "err", v: "#NAME?" };
    }
    if (t.t === "op" && t.v === "(") {
      const n = this.cmp();
      this.eat(")");
      return n;
    }
    throw new Error("syntax");
  }
}

const cache = new Map<string, Node | null>();

// A formula with ";" between its arguments (as in a French spreadsheet) writes its decimals with a comma: 2,5 is 2.5.
function commaDecimals(src: string): string {
  if (!src.includes(";")) return src;
  return src
    .split(/("(?:[^"]|"")*")/)
    .map((part, i) => (i % 2 ? part : part.replace(/(\d),(\d)/g, "$1.$2")))
    .join("");
}

function parseFormula(raw: string): Node | null {
  if (cache.has(raw)) return cache.get(raw) ?? null;
  let node: Node | null = null;
  const toks = tokenize(commaDecimals(raw.replace(/^=\s*/, "")));
  if (toks && toks.length) {
    try {
      node = new Parser(toks).parse();
    } catch {
      node = null;
    }
  }
  if (cache.size > 500) cache.clear();
  cache.set(raw, node);
  return node;
}

/** Whether a text typed in a cell is a formula (it starts with "=" and has something after it) */
export const isFormula = (raw: string) => raw.startsWith("=") && raw.slice(1).trim() !== "";

// ---- working it out ----

type Arg = Value | Value[];

export type Sheet = {
  rows: number;
  cols: number;
  /** What the cell at (r, c) is worth (a formula is worked out, once) */
  value: (r: number, c: number) => Value;
};

const FUNCTION_ALIASES: Record<string, string> = {
  SOMME: "SUM",
  MOYENNE: "AVERAGE",
  NB: "COUNT",
  NBVAL: "COUNTA",
  ARRONDI: "ROUND",
  "ARRONDI.SUP": "ROUNDUP",
  "ARRONDI.INF": "ROUNDDOWN",
  SI: "IF",
  ET: "AND",
  OU: "OR",
  NON: "NOT",
  RACINE: "SQRT",
  PUISSANCE: "POWER",
  PRODUIT: "PRODUCT",
  MEDIANE: "MEDIAN",
  ENT: "INT",
  LOG: "LOG10",
};

const toNumber = (v: Value): number | FormulaError => {
  if (isError(v)) return v;
  if (v === null) return 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") return v;
  const n = parseNumber(v);
  return n === null ? err("#VALUE!") : n;
};

const toText = (v: Value): string => (v === null ? "" : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v));
const toBool = (v: Value): boolean | FormulaError => {
  if (isError(v)) return v;
  if (v === null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const up = v.toUpperCase();
  return up === "TRUE" || up === "VRAI" ? true : up === "FALSE" || up === "FAUX" ? false : err("#VALUE!");
};

const finite = (n: number): Value => (Number.isFinite(n) ? n : err("#NUM!"));

function compare(op: string, a: Value, b: Value): Value {
  if (isError(a)) return a;
  if (isError(b)) return b;
  const x = a === null ? (typeof b === "string" ? "" : 0) : a;
  const y = b === null ? (typeof a === "string" ? "" : 0) : b;
  let order: number;
  if (typeof x === typeof y) order = x < y ? -1 : x > y ? 1 : 0;
  else order = typeof x === "number" ? -1 : typeof x === "boolean" ? 1 : typeof y === "number" ? 1 : -1; // numbers < text < truth values
  if (typeof x === "string" && typeof y === "string") order = x.localeCompare(y, undefined, { sensitivity: "accent" });
  switch (op) {
    case "=":
      return order === 0;
    case "<>":
      return order !== 0;
    case "<":
      return order < 0;
    case ">":
      return order > 0;
    case "<=":
      return order <= 0;
    default:
      return order >= 0;
  }
}

function evaluate(node: Node, sheet: Sheet): Arg {
  switch (node.k) {
    case "num":
    case "str":
    case "bool":
      return node.v;
    case "err":
      return err(node.v);
    case "ref":
      return cellValue(node.ref.r, node.ref.c, sheet);
    case "range": {
      const out: Value[] = [];
      const [r0, r1] = [Math.min(node.a.r, node.b.r), Math.max(node.a.r, node.b.r)];
      const [c0, c1] = [Math.min(node.a.c, node.b.c), Math.max(node.a.c, node.b.c)];
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push(cellValue(r, c, sheet));
      return out;
    }
    case "un": {
      const x = scalar(evaluate(node.x, sheet));
      const n = toNumber(x);
      return isError(n) ? n : node.op === "-" ? -n : n;
    }
    case "pct": {
      const n = toNumber(scalar(evaluate(node.x, sheet)));
      return isError(n) ? n : n / 100;
    }
    case "bin": {
      const a = scalar(evaluate(node.a, sheet));
      const b = scalar(evaluate(node.b, sheet));
      if (["=", "<>", "<", ">", "<=", ">="].includes(node.op)) return compare(node.op, a, b);
      if (isError(a)) return a;
      if (isError(b)) return b;
      if (node.op === "&") return toText(a) + toText(b);
      const x = toNumber(a);
      const y = toNumber(b);
      if (isError(x)) return x;
      if (isError(y)) return y;
      switch (node.op) {
        case "+":
          return finite(x + y);
        case "-":
          return finite(x - y);
        case "*":
          return finite(x * y);
        case "/":
          return y === 0 ? err("#DIV/0!") : finite(x / y);
        default:
          return finite(Math.pow(x, y));
      }
    }
    case "fn":
      return callFunction(node.name, node.args, sheet);
  }
}

// A range where one value is needed is an error (as in a spreadsheet, outside functions that take ranges).
const scalar = (a: Arg): Value => (Array.isArray(a) ? err("#VALUE!") : a);

function cellValue(r: number, c: number, sheet: Sheet): Value {
  if (r < 0 || c < 0 || r >= sheet.rows || c >= sheet.cols) return err("#REF!");
  return sheet.value(r, c);
}

// What a function that adds up or counts takes from its arguments: the numbers of the ranges (text in a range is left out), and
// the numbers typed or computed as arguments (text that is not a number is an error).
function numbersOf(args: Arg[]): number[] | FormulaError {
  const out: number[] = [];
  for (const a of args) {
    if (Array.isArray(a)) {
      for (const v of a) {
        if (isError(v)) return v;
        if (typeof v === "number") out.push(v);
      }
    } else {
      const n = toNumber(a);
      if (isError(n)) return n;
      out.push(n);
    }
  }
  return out;
}

function callFunction(rawName: string, nodes: Node[], sheet: Sheet): Arg {
  const name = FUNCTION_ALIASES[rawName] ?? rawName;
  // IF, AND and OR only work out what they need
  if (name === "IF") {
    if (nodes.length < 2 || nodes.length > 3) return err("#VALUE!");
    const cond = toBool(scalar(evaluate(nodes[0], sheet)));
    if (isError(cond)) return cond;
    if (cond) return scalar(evaluate(nodes[1], sheet));
    return nodes[2] ? scalar(evaluate(nodes[2], sheet)) : false;
  }
  const args = nodes.map((n) => evaluate(n, sheet));
  const one = (f: (x: number) => number): Value => {
    if (args.length !== 1) return err("#VALUE!");
    const x = toNumber(scalar(args[0]));
    return isError(x) ? x : finite(f(x));
  };
  switch (name) {
    case "SUM":
    case "AVERAGE":
    case "MIN":
    case "MAX":
    case "PRODUCT":
    case "MEDIAN": {
      const nums = numbersOf(args);
      if (isError(nums)) return nums;
      if (name === "SUM") return finite(nums.reduce((s, v) => s + v, 0));
      if (name === "PRODUCT") return finite(nums.reduce((s, v) => s * v, 1));
      if (!nums.length) return name === "MIN" || name === "MAX" ? 0 : err("#DIV/0!");
      if (name === "AVERAGE") return finite(nums.reduce((s, v) => s + v, 0) / nums.length);
      if (name === "MIN") return Math.min(...nums);
      if (name === "MAX") return Math.max(...nums);
      const sorted = [...nums].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    case "COUNT": {
      let n = 0;
      for (const a of args) {
        if (Array.isArray(a)) n += a.filter((v) => typeof v === "number").length;
        else if (typeof a === "number" || (typeof a === "string" && parseNumber(a) !== null)) n++;
      }
      return n;
    }
    case "COUNTA": {
      let n = 0;
      for (const a of args) n += (Array.isArray(a) ? a : [a]).filter((v) => v !== null && v !== "").length;
      return n;
    }
    case "ROUND":
    case "ROUNDUP":
    case "ROUNDDOWN": {
      if (args.length < 1 || args.length > 2) return err("#VALUE!");
      const x = toNumber(scalar(args[0]));
      const d = args[1] === undefined ? 0 : toNumber(scalar(args[1]));
      if (isError(x)) return x;
      if (isError(d)) return d;
      const k = Math.pow(10, Math.trunc(d));
      const f = name === "ROUND" ? (v: number) => Math.sign(v) * Math.round(Math.abs(v)) : name === "ROUNDUP" ? (v: number) => Math.sign(v) * Math.ceil(Math.abs(v)) : Math.trunc;
      return finite(f(Math.round(x * k * 1e8) / 1e8) / k);
    }
    case "ABS":
      return one(Math.abs);
    case "SQRT": {
      const x = args.length === 1 ? toNumber(scalar(args[0])) : err("#VALUE!");
      return isError(x) ? x : x < 0 ? err("#NUM!") : Math.sqrt(x);
    }
    case "INT":
      return one(Math.floor);
    case "EXP":
      return one(Math.exp);
    case "LN":
    case "LOG10": {
      const x = args.length === 1 ? toNumber(scalar(args[0])) : err("#VALUE!");
      if (isError(x)) return x;
      return x <= 0 ? err("#NUM!") : name === "LN" ? Math.log(x) : Math.log10(x);
    }
    case "SIN":
      return one(Math.sin);
    case "COS":
      return one(Math.cos);
    case "TAN":
      return one(Math.tan);
    case "POWER":
    case "MOD": {
      if (args.length !== 2) return err("#VALUE!");
      const x = toNumber(scalar(args[0]));
      const y = toNumber(scalar(args[1]));
      if (isError(x)) return x;
      if (isError(y)) return y;
      if (name === "POWER") return finite(Math.pow(x, y));
      return y === 0 ? err("#DIV/0!") : x - y * Math.floor(x / y);
    }
    case "AND":
    case "OR": {
      const flat = args.flatMap((a) => (Array.isArray(a) ? a.filter((v) => v !== null) : [a]));
      let result = name === "AND";
      for (const v of flat) {
        const b = toBool(v);
        if (isError(b)) return b;
        result = name === "AND" ? result && b : result || b;
      }
      return result;
    }
    case "NOT": {
      const b = args.length === 1 ? toBool(scalar(args[0])) : err("#VALUE!");
      return isError(b) ? b : !b;
    }
    case "PI":
      return Math.PI;
    default:
      return err("#NAME?");
  }
}

/** A table's cells as a sheet: `calc` says whether a text starting with "=" is a formula (older tables have none) */
export function createSheet(cells: readonly (readonly string[])[], calc: boolean, plain: (raw: string) => string = (s) => s): Sheet {
  const rows = cells.length;
  const cols = Math.max(0, ...cells.map((row) => row.length));
  const done = new Map<number, Value>();
  const busy = new Set<number>();
  const sheet: Sheet = {
    rows,
    cols,
    value(r, c) {
      const id = r * 1000 + c;
      if (done.has(id)) return done.get(id) as Value;
      if (busy.has(id)) return err("#CIRC!");
      const raw = cells[r]?.[c] ?? "";
      let v: Value;
      if (calc && isFormula(raw)) {
        busy.add(id);
        const node = parseFormula(raw);
        if (!node) v = err("#ERROR!");
        else {
          const out = evaluate(node, sheet);
          v = Array.isArray(out) ? err("#VALUE!") : out;
          if (isError(v) && v.error === "#CIRC!") v = err("#CIRC!");
        }
        busy.delete(id);
      } else {
        const text = plain(raw).trim();
        v = text === "" ? null : (parseNumber(text) ?? text);
      }
      done.set(id, v);
      return v;
    },
  };
  return sheet;
}

// ---- changing the references of a formula (a row is inserted, a cell is copied…) ----

function rewrite(raw: string, mapRef: (p: ParsedRef) => ParsedRef | null, mapRange?: (a: ParsedRef, b: ParsedRef) => [ParsedRef, ParsedRef] | null): string {
  if (!isFormula(raw)) return raw;
  const toks = tokenize(raw);
  if (!toks) return raw;
  let out = "";
  let at = 0;
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.t !== "ref") continue;
    const a = parseRef(t.v)!;
    const colon = toks[k + 1];
    const second = toks[k + 2];
    if (colon?.t === "op" && colon.v === ":" && second?.t === "ref") {
      const b = parseRef(second.v)!;
      const mapped = mapRange ? mapRange(a, b) : (() => {
        const x = mapRef(a);
        const y = mapRef(b);
        return x && y ? ([x, y] as [ParsedRef, ParsedRef]) : null;
      })();
      out += raw.slice(at, t.i) + (mapped ? `${formatRef(mapped[0])}:${formatRef(mapped[1])}` : "#REF!");
      at = second.j;
      k += 2;
    } else {
      const m = mapRef(a);
      out += raw.slice(at, t.i) + (m ? formatRef(m) : "#REF!");
      at = t.j;
    }
  }
  return out + raw.slice(at);
}

/** The formula copied `dr` rows down and `dc` columns right: the references that are not fixed with $ move with it */
export function shiftFormula(raw: string, dr: number, dc: number): string {
  if (dr === 0 && dc === 0) return raw;
  return rewrite(raw, (p) => {
    const r = p.absR ? p.r : p.r + dr;
    const c = p.absC ? p.c : p.c + dc;
    return r < 0 || c < 0 ? null : { ...p, r, c };
  });
}

/** A change of the rows or columns of the table that the references have to follow */
export type Structure = { axis: "row" | "col"; at: number; count: number; kind: "insert" | "delete" };

// Where a reference to row (or column) `v` goes: null if what it pointed to is gone. A range's start moves to the first row left, its end to the last.
function moved(v: number, s: Structure, part: "single" | "start" | "end"): number | null {
  if (s.kind === "insert") return v >= s.at ? v + s.count : v;
  if (v < s.at) return v;
  if (v >= s.at + s.count) return v - s.count;
  return part === "single" ? null : part === "start" ? s.at : s.at - 1;
}

export function adjustFormula(raw: string, s: Structure): string {
  const row = s.axis === "row";
  const one = (p: ParsedRef, part: "single" | "start" | "end"): ParsedRef | null => {
    const v = moved(row ? p.r : p.c, s, part);
    return v === null || v < 0 ? null : row ? { ...p, r: v } : { ...p, c: v };
  };
  return rewrite(
    raw,
    (p) => one(p, "single"),
    (a, b) => {
      const [lo, hi] = (row ? a.r <= b.r : a.c <= b.c) ? [a, b] : [b, a];
      const x = one(lo, "start");
      const y = one(hi, "end");
      if (!x || !y || (row ? x.r > y.r : x.c > y.c)) return null;
      return [x, y];
    },
  );
}
