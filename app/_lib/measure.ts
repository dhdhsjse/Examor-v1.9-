// Text measuring + word wrapping, shared by the canvas and the layout code,
// so the drawn text and the computed block heights always match.
// Text can contain styled pieces (see richText.ts): each line is a list of pieces with their own font.

import { fontStack } from "./fonts";
import { MATH_CHAR, mathBox, type InlineMath } from "./inlineMath";
import { SCRIPT_SCALE, SUB_DROP, SUP_RISE, parseRich, type RunStyle, type TextEffect, type UnderlineStyle } from "./richText";

export const FONT_FAMILY = fontStack(); // render Arabic + French

// Everything needed to draw a piece of text.
export interface TextFont {
  family: string; // full stack, e.g. "Georgia, Segoe UI, Tahoma, Arial, sans-serif"
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  underlineStyle?: UnderlineStyle; // the words' own kind of underline, when it is not a single line (drawn by RichText, not by Konva)
  effect?: TextEffect; // the words' own text effect (a shadow, an outline, a glow)
  strike?: boolean; // struck through (BlockFont.strike, or the words' own style)
  highlight?: string; // background color of the words
  color: string;
  // A subscript or superscript: `size` is already the smaller size, `scriptBase` is the size of the text around it
  // (what it is lowered or raised by when drawn).
  script?: "sub" | "sup";
  scriptBase?: number;
  math?: InlineMath; // a formula (inlineMath.ts): its piece is one MATH_CHAR, drawn as its picture, not as text
}

// A piece of one line, all in one font. `x` is from the start of the line (left to right).
export interface Piece {
  text: string;
  x: number;
  width: number;
  font: TextFont;
}

export interface RichLine {
  pieces: Piece[];
  width: number;
  height: number; // line height (grows for big pieces)
  size: number; // biggest font size on the line (to line up the baselines)
}

