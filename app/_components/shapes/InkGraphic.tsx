"use client";

import { useMemo } from "react";
import { Group, Line, Path } from "react-konva";
import { inkModel, shapeToInk, strokeSeed, type InkPoint, type InkTool } from "@/app/_lib/ink/engine";

// The grain of the paper under a pencil: light specks over the graphite, made once (a canvas the pencil's outline is filled with).
let grain: HTMLCanvasElement | null = null;
function pencilGrain() {
  if (grain || typeof document === "undefined") return grain;
  const size = 96;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  let s = 1234567;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < size * size; i++) {
    const r = rand();
    img.data[i * 4] = 255;
    img.data[i * 4 + 1] = 255;
    img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = r < 0.42 ? Math.round(rand() * 150) : 0;
  }
  ctx.putImageData(img, 0, 0);
  grain = c;
  return c;
}

/** A stroke of ink, in the coordinates of its own drawing (the points already in pixels). */
export function InkStroke({ tool, points, color, size, seed = 1, opacity = 1 }: { tool: InkTool; points: InkPoint[]; color: string; size: number; seed?: number; opacity?: number }) {
  const model = useMemo(() => inkModel(tool, points, size, seed), [tool, points, size, seed]);
  if (!model.body) return null;
  if (tool === "highlighter")
    // a marker: see-through, and it darkens what is under it instead of covering it
    return <Path data={model.body} fill={color} opacity={0.55 * opacity} globalCompositeOperation="multiply" />;
  if (tool === "pencil")
    return (
      <Group opacity={opacity}>
        <Path data={model.body} fill={color} opacity={0.92} />
        <Path data={model.body} fillPatternImage={(pencilGrain() ?? undefined) as HTMLImageElement | undefined} fillPatternScaleX={0.5} fillPatternScaleY={0.5} listening={false} />
      </Group>
    );
  return (
    <Group opacity={opacity}>
      <Path data={model.body} fill={color} />
      {/* paint gathers at the edges */}
      <Path data={model.body} stroke="#000000" strokeWidth={Math.min(0.8, size * 0.05)} opacity={0.18} listening={false} />
      {model.bristles.map((b, i) => (
        <Line key={i} points={b.points} stroke={b.light ? "#ffffff" : "#000000"} strokeWidth={b.width} opacity={b.alpha} lineCap="round" lineJoin="round" listening={false} perfectDrawEnabled={false} />
      ))}
    </Group>
  );
}

/** A shape that is a stroke of ink (ShapeGraphic draws it this way): its points are fractions of the box, so it follows the box. */
export function InkGraphic({ style, w, h, opacity = 1 }: { style: { ink?: InkTool; adj?: number[]; pressure?: number[]; stroke?: string | null; strokeWidth?: number }; w: number; h: number; opacity?: number }) {
  const points = useMemo(() => shapeToInk(style.adj, style.pressure, w, h), [style.adj, style.pressure, w, h]);
  const seed = useMemo(() => strokeSeed(style.adj), [style.adj]);
  return <InkStroke tool={style.ink ?? "pencil"} points={points} color={style.stroke ?? "#111111"} size={style.strokeWidth ?? 3} seed={seed} opacity={opacity} />;
}
