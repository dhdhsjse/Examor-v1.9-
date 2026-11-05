import { describe, expect, it } from "vitest";
import { createBlock } from "../blocks";
import { frameOf } from "../sheet/frame";
import { sheetScores } from "../sheet/marks";
import { defaultSheet } from "../sheet/model";
import { MAX_RECENT, remembered } from "../sheet/stickers";
import { addTotals, rowsWithoutTotal } from "../sheet/totals";
import type { Block, ExamDoc, ExamMeta, MarkBlock } from "../types";

describe("the marks the library keeps", () => {
  it("puts the latest first, once, and keeps only so many", () => {
    expect(remembered([1, 2, 3], 2, 6)).toEqual([2, 1, 3]);
    expect(remembered([1, 2, 3], 9, 3)).toEqual([9, 1, 2]);
    expect(remembered<number>([], 0.5, MAX_RECENT)).toEqual([0.5]);
  });
});

describe("the total a row with several marks needs", () => {
  const meta: ExamMeta = { title: "x", lang: "fr", templateId: "t" };
  const sheet = defaultSheet("fr");
  const doc = (blocks: Block[], config = sheet): ExamDoc => ({ version: 1, meta, pages: [{ id: "c1" }], blocks, sheet: config });
  const geo = frameOf(doc([]), 0)!;
  const mark = (y: number, data: Partial<MarkBlock>): Block => {
    const b = createBlock("mark", "fr", "c1", data);
    return { ...b, layout: { ...b.layout, x: geo.marks!.x0, y } };
  };
  const rule = (y: number): Block => ({ ...createBlock("rule", "fr", "c1"), layout: { pageId: "c1", x: geo.frame.x, y, width: geo.frame.width, height: 10 } });

  it("finds the rows with two or more marks and no total, not the others", () => {
    const d = doc([mark(200, { kind: "number", value: 0.5 }), mark(230, { kind: "number", value: 1 }), rule(260), mark(280, { kind: "number", value: 1 }), rule(320), mark(340, { kind: "number", value: 1 }), mark(370, { kind: "number", value: 1 }), mark(370, { kind: "total" })]);
    expect(rowsWithoutTotal(d)).toHaveLength(1);
    expect(rowsWithoutTotal(d)[0].marks.map((m) => m.value)).toEqual([0.5, 1]);
  });

  it("puts the total in the column of the totals, in the middle of the marks of the row, and adds up", () => {
    const d = doc([mark(200, { kind: "number", value: 0.5 }), mark(260, { kind: "number", value: 1 }), rule(300)]);
    const next = addTotals(d);
    const total = next.blocks.find((b): b is MarkBlock => b.type === "mark" && b.kind === "total")!;
    expect(total).toBeTruthy();
    expect(total.layout.x).toBe(geo.total!.x0);
    const marks = next.blocks.filter((b): b is MarkBlock => b.type === "mark" && b.kind === "number");
    const middle = (Math.min(...marks.map((m) => m.layout.y)) + Math.max(...marks.map((m) => m.layout.y + m.layout.height))) / 2;
    expect(total.layout.y + total.layout.height / 2).toBeCloseTo(middle, 0);
    expect(sheetScores(next).total).toBe(1.5);
    expect(rowsWithoutTotal(next)).toEqual([]);
    expect(addTotals(next)).toBe(next);
  });

  it("asks for no total on a sheet that has no column for them", () => {
    const d = doc([mark(200, { kind: "number", value: 0.5 }), mark(260, { kind: "number", value: 1 })], { ...sheet, total: null });
    expect(rowsWithoutTotal(d)).toEqual([]);
    expect(addTotals(d)).toBe(d);
  });

  it("adds the rows up whatever the columns: with only the column of the marks on, a row is its marks added", () => {
    const only = { ...sheet, total: null };
    const d = doc([mark(200, { kind: "number", value: 0.5 }), mark(230, { kind: "number", value: 1 }), rule(260), mark(280, { kind: "number", value: 2 })], only);
    expect(sheetScores(d).rows.map((r) => r.score)).toEqual([1.5, 2]);
    expect(sheetScores(d).total).toBe(3.5);
  });

  it("keeps the link of the marks with their question on the total it adds", () => {
    const linked = (y: number, v: number): Block => ({ ...mark(y, { kind: "number", value: v }), meta: { source: { id: "q1", part: 0 } } }) as Block;
    const next = addTotals(doc([linked(200, 1), linked(260, 1)]));
    const total = next.blocks.find((b) => b.type === "mark" && b.kind === "total")!;
    expect(total.meta?.source).toEqual({ id: "q1" });
  });
});
