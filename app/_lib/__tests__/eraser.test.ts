import { describe, expect, it } from "vitest";
import { cutStroke, eraseStrokes } from "../ink/eraser";
import { inkToShape, shapeToInk } from "../ink/engine";
import type { ShapeItem } from "../shapes";

// A straight stroke from (x0, y) to (x1, y), 4 px wide, as the Draw tool keeps it (its two ends only).
const line = (x0: number, x1: number, y: number, extra: Partial<ShapeItem> = {}): ShapeItem => {
  const s = inkToShape(
    [
      { x: x0, y, p: 0.7 },
      { x: x1, y, p: 0.7 },
    ],
    4,
  )!;
  return { id: "s1", shape: "freehand", ink: "pencil", stroke: "#111", strokeWidth: 4, ...s, ...extra };
};
// The points of a piece, where they are on the page.
const xsOf = (p: { x: number; y: number; w: number; h: number; adj: number[]; pressure: number[] }) => shapeToInk(p.adj, p.pressure, p.w, p.h).map((q) => q.x + p.x);

describe("the eraser", () => {
  it("leaves a stroke it does not touch as it is", () => {
    expect(cutStroke(line(0, 100, 50), [{ x: 50, y: 90 }], 5)).toBeNull();
  });

  it("cuts a stroke in two where it goes over its middle (even between the stroke's own points)", () => {
    const pieces = cutStroke(line(0, 100, 50), [{ x: 50, y: 50 }], 5)!;
    expect(pieces).toHaveLength(2);
    const [a, b] = pieces.map(xsOf).sort((p, q) => p[0] - q[0]);
    expect(Math.min(...a)).toBeCloseTo(0, 0);
    expect(Math.max(...a)).toBeLessThan(50 - 5);
    expect(Math.min(...b)).toBeGreaterThan(50 + 5);
    expect(Math.max(...b)).toBeCloseTo(100, 0);
  });

  it("shortens a stroke rubbed at one end", () => {
    const pieces = cutStroke(line(0, 100, 50), [{ x: 100, y: 50 }, { x: 80, y: 50 }], 4)!;
    expect(pieces).toHaveLength(1);
    expect(Math.max(...xsOf(pieces[0]))).toBeLessThan(80 - 4);
  });

  it("rubs out a stroke it goes all along", () => {
    expect(cutStroke(line(0, 100, 50), [{ x: -10, y: 50 }, { x: 110, y: 50 }], 5)).toEqual([]);
  });

  it("cuts a flipped stroke where it is seen, not where its points are kept", () => {
    // flipped: the same line drawn the other way round (seen in the same place)
    const pieces = cutStroke({ ...line(0, 100, 50), flipX: true }, [{ x: 10, y: 50 }], 3)!;
    expect(pieces).toHaveLength(2);
  });

  it("cuts only the strokes of a Studio's shapes (a rectangle stays), the first piece keeping the stroke's id", () => {
    const rect: ShapeItem = { id: "r", shape: "rect", x: 40, y: 40, w: 20, h: 20 };
    let n = 0;
    const out = eraseStrokes([line(0, 100, 50), rect], [{ x: 50, y: 50 }], 5, () => `new${++n}`)!;
    expect(out.map((s) => s.id)).toEqual(["s1", "new1", "r"]);
    expect(out[2]).toBe(rect);
    expect(eraseStrokes([rect], [{ x: 50, y: 50 }], 5, () => "x")).toBeNull();
  });
});
