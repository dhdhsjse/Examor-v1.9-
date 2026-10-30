"use client";

import { Fragment, useEffect, useState } from "react";
import { Image as KImage, Line, Rect, Text } from "react-konva";
import { useImage } from "@/app/_lib/images";
import { drawInlineMath, inlineMathUrl, mathBox } from "@/app/_lib/inlineMath";
import { FONT_FAMILY, baselineBelowMiddle, konvaFontStyle, measureText, pieceTop, pieceWidth, rtlPlacement, wrapRich, type RichLine, type TextFont } from "@/app/_lib/measure";
import { isRich, type UnderlineStyle } from "@/app/_lib/richText";

export { INK } from "@/app/_lib/blockLayout";
export const MUTED = "#4b5563";

// Konva's text decoration for a font: "underline", "line-through", both, or none. (An underline of another kind than the single line
// is not Konva's: see StyledUnderline.)
const decoration = (f: TextFont) => [f.underline && !f.underlineStyle && "underline", f.strike && "line-through"].filter(Boolean).join(" ");

// Light version of a color, e.g. for the inside of a box ("#4f46e5" → "#4f46e514").
export const tint = (hex: string, alpha = "14") => (/^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${alpha}` : hex);

// What a text effect adds to the Konva text: a shadow, a glow (a shadow of the color of the letters, all around), or an outline (the letters
// are only a line, in their color).
function effectProps(f: TextFont, fill: string) {
  switch (f.effect) {
    case "shadow":
      return { shadowColor: "#000000", shadowOpacity: 0.35, shadowBlur: f.size * 0.12, shadowOffsetX: f.size * 0.06, shadowOffsetY: f.size * 0.06 };
    case "glow":
      return { shadowColor: fill, shadowOpacity: 0.9, shadowBlur: f.size * 0.35, shadowOffsetX: 0, shadowOffsetY: 0 };
    case "outline":
      return { fill: "rgba(255,255,255,0)", stroke: fill, strokeWidth: Math.max(0.6, f.size * 0.04), fillAfterStrokeEnabled: false };
    default:
      return {};
  }
}

interface UnderlineProps {
  x: number;
  y: number; // the top of the Konva text it goes with
  width: number;
  size: number;
  line: number; // the line height of that text
  color: string;
  kind: UnderlineStyle;
}

// A double, dotted, dashed or wavy underline: Konva only draws the single one, so these are lines of our own, placed where Konva places its
// own (half a font size under the middle of the line height, as thick as a fifteenth of the size).
function StyledUnderline({ x, y, width, size, line, color, kind }: UnderlineProps) {
  const t = Math.max(0.8, size / 15);
  const at = y + line / 2 + Math.round(size / 2);
  const common = { stroke: color, strokeWidth: t, listening: false } as const;
  if (kind === "double") {
    return (
      <>
        <Line points={[x, at, x + width, at]} {...common} />
        <Line points={[x, at + t * 2.2, x + width, at + t * 2.2]} {...common} />
      </>
    );
  }
  if (kind === "wavy") {
    const wave = size * 0.4;
    const amplitude = size * 0.06;
    const points: number[] = [];
    for (let px = 0; px <= width; px += 1) points.push(x + px, at + Math.sin((px / wave) * Math.PI * 2) * amplitude);
    return <Line points={points} lineJoin="round" {...common} />;
  }
  return <Line points={[x, at, x + width, at]} dash={kind === "dotted" ? [t, t * 1.8] : [t * 4, t * 2.5]} lineCap={kind === "dotted" ? "round" : "butt"} {...common} />;
}

interface PieceProps {
  x: number;
  y: number; // where its text is drawn (see pieceTop)
  width: number;
  text: string;
  font: TextFont;
  lineH: number;
  fill: string;
  rtl: boolean;
}

// One styled piece of a line: its text and, when it has one, its own kind of underline. A formula's piece is its picture.
function PieceDraw({ x, y, width, text, font, lineH, fill, rtl }: PieceProps) {
  if (font.math) return <MathPiece x={x} y={y} font={font} lineH={lineH} />;
  return (
    <>
      <Text
        x={x}
        y={y}
        width={width + 1}
        text={text}
        fontFamily={font.family}
        fontSize={font.size}
        lineHeight={lineH / font.size}
        fontStyle={konvaFontStyle(font)}
        textDecoration={decoration(font)}
        fill={fill}
        {...effectProps(font, fill)}
        wrap="none"
        align={rtl ? "right" : "left"}
        direction={rtl ? "rtl" : "ltr"}
        listening={false}
      />
      {font.underline && font.underlineStyle && <StyledUnderline x={x} y={y} width={width} size={font.size} line={lineH} color={fill} kind={font.underlineStyle} />}
    </>
  );
}

// A formula in a line (inlineMath.ts), its baseline on the baseline of the text: the drawing it keeps, or MathJax's, made the first
// time it is shown (a formula of an older text).
function MathPiece({ x, y, font, lineH }: { x: number; y: number; font: TextFont; lineH: number }) {
  const math = font.math!;
  const kept = inlineMathUrl(math);
  const [drawn, setDrawn] = useState<string>();
  useEffect(() => {
    if (kept) return;
    let alive = true;
    drawInlineMath(math.latex)
      .then((d) => alive && setDrawn(d.url))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [kept, math.latex]);
  const img = useImage(kept ?? drawn ?? "");
  const { width, height, depth } = mathBox(math, font.size);
  const baseline = y + lineH / 2 + baselineBelowMiddle(font);
  if (!img) return null;
  return <KImage image={img} x={x} y={baseline + depth - height} width={width} height={height} listening={false} />;
}

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
  const fillOf = (f: TextFont) => (recolor && f.color === recolor[0] ? recolor[1] : f.color);
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
            return words.map((w, j) => {
              const wx = rtl ? x + width - w.x - w.width : x + w.x;
              return (
                <Fragment key={`${k}-${j}`}>
                  {w.font.highlight && <Rect x={wx} y={lineTop} width={w.width} height={lineH} fill={w.font.highlight} listening={false} />}
                  <PieceDraw x={wx} y={lineTop + pieceTop(l.size, w.font)} width={w.width} text={w.text} font={w.font} lineH={lineH} fill={fillOf(w.font)} rtl={rtl} />
                </Fragment>
              );
            });
          }
        }
        // Justified text: the last line (and a line without spaces) starts on the writing side.
        const side = a === "justify" ? (rtl ? "right" : "left") : a;
        const start = side === "left" ? x : side === "right" ? x + width - l.width : x + (width - l.width) / 2;
        // Right-to-left: the first piece is on the right, but French words and the formulas between them keep their order.
        const placed = rtl ? rtlPlacement(l.pieces) : null;
        return l.pieces.map((p, j) => {
          const px = placed ? start + placed.x[j] : start + p.x;
          const pieceRtl = placed ? !placed.ltr[j] : false;
          return (
            <Fragment key={`${k}-${j}`}>
              {/* Highlighted words: their color behind them, over the whole line height */}
              {p.font.highlight && <Rect x={px} y={lineTop} width={p.width} height={lineH} fill={p.font.highlight} listening={false} />}
              <PieceDraw x={px} y={lineTop + pieceTop(l.size, p.font)} width={p.width} text={p.text} font={p.font} lineH={lineH} fill={fillOf(p.font)} rtl={pieceRtl} />
            </Fragment>
          );
        });
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
    if (p.font.math) {
      out.push({ text: p.text, x: p.x + shift, width: pieceWidth(p.text, p.font), font: p.font });
      continue;
    }
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
