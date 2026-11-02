import { decodeMath, encodeMath, type InlineMath } from "./inlineMath";

// Styled text inside the plain string fields of a block.
// A styled piece is written ⁅c=#dc2626;f=Georgia;s=18;b;i;u;x;sub;h=#fef08a⁆text⁅/⁆ (rare brackets, so they
// never clash with what teachers type). Text without markers is plain, so older exams still work.
// An underline that is not a single line is written u=double (u=dotted, u=dashed, u=wavy: a reader that does not know the
// kind still draws an underline), and a text effect fx=shadow (fx=outline, fx=glow).

// The kinds of underline besides the single line, and the effects of Word's "Text effects".
export const UNDERLINE_STYLES = ["double", "dotted", "dashed", "wavy"] as const;
export type UnderlineStyle = (typeof UNDERLINE_STYLES)[number];
export const TEXT_EFFECTS = ["shadow", "outline", "glow"] as const;
export type TextEffect = (typeof TEXT_EFFECTS)[number];
export const isUnderlineStyle = (v: unknown): v is UnderlineStyle => (UNDERLINE_STYLES as readonly unknown[]).includes(v);
export const isTextEffect = (v: unknown): v is TextEffect => (TEXT_EFFECTS as readonly unknown[]).includes(v);

export interface RunStyle {
  color?: string;
  font?: string; // font family (one of FONT_CHOICES)
  size?: number;
  b?: boolean;
  i?: boolean;
  u?: boolean; // underlined (a single line unless `ul` says another kind)
  ul?: UnderlineStyle; // the kind of underline when it is not a single line (`u` is true too)
  fx?: TextEffect; // a shadow, an outline or a glow around the letters
  x?: boolean; // struck through
  hl?: string; // highlight (background color of the words)
  sub?: boolean; // subscript (H₂O): smaller, lowered
  sup?: boolean; // superscript (m/s²): smaller, raised. Never together with sub.
  math?: InlineMath; // a formula: each character of the run (MATH_CHAR) is this formula, drawn by MathJax (inlineMath.ts)
}

export interface Run {
  text: string;
  style: RunStyle;
}

const OPEN = "⁅";
const CLOSE = "⁆";
const END = "⁅/⁆";
const RUN_RE = /⁅(?!\/)([^⁆]*)⁆([\s\S]*?)⁅\/⁆/g;
const MARKERS_RE = /[⁅⁆]/g;

export const isRich = (s: string) => s.includes(OPEN);

function parseStyle(src: string): RunStyle {
  const st: RunStyle = {};
  for (const part of src.split(";")) {
    const [k, v] = part.split("=");
    if (k === "c" && v) st.color = v;
    else if (k === "f" && v) st.font = v;
    else if (k === "s" && Number(v) > 0) st.size = Number(v);
    else if (k === "b") st.b = true;
    else if (k === "i") st.i = true;
    else if (k === "u") {
      st.u = true;
      if (isUnderlineStyle(v)) st.ul = v;
    } else if (k === "fx" && isTextEffect(v)) st.fx = v;
    else if (k === "x") st.x = true;
    else if (k === "sub") st.sub = true;
    else if (k === "sup") st.sup = true;
    else if (k === "h" && v) st.hl = v;
    else if (k === "m" && v) {
      const math = decodeMath(v);
      if (math) st.math = math;
    }
  }
  if (st.sub && st.sup) delete st.sup; // (never both: the first wins)
  return st;
}

function styleString(st: RunStyle): string {
  const out: string[] = [];
  if (st.color) out.push(`c=${st.color}`);
  if (st.font) out.push(`f=${st.font}`);
  if (st.size) out.push(`s=${st.size}`);
  if (st.b) out.push("b");
  if (st.i) out.push("i");
  if (st.u || st.ul) out.push(st.ul ? `u=${st.ul}` : "u");
  if (st.x) out.push("x");
  if (st.sub) out.push("sub");
  else if (st.sup) out.push("sup");
  if (st.hl) out.push(`h=${st.hl}`);
  if (st.fx) out.push(`fx=${st.fx}`);
  if (st.math) out.push(`m=${encodeMath(st.math)}`);
  return out.join(";");
}

