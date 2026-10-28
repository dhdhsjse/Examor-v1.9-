// What a keyboard key types in a plain text field. The keys carry LaTeX (for the equation field of the Properties panel); the
// studios have no equation field, only ordinary inputs (axis titles, labels, a formula "5*exp(-t/40)"), so there the LaTeX is turned
// into text: Greek letters and signs as Unicode, a fraction as "a/b", a root as "√(x)", and the scripts in the markup the Graph
// Studio's labels already read ("u_{C}", "10^{-4}"). A key with no text form (a matrix, a limit in a formula…) gives null: the
// keyboard greys it out in that field. Pure functions (no React, no DOM).
//
// Two flavours, since two kinds of field exist: "label" (free text, scripts as markup) and "formula" (the Graph Studio's
// y = f(x) field, read by graphMath.ts: "x^2", "√(x)", "π", no subscripts).

export type PlainFlavor = "label" | "formula";

export interface PlainInsert {
  text: string;
  /** Where the cursor goes in `text` (the first box of the key: inside the brackets of "()", the numerator…). */
  caret: number;
}

const CARET = "\u0001"; // stands for a box to fill while the text is built

const SYMBOLS: Record<string, string> = {
  // Greek
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ",
  iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ",
  phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  hbar: "ħ", ell: "ℓ",
  // signs
  times: "×", div: "÷", cdot: "·", pm: "±", mp: "∓", neq: "≠", ne: "≠", approx: "≈", leq: "≤", le: "≤", geq: "≥", ge: "≥",
  infty: "∞", ldots: "…", dots: "…", cdots: "⋯", circ: "°", prime: "′", propto: "∝", equiv: "≡", sim: "∼",
  to: "→", rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", Leftrightarrow: "⇔", rightleftharpoons: "⇌",
  in: "∈", notin: "∉", subset: "⊂", cup: "∪", cap: "∩", emptyset: "∅", forall: "∀", exists: "∃",
  parallel: "∥", perp: "⊥", triangle: "△", angle: "∠", wedge: "∧", sum: "∑", int: "∫", partial: "∂", nabla: "∇",
  Vert: "‖", vert: "|",
};

// Functions written as their name.
const NAMES = new Set(["sin", "cos", "tan", "cot", "arcsin", "arccos", "arctan", "ln", "log", "lim", "max", "min"]);

// Accents become the combining sign that follows the letter: v⃗, ẋ, ẍ, x̄, x̂.
const ACCENTS: Record<string, string> = { vec: "⃗", overrightarrow: "⃗", dot: "̇", ddot: "̈", overline: "̄", widehat: "̂" };

