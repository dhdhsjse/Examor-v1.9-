import { describe, expect, it } from "vitest";
import { InkCapture, bristles, finishInk, inkModel, inkRadii, inkToShape, outlinePath, resample, seeded, shapeToInk, straighten, strokeLength, type InkPoint } from "../ink/engine";

// A shaky line drawn left to right: the mouse moves 2px at a time, with up to ±2px of shake.
function shaky(n = 120, shake = 4): { x: number; y: number }[] {
  const rand = seeded(3);
  return Array.from({ length: n }, (_, i) => ({ x: 10 + i * 2, y: 100 + (rand() - 0.5) * shake }));
}

// How much a stroke wanders up and down from one point to the next (the sum of the turns of its height).
const wobble = (pts: { y: number }[]) => pts.slice(1).reduce((s, p, i) => s + Math.abs(p.y - pts[i].y), 0);

function capture(level: 0 | 1 | 2 | 3, pts = shaky()) {
  const c = new InkCapture(pts[0].x, pts[0].y, level, 1, 0);
  pts.slice(1).forEach((p, i) => c.add(p.x, p.y, (i + 1) * 8));
  const last = pts[pts.length - 1];
  c.end(last.x, last.y);
  return c.points;
}

describe("steadying the hand", () => {
  it("the raw level keeps the stroke as drawn", () => {
    const raw = capture(0);
    expect(raw[0]).toMatchObject({ x: 10, y: expect.any(Number) });
    expect(wobble(raw)).toBeGreaterThan(wobble(shaky()) * 0.9);
  });

  it("more smoothing, less shake", () => {
    const w = [0, 1, 2, 3].map((l) => wobble(finishInk(capture(l as 0 | 1 | 2 | 3), "pencil", l as 0 | 1 | 2 | 3)));
    expect(w[1]).toBeLessThan(w[0]);
    expect(w[2]).toBeLessThan(w[1]);
    expect(w[3]).toBeLessThan(w[2]);
    expect(w[3]).toBeLessThan(w[0] * 0.25);
  });

  it("the stroke still ends where the pointer was let go", () => {
    const pts = finishInk(capture(3), "brush", 3);
    const end = pts[pts.length - 1];
    expect(end.x).toBeCloseTo(shaky()[119].x, 5);
    expect(pts[0].x).toBeCloseTo(10, 5);
  });

  it("a fast mouse presses lighter than a slow one", () => {
    const slow = new InkCapture(0, 0, 0, 1, 0);
    const fast = new InkCapture(0, 0, 0, 1, 0);
    for (let i = 1; i < 40; i++) {
      slow.add(i, 0, i * 16);
      fast.add(i * 12, 0, i * 4);
    }
    expect(fast.points.at(-1)!.p).toBeLessThan(slow.points.at(-1)!.p);
  });

  it("a pen's own pressure is followed", () => {
    const c = new InkCapture(0, 0, 0, 1, 0, 0.2);
    for (let i = 1; i < 30; i++) c.add(i * 2, 0, i * 8, 0.9);
    expect(c.points.at(-1)!.p).toBeGreaterThan(0.85);
  });

  it("a click is a dot", () => {
    const dot = finishInk([{ x: 5, y: 5, p: 0.5 }], "pencil", 2);
    expect(dot).toHaveLength(2);
    expect(outlinePath([[5, 5]], [2])).toMatch(/^M3 5a2 2/);
  });
});

describe("the finished stroke", () => {
  it("points come at even steps", () => {
    const pts = resample(
      [
        { x: 0, y: 0, p: 0 },
        { x: 10, y: 0, p: 1 },
      ],
      2,
    );
    expect(pts.map((p) => p.x)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(pts[3].p).toBeCloseTo(0.6);
  });

  it("a nearly straight, nearly level highlighter stroke is made straight and level", () => {
    const line = straighten(shaky(80, 3) as InkPoint[]);
    expect(line).not.toBeNull();
    expect(line![0].y).toBe(line![1].y);
    const out = finishInk(capture(2, shaky(80, 3)), "highlighter", 2);
    expect(new Set(out.map((p) => Math.round(p.y * 100))).size).toBe(1);
  });

  it("a curved highlighter stroke stays curved; the raw level never straightens", () => {
    const arc = Array.from({ length: 60 }, (_, i) => ({ x: i * 3, y: Math.sin(i / 10) * 30, p: 1 }));
    expect(straighten(arc)).toBeNull();
    const raw = finishInk(capture(0, shaky(80, 3)), "highlighter", 0);
    expect(new Set(raw.map((p) => Math.round(p.y * 100))).size).toBeGreaterThan(1);
  });

  it("a brush thins at both ends; a highlighter keeps its width", () => {
    const pts = Array.from({ length: 100 }, (_, i) => ({ x: i * 2, y: 0, p: 0.8 }));
    const brush = inkRadii("brush", pts, 20);
    expect(brush[0]).toBeLessThan(brush[50] * 0.3);
    expect(brush[99]).toBeLessThan(brush[50] * 0.2);
    expect(new Set(inkRadii("highlighter", pts, 20))).toEqual(new Set([10]));
    expect(strokeLength(pts)).toBe(198);
  });

  it("the outline goes round the stroke at its width", () => {
    const d = outlinePath(
      [
        [0, 0],
        [50, 0],
        [100, 0],
      ],
      [5, 5, 5],
    );
    const ys = [...d.matchAll(/-?\d+(\.\d+)?/g)].map((m) => Number(m[0])).filter((_, i) => i % 2 === 1);
    expect(Math.max(...ys)).toBeCloseTo(5, 0);
    expect(Math.min(...ys)).toBeCloseTo(-5, 0);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("a brush has hairs, always the same ones for the same stroke", () => {
    const pts = Array.from({ length: 80 }, (_, i) => ({ x: i * 2, y: Math.sin(i / 8) * 10, p: 0.7 }));
    const a = inkModel("brush", pts, 16, 42);
    expect(a.bristles.length).toBeGreaterThan(5);
    expect(inkModel("brush", pts, 16, 42)).toEqual(a);
    expect(inkModel("pencil", pts, 3).bristles).toEqual([]);
    expect(bristles([[0, 0]], [1], 10, 1)).toEqual([]);
  });
});

describe("kept in a shape", () => {
  it("the box holds the ink's width, and the points come back as drawn", () => {
    const pts = [
      { x: 10, y: 20, p: 0.5 },
      { x: 60, y: 40, p: 1 },
    ];
    const s = inkToShape(pts, 10)!;
    expect(s).toMatchObject({ x: 5, y: 15, w: 60, h: 30 });
    const back = shapeToInk(s.adj, s.pressure, s.w, s.h).map((p) => ({ x: p.x + s.x, y: p.y + s.y, p: p.p }));
    expect(back[0].x).toBeCloseTo(10);
    expect(back[1].y).toBeCloseTo(40);
    expect(back.map((p) => p.p)).toEqual([0.5, 1]);
  });
});
