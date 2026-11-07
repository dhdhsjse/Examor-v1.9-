import { describe, expect, it } from "vitest";
import { MIN_CROP, dragCrop, fitRatio, fullCrop, isFullCrop, roundCrop } from "../crop";

const W = 400;
const H = 300;
const c = { x: 100, y: 50, w: 200, h: 100 };

describe("the crop frame", () => {
  it("moves, kept on the picture", () => {
    expect(dragCrop(c, "move", 30, -20, W, H, null)).toEqual({ x: 130, y: 30, w: 200, h: 100 });
    expect(dragCrop(c, "move", 1000, 1000, W, H, null)).toEqual({ x: 200, y: 200, w: 200, h: 100 });
    expect(dragCrop(c, "move", -1000, -1000, W, H, null)).toEqual({ x: 0, y: 0, w: 200, h: 100 });
  });

  it("is sized by its sides and corners, never past the picture nor smaller than MIN_CROP", () => {
    expect(dragCrop(c, "e", 50, 0, W, H, null)).toEqual({ x: 100, y: 50, w: 250, h: 100 });
    expect(dragCrop(c, "w", -500, 0, W, H, null)).toEqual({ x: 0, y: 50, w: 300, h: 100 });
    expect(dragCrop(c, "n", 0, 500, W, H, null)).toEqual({ x: 100, y: 150 - MIN_CROP, w: 200, h: MIN_CROP });
    expect(dragCrop(c, "se", 500, 500, W, H, null)).toEqual({ x: 100, y: 50, w: 300, h: 250 });
  });

  it("keeps its shape from a corner when it has one, the opposite corner staying", () => {
    const r = dragCrop(c, "se", 100, 0, W, H, 2);
    expect(r.x).toBe(100);
    expect(r.y).toBe(50);
    expect(r.w / r.h).toBeCloseTo(2);
    expect(r.w).toBe(300);
    // as far as the picture lets it
    const big = dragCrop(c, "nw", -1000, -1000, W, H, 2);
    expect(big.x + big.w).toBe(300);
    expect(big.y + big.h).toBe(150);
    expect(big.x).toBeGreaterThanOrEqual(0);
    expect(big.y).toBeGreaterThanOrEqual(0);
    expect(big.w / big.h).toBeCloseTo(2);
  });

  it("fits a shape on the picture round the middle of the frame", () => {
    const sq = fitRatio(c, 1, W, H);
    expect(sq).toEqual({ x: 50, y: 0, w: 300, h: 300 });
    const wide = fitRatio({ x: 0, y: 0, w: 10, h: 10 }, 16 / 9, W, H);
    expect(wide.x).toBe(0);
    expect(wide.w).toBe(400);
    expect(wide.h).toBeCloseTo(225);
  });

  it("tells the whole picture apart", () => {
    expect(isFullCrop(fullCrop(W, H), W, H)).toBe(true);
    expect(isFullCrop({ x: 0.2, y: 0, w: 399.9, h: 300 }, W, H)).toBe(true);
    expect(isFullCrop(c, W, H)).toBe(false);
    expect(roundCrop({ x: 1.4, y: 2.6, w: 10.5, h: 0.2 })).toEqual({ x: 1, y: 3, w: 11, h: 1 });
  });
});
