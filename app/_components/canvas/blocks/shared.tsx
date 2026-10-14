"use client";

import { Text } from "react-konva";
import { FONT_FAMILY } from "@/app/_lib/measure";

export const INK = "#111827";
export const MUTED = "#4b5563";
export const KEY = "#15803d"; // correction-sheet green

interface LinesProps {
  lines: string[];
  x: number;
  y: number;
  width: number;
  size: number;
  line: number; // line height in px
  bold?: boolean;
  color?: string;
  rtl: boolean;
  align?: "left" | "right" | "center";
}

// Draws text that was already wrapped by `wrapText` (so it matches the computed heights).
export function Lines({ lines, x, y, width, size, line, bold, color = INK, rtl, align }: LinesProps) {
  return (
    <Text
      x={x}
      y={y}
      width={width}
      text={lines.join("\n")}
      fontFamily={FONT_FAMILY}
      fontSize={size}
      lineHeight={line / size}
      fontStyle={bold ? "bold" : "normal"}
      fill={color}
      wrap="none"
      align={align ?? (rtl ? "right" : "left")}
      direction={rtl ? "rtl" : "ltr"}
      listening={false}
    />
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
  rtl: boolean;
  align?: "left" | "right" | "center";
}

// A single line of text, cut with "…" if too long (used in headers).
export function OneLine({ text, x, y, width, size, bold, color = INK, rtl, align }: OneLineProps) {
  return (
    <Text
      x={x}
      y={y}
      width={width}
      text={text}
      fontFamily={FONT_FAMILY}
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
