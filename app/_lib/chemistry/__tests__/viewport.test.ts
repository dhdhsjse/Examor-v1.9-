import { describe, expect, it } from "vitest";
import { graphBounds } from "../bondGeometry";
import { MAX_SCALE, MIN_SCALE, clampScale, fitView, panBy, scrollRanges, thumb, viewMinFromThumb, wheelFactor, wheelScroll, zoomAt } from "../viewport";

describe("zoom around the cursor", () => {
  const view = { x: 40, y: -20, scale: 1.5 };
  const toScreen = (v: typeof view, wx: number, wy: number) => ({ x: wx * v.scale + v.x, y: wy * v.scale + v.y });

  it("keeps the point under the cursor where it is", () => {
    const [px, py] = [300, 200];
    const world = { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
    for (const factor of [0.5, 0.9, 1.1, 2]) {
      const next = zoomAt(view, px, py, factor);
      const s = toScreen(next, world.x, world.y);
      expect(s.x).toBeCloseTo(px);
      expect(s.y).toBeCloseTo(py);
    }
  });

  it("multiplies the scale, within the limits", () => {
    expect(zoomAt(view, 0, 0, 2).scale).toBeCloseTo(3);
    expect(zoomAt(view, 0, 0, 1000).scale).toBe(MAX_SCALE);
    expect(zoomAt(view, 0, 0, 0.0001).scale).toBe(MIN_SCALE);
  });

  it("does not drift when the limit is reached", () => {
    const atMax = { x: 10, y: 10, scale: MAX_SCALE };
    expect(zoomAt(atMax, 100, 100, 2)).toEqual(atMax);
  });

  it("zooms in on a wheel pushed away and out on a wheel pulled back", () => {
    expect(wheelFactor(-100)).toBeGreaterThan(1);
    expect(wheelFactor(100)).toBeLessThan(1);
    expect(wheelFactor(0)).toBe(1);
    expect(wheelFactor(100) * wheelFactor(-100)).toBeCloseTo(1);
  });

  it("clamps scales", () => {
    expect(clampScale(0)).toBe(MIN_SCALE);
    expect(clampScale(1)).toBe(1);
    expect(clampScale(99)).toBe(MAX_SCALE);
  });
});

describe("fit to the drawing", () => {
  const size = { w: 1000, h: 600 };
  const centreOf = (v: { x: number; y: number; scale: number }, b: NonNullable<ReturnType<typeof graphBounds>>) => ({
    x: ((b.minX + b.maxX) / 2) * v.scale + v.x,
    y: ((b.minY + b.maxY) / 2) * v.scale + v.y,
  });

  it("centres the drawing in the area", () => {
    const b = graphBounds([{ x: -50, y: 0 }, { x: 150, y: 80 }])!;
    const c = centreOf(fitView(b, size), b);
    expect(c.x).toBeCloseTo(500);
    expect(c.y).toBeCloseTo(300);
  });

  it("shrinks a large drawing until all of it is visible", () => {
    const b = graphBounds([{ x: 0, y: 0 }, { x: 4000, y: 100 }])!;
    const v = fitView(b, size);
    expect(v.scale).toBeLessThan(1);
    expect(4000 * v.scale).toBeLessThanOrEqual(size.w);
  });

  it("does not blow a small drawing up beyond 150 %", () => {
    expect(fitView(graphBounds([{ x: 0, y: 0 }])!, size).scale).toBeLessThanOrEqual(1.5);
  });

  it("copes with no drawing and with no room", () => {
    expect(fitView(null, size)).toEqual({ x: 500, y: 300, scale: 1 });
    expect(Number.isFinite(fitView(graphBounds([{ x: 0, y: 0 }]), { w: 0, h: 0 }).scale)).toBe(true);
  });
});

describe("scrolling", () => {
  const size = { w: 1000, h: 600 };
  const view = { x: 500, y: 300, scale: 1 };

  it("pans by screen pixels, the drawing following the scroll", () => {
    expect(panBy(view, 40, -10)).toEqual({ x: 460, y: 310, scale: 1 });
  });

  it("scrolls sideways with Shift, and takes a sideways wheel as it comes", () => {
    expect(wheelScroll({ deltaX: 0, deltaY: 100, deltaMode: 0, shiftKey: true })).toEqual({ dx: 100, dy: 0 });
    expect(wheelScroll({ deltaX: 30, deltaY: 100, deltaMode: 0, shiftKey: false })).toEqual({ dx: 30, dy: 100 });
    expect(wheelScroll({ deltaX: 0, deltaY: 3, deltaMode: 1, shiftKey: false })).toEqual({ dx: 0, dy: 48 }); // 3 lines
  });

  it("covers the drawing with a margin, and wherever the view is", () => {
    const r = scrollRanges(view, size, graphBounds([{ x: 0, y: 0 }, { x: 2000, y: 100 }]));
    expect(r.x.min).toBe(-500); // the view starts further left than the drawing's margin (-200)
    expect(r.x.min + r.x.span).toBe(2200);
    const far = scrollRanges({ ...view, x: -9500 }, size, graphBounds([{ x: 0, y: 0 }])); // looking at x = 9500…10500
    expect(far.x.min + far.x.span).toBe(10500);
  });

  it("has no thumb when everything is in view, and a thumb that follows the view otherwise", () => {
    expect(thumb({ min: 0, span: 800 }, 0, 1000)).toBeNull();
    const range = { min: 0, span: 2000 };
    expect(thumb(range, 0, 1000)).toEqual({ start: 0, length: 0.5 });
    expect(thumb(range, 1000, 1000)).toEqual({ start: 0.5, length: 0.5 });
    expect(thumb(range, 500, 1000)!.start).toBeCloseTo(0.25);
  });

  it("turns a thumb position back into a view", () => {
    const range = { min: -200, span: 2000 };
    for (const min of [-200, 100, 800]) {
      const t = thumb(range, min, 1000)!;
      expect(viewMinFromThumb(range, 1000, t.start)).toBeCloseTo(min);
    }
  });
});
