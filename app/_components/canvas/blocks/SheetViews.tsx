"use client";

import { Group, Line, Rect, Text } from "react-konva";
import { fontStack } from "@/app/_lib/fonts";
import type { PageBox } from "@/app/_lib/pageStack";
import type { FrameGeometry } from "@/app/_lib/sheet/frame";
import { MARK_DEFAULT_SIZE, RULE_HEIGHT, markHeight, markText } from "@/app/_lib/sheet/marks";
import type { SheetConfig } from "@/app/_lib/sheet/model";
import type { ExamMeta, MarkBlock, RuleBlock } from "@/app/_lib/types";

// What the stickers and lines of a correction sheet need from the sheet: how marks are written, what each total shows, how its lines look.
export interface SheetInfo {
  pad: boolean;
  shown: Map<string, number>;
  line: { color: string; width: number };
  /** The column of the totals is off: nothing is written where the totals go */
  hideTotals?: boolean;
}

const INK = "#111111";
export const TITLE_SIZE = 12; // (the titles of the frame; FrameTitles types them in the same size)

// A sticker: its mark, sign, total or words, in the middle of its box (the width of its column), plain or in a circle or a box.
export function MarkView({ b, meta, info, interactive }: { b: MarkBlock; meta: ExamMeta; info?: SheetInfo; interactive: boolean }) {
  if (b.kind === "total" && info?.hideTotals) return null;
  const w = b.layout.width;
  const h = markHeight(b, meta.fontSize);
  const text = markText(b, info?.shown.get(b.id), !!info?.pad);
  const size = b.size ?? meta.fontSize ?? MARK_DEFAULT_SIZE;
  const color = b.color ?? INK;
  const look = b.look ?? "plain";
  // the frame around the text: as wide as the text, and never narrower than it is tall (a single digit is a circle)
  const around = Math.min(w - 2, Math.max(h - 2, text.length * size * 0.62 + size * 0.9));
  const x = (w - around) / 2;
  return (
    <Group listening={false}>
      {look !== "plain" && <Rect x={x} y={1} width={around} height={h - 2} stroke={color} strokeWidth={1.3} cornerRadius={look === "circle" ? (h - 2) / 2 : 3} />}
      {!text && interactive && <Rect x={x} y={1} width={Math.min(w - 2, 40)} height={h - 2} stroke="#9ca3af" strokeWidth={1} dash={[3, 3]} cornerRadius={3} />}
      <Text
        width={w}
        height={h}
        align="center"
        verticalAlign="middle"
        text={text}
        fontSize={size}
        fontFamily={fontStack(b.font?.family || meta.fontFamily)}
        fontStyle={b.font?.bold ? "bold" : "normal"}
        fill={color}
        wrap="none"
      />
    </Group>
  );
}

// A line across the sheet: thin between the answers of two questions, thick between two exercises, or not drawn (hidden: only shown on screen).
export function RuleView({ b, info, interactive }: { b: RuleBlock; info?: SheetInfo; interactive: boolean }) {
  const w = b.layout.width;
  const line = b.line ?? "row";
  const base = info?.line.width ?? 1.2;
  const y = RULE_HEIGHT / 2;
  if (line === "hidden") return interactive ? <Line points={[0, y, w, y]} stroke="#a5b4fc" strokeWidth={1} dash={[4, 4]} listening={false} /> : null;
  return <Line points={[0, y, w, y]} stroke={b.color ?? info?.line.color ?? INK} strokeWidth={line === "exercise" ? base * 2 : base} listening={false} />;
}

// The frame of a bordered page: the border, the lines between its columns and the titles of the columns.
// `titles`: false on screen, where the titles are boxes typed in on the page (FrameTitles, over the canvas).
export function SheetFrame({ geo, sheet, box, meta, titles = true }: { geo: FrameGeometry; sheet: SheetConfig; box: PageBox; meta: ExamMeta; titles?: boolean }) {
  const { x, y, width, height } = geo.frame;
  const stroke = sheet.line.color;
  const sw = sheet.line.width;
  return (
    <Group x={box.left} y={box.top} listening={false}>
      <Rect x={x} y={y} width={width} height={height} stroke={stroke} strokeWidth={sw} />
      {geo.lines.map((l, k) => (
        <Line key={k} points={[l.x1, l.y1, l.x2, l.y2]} stroke={stroke} strokeWidth={sw} />
      ))}
      {titles &&
        geo.titles.filter((t) => t.text).map((t, k) => (
        <Text
          key={k}
          x={t.rect.x}
          y={t.rect.y}
          width={t.rect.width}
          height={t.rect.height}
          align="center"
          verticalAlign="middle"
          text={t.text}
          fontSize={TITLE_SIZE}
          fontStyle="bold"
          fontFamily={fontStack(meta.fontFamily)}
          fill={stroke}
          padding={2}
        />
      ))}
    </Group>
  );
}
