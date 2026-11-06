import { describe, expect, it } from "vitest";
import { BORDER_KINDS, CORNER_STYLES, boxFillPath, boxLines, cornerOf, sidesOf } from "../boxBorder";

describe("the border of a text box", () => {
  it("draws nothing without a border, and every kind with one", () => {
    expect(boxLines({}, 200, 80)).toEqual([]);
    for (const kind of BORDER_KINDS) for (const corner of CORNER_STYLES) for (const sides of [undefined, "tb", "l"]) {
      const lines = boxLines({ border: "#000", borderWidth: 3, borderStyle: kind, corner, sides }, 200, 80);
      expect(lines.length, `${kind} ${corner}`).toBeGreaterThan(0);
      for (const l of lines) expect(l.d, `${kind} ${corner} ${sides}`).not.toMatch(/NaN|undefined/);
    }
  });

  it("follows the corners, never more than half the box", () => {
    expect(boxFillPath({ corner: "square" }, 100, 40)).not.toContain("A");
    expect(boxFillPath({ corner: "round", radius: 12 }, 100, 40)).toContain("A12 12");
    expect(boxFillPath({ corner: "round", radius: 500 }, 100, 40)).toContain("A20 20");
    expect(boxFillPath({ corner: "chamfer", radius: 10 }, 100, 40)).not.toContain("A");
    expect(boxFillPath({ corner: "scoop", radius: 10 }, 100, 40)).toContain("0 0 0");
  });

  it("reads older boxes: a radius alone is a rounded corner", () => {
    expect(cornerOf({})).toBe("square");
    expect(cornerOf({ radius: 8 })).toBe("round");
    expect(cornerOf({ corner: "leaf", radius: 8 })).toBe("leaf");
    expect(sidesOf({})).toEqual(["t", "r", "b", "l"]);
    expect(sidesOf({ sides: "tb" })).toEqual(["t", "b"]);
    expect(sidesOf({ sides: "x" })).toHaveLength(4);
  });

  it("a double line is two lines, a triple three", () => {
    expect(boxLines({ border: "#000", borderWidth: 6, borderStyle: "double" }, 100, 50)).toHaveLength(2);
    expect(boxLines({ border: "#000", borderWidth: 6, borderStyle: "triple" }, 100, 50)).toHaveLength(3);
    expect(boxLines({ border: "#000", borderStyle: "shadow" }, 100, 50)).toHaveLength(2);
  });
});
