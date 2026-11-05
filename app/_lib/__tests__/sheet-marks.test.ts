import { describe, expect, it } from "vitest";
import { createBlock } from "../blocks";
import { MARK_STEP, RULE_HEIGHT, evaluate, formatMark, markHeight, rowHasTotalAt, sheetScores, snapMark, type Item } from "../sheet/marks";
import type { Block, ExamMeta, MarkBlock, Page, RuleBlock } from "../types";

const meta: ExamMeta = { title: "", lang: "fr", templateId: "" };
const page = (id: string): Page => ({ id });

// A sticker at a y on a page (x only matters for stickers on the same line)
const mark = (id: string, pageId: string, y: number, data: Partial<MarkBlock>, x = 600): MarkBlock => ({
  ...(createBlock("mark", "fr", pageId, data) as MarkBlock),
  id,
  layout: { pageId, x, y, width: 64, height: markHeight({}) },
});
const rule = (id: string, pageId: string, y: number): RuleBlock => ({ ...(createBlock("rule", "fr", pageId, {}) as RuleBlock), id, layout: { pageId, x: 0, y, width: 700, height: RULE_HEIGHT } });
const num = (id: string, pageId: string, y: number, value: number) => mark(id, pageId, y, { kind: "number", value });
const op = (id: string, pageId: string, y: number, o: "+" | "×" | "−") => mark(id, pageId, y, { kind: "op", op: o });
const total = (id: string, pageId: string, y: number, data: Partial<MarkBlock> = {}) => mark(id, pageId, y, { kind: "total", ...data }, 100);
const sheet = (blocks: Block[], pages = [page("p1")], lang: "fr" | "ar" = "fr") => ({ pages, blocks, meta: { ...meta, lang } });

describe("how a mark is written", () => {
  it("brings a mark to a multiple of 0.125, between 0 and 100", () => {
    expect(MARK_STEP).toBe(0.125);
    expect(snapMark(0.3)).toBe(0.25);
    expect(snapMark(0.07)).toBe(0.125);
    expect(snapMark(0.06)).toBe(0);
    expect(snapMark(-2)).toBe(0);
    expect(snapMark(250)).toBe(100);
    expect(snapMark(Number.NaN)).toBe(0);
    expect(snapMark(1.1875)).toBe(1.25);
  });

  it("writes whole marks plainly, the others with up to three decimals, and pads a whole mark under ten when asked", () => {
    expect(formatMark(2)).toBe("2");
    expect(formatMark(0.5)).toBe("0.5");
    expect(formatMark(1.5)).toBe("1.5");
    expect(formatMark(0.125)).toBe("0.125");
    expect(formatMark(0.375)).toBe("0.375");
    expect(formatMark(1, true)).toBe("01");
    expect(formatMark(6, true)).toBe("06");
    expect(formatMark(12, true)).toBe("12");
    expect(formatMark(0.5, true)).toBe("0.5");
    expect(formatMark(1.5, true)).toBe("1.5");
    expect(formatMark(0, true)).toBe("00");
    expect(formatMark(-0.25)).toBe("−0.25");
  });
});

describe("the calculation of a row", () => {
  const n = (v: number): Item => ({ n: v });
  const o = (p: "+" | "×" | "−"): Item => ({ op: p });

  it("adds marks that have no sign between them", () => {
    expect(evaluate([n(1), n(1)])).toBe(2);
    expect(evaluate([n(0.5), n(0.5), n(0.25)])).toBe(1.25);
    expect(evaluate([])).toBe(0);
  });

  it("does the product before the sum: 0.5 × 2 + 0.5 = 1.5", () => {
    expect(evaluate([n(0.5), o("×"), n(2), o("+"), n(0.5)])).toBe(1.5);
    expect(evaluate([n(1), o("+"), n(0.5), o("×"), n(2)])).toBe(2);
    expect(evaluate([n(0.5), o("×"), n(2), o("×"), n(3)])).toBe(3);
  });

  it("subtracts", () => {
    expect(evaluate([n(2), o("−"), n(0.25)])).toBe(1.75);
    expect(evaluate([n(2), o("−"), n(0.5), o("×"), n(2)])).toBe(1);
  });

  it("ignores a sign that stands alone, and takes the last of two signs in a row", () => {
    expect(evaluate([o("+"), n(1), n(1)])).toBe(2);
    expect(evaluate([o("×"), n(2)])).toBe(2);
    expect(evaluate([n(2), o("+")])).toBe(2);
    expect(evaluate([n(2), o("×"), o("+"), n(1)])).toBe(3);
    expect(evaluate([o("−"), n(1)])).toBe(-1);
  });

  it("is exact for eighths", () => {
    expect(evaluate([n(0.125), n(0.125), n(0.125)])).toBe(0.375);
    expect(evaluate([n(0.375), o("×"), n(2)])).toBe(0.75);
  });
});

