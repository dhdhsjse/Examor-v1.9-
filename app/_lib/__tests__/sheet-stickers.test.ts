import { describe, expect, it } from "vitest";
import { createBlock } from "../blocks";
import { frameOf } from "../sheet/frame";
import { sheetScores } from "../sheet/marks";
import { defaultSheet } from "../sheet/model";
import { isDefaultSticker, parseSticker, withSticker, withoutSticker } from "../sheet/stickers";
import { addTotals, rowsWithoutTotal } from "../sheet/totals";
import type { Block, ExamDoc, ExamMeta, MarkBlock } from "../types";

describe("the sticker library the teacher keeps", () => {
  it("reads what is typed as a mark (a comma is a decimal point) or as words", () => {
    expect(parseSticker("3.5")).toBe(3.5);
    expect(parseSticker(" 1,25 ")).toBe(1.25);
    expect(parseSticker("NR")).toBe("NR");
    expect(parseSticker("")).toBeNull();
    expect(parseSticker("0")).toBeNull();
    expect(parseSticker("-2")).toBeNull();
  });

  it("adds a sticker at the end, once, and takes an added one off again", () => {
    expect(withSticker([3.5, "NR"], 7)).toEqual([3.5, "NR", 7]);
    expect(withSticker([3.5], 3.5)).toEqual([3.5]);
    expect(withSticker([3.5, 7], 9, 2)).toEqual([3.5, 7]);
    expect(withoutSticker([3.5, "NR"], "NR")).toEqual([3.5]);
  });

  it("does not add the usual stickers again: they are always there", () => {
    expect(withSticker([], 1)).toEqual([]);
    expect(withSticker([], "✓")).toEqual([]);
    expect(isDefaultSticker(0.125)).toBe(true);
    expect(isDefaultSticker(3.5)).toBe(false);
  });
});

describe("the total a row needs", () => {
  const meta: ExamMeta = { title: "x", lang: "fr", templateId: "t" };
  const sheet = defaultSheet("fr");
  const doc = (blocks: Block[], config = sheet): ExamDoc => ({ version: 1, meta, pages: [{ id: "c1" }], blocks, sheet: config });
  const geo = frameOf(doc([]), 0)!;
  const mark = (y: number, data: Partial<MarkBlock>): Block => {
    const b = createBlock("mark", "fr", "c1", data);
    return { ...b, layout: { ...b.layout, x: geo.marks!.x0, y } };
  };
  const rule = (y: number): Block => ({ ...createBlock("rule", "fr", "c1"), layout: { pageId: "c1", x: geo.frame.x, y, width: geo.frame.width, height: 10 } });

  it("finds the rows with marks and no total on a bordered sheet, even a row of one mark", () => {
    const d = doc([mark(200, { kind: "number", value: 0.5 }), mark(230, { kind: "number", value: 1 }), rule(260), mark(280, { kind: "number", value: 1 }), rule(320), mark(340, { kind: "number", value: 1 }), mark(370, { kind: "number", value: 1 }), mark(370, { kind: "total" })]);
    expect(rowsWithoutTotal(d).map((g) => g.marks.map((m) => m.value))).toEqual([[0.5, 1], [1]]);
  });

  it("on free paper, asks a total only of the rows with two or more marks", () => {
    const d = doc([mark(200, { kind: "number", value: 0.5 }), mark(230, { kind: "number", value: 1 }), rule(260), mark(280, { kind: "number", value: 1 }), rule(320)], { ...sheet, paper: "free" });
    expect(rowsWithoutTotal(d).map((g) => g.marks.map((m) => m.value))).toEqual([[0.5, 1]]);
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

  it("can add the total of the row of one mark only (a mark just stamped)", () => {
    const d = doc([mark(200, { kind: "number", value: 1 }), rule(260), mark(280, { kind: "number", value: 2 }), rule(320)]);
    const stamped = d.blocks[2].id;
    const next = addTotals(d, stamped);
    expect(rowsWithoutTotal(next).map((g) => g.marks.map((m) => m.value))).toEqual([[1]]);
    expect(addTotals(next, stamped)).toBe(next);
  });

  it("keeps the link of the marks with their question on the total it adds", () => {
    const linked = (y: number, v: number): Block => ({ ...mark(y, { kind: "number", value: v }), meta: { source: { id: "q1", part: 0 } } }) as Block;
    const next = addTotals(doc([linked(200, 1), linked(260, 1)]));
    const total = next.blocks.find((b) => b.type === "mark" && b.kind === "total")!;
    expect(total.meta?.source).toEqual({ id: "q1" });
  });
});
