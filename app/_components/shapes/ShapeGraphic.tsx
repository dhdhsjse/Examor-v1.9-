"use client";

import { Group, Path, Text } from "react-konva";
import { InkGraphic } from "./InkGraphic";
import { LINE_HEIGHT, dashArray, layoutShapeText, paintFill, resolveStyle, shapeParts, type ShapeStyle } from "@/app/_lib/shapes";

// One shape on a Konva canvas, in the coordinates of its own box (0,0 = its top-left corner): its parts, flipped if it is, then its text.
// The place and the turn belong to whoever holds it (a Group). The parts and the text lines come from _lib/shapes, the same ones
// the picture on the page is made of.
export function ShapeGraphic({ style, w, h, opacity = 1 }: { style: ShapeStyle; w: number; h: number; opacity?: number }) {
  // (a stroke of the page's brush, pencil or highlighter: drawn as ink, flipped like any shape)
  if (style.ink && style.shape === "freehand")
    return (
      <Group x={style.flipX ? w : 0} y={style.flipY ? h : 0} scaleX={style.flipX ? -1 : 1} scaleY={style.flipY ? -1 : 1}>
        <InkGraphic style={style} w={w} h={h} opacity={opacity} />
      </Group>
    );
  const { stroke, strokeWidth } = resolveStyle(style);
  const dash = dashArray(style);
  const text = layoutShapeText(style, w, h);
  const fontStyle = [style.italic && "italic", style.bold && "bold"].filter(Boolean).join(" ") || "normal";
  return (
    <Group opacity={opacity}>
      <Group x={style.flipX ? w : 0} y={style.flipY ? h : 0} scaleX={style.flipX ? -1 : 1} scaleY={style.flipY ? -1 : 1}>
        {shapeParts(style, w, h).map((p, i) => (
          <Path
            key={i}
            data={p.d}
            fill={paintFill(p.paint, style) ?? undefined}
            stroke={stroke ?? undefined}
            strokeWidth={stroke ? strokeWidth : 0}
            dash={p.paint === "solid" ? undefined : dash}
            lineJoin="round"
            lineCap="round"
            hitStrokeWidth={Math.max(strokeWidth, 10)}
          />
        ))}
      </Group>
      {text?.lines.map((l, i) =>
        l.text ? (
          <Text key={i} text={l.text} x={l.x} y={l.y} fontSize={text.size} lineHeight={LINE_HEIGHT} fontFamily={text.family} fontStyle={fontStyle} fill={text.color} wrap="none" listening={false} />
        ) : null,
      )}
    </Group>
  );
}