describe("the rows of a sheet", () => {
  it("makes one row of everything when there is no line, and adds it up", () => {
    const s = sheetScores(sheet([num("a", "p1", 100, 1), num("b", "p1", 200, 1), total("t", "p1", 150)]));
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0].auto).toBe(2);
    expect(s.shown.get("t")).toBe(2);
    expect(s.total).toBe(2);
  });

  it("cuts the rows at the lines, whatever order the blocks are in", () => {
    const blocks = [num("b2", "p1", 300, 1), rule("r", "p1", 250), num("a1", "p1", 100, 0.5), num("a2", "p1", 180, 0.5), total("t1", "p1", 140), total("t2", "p1", 330)];
    const s = sheetScores(sheet(blocks));
    expect(s.rows.map((r) => r.auto)).toEqual([1, 1]);
    expect(s.shown.get("t1")).toBe(1);
    expect(s.shown.get("t2")).toBe(1);
    expect(s.total).toBe(2);
  });

  it("reads the signs top to bottom, as in the answer keys: 0.5 × 2 + 0.5 = 1.5", () => {
    const blocks = [num("1", "p1", 100, 0.5), op("2", "p1", 140, "×"), num("3", "p1", 180, 2), op("4", "p1", 220, "+"), num("5", "p1", 260, 0.5), total("t", "p1", 190)];
    const s = sheetScores(sheet(blocks));
    expect(s.shown.get("t")).toBe(1.5);
    expect(s.total).toBe(1.5);
  });

  it("keeps a row going across a page break (its total can be on either page)", () => {
    const pages = [page("p1"), page("p2")];
    const blocks = [num("a", "p1", 1000, 0.5), rule("r1", "p2", 400), num("b", "p2", 100, 1), total("t", "p2", 200), num("c", "p2", 450, 1), total("u", "p2", 500)];
    const s = sheetScores(sheet(blocks, pages));
    // (the first row: the 0.5 of the first page and the 1 of the second page)
    expect(s.shown.get("t")).toBe(1.5);
    expect(s.shown.get("u")).toBe(1);
    expect(s.total).toBe(2.5);
    expect(s.rows).toHaveLength(2);
  });

  it("counts a row that has marks but no total sticker", () => {
    const s = sheetScores(sheet([num("a", "p1", 100, 1.5), rule("r", "p1", 200), num("b", "p1", 300, 2)]));
    expect(s.total).toBe(3.5);
    expect(s.rows.map((r) => r.score)).toEqual([1.5, 2]);
  });

  it("leaves out the rows with nothing in them and the words", () => {
    const blocks = [rule("r1", "p1", 100), rule("r2", "p1", 200), mark("w", "p1", 250, { kind: "text", text: "✓" }), num("a", "p1", 300, 1)];
    const s = sheetScores(sheet(blocks));
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0].index).toBe(2);
    expect(s.total).toBe(1);
  });

  it("shows a total typed by hand, snapped to a multiple of 0.125, and says when it differs from the marks", () => {
    const blocks = [num("a", "p1", 100, 1), num("b", "p1", 150, 0.5), total("t", "p1", 120, { manual: true, value: 2 })];
    const s = sheetScores(sheet(blocks));
    expect(s.shown.get("t")).toBe(2);
    expect(s.rows[0].score).toBe(2);
    expect(s.total).toBe(2);
    expect(s.issues).toMatchObject([{ kind: "typed-differs", row: 0, typed: 2, auto: 1.5 }]);
    const same = sheetScores(sheet([num("a", "p1", 100, 1), num("b", "p1", 150, 1), total("t", "p1", 120, { manual: true, value: 2 })]));
    expect(same.issues).toEqual([]);
  });

  it("tells which row a point falls in, and whether it has a total already", () => {
    const d = sheet([num("a", "p1", 100, 1), total("t", "p1", 110), rule("r", "p1", 200), num("b", "p1", 300, 2)]);
    expect(rowHasTotalAt(d, 0, 150)).toBe(true);
    expect(rowHasTotalAt(d, 0, 350)).toBe(false);
    expect(rowHasTotalAt(d, 0, 50)).toBe(true); // (above the marks, still in the first row)
    const two = sheet([num("a", "p1", 100, 1), total("t", "p1", 110), rule("r", "p1", 200), num("b", "p1", 300, 2)], [page("p1"), page("p2")]);
    expect(rowHasTotalAt(two, 1, 100)).toBe(false); // (the row of page 2 is the one under the line)
  });

  it("says when a row has two totals, and counts the first one", () => {
    const blocks = [num("a", "p1", 100, 1), total("t1", "p1", 120), total("t2", "p1", 160, { manual: true, value: 5 })];
    const s = sheetScores(sheet(blocks));
    expect(s.issues).toMatchObject([{ kind: "two-totals", row: 0 }]);
    expect(s.issues[0]).toHaveProperty("id", "t2");
    expect(s.rows[0].score).toBe(1);
  });

  it("reads two stickers on the same line along the line (right to left on an Arabic sheet)", () => {
    const five = mark("a", "p1", 100, { kind: "number", value: 5 }, 100);
    const minus = mark("b", "p1", 100, { kind: "op", op: "−" }, 300);
    const two = mark("c", "p1", 100, { kind: "number", value: 2 }, 500);
    expect(sheetScores(sheet([two, minus, five], [page("p1")], "fr")).rows[0].auto).toBe(3); // 5 − 2
    expect(sheetScores(sheet([two, minus, five], [page("p1")], "ar")).rows[0].auto).toBe(-3); // 2 − 5
  });
});
