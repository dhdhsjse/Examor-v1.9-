"use client";

import { Fragment } from "react";
import { Rect, Text } from "react-konva";
import { FONT_FAMILY, konvaFontStyle, measureText, wrapRich, type RichLine, type TextFont } from "@/app/_lib/measure";
import { isRich } from "@/app/_lib/richText";

export { INK } from "@/app/_lib/blockLayout";
export const MUTED = "#4b5563";

// Konva's text decoration for a font: "underline", "line-through", both, or none.
const decoration = (f: TextFont) => [f.underline && "underline", f.strike && "line-through"].filter(Boolean).join(" ");

// Light version of a color, e.g. for the inside of a box ("#4f46e5" → "#4f46e514").
export const tint = (hex: string, alpha = "14") => (/^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${alpha}` : hex);

interface RichTextProps {
  lines: RichLine[];
  x: number;
  y: number;
  width: number;
  rtl: boolean;
  align?: "left" | "right" | "center" | "justify"; // justify: every line but the last fills the width
  step?: number; // fixed distance between lines (answers on dotted lines)
  recolor?: [from: string, to: string]; // e.g. the correct MCQ option in the answer color
}

// Draws text that was already wrapped by `wrapRich` (so it matches the computed heights).
// Each styled piece is its own Konva text; pieces of one line share the same baseline.
export function RichText({ lines, x, y, width, rtl, align, step, recolor }: RichTextProps) {
  const a = align ?? (rtl ? "right" : "left");
  // Top of each line (lines can have different heights).
  const tops = lines.map((_, k) => (step ? y + k * step : y + lines.slice(0, k).reduce((s, l) => s + l.height, 0)));
  return (
    <>
      {lines.map((l, k) => {
        const lineTop = tops[k];
        const lineH = step ?? l.height;
        if (a === "justify" && k < lines.length - 1) {
          const words = justified(l, width);
          if (words) {
            return words.map((w, j) => (
              <Fragment key={`${k}-${j}`}>
                {w.font.highlight && <Rect x={rtl ? x + width - w.x - w.width : x + w.x} y={lineTop} width={w.width} height={lineH} fill={w.font.highlight} listening={false} />}
                <Text
                  x={rtl ? x + width - w.x - w.width : x + w.x}
                  y={lineTop + (l.size - w.font.size) * 0.38}
                  width={w.width + 1}
                  text={w.text}
                  fontFamily={w.font.family}
                  fontSize={w.font.size}
                  lineHeight={lineH / w.font.size}
                  fontStyle={konvaFontStyle(w.font)}
                  textDecoration={decoration(w.font)}
                  fill={recolor && w.font.color === recolor[0] ? recolor[1] : w.font.color}
                  wrap="none"
                  align={rtl ? "right" : "left"}
                  direction={rtl ? "rtl" : "ltr"}
                  listening={false}
                />
              </Fragment>
            ));
          }
        }
        // Justified text: the last line (and a line without spaces) starts on the writing side.
        const side = a === "justify" ? (rtl ? "right" : "left") : a;
        const start = side === "left" ? x : side === "right" ? x + width - l.width : x + (width - l.width) / 2;
        return l.pieces.map((p, j) => (
          <Fragment key={`${k}-${j}`}>
            {/* Highlighted words: their color behind them, over the whole line height */}
            {p.font.highlight && <Rect x={rtl ? start + l.width - p.x - p.width : start + p.x} y={lineTop} width={p.width} height={lineH} fill={p.font.highlight} listening={false} />}
            <Text
              // Right-to-left: the first piece is on the right.
              x={rtl ? start + l.width - p.x - p.width : start + p.x}
              y={lineTop + (l.size - p.font.size) * 0.38}
              width={p.width + 1}
              text={p.text}
              fontFamily={p.font.family}
              fontSize={p.font.size}
              lineHeight={lineH / p.font.size}
              fontStyle={konvaFontStyle(p.font)}
              textDecoration={decoration(p.font)}
              fill={recolor && p.font.color === recolor[0] ? recolor[1] : p.font.color}
              wrap="none"
              align={rtl ? "right" : "left"}
              direction={rtl ? "rtl" : "ltr"}
              listening={false}
            />
          </Fragment>
        ));
      })}
    </>
  );
}

// The words of a line spread over `width`: the spaces share what is left (null = a line without spaces).
function justified(l: RichLine, width: number) {
  const spaces = l.pieces.reduce((n, p) => n + (p.text.trimEnd().match(/ /g)?.length ?? 0), 0);
  if (!spaces || l.width >= width) return null;
  const extra = (width - l.width) / spaces;
  const out: { text: string; x: number; width: number; font: RichLine["pieces"][number]["font"] }[] = [];
  let shift = 0;
  for (const p of l.pieces) {
    let offset = 0;
    for (const part of p.text.split(/( +)/)) {
      const w = measureText(part, p.font);
      if (part.trim()) out.push({ text: part, x: p.x + offset + shift, width: w, font: p.font });
      else shift += extra * part.length;
      offset += w;
    }
  }
  return out;
}

interface OneLineProps {
  text: string;
  x: number;
  y: number;
  width: number;
  size: number;
  bold?: boolean;
  color?: string;
  family?: string;
  rtl: boolean;
  align?: "left" | "right" | "center";
}

// A single line of text, cut with "…" if too long (used in headers and labels). Words styled on the
// page (bigger, bold, colored…) are drawn as styled pieces; what does not fit is left out.
export function OneLine({ text, x, y, width, size, bold, color = "#111827", family = FONT_FAMILY, rtl, align }: OneLineProps) {
  if (isRich(text)) {
    const [line] = wrapRich(text.replace(/\n/g, " "), width, { family, size, bold: !!bold, italic: false, underline: false, color }, size);
    return line ? <RichText lines={[line]} x={x} y={y} width={width} rtl={rtl} align={align} /> : null;
  }
  return (
    <Text
      x={x}
      y={y}
      width={width}
      text={text}
      fontFamily={family}
      fontSize={size}
      fontStyle={bold ? "bold" : "normal"}
      fill={color}
      wrap="none"
      ellipsis
      align={align ?? (rtl ? "right" : "left")}
      direction={rtl ? "rtl" : "ltr"}
      listening={false}
    />
  );
}
