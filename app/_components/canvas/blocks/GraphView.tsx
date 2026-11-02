"use client";

import { useMemo } from "react";
import { Arrow, Circle, Group, Line, Rect, Text } from "react-konva";
import { niceStep, type Fn } from "@/app/_lib/graphMath";
import { CURVE_PALETTE, FUNCTION_NAMES, colorOf, drawingsOf, lineLabel } from "@/app/_lib/mathGraph";
import { FONT_FAMILY } from "@/app/_lib/measure";
import type { GraphBlock, GraphLine } from "@/app/_lib/types";
import { INK } from "./shared";

export const CURVE_COLORS = CURVE_PALETTE;
const NAMES = FUNCTION_NAMES;
const SAMPLES = 600;

// Round tick labels nicely: 0.5, 2, -1.5 (no 0.30000000004).
const fmt = (v: number) => String(Math.round(v * 1000) / 1000).replace("-", "−");

const LABEL_W = 22;
const LABEL_H = 14;

// Where to write "Cf", "Cg", "Ch": a spot along each curve (preferably towards its right end)
// whose label box doesn't touch another label or another curve.
function curveLabels(curves: number[][][], W: number, H: number) {
  const placed: { x: number; y: number }[] = [];
  const points = curves.map((pieces) =>
    pieces.flatMap((p) => {
      const out: [number, number][] = [];
      for (let i = 0; i < p.length; i += 2) out.push([p[i], p[i + 1]]);
      return out;
    }),
  );
  const hitsLabel = (x: number, y: number) =>
    placed.some((o) => x < o.x + LABEL_W + 4 && o.x < x + LABEL_W + 4 && y < o.y + LABEL_H + 2 && o.y < y + LABEL_H + 2);
  // How many points of the OTHER curves fall inside the label box.
  const crowd = (k: number, x: number, y: number) =>
    points.reduce((n, pts, j) => (j === k ? n : n + pts.filter(([px, py]) => px > x - 3 && px < x + LABEL_W + 3 && py > y - 3 && py < y + LABEL_H + 3).length), 0);

  return points.map((pts, k) => {
    const visible = pts.filter(([, py]) => py > 12 && py < H - 12);
    if (!visible.length) return null;
    let best: { x: number; y: number; score: number } | null = null;
    // Try spots from the right end backwards, above and below the curve.
    for (const share of [0.85, 0.7, 0.95, 0.55, 0.4, 0.25, 0.1]) {
      const [px, py] = visible[Math.min(visible.length - 1, Math.floor(visible.length * share))];
      for (const dy of [-16, 4]) {
        const x = Math.min(Math.max(0, px + 4), W - LABEL_W);
        const y = Math.min(Math.max(0, py + dy), H - LABEL_H);
        if (hitsLabel(x, y)) continue;
        const score = crowd(k, x, y);
        if (!best || score < best.score) best = { x, y, score };
        if (score === 0) break;
      }
      if (best?.score === 0) break;
    }
    // Every spot is taken (curves on top of each other): stack the name in the top-right corner.
    for (let y = 4; !best && y < H - LABEL_H; y += LABEL_H + 2) {
      const x = W - LABEL_W - 16;
      if (!hitsLabel(x, y)) best = { x, y, score: 0 };
    }
    if (!best) return null;
    placed.push(best);
    return { k, x: best.x, y: best.y };
  });
}

type Win = { xMin: number; xMax: number; W: number; H: number; sx: (x: number) => number; sy: (y: number) => number };

// The points of a curve, cut where the function is undefined, jumps (1/x), or leaves the frame (so nothing is drawn outside the graph box).
function plotPieces(fn: Fn, { xMin, xMax, H, sx, sy }: Win): number[][] {
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
}

// The part of a segment inside the frame [0, W] × [0, H] (Liang–Barsky), or null when none of it is. A line is cut here, not only by the
// clip of the group: the frame round the selected block is as big as everything drawn, clipped or not.
function clipSegment(x1: number, y1: number, x2: number, y2: number, W: number, H: number): number[] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  for (const [p, q] of [[-dx, x1], [dx, W - x1], [-dy, y1], [dy, H - y1]] as const) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
    }
  }
  return t0 > t1 ? null : [x1 + t0 * dx, y1 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy];
}

