"use client";

import { Text } from "react-konva";
import { FONT_FAMILY, konvaFontStyle, wrapRich, type RichLine } from "@/app/_lib/measure";
import { isRich } from "@/app/_lib/richText";

export { INK } from "@/app/_lib/blockLayout";
export const MUTED = "#4b5563";

// Light version of a color, e.g. for the inside of a box ("#4f46e5" → "#4f46e514").
export const tint = (hex: string, alpha = "14") => (/^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${alpha}` : hex);

interface RichTextProps {
  lines: RichLine[];
  x: number;
  y: number;
  width: number;
  rtl: boolean;
  align?: "left" | "right" | "center";
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
        const start = a === "left" ? x : a === "right" ? x + width - l.width : x + (width - l.width) / 2;
        return l.pieces.map((p, j) => (
          <Text
            key={`${k}-${j}`}
            // Right-to-left: the first piece is on the right.
            x={rtl ? start + l.width - p.x - p.width : start + p.x}
            y={lineTop + (l.size - p.font.size) * 0.38}
            width={p.width + 1}
            text={p.text}
            fontFamily={p.font.family}
            fontSize={p.font.size}
            lineHeight={lineH / p.font.size}
            fontStyle={konvaFontStyle(p.font)}
            textDecoration={p.font.underline ? "underline" : ""}
            fill={recolor && p.font.color === recolor[0] ? recolor[1] : p.font.color}
            wrap="none"
            align={rtl ? "right" : "left"}
            direction={rtl ? "rtl" : "ltr"}
            listening={false}
          />
        ));
      })}
    </>
  );
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
