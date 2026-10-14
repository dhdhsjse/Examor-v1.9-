"use client";

import { useMemo } from "react";
import { Arrow, Group, Line, Rect, Text } from "react-konva";
import { niceStep, tryCompile } from "@/app/_lib/graphMath";
import { FONT_FAMILY } from "@/app/_lib/measure";
import type { GraphBlock } from "@/app/_lib/types";
import { INK } from "./shared";

export const CURVE_COLORS = ["#1d4ed8", "#dc2626", "#059669"];
const NAMES = ["f", "g", "h"];
const SAMPLES = 600;

// Round tick labels nicely: 0.5, 2, -1.5 (no 0.30000000004).
const fmt = (v: number) => String(Math.round(v * 1000) / 1000).replace("-", "−");

// Axes, grid and the curves of the teacher's formulas, drawn in the block's box.
export function GraphView({ b }: { b: GraphBlock }) {
  const { width: W, height: H } = b.layout;
  const { xMin, xMax, yMin, yMax } = b;
  const sx = (x: number) => ((x - xMin) / (xMax - xMin)) * W;
  const sy = (y: number) => H - ((y - yMin) / (yMax - yMin)) * H;
  const stepX = niceStep(xMax - xMin);
  const stepY = niceStep(yMax - yMin);
  const ax = Math.min(Math.max(sx(0), 3), W - 3); // where the y axis is drawn
  const ay = Math.min(Math.max(sy(0), 3), H - 3); // where the x axis is drawn

  // Points of every curve, cut where the function is undefined, jumps (1/x),
  // or leaves the frame (so nothing is drawn outside the graph box).
  const curves = useMemo(
    () =>
      b.functions.map((src) => {
        const { fn } = tryCompile(src);
        if (!fn) return [];
        const pieces: number[][] = [];
        let cur: number[] = [];
        let prev: { px: number; py: number } | null = null;
        const end = () => {
          if (cur.length >= 4) pieces.push(cur);
          cur = [];
        };
        for (let i = 0; i <= SAMPLES; i++) {
          const x = xMin + ((xMax - xMin) * i) / SAMPLES;
          const y = fn(x);
          if (!Number.isFinite(y)) {
            end();
            prev = null;
            continue;
          }
          const p = { px: sx(x), py: sy(y) };
          const inside = p.py >= 0 && p.py <= H;
          if (prev && Math.abs(p.py - prev.py) > H * 2) {
            end(); // vertical asymptote: don't join the two sides
          } else if (prev) {
            const wasInside = prev.py >= 0 && prev.py <= H;
            if (inside !== wasInside) {
              // Crossing the top or bottom edge: add the exact point on the edge.
              const edge = (inside ? prev.py : p.py) < 0 ? 0 : H;
              const t = (edge - prev.py) / (p.py - prev.py);
              cur.push(prev.px + (p.px - prev.px) * t, edge);
              if (!inside) end();
            }
          }
          if (inside) cur.push(p.px, p.py);
          prev = p;
        }
        end();
        return pieces;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [b.functions, xMin, xMax, yMin, yMax, W, H],
  );

  const ticks = (min: number, max: number, step: number) => {
    const out: number[] = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) if (Math.abs(v) > step / 1000) out.push(v);
    return out;
  };
  const xs = ticks(xMin, xMax, stepX);
  const ys = ticks(yMin, yMax, stepY);
  const text = { fontFamily: FONT_FAMILY, fontSize: 10, fill: INK, listening: false };
  // Labels stay inside the frame: below the x axis (above it at the bottom edge),
  // left of the y axis (right of it at the left edge).
  const xLabelY = ay > H - 16 ? ay - 15 : ay + 5;
  const yLabelLeft = ax >= 34;

  return (
    <Group listening={false}>
      <Rect width={W} height={H} fill="#ffffff" />
      <Group clipX={0} clipY={0} clipWidth={W} clipHeight={H}>
        {b.grid && xs.map((v) => <Line key={`gx${v}`} points={[sx(v), 0, sx(v), H]} stroke="#d4d4d8" strokeWidth={0.7} />)}
        {b.grid && ys.map((v) => <Line key={`gy${v}`} points={[0, sy(v), W, sy(v)]} stroke="#d4d4d8" strokeWidth={0.7} />)}
        <Arrow points={[0, ay, W - 1, ay]} stroke={INK} fill={INK} strokeWidth={1.2} pointerLength={7} pointerWidth={6} />
        <Arrow points={[ax, H, ax, 1]} stroke={INK} fill={INK} strokeWidth={1.2} pointerLength={7} pointerWidth={6} />
        {xs.filter((v) => sx(v) >= 15 && sx(v) <= W - 15).map((v) => (
          <Group key={`tx${v}`}>
            <Line points={[sx(v), ay - 3, sx(v), ay + 3]} stroke={INK} strokeWidth={1} />
            <Text {...text} x={sx(v) - 15} y={xLabelY} width={30} align="center" text={fmt(v)} />
          </Group>
        ))}
        {ys.filter((v) => sy(v) >= 6 && sy(v) <= H - 6).map((v) => (
          <Group key={`ty${v}`}>
            <Line points={[ax - 3, sy(v), ax + 3, sy(v)]} stroke={INK} strokeWidth={1} />
            <Text {...text} x={yLabelLeft ? ax - 34 : ax + 5} y={sy(v) - 5} width={30} align={yLabelLeft ? "right" : "left"} text={fmt(v)} />
          </Group>
        ))}
        {ax >= 12 && ay <= H - 14 && <Text {...text} x={ax - 12} y={ay + 4} text="O" />}
        <Text {...text} fontSize={12} x={W - 12} y={Math.max(0, ay - 18)} text="x" />
        <Text {...text} fontSize={12} x={ax + 6} y={2} text="y" />
        {curves.map((pieces, k) =>
          pieces.map((pts, j) => <Line key={`c${k}-${j}`} points={pts} stroke={CURVE_COLORS[k]} strokeWidth={2} lineJoin="round" lineCap="round" />),
        )}
        {/* Curve names (Cf, Cg...) near the right end of each curve */}
        {curves.map((pieces, k) => {
          const visible = pieces.flatMap((p) => {
            const pts: [number, number][] = [];
            for (let i = 0; i < p.length; i += 2) if (p[i + 1] > 12 && p[i + 1] < H - 12) pts.push([p[i], p[i + 1]]);
            return pts;
          });
          const at = visible[Math.floor(visible.length * 0.85)];
          if (!at) return null;
          return <Text key={`n${k}`} {...text} fontSize={12} fontStyle="bold" fill={CURVE_COLORS[k]} x={Math.min(at[0] + 4, W - 24)} y={Math.max(0, at[1] - 16)} text={`C${NAMES[k]}`} />;
        })}
      </Group>
      <Rect width={W} height={H} stroke="#9ca3af" strokeWidth={0.8} />
    </Group>
  );
}
