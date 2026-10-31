"use client";

import { Circle, Group, Line, Rect, Text } from "react-konva";
import { dividerColor, dividerHeight, dividerMarks } from "@/app/_lib/divider";
import { FONT_FAMILY, measureText } from "@/app/_lib/measure";
import type { DividerBlock } from "@/app/_lib/types";

const textWidth = (text: string, size: number) => measureText(text, { family: FONT_FAMILY, size, bold: true, italic: false });

// A separating line, across the block (its look: divider.ts).
export function DividerView({ b }: { b: DividerBlock }) {
  const w = b.layout.width;
  const h = dividerHeight(b);
  const color = dividerColor(b);
  const clear = /^#[0-9a-f]{6}$/i.test(color) ? `${color}00` : "rgba(255,255,255,0)";
  return (
    <Group listening={false}>
      {dividerMarks(b, w, h, textWidth).map((m, k) => {
        switch (m.kind) {
          case "line":
            return <Line key={k} points={[m.x1, m.y1, m.x2, m.y2]} stroke={color} strokeWidth={m.width} dash={m.dash} lineCap={m.round ? "round" : "butt"} />;
          case "fade":
            return (
              <Rect
                key={k}
                x={m.x}
                y={m.y}
                width={m.w}
                height={m.h}
                fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                fillLinearGradientEndPoint={{ x: m.w, y: 0 }}
                fillLinearGradientColorStops={[0, clear, 0.5, color, 1, clear]}
              />
            );
          case "dot":
            return <Circle key={k} x={m.x} y={m.y} radius={m.r} fill={color} />;
          case "path":
            return <Line key={k} points={m.points} stroke={color} strokeWidth={m.width} lineCap="round" lineJoin="round" />;
          case "diamond":
            return <Rect key={k} x={m.x} y={m.y - m.r * Math.SQRT2} width={m.r * 2} height={m.r * 2} rotation={45} fill={color} />;
          case "text":
            return (
              <Text
                key={k}
                x={m.anchor === "middle" ? 0 : m.x}
                y={m.y - m.size * 0.7}
                width={m.anchor === "middle" ? w : undefined}
                height={m.size * 1.4}
                align={m.anchor === "middle" ? "center" : "left"}
                verticalAlign="middle"
                text={m.text}
                fontSize={m.size}
                fontFamily={FONT_FAMILY}
                fontStyle="bold"
                fill={color}
              />
            );
        }
      })}
    </Group>
  );
}
