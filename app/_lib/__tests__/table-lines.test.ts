import { describe, expect, it } from "vitest";
import { layoutTable } from "../blockLayout";
import { blankCells, hEdgeLook, insertLines, setBorders, sideLook, vEdgeLook, type TableData } from "../table";
import type { ExamMeta, TableBlock } from "../types";

const fr: ExamMeta = { title: "t", lang: "fr", templateId: "x" };
const grid = (): TableData => ({ cells: blankCells(2, 2), header: false });
const thick = { w: 3, dash: "dashed" as const, color: "#dc2626" };

describe("the look of a table's lines", () => {
  it("is given to the lines a border button draws", () => {
    const t = { ...grid(), ...setBorders(grid(), { r0: 0, c0: 0, r1: 1, c1: 1 }, "outer", { look: thick }) };
    expect(hEdgeLook(t, 0, 0)).toEqual(thick);
    expect(vEdgeLook(t, 2, 1)).toEqual(thick);
    expect(hEdgeLook(t, 1, 0)).toBeUndefined(); // (inside: plain)
    expect(sideLook(t, { r0: 0, c0: 0, r1: 1, c1: 1 }, "top")).toEqual(thick);
  });

  it("goes with a line that is hidden or drawn plain again", () => {
    let t = { ...grid(), ...setBorders(grid(), { r0: 0, c0: 0, r1: 0, c1: 0 }, "all", { look: thick }) };
    t = { ...t, ...setBorders(t, { r0: 0, c0: 0, r1: 0, c1: 0 }, "bottom", { show: false }) };
    expect(hEdgeLook(t, 1, 0)).toBeUndefined();
    t = { ...t, ...setBorders(t, { r0: 0, c0: 0, r1: 0, c1: 0 }, "all") };
    expect(hEdgeLook(t, 0, 0)).toBeUndefined();
  });

  it("is not copied to a new row", () => {
    const t = { ...grid(), ...setBorders(grid(), { r0: 0, c0: 0, r1: 1, c1: 1 }, "all", { look: thick }) };
    const next = { ...t, ...insertLines(t, "row", 1) };
    expect(next.cellStyles?.["1,0"]?.lB).toBeUndefined();
  });

  it("is laid out apart from the plain lines", () => {
    const t = { ...grid(), ...setBorders(grid(), { r0: 0, c0: 0, r1: 0, c1: 1 }, "top", { look: thick }) };
    const L = layoutTable({ ...t, id: "t", type: "table", layout: { pageId: "p", x: 0, y: 0, width: 200, height: 0 } } as TableBlock, fr);
    expect(L.styled).toEqual([
      { pts: [0, 0, 100, 0], look: thick },
      { pts: [100, 0, 200, 0], look: thick },
    ]);
    expect(L.lines.some(([, y1, , y2]) => y1 === 0 && y2 === 0)).toBe(false);
  });
});