export const sameStyle = (a: RunStyle, b: RunStyle) => styleString(a) === styleString(b);

export function parseRich(s: string): Run[] {
  if (!isRich(s)) return [{ text: s, style: {} }];
  const runs: Run[] = [];
  let last = 0;
  for (const m of s.matchAll(RUN_RE)) {
    if (m.index > last) runs.push({ text: s.slice(last, m.index), style: {} });
    runs.push({ text: m[2], style: parseStyle(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < s.length) runs.push({ text: s.slice(last), style: {} });
  return runs;
}

// Back to a string; neighbours with the same style are merged.
export function serializeRich(runs: Run[]): string {
  const merged: Run[] = [];
  for (const r of runs) {
    const text = r.text.replace(MARKERS_RE, "");
    if (!text) continue;
    const prev = merged[merged.length - 1];
    if (prev && sameStyle(prev.style, r.style)) prev.text += text;
    else merged.push({ text, style: r.style });
  }
  return merged
    .map((r) => {
      const st = styleString(r.style);
      return st ? `${OPEN}${st}${CLOSE}${r.text}${END}` : r.text;
    })
    .join("");
}

export const plainText = (s: string) => (isRich(s) ? parseRich(s).map((r) => r.text).join("") : s);

// ---- Character-level editing (offsets count the plain text) ----

type Char = { ch: string; style: RunStyle };

const toChars = (s: string): Char[] => parseRich(s).flatMap((r) => [...r.text].map((ch) => ({ ch, style: r.style })));
const fromChars = (chars: Char[]) => serializeRich(chars.map((c) => ({ text: c.ch, style: c.style })));

// Offsets in UTF-16 units (like DOM selections) → index in the char array.
function charIndex(chars: Char[], offset: number): number {
  let n = 0;
  for (let i = 0; i < chars.length; i++) {
    if (n >= offset) return i;
    n += chars[i].ch.length;
  }
  return chars.length;
}

export type StylePatch = { [K in keyof RunStyle]?: RunStyle[K] | null }; // null = remove

export const patchStyle = (st: RunStyle, patch: StylePatch): RunStyle => {
  const out = { ...st } as Record<string, unknown>;
  // A script replaces the other one (a word is not both below and above the line).
  if (patch.sub) delete out.sup;
  if (patch.sup) delete out.sub;
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === false || v === undefined) delete out[k];
    else out[k] = v;
  }
  if (patch.ul) out.u = true; // (giving a kind of underline underlines)
  if (!out.u) delete out.ul; // (no underline, no kind of it)
  return out as RunStyle;
};

// Style the text between `start` and `end`. `clear` removes every style there.
export function applyStyle(s: string, start: number, end: number, patch: StylePatch | "clear"): string {
  const chars = toChars(s);
  const a = charIndex(chars, start);
  const b = charIndex(chars, end);
  for (let i = a; i < b; i++) chars[i] = { ch: chars[i].ch, style: patch === "clear" ? {} : patchStyle(chars[i].style, patch) };
  return fromChars(chars);
}

// The style all the selected characters share (for the format bar). Empty selection: the char before.
export function styleAt(s: string, start: number, end: number): RunStyle {
  const chars = toChars(s);
  let a = charIndex(chars, start);
  let b = charIndex(chars, end);
  if (a === b) {
    a = Math.max(0, a - 1);
    b = Math.min(chars.length, a + 1);
  }
  const picked = chars.slice(a, b);
  if (!picked.length) return {};
  const first = picked[0].style;
  const common: RunStyle = {};
  for (const k of Object.keys(first) as (keyof RunStyle)[]) {
    if (picked.every((c) => c.style[k] === first[k])) (common as Record<string, unknown>)[k] = first[k];
  }
  return common;
}

// Insert plain text (taking the style of the character before it; never its formula: typed letters are not a formula).
export function insertText(s: string, offset: number, text: string): string {
  const chars = toChars(s);
  const i = charIndex(chars, offset);
  const style = { ...(chars[i - 1]?.style ?? chars[i]?.style ?? {}) };
  delete style.math;
  chars.splice(i, 0, ...[...text].map((ch) => ({ ch, style })));
  return fromChars(chars);
}

// Fill-in-the-blank: replace every [answer] with `fn(answer)`, keeping the styles around it.
export function replaceBlanks(s: string, fn: (answer: string) => { text: string; style?: RunStyle }): Run[] {
  const chars = toChars(s);
  const out: Run[] = [];
  const push = (text: string, style: RunStyle) => {
    const prev = out[out.length - 1];
    if (prev && sameStyle(prev.style, style)) prev.text += text;
    else out.push({ text, style });
  };
  for (let i = 0; i < chars.length; i++) {
    if (chars[i].ch === "[") {
      const close = chars.findIndex((c, k) => k > i && c.ch === "]");
      if (close > i) {
        const inner = chars.slice(i + 1, close);
        const r = fn(inner.map((c) => c.ch).join(""));
        push(r.text, { ...(inner[0]?.style ?? chars[i].style), ...r.style });
        i = close;
        continue;
      }
    }
    push(chars[i].ch, chars[i].style);
  }
  return out;
}

// Remove the text between `start` and `end`.
export function deleteRange(s: string, start: number, end: number): string {
  if (end <= start) return s;
  const chars = toChars(s);
  chars.splice(charIndex(chars, start), charIndex(chars, end) - charIndex(chars, start));
  return fromChars(chars);
}

// ---- Pieces of styled text: copy, paste, paragraphs, transforms ----

// The styled text between `start` and `end` (UTF-16 offsets of the plain text), as a styled string of its own.
export function sliceRich(s: string, start: number, end: number): string {
  const chars = toChars(s);
  return fromChars(chars.slice(charIndex(chars, start), charIndex(chars, end)));
}

// Insert styled text: every character keeps the style it came with (not the one of its neighbour).
export function insertRich(s: string, offset: number, rich: string): string {
  const chars = toChars(s);
  chars.splice(charIndex(chars, offset), 0, ...toChars(rich));
  return fromChars(chars);
}

// Replace the text between `start` and `end` by styled text.
export const replaceRich = (s: string, start: number, end: number, rich: string) => insertRich(deleteRange(s, start, end), start, rich);

// The paragraphs of a text (one per line): each is a styled string of its own, so the styles of a piece that
// spans a line break are kept on both sides. "a\nb" has two paragraphs; "" has one (empty).
export function splitParagraphs(s: string): string[] {
  const out: Char[][] = [[]];
  for (const c of toChars(s)) {
    if (c.ch === "\n") out.push([]);
    else out[out.length - 1].push(c);
  }
  return out.map(fromChars);
}

// The inverse: paragraphs back into one text.
export const joinParagraphs = (paragraphs: string[]) => fromChars(paragraphs.flatMap((p, i): Char[] => [...(i ? [{ ch: "\n", style: {} }] : []), ...toChars(p)]));

// The same text with each character replaced by what `fn` gives for it, keeping the style it had: for changes that
// do not move the letters (a case change: "ß" may become "SS", the style goes with both letters).
export function mapChars(s: string, start: number, end: number, fn: (chars: string[]) => string[]): string {
  const chars = toChars(s);
  const a = charIndex(chars, start);
  const b = charIndex(chars, end);
  const mapped = fn(chars.slice(a, b).map((c) => c.ch));
  const out: Char[] = [...chars.slice(0, a)];
  chars.slice(a, b).forEach((c, i) => out.push(...[...(mapped[i] ?? c.ch)].map((ch) => ({ ch, style: c.style }))));
  out.push(...chars.slice(b));
  return fromChars(out);
}

// Replace every match of `re` in the plain text, keeping the style of the first character of each match. `count` is
// how many were replaced. (`re` must be global.)
export function replaceMatches(s: string, re: RegExp, replacement: string | ((match: string, ...groups: string[]) => string)): { value: string; count: number } {
  const chars = toChars(s);
  const plain = chars.map((c) => c.ch).join("");
  // Offsets of the plain text in UTF-16 units → index in chars.
  const starts: number[] = [];
  let n = 0;
  for (const c of chars) {
    starts.push(n);
    n += c.ch.length;
  }
  const indexOf = (offset: number) => {
    let lo = 0;
    let hi = starts.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (starts[mid] < offset) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const out: Char[] = [];
  let last = 0; // index in chars
  let count = 0;
  for (const m of plain.matchAll(re)) {
    if (!m[0]) continue; // (an empty match replaces nothing)
    const from = indexOf(m.index);
    const to = indexOf(m.index + m[0].length);
    out.push(...chars.slice(last, from));
    const text = typeof replacement === "string" ? replacement : replacement(m[0], ...(m.slice(1) as string[]));
    const style = chars[from]?.style ?? {};
    out.push(...[...text].map((ch) => ({ ch, style })));
    last = to;
    count++;
  }
  if (!count) return { value: s, count: 0 };
  out.push(...chars.slice(last));
  return { value: fromChars(out), count };
}

// How many characters (UTF-16 units) the plain text has: what selection offsets count.
export const plainLength = (s: string) => plainText(s).length;

// What each text effect looks like in the editors (the canvas draws the same with Konva, see RichText): a shadow, a glow of the color of
// the letters, and an outline (the letters are only a line, in the color they have).
export const EFFECT_CSS: Record<TextEffect, Partial<CSSStyleDeclaration>> = {
  shadow: { textShadow: "0.06em 0.06em 0.1em rgba(0,0,0,0.35)" },
  glow: { textShadow: "0 0 0.3em currentColor, 0 0 0.12em currentColor" },
  outline: { webkitTextStroke: "0.04em currentColor", webkitTextFillColor: "transparent" },
};

// CSS for a styled piece (used by the text boxes where the teacher types).
export function runCss(st: RunStyle, stack: (font: string) => string): Partial<CSSStyleDeclaration> {
  const script = st.sub || st.sup;
  return {
    ...(st.color ? { color: st.color } : {}),
    ...(st.font ? { fontFamily: stack(st.font) } : {}),
    // A script is smaller than the text around it (of its own size, if it has one).
    ...(script ? { fontSize: st.size ? `${st.size * SCRIPT_SCALE}px` : `${SCRIPT_SCALE}em` } : st.size ? { fontSize: `${st.size}px` } : {}),
    ...(script ? { lineHeight: "0", position: "relative", top: `${st.sup ? -SUP_RISE_EM : SUB_DROP_EM}em` } : {}),
    ...(st.b ? { fontWeight: "700" } : {}),
    ...(st.i ? { fontStyle: "italic" } : {}),
    ...(st.u || st.x ? { textDecoration: [st.u && "underline", st.x && "line-through"].filter(Boolean).join(" ") + (st.u && st.ul ? ` ${st.ul}` : "") } : {}),
    ...(st.hl ? { backgroundColor: st.hl } : {}),
    ...(st.fx ? EFFECT_CSS[st.fx] : {}),
  };
}

// Subscripts and superscripts: this much of the size of the text around them; raised / lowered by this much of
// that text's size (in the editors, in em of the script itself: the canvas and the editors look the same).
export const SCRIPT_SCALE = 0.7;
export const SUP_RISE = 0.36;
export const SUB_DROP = 0.14;
const SUP_RISE_EM = SUP_RISE / SCRIPT_SCALE;
const SUB_DROP_EM = SUB_DROP / SCRIPT_SCALE;

export const encodeStyle = styleString;
export const decodeStyle = parseStyle;