const BLACKBOARD: Record<string, string> = { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ" };

class Unsupported extends Error {}
const no = (): never => {
  throw new Unsupported();
};

// A fraction's part needs no brackets when it is one number or one letter (with its accent): "t/τ", "1/2". "2a" does: 1/2a reads (1/2)a.
const ATOM = /^(?:\d+(?:\.\d+)?|\p{L}\p{M}*)$/u;
const wrap = (s: string) => (s.includes(CARET) || !ATOM.test(s) ? `(${s})` : s);
// What `formula` fields accept after "^" without brackets: a number or one letter.
const FORMULA_ATOM = /^(?:\d+\.?\d*|\p{L})$/u;

function accent(arg: string, mark: string): string {
  if (arg.includes(CARET) || !arg.trim()) return no(); // nothing to put the sign on
  return arg + mark;
}

class Reader {
  private i = 0;

  constructor(
    private readonly src: string,
    private readonly flavor: PlainFlavor,
    private readonly selection: string,
  ) {}

  private done = () => this.i >= this.src.length;

  private expect(c: string) {
    if (this.src[this.i] !== c) no();
    this.i++;
  }

  /** What is left up to `stop` (not taken) or the end. */
  seq(stop?: string): string {
    let out = "";
    while (!this.done() && this.src[this.i] !== stop) out += this.item();
    return out;
  }

  private item(): string {
    const c = this.src[this.i++];
    switch (c) {
      case " ":
        return ""; // spaces mean nothing in LaTeX maths
      case "\\":
        return this.command();
      case "{": {
        const inner = this.seq("}");
        this.expect("}");
        return inner;
      }
      case "^":
        return this.script("sup");
      case "_":
        return this.script("sub");
      case "#": {
        const kind = this.src[this.i++];
        if (kind === "?") return CARET; // a box to fill
        if (kind === "0") return this.selection || CARET; // the selected part
        if (kind === "@") return ""; // the thing before the cursor: it is already there
        return no();
      }
      case "&":
      case "}":
        return no();
      default:
        return c;
    }
  }

  /** One argument: {a group} or a single token. */
  private arg(): string {
    while (this.src[this.i] === " ") this.i++;
    if (this.done()) return no();
    if (this.src[this.i] === "{") {
      this.i++;
      const inner = this.seq("}");
      this.expect("}");
      return inner;
    }
    return this.item();
  }

  /** The text of a {group} as it is (\text{si }), spaces and all. */
  private raw(): string {
    if (this.src[this.i] !== "{") return no();
    let depth = 0;
    let out = "";
    for (; !this.done(); this.i++) {
      const c = this.src[this.i];
      if (c === "{") {
        if (depth++ === 0) continue;
      } else if (c === "}" && --depth === 0) {
        this.i++;
        return out;
      }
      out += c;
    }
    return no();
  }

  private script(kind: "sup" | "sub"): string {
    const inner = this.arg();
    if (kind === "sub") return this.flavor === "formula" ? no() : `_{${inner}}`;
    if (inner === "°") return "°"; // 90^{\circ} is just 90°
    if (this.flavor === "label") return `^{${inner}}`;
    return FORMULA_ATOM.test(inner) ? `^${inner}` : `^(${inner})`;
  }

  /** The bracket after \left or \right. */
  private delimiter(): string {
    const c = this.src[this.i++];
    if (c === ".") return "";
    if (c === "\\") {
      const named = /^[a-zA-Z]+/.exec(this.src.slice(this.i));
      if (named) {
        this.i += named[0].length;
        return named[0] === "Vert" ? "‖" : named[0] === "vert" ? "|" : no();
      }
      const d = this.src[this.i++];
      return d === "{" || d === "}" ? d : d === "|" ? "‖" : no();
    }
    return c ?? no();
  }

  private command(): string {
    const named = /^[a-zA-Z]+/.exec(this.src.slice(this.i));
    if (!named) {
      const c = this.src[this.i++];
      if (c === "," || c === ";" || c === ":" || c === " ") return " "; // a thin space, between a number and its unit
      if (c === "!") return "";
      if (c === "{" || c === "}" || c === "%") return c;
      if (c === "|") return "‖";
      return no(); // \\ (a table row)…
    }
    const name = named[0];
    this.i += name.length;
    if (Object.hasOwn(SYMBOLS, name)) return SYMBOLS[name];
    if (NAMES.has(name)) return name;
    switch (name) {
      case "left":
      case "right":
        return this.delimiter();
      case "frac": {
        const top = this.arg();
        const bottom = this.arg();
        return `${wrap(top)}/${wrap(bottom)}`;
      }
      case "sqrt":
        if (this.src[this.i] === "[") return no(); // an n-th root has no text form
        return `√(${this.arg()})`;
      case "vec":
      case "overrightarrow":
      case "dot":
      case "ddot":
      case "overline":
      case "widehat":
        return accent(this.arg(), ACCENTS[name]);
      case "mathrm":
      case "mathit":
      case "mathbf":
      case "mathcal":
      case "operatorname":
        return this.arg();
      case "text":
        return this.raw();
      case "mathbb": {
        const letter = this.arg();
        return BLACKBOARD[letter] ?? letter;
      }
      case "xrightarrow":
        return `—${this.arg()}→`;
      default:
        return no(); // \begin{cases}, \binom…
    }
  }
}

/**
 * The text a key types in a plain field, and where the cursor goes after it; null if the key has no text form in that kind of field.
 * `selection` is what is selected in the field now: keys that wrap "the selected part" (a fraction, a root, brackets) keep it.
 */
export function plainFromLatex(latex: string, flavor: PlainFlavor = "label", selection = ""): PlainInsert | null {
  try {
    const built = new Reader(latex, flavor, selection).seq();
    const text = built.replaceAll(CARET, "");
    if (!text) return null;
    const caret = built.indexOf(CARET);
    return { text, caret: caret < 0 ? text.length : caret };
  } catch (error) {
    if (error instanceof Unsupported) return null;
    throw error;
  }
}
