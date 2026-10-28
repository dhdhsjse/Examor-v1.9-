// The text written in a shape: broken into lines that fit the room the shape leaves for it, and placed (left, centre or right; top,
// middle or bottom). The Konva canvases and the SVG pictures both draw these lines, so the picture on the page breaks the text
// exactly where the Studio did.
import { fontStack } from "@/app/_lib/fonts";
import { measureText } from "@/app/_lib/measure";
import { DEFAULT_FONT_SIZE, DEFAULT_TEXT_COLOR, SHAPE_FONT, textRect } from "./geometry";
import type { ShapeStyle, ShapeTextAlign } from "./types";

export const LINE_HEIGHT = 1.2;

export type ShapeTextLine = { text: string; x: number; y: number; width: number };

export type ShapeTextLayout = {
  lines: ShapeTextLine[];
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
  /** The CSS font stack the lines are drawn in (and were measured in) */
  family: string;
  align: ShapeTextAlign;
  /** The line height, px */
  lineHeight: number;
};

export type Measure = (text: string, size: number, bold: boolean, italic: boolean, family: string) => number;

const defaultMeasure: Measure = (text, size, bold, italic, family) => measureText(text, { family, size, bold, italic });

// Words go on a line while they fit; a word wider than the line is cut where it must be.
export function wrapLine(text: string, maxWidth: number, width: (s: string) => number): string[] {
  if (!text) return [""];
  const out: string[] = [];
  let line = "";
  const push = () => {
    out.push(line);
    line = "";
  };
  for (const word of text.split(/(?<=\s)/)) {
    const candidate = line + word;
    if (width(candidate.trimEnd()) <= maxWidth || !line) {
      line = candidate;
      if (width(line.trimEnd()) > maxWidth) {
        // a single word that is too wide: break it by characters
        let piece = "";
        for (const ch of Array.from(line)) {
          if (piece && width(piece + ch) > maxWidth) {
            out.push(piece);
            piece = "";
          }
          piece += ch;
        }
        line = piece;
      }
    } else {
      push();
      line = word;
    }
  }
  if (line) push();
  return out.map((l) => l.trimEnd());
}

/** The lines of a shape's text in a box of w×h (null if it has none). */
export function layoutShapeText(style: ShapeStyle, w: number, h: number, measure: Measure = defaultMeasure): ShapeTextLayout | null {
  const raw = style.text ?? "";
  if (!raw.trim()) return null;
  const size = Math.max(4, style.fontSize ?? DEFAULT_FONT_SIZE);
  const bold = !!style.bold;
  const italic = !!style.italic;
  const align = style.textAlign ?? "center";
  const valign = style.textVAlign ?? "middle";
  const box = textRect(style, w, h);
  const family = style.fontFamily ? fontStack(style.fontFamily) : SHAPE_FONT;
  const width = (s: string) => measure(s, size, bold, italic, family);
  const texts = raw.split(/\r?\n/).flatMap((p) => wrapLine(p, box.w, width));
  const lineHeight = size * LINE_HEIGHT;
  const total = texts.length * lineHeight;
  const top = valign === "top" ? box.y : valign === "bottom" ? box.y + box.h - total : box.y + (box.h - total) / 2;
  const lines = texts.map((text, i) => {
    const lw = width(text);
    const x = align === "left" ? box.x : align === "right" ? box.x + box.w - lw : box.x + (box.w - lw) / 2;
    return { text, x, y: top + i * lineHeight, width: lw };
  });
  return { lines, size, color: style.textColor ?? DEFAULT_TEXT_COLOR, bold, italic, family, align, lineHeight };
}
