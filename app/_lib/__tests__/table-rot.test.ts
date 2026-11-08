import { describe, expect, it } from "vitest";
import { TABLE_MIN_ROW, layoutTable } from "../blockLayout";
import { editRegions } from "../editRegions";
import type { ExamMeta, TableBlock } from "../types";

const fr: ExamMeta = { title: "t", lang: "fr", templateId: "x" };
const table = (extra: Partial<TableBlock>): TableBlock => ({ id: "t", type: "table", cells: [["Une longue étiquette", "b"]], header: false, layout: { pageId: "p", x: 0, y: 0, width: 200, height: 0 }, ...extra });

describe("sideways text in a cell", () => {
  it("makes the row as high as its longest line, not as its lines", () => {
    const across = layoutTable(table({ cellStyles: { "0,1": { bold: true } } }), fr);
    const up = layoutTable(table({ cellStyles: { "0,0": { rot: 270 } } }), fr);
    const line = Math.max(...up.cellBoxes[0].text.lines.map((l) => l.width));
    expect(up.cellBoxes[0].text.lines).toHaveLength(1); // (not wrapped at the column's width)
    expect(up.rows[0].height).toBeCloseTo(Math.max(TABLE_MIN_ROW, line + 12));
    expect(up.rows[0].height).toBeGreaterThan(across.rows[0].height);
    expect(up.cellBoxes[0].rot).toBe(270);
  });

  it("wraps at the height the row was given", () => {
    const L = layoutTable(table({ rowHeights: [60], cellStyles: { "0,0": { rot: 90 } } }), fr);
    expect(L.cellBoxes[0].text.lines.length).toBeGreaterThan(1);
    expect(L.rows[0].height).toBeLessThanOrEqual(60 + 1);
  });

  it("puts its first line across the cell as the vertical alignment says", () => {
    const mid = layoutTable(table({ rowHeights: [120], cellStyles: { "0,0": { rot: 270 } } }), fr).cellBoxes[0];
    const top = layoutTable(table({ rowHeights: [120], cellStyles: { "0,0": { rot: 270, valign: "top" } } }), fr).cellBoxes[0];
    expect(top.textY).toBe(4);
    expect(mid.textY).toBeCloseTo((mid.w - mid.text.height) / 2);
  });

  it("is typed in turned the same way", () => {
    const r = editRegions(table({ cellStyles: { "0,0": { rot: 270 } } }), 1, fr, "exam")[0];
    const L = layoutTable(table({ cellStyles: { "0,0": { rot: 270 } } }), fr).cellBoxes[0];
    expect(r.turn).toEqual({ x: L.x, y: L.y + L.h, rot: 270 });
    expect(r.width).toBe(L.h - 12);
  });
});
