import { describe, expect, it } from "vitest";
import { FREEHAND_ID, MIN_SHAPE_SIZE, SHAPES, freehandFrom, newShapeItem, shapeParts, shapesSvg } from "../shapes";

describe("the pencil (a freehand shape)", () => {
  it("keeps the stroke's points as fractions of its box", () => {
    const drawn = freehandFrom([
      [10, 20],
      [60, 70],
      [110, 20],
    ]);
    expect(drawn?.box).toMatchObject({ x: 10, y: 20, w: 100, h: 50 });
    expect(drawn?.adj).toEqual([0, 0, 0.5, 1, 1, 0]);
  });

  it("is drawn through its points, stretched with its box", () => {
    const item = newShapeItem(FREEHAND_ID, { x: 0, y: 0, w: 200, h: 100 }, { adj: [0, 0, 0.5, 1, 1, 0] });
    expect(shapeParts(item, 200, 100)).toEqual([{ d: "M0 0L100 100L200 0", paint: "line" }]);
    expect(shapesSvg([item])).toContain("M0 0L100 100L200 0");
  });

  it("gives a straight stroke a box a few pixels thick, and a click nothing", () => {
    const flat = freehandFrom([
      [0, 50],
      [80, 50],
    ]);
    expect(flat?.box.h).toBe(MIN_SHAPE_SIZE);
    expect(flat?.adj).toEqual([0, 0.5, 1, 0.5]);
    expect(freehandFrom([[5, 5]])).toBeNull();
    expect(
      freehandFrom([
        [5, 5],
        [6, 5],
      ]),
    ).toBeNull();
  });

  it("is not one of the gallery's shapes", () => {
    expect(SHAPES.some((s) => s.id === FREEHAND_ID)).toBe(false);
  });
});
