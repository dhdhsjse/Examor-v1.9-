import { describe, expect, it } from "vitest";
import { sheetsOf } from "../printLayout";

const A4 = { width: 210, height: 297 };
const A4_WIDE = { width: 297, height: 210 };
const round = (v: number) => Math.round(v * 10) / 10;

describe("the pages on the sheets of paper", () => {
  it("prints each page on its own sheet, of its own size", () => {
    const sheets = sheetsOf([A4, A4_WIDE], { perSheet: 1, paper: "A4" });
    expect(sheets.map((s) => [s.width, s.height])).toEqual([[210, 297], [297, 210]]);
    expect(sheets[1].slots).toEqual([{ page: 1, x: 0, y: 0, width: 297, height: 210 }]);
  });

  it("puts two A4 pages side by side on a landscape A4, each the size of an A5", () => {
    const sheets = sheetsOf([A4, A4, A4], { perSheet: 2, paper: "A4" });
    expect(sheets).toHaveLength(2);
    const [first, last] = sheets;
    expect([first.width, first.height]).toEqual([297, 210]);
    expect(first.slots.map((s) => s.page)).toEqual([0, 1]);
    expect(first.slots.map((s) => [round(s.width), round(s.height)])).toEqual([[148.5, 210], [148.5, 210]]);
    expect(round(first.slots[0].x)).toBe(0);
    expect(round(first.slots[1].x)).toBe(148.5);
    // (the last page alone, in the first half)
    expect(last.slots).toHaveLength(1);
    expect(last.slots[0].page).toBe(2);
  });

  it("puts two A4 pages full size on an A3", () => {
    const [sheet] = sheetsOf([A4, A4], { perSheet: 2, paper: "A3" });
    expect([sheet.width, sheet.height]).toEqual([420, 297]);
    expect(sheet.slots.map((s) => [round(s.x), round(s.width), round(s.height)])).toEqual([[0, 210, 297], [210, 210, 297]]);
  });

  it("puts the first page on the right for an Arabic exam", () => {
    const [sheet] = sheetsOf([A4, A4], { perSheet: 2, paper: "A4" }, true);
    expect(round(sheet.slots.find((s) => s.page === 0)!.x)).toBe(148.5);
    expect(round(sheet.slots.find((s) => s.page === 1)!.x)).toBe(0);
  });

  it("stacks two landscape pages on a standing sheet", () => {
    const [sheet] = sheetsOf([A4_WIDE, A4_WIDE], { perSheet: 2, paper: "A4" }, true);
    expect([sheet.width, sheet.height]).toEqual([210, 297]);
    expect(sheet.slots.map((s) => [s.page, round(s.y)])).toEqual([[0, 0], [1, 148.5]]);
  });
});
