// Styled text inside the plain string fields of a block.
// A styled piece is written ⁅c=#dc2626;f=Georgia;s=18;b;i;u⁆text⁅/⁆ (rare brackets, so they
// never clash with what teachers type). Text without markers is plain, so older exams still work.

export interface RunStyle {
  color?: string;
  font?: string; // font family (one of FONT_CHOICES)
  size?: number;
  b?: boolean;
  i?: boolean;
  u?: boolean;
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
    else if (k === "u") st.u = true;
  }
  return st;
}

function styleString(st: RunStyle): string {
  const out: string[] = [];
  if (st.color) out.push(`c=${st.color}`);
  if (st.font) out.push(`f=${st.font}`);
  if (st.size) out.push(`s=${st.size}`);
  if (st.b) out.push("b");
  if (st.i) out.push("i");
  if (st.u) out.push("u");
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

const patchStyle = (st: RunStyle, patch: StylePatch): RunStyle => {
  const out = { ...st } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === false || v === undefined) delete out[k];
    else out[k] = v;
  }
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

// Insert plain text (taking the style of the character before it).
export function insertText(s: string, offset: number, text: string): string {
  const chars = toChars(s);
  const i = charIndex(chars, offset);
  const style = chars[i - 1]?.style ?? chars[i]?.style ?? {};
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

// CSS for a styled piece (used by the text boxes where the teacher types).
export function runCss(st: RunStyle, stack: (font: string) => string): Partial<CSSStyleDeclaration> {
  return {
    ...(st.color ? { color: st.color } : {}),
    ...(st.font ? { fontFamily: stack(st.font) } : {}),
    ...(st.size ? { fontSize: `${st.size}px` } : {}),
    ...(st.b ? { fontWeight: "700" } : {}),
    ...(st.i ? { fontStyle: "italic" } : {}),
    ...(st.u ? { textDecoration: "underline" } : {}),
  };
}

export const encodeStyle = styleString;
export const decodeStyle = parseStyle;
