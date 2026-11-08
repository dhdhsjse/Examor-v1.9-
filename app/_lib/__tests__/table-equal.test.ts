import { describe, expect, it } from "vitest";
import { cutSpots, edgeSpots, lineSpots, magnet } from "../table/equal";

describe("the magnet that makes rows and columns the same size", () => {
  it("takes a line near a spot to it, and leaves one further away where it is", () => {
    const spots = [{ at: 100, marks: [[0, 100]] as [number, number][] }];
    expect(magnet(104, spots, 6).at).toBe(100);
    expect(magnet(110, spots, 6)).toEqual({ at: 110, marks: [] });
  });

  it("cuts a row so a part is as high as another row, or in two halves", () => {
    // rows 40, 100: cutting the second one
    const spots = cutSpots([40, 100], 1, 28);
    expect(spots.map((s) => s.at).sort((a, b) => a - b)).toEqual([80, 90, 100]);
    const half = spots.find((s) => s.at === 90)!;
    expect(half.marks).toEqual([[40, 90], [90, 140]]);
    const same = spots.find((s) => s.at === 80)!;
    expect(same.marks).toEqual([[40, 80], [0, 40]]);
  });

  it("leaves out parts that would be too small", () => {
    expect(cutSpots([40, 50], 1, 28)).toEqual([]);
  });

  it("drags the line between two columns to give one the size of another, or both the same", () => {
    // columns 100, 60, 140: the line between the second and the third
    const spots = lineSpots([100, 60, 140], 1, 24);
    const at = (x: number) => spots.find((s) => s.at === x);
    expect(at(200)?.marks).toEqual([[100, 200], [0, 100], [200, 300]]); // all three 100 wide, each marked once
    expect(at(160)).toBeUndefined(); // (no column is 60 or 140 wide outside the two)
    // columns 50, 80, 120: the second and the third the same width, or one as wide as the first
    const two = lineSpots([50, 80, 120], 1, 24);
    expect(two.map((x) => x.at).sort((p, q) => p - q)).toEqual([100, 150, 200]);
    expect(two.find((x) => x.at === 150)?.marks).toEqual([[50, 150], [150, 250]]);
  });

  it("drags the bottom of a row to the height of another", () => {
    const spots = edgeSpots([30, 60, 45], 2, 28, 0);
    expect(spots.map((s) => s.at)).toEqual([120, 150]);
    expect(spots[1].marks).toEqual([[90, 150], [30, 90]]);
  });
});