// A straight line of the graph as two points of its frame (null if it does not cross it).
function linePoints(l: GraphLine, { xMin, xMax, W, H, sx, sy }: Win): number[] | null {
  if (l.kind === "v") return sx(l.a) < 0 || sx(l.a) > W ? null : [sx(l.a), 0, sx(l.a), H];
  if (l.kind === "h") return sy(l.b) < 0 || sy(l.b) > H ? null : [0, sy(l.b), W, sy(l.b)];
  return clipSegment(sx(xMin), sy(l.m * xMin + l.p), sx(xMax), sy(l.m * xMax + l.p), W, H);
}

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

  // What every curve draws (its function, derivative, tangents, asymptotes) and the points of the curves.
  const win: Win = { xMin, xMax, W, H, sx, sy };
  const draws = useMemo(
    () => drawingsOf(b),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [b.functions, b.curves, xMin, xMax],
  );
  const curves = useMemo(
    () => draws.map((d) => (d.fn ? plotPieces(d.fn, win) : [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draws, xMin, xMax, yMin, yMax, W, H],
  );
  const derivs = useMemo(
    () => draws.map((d) => (d.derivative ? plotPieces(d.derivative, win) : [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draws, xMin, xMax, yMin, yMax, W, H],
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
        {/* The lines of the teacher's own, then the asymptotes of the curves (dashed), under the curves */}
        {(b.lines ?? []).map((l, i) => {
          const pts = linePoints(l, win);
          return pts && <Line key={`l${i}`} points={pts} stroke={l.color ?? "#64748b"} strokeWidth={1.2} dash={[6, 4]} />;
        })}
        {draws.map((d, k) =>
          d.asymptotes.map((l, i) => {
            const pts = linePoints(l, win);
            return pts && <Line key={`a${k}-${i}`} points={pts} stroke={colorOf(b, k)} strokeWidth={1.2} dash={[6, 4]} opacity={0.75} />;
          }),
        )}
        {derivs.map((pieces, k) =>
          pieces.map((pts, j) => <Line key={`d${k}-${j}`} points={pts} stroke={colorOf(b, k)} strokeWidth={1.6} dash={[7, 4]} lineJoin="round" lineCap="round" />),
        )}
        {curves.map((pieces, k) =>
          pieces.map((pts, j) => <Line key={`c${k}-${j}`} points={pts} stroke={colorOf(b, k)} strokeWidth={2} lineJoin="round" lineCap="round" />),
        )}
        {/* The tangents: the line, and a dot where it touches the curve */}
        {draws.map((d, k) =>
          d.tangents.map((t, i) => {
            const pts = clipSegment(sx(xMin), sy(t.m * xMin + t.p), sx(xMax), sy(t.m * xMax + t.p), W, H);
            const inside = sx(t.a) >= 0 && sx(t.a) <= W && sy(t.y) >= 0 && sy(t.y) <= H;
            return (
              <Group key={`t${k}-${i}`}>
                {pts && <Line points={pts} stroke={colorOf(b, k)} strokeWidth={1.4} />}
                {inside && <Circle x={sx(t.a)} y={sy(t.y)} radius={3.5} fill="#ffffff" stroke={colorOf(b, k)} strokeWidth={1.6} />}
              </Group>
            );
          }),
        )}
        {/* What the lines are (x = 1, y = 2…), over the curves so that nothing hides them */}
        {draws.map((d, k) => d.asymptotes.map((l, i) => <AsymptoteLabel key={`al${k}-${i}`} line={l} color={colorOf(b, k)} win={win} text={text} />))}
        {(b.lines ?? []).map((l, i) => (
          <AsymptoteLabel key={`ll${i}`} line={l} color={l.color ?? "#64748b"} win={win} text={text} />
        ))}
        {/* Curve names (Cf, Cg..., and Cf′ for a derivative) next to their curve, never on top of each other */}
        {curveLabels([...curves, ...derivs], W, H).map((l) =>
          l ? <Text key={`n${l.k}`} {...text} fontSize={12} fontStyle="bold" fill={colorOf(b, l.k % curves.length)} x={l.x} y={l.y} text={`C${NAMES[l.k % curves.length] ?? ""}${l.k >= curves.length ? "′" : ""}`} /> : null,
        )}
      </Group>
      <Rect width={W} height={H} stroke="#9ca3af" strokeWidth={0.8} />
    </Group>
  );
}

// The equation of a line, small, near where it enters the frame (nothing if it is out of it).
function AsymptoteLabel({ line, color, win, text }: { line: GraphLine; color: string; win: Win; text: Record<string, unknown> }) {
  const { W, H, sx, sy, xMax } = win;
  let x: number;
  let y: number;
  if (line.kind === "v") {
    x = sx(line.a) + 3;
    y = 3;
    if (x > W - 44) x = sx(line.a) - 46;
  } else if (line.kind === "h") {
    x = W - 52;
    y = sy(line.b) - 13;
  } else {
    x = W - 70;
    y = sy(line.m * xMax + line.p) - 15;
  }
  if (x < 0 || x > W - 10 || y < 0 || y > H - 12) return null;
  return <Text {...text} fontSize={10} fill={color} x={x} y={y} text={lineLabel(line)} />;
}