// Same font string as Konva builds (families with spaces in quotes).
const quoteStack = (stack: string) =>
  stack
    .split(",")
    .map((f) => f.trim())
    .map((f) => (f.includes(" ") && !/["']/.test(f) ? `"${f}"` : f))
    .join(", ");

export const konvaFontStyle = (f: { bold: boolean; italic: boolean }) => [f.italic && "italic", f.bold && "bold"].filter(Boolean).join(" ") || "normal";

let ctx: CanvasRenderingContext2D | null = null;

export function measureText(text: string, f: Pick<TextFont, "family" | "size" | "bold" | "italic">): number {
  if (typeof document === "undefined") return text.length * f.size * 0.55; // fallback (no browser)
  ctx ??= document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * f.size * 0.55;
  ctx.font = `${f.italic ? "italic " : ""}${f.bold ? "bold " : ""}${f.size}px ${quoteStack(f.family)}`;
  return ctx.measureText(text).width;
}

/** How far the baseline of a line of `f` is below the middle of its line (where Konva puts it: half of ascent − descent). */
export function baselineBelowMiddle(f: Pick<TextFont, "family" | "size" | "bold" | "italic">): number {
  if (typeof document === "undefined") return f.size * 0.3;
  ctx ??= document.createElement("canvas").getContext("2d");
  if (!ctx) return f.size * 0.3;
  ctx.font = `${f.italic ? "italic " : ""}${f.bold ? "bold " : ""}${f.size}px ${quoteStack(f.family)}`;
  const m = ctx.measureText("M");
  const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent;
  const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent;
  return Number.isFinite(ascent - descent) ? (ascent - descent) / 2 : f.size * 0.3;
}

/** The width of a piece of a line: its text, or its formulas side by side. */
export const pieceWidth = (text: string, f: TextFont) => (f.math ? [...text].length * mathBox(f.math, f.size).width : measureText(text, f));

// Where a piece is drawn under the top of its line (pieces of different sizes line up on one baseline, a script is raised or
// lowered by a part of the size of the text around it). Shared with the canvas (RichText).
export const pieceTop = (lineSize: number, f: TextFont) =>
  (lineSize - f.size) * 0.38 + (f.script === "sup" ? -SUP_RISE * (f.scriptBase ?? f.size) : f.script === "sub" ? SUB_DROP * (f.scriptBase ?? f.size) : 0);

// The line height a formula needs: its part over the baseline above it, its depth under it (the line's text is drawn in its middle).
function mathLineHeight(f: TextFont, lineSize: number): number {
  if (!f.math) return 0;
  const { height, depth } = mathBox(f.math, f.size);
  const below = pieceTop(lineSize, f) + baselineBelowMiddle(f); // the baseline, from the middle of the line
  return Math.ceil(2 * Math.max(height - depth - below, depth + below)) + 2;
}

const sameFont = (a: TextFont, b: TextFont) =>
  !a.math &&
  !b.math &&
  a.family === b.family &&
  a.size === b.size &&
  a.bold === b.bold &&
  a.italic === b.italic &&
  a.underline === b.underline &&
  a.underlineStyle === b.underlineStyle &&
  a.effect === b.effect &&
  !!a.strike === !!b.strike &&
  a.highlight === b.highlight &&
  a.script === b.script &&
  a.scriptBase === b.scriptBase &&
  a.color === b.color;

interface Token {
  text: string;
  font: TextFont;
  kind: "word" | "space" | "nl";
}

// The font of a styled piece of text: what its style says, over the font of the text around it.
export function runFont(st: RunStyle, base: TextFont): TextFont {
  const size = st.size ?? base.size;
  const script = st.sup ? "sup" : st.sub ? "sub" : undefined;
  return {
    family: st.font ? fontStack(st.font) : base.family,
    size: script ? size * SCRIPT_SCALE : size,
    bold: base.bold || !!st.b,
    italic: base.italic || !!st.i,
    underline: base.underline || !!st.u,
    ...(st.ul ? { underlineStyle: st.ul } : {}),
    ...(st.fx ? { effect: st.fx } : {}),
    strike: !!base.strike || !!st.x,
    highlight: st.hl,
    color: st.color ?? base.color,
    ...(script ? { script, scriptBase: size } : {}),
    ...(st.math ? { math: st.math } : {}),
  };
}

const cache = new Map<string, RichLine[]>();

// Split (styled) text into lines that fit in `width` (keeps the user's own line breaks).
// `line` = line height for the base size; bigger pieces make their line taller.
export function wrapRich(src: string, width: number, base: TextFont, line: number): RichLine[] {
  const key = `${base.family}|${base.size}|${base.bold}|${base.italic}|${base.underline}|${!!base.strike}|${base.color}|${line}|${Math.round(width)}|${src}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const ratio = line / base.size;
  const tokens: Token[] = [];
  for (const run of parseRich(src)) {
    const font = runFont(run.style, base);
    // A formula's run: each of its characters is one formula, glued to the words around it like a letter.
    if (font.math) {
      for (const ch of run.text) if (ch === MATH_CHAR) tokens.push({ text: ch, font, kind: "word" });
      continue;
    }
    for (const part of run.text.split(/(\n| +)/)) {
      if (!part) continue;
      tokens.push({ text: part, font, kind: part === "\n" ? "nl" : part[0] === " " ? "space" : "word" });
    }
  }

  const lines: RichLine[] = [];
  let cur: Token[] = [];
  let curW = 0;
  let spaces: Token[] = [];
  const spacesW = () => spaces.reduce((s, t) => s + measureText(t.text, t.font), 0);

  const finish = () => {
    // Merge neighbours with the same font into pieces (never a formula: each is a piece of its own).
    const pieces: Piece[] = [];
    for (const t of cur) {
      const prev = pieces[pieces.length - 1];
      if (prev && sameFont(prev.font, t.font)) prev.text += t.text;
      else pieces.push({ text: t.text, x: 0, width: 0, font: t.font });
    }
    let x = 0;
    for (const p of pieces) {
      p.x = x;
      p.width = pieceWidth(p.text, p.font);
      x += p.width;
    }
    const size = Math.max(base.size, ...pieces.map((p) => p.font.size));
    // A tall formula (a fraction, a limit) makes its line taller.
    const tallest = Math.max(0, ...pieces.map((p) => mathLineHeight(p.font, size)));
    lines.push({ pieces, width: x, height: Math.max(line, Math.round(size * ratio), tallest), size });
    cur = [];
    curW = 0;
    spaces = [];
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind === "nl") {
      cur.push(...spaces);
      finish();
      continue;
    }
    if (t.kind === "space") {
      spaces.push(t);
      continue;
    }
    // A word can be made of several styled tokens with no space between them.
    const word = [t];
    while (tokens[i + 1]?.kind === "word") word.push(tokens[++i]);
    const w = word.reduce((s, x) => s + pieceWidth(x.text, x.font), 0);
    const sw = spacesW();
    if (cur.length && curW + sw + w > Math.max(20, width)) {
      finish();
    } else {
      cur.push(...spaces);
      curW += sw;
    }
    spaces = [];
    cur.push(...word);
    curW += w;
  }
  cur.push(...spaces);
  finish();

  if (cache.size > 3000) cache.clear();
  cache.set(key, lines);
  return lines;
}

export const linesHeight = (lines: RichLine[]) => lines.reduce((s, l) => s + l.height, 0);

// ---- Right-to-left lines ----

const STRONG_RTL = /[֐-ࣿיִ-﷿ﹰ-ﻼ]/; // Hebrew, Arabic
const STRONG_LTR = /[A-Za-zÀ-ʯͰ-ϿЀ-ӿ]/; // Latin, Greek, Cyrillic

/**
 * Where each piece of a right-to-left line goes (x from the left of the line), and which ones read left to right. The pieces follow
 * each other from the right, except that left-to-right pieces next to each other (French words, and a formula or other neutral piece
 * between two of them) stay together and read left to right, as the browser shows them: "حيث a = ⅟x donc" keeps "a = ⅟x donc" in order.
 */
export function rtlPlacement(pieces: Pick<Piece, "text" | "width" | "font">[]): { x: number[]; ltr: boolean[] } {
  const dirs = pieces.map((p) => (p.font.math ? "n" : STRONG_RTL.test(p.text) ? "r" : STRONG_LTR.test(p.text) ? "l" : "n"));
  const strongBefore = (i: number) => dirs.slice(0, i).reverse().find((d) => d !== "n");
  const strongAfter = (i: number) => dirs.slice(i + 1).find((d) => d !== "n");
  const ltr = dirs.map((d, i) => (d === "n" ? strongBefore(i) === "l" && strongAfter(i) === "l" : d === "l"));
  const x: number[] = [];
  let right = pieces.reduce((s, p) => s + p.width, 0);
  for (let i = 0; i < pieces.length; ) {
    if (!ltr[i]) {
      right -= pieces[i].width;
      x[i] = right;
      i++;
      continue;
    }
    let j = i;
    let w = 0;
    while (j < pieces.length && ltr[j]) w += pieces[j++].width;
    let at = right - w;
    for (let k = i; k < j; k++) {
      x[k] = at;
      at += pieces[k].width;
    }
    right -= w;
    i = j;
  }
  return { x, ltr };
}
