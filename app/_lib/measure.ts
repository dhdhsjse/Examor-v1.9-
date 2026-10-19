// Text measuring + word wrapping, shared by the canvas and the layout code,
// so the drawn text and the computed block heights always match.
// Text can contain styled pieces (see richText.ts): each line is a list of pieces with their own font.

import { fontStack } from "./fonts";
import { parseRich } from "./richText";

export const FONT_FAMILY = fontStack(); // render Arabic + French

// Everything needed to draw a piece of text.
export interface TextFont {
  family: string; // full stack, e.g. "Georgia, Segoe UI, Tahoma, Arial, sans-serif"
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike?: boolean; // struck through (BlockFont.strike, or the words' own style)
  highlight?: string; // background color of the words
  color: string;
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

const sameFont = (a: TextFont, b: TextFont) =>
  a.family === b.family &&
  a.size === b.size &&
  a.bold === b.bold &&
  a.italic === b.italic &&
  a.underline === b.underline &&
  !!a.strike === !!b.strike &&
  a.highlight === b.highlight &&
  a.color === b.color;

interface Token {
  text: string;
  font: TextFont;
  kind: "word" | "space" | "nl";
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
    const st = run.style;
    const font: TextFont = {
      family: st.font ? fontStack(st.font) : base.family,
      size: st.size ?? base.size,
      bold: base.bold || !!st.b,
      italic: base.italic || !!st.i,
      underline: base.underline || !!st.u,
      strike: !!base.strike || !!st.x,
      highlight: st.hl,
      color: st.color ?? base.color,
    };
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
    // Merge neighbours with the same font into pieces.
    const pieces: Piece[] = [];
    for (const t of cur) {
      const prev = pieces[pieces.length - 1];
      if (prev && sameFont(prev.font, t.font)) prev.text += t.text;
      else pieces.push({ text: t.text, x: 0, width: 0, font: t.font });
    }
    let x = 0;
    for (const p of pieces) {
      p.x = x;
      p.width = measureText(p.text, p.font);
      x += p.width;
    }
    const size = Math.max(base.size, ...pieces.map((p) => p.font.size));
    lines.push({ pieces, width: x, height: Math.max(line, Math.round(size * ratio)), size });
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
    const w = word.reduce((s, x) => s + measureText(x.text, x.font), 0);
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
