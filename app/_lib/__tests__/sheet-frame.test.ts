import { describe, expect, it } from "vitest";
import { MM_TO_PX, getPageDimensions } from "../pageFormats";
import { DEFAULT_MARGINS } from "../a4";
import { blockHeight } from "../blockLayout";
import { HEAD_ROW, chromeLimits, columnsAfterDrag, contentBounds, frameGeometry, frameOf, offsetsAfterDrag } from "../sheet/frame";
import { MIN_ANSWER_WIDTH, MIN_COLUMN, defaultSheet, normalizeSheet } from "../sheet/model";
import { columnOf, settleSheet } from "../sheet/settle";
import { createBlock } from "../blocks";
import { markHeight } from "../sheet/marks";
import type { Block, ExamDoc, MarkBlock, Page, RuleBlock } from "../types";

const A4 = getPageDimensions();
const page: Page = { id: "p1" };

describe("the frame of a bordered sheet", () => {
  it("is the margin box, with the answers first and then the marks and the totals (left to right)", () => {
    const sheet = defaultSheet("fr");
    const g = frameGeometry(sheet, page, 0, false)!;
    expect(g.frame).toEqual({ x: 48, y: 48, width: A4.width - 96, height: A4.height - 96 });
    expect(g.columns.map((c) => c.id)).toEqual(["answer", "marks", "total"]);
    expect(g.columns[0].x0).toBe(48);
    expect(g.columns[2].x1).toBe(A4.width - 48);
    expect(g.marks!.x1 - g.marks!.x0).toBe(64);
    expect(g.total!.x1 - g.total!.x0).toBe(64);
    // the columns follow each other with no gap
    expect(g.columns[0].x1).toBe(g.columns[1].x0);
    expect(g.columns[1].x1).toBe(g.columns[2].x0);
  });

  it("runs the other way on a right-to-left sheet: the totals at the left edge, the answers at the right", () => {
    const g = frameGeometry(defaultSheet("ar"), page, 0, true)!;
    expect(g.columns.map((c) => c.id)).toEqual(["total", "marks", "answer"]);
    expect(g.total!.x0).toBe(48);
    expect(g.answer.x1).toBe(A4.width - 48);
  });

  it("has no frame on free paper", () => {
    expect(frameGeometry(defaultSheet("fr", "free"), page, 0, false)).toBeNull();
  });

  it("writes the titles on the first page only (or on every page, or none)", () => {
    const sheet = defaultSheet("fr");
    expect(frameGeometry(sheet, page, 0, false)!.head).toBe(HEAD_ROW * 2);
    expect(frameGeometry(sheet, page, 1, false)!.head).toBe(0);
    expect(frameGeometry({ ...sheet, headings: "all" }, page, 3, false)!.head).toBe(HEAD_ROW * 2);
    expect(frameGeometry({ ...sheet, headings: "none" }, page, 0, false)!.head).toBe(0);
    // one title row when there is only one of the two mark columns
    expect(frameGeometry({ ...sheet, total: null }, page, 0, false)!.head).toBe(HEAD_ROW);
  });

  it("puts the titles over their columns, with the one over both marks and totals spanning them", () => {
    const g = frameGeometry(defaultSheet("fr"), page, 0, false)!;
    const by = (text: string) => g.titles.find((t) => t.text === text)!;
    expect(g.titles).toHaveLength(4);
    expect(by("Éléments de réponse").rect.x).toBe(g.answer.x0);
    expect(by("Éléments de réponse").rect.height).toBe(HEAD_ROW * 2);
    expect(by("Note").rect.x).toBe(g.marks!.x0);
    expect(by("Note").rect.width).toBe(g.total!.x1 - g.marks!.x0);
    expect(by("Partielle").rect.x).toBe(g.marks!.x0);
    expect(by("Totale").rect.x).toBe(g.total!.x0);
  });

  it("stops the line between the marks and the totals under the title that is over both", () => {
    const g = frameGeometry(defaultSheet("fr"), page, 0, false)!;
    const between = g.lines.find((l) => l.x1 === g.total!.x0 && l.x2 === g.total!.x0)!;
    expect(between.y1).toBe(g.frame.y + HEAD_ROW);
    const next = frameGeometry(defaultSheet("fr"), page, 1, false)!;
    expect(next.lines.find((l) => l.x1 === next.total!.x0)!.y1).toBe(next.frame.y);
    // (the line before the marks goes the whole height)
    const first = g.lines.find((l) => l.x1 === g.marks!.x0 && l.x2 === g.marks!.x0)!;
    expect(first.y1).toBe(g.frame.y);
  });

  it("leaves the answers a column of their own, inside the frame, under the titles", () => {
    const g = frameGeometry(defaultSheet("fr"), page, 0, false)!;
    expect(g.content.x).toBeGreaterThan(g.answer.x0);
    expect(g.content.x + g.content.width).toBeLessThan(g.answer.x1);
    expect(g.content.y).toBeGreaterThan(g.frame.y + g.head);
  });

  it("never leaves the answers narrower than the minimum, however wide the columns", () => {
    const sheet = { ...defaultSheet("fr"), marks: { width: 220, title: "" }, total: { width: 220, title: "" } };
    const small: Page = { id: "s", format: { size: "A5", orientation: "portrait" } };
    const g = frameGeometry(sheet, small, 0, false)!;
    expect(g.answer.x1 - g.answer.x0).toBeGreaterThanOrEqual(MIN_ANSWER_WIDTH - 0.01);
  });

  it("goes past the margins by the offsets (and inside them with negative ones), and starts lower on the first page", () => {
    const sheet = { ...defaultSheet("fr"), frame: { top: 20, right: 10, bottom: 0, left: 48, firstTop: 100 } };
    const first = frameGeometry(sheet, page, 0, false)!;
    expect(first.frame.x).toBe(0);
    expect(first.frame.x + first.frame.width).toBe(A4.width - 48 + 10);
    expect(first.frame.y).toBe(48 - 20 + 100);
    expect(frameGeometry(sheet, page, 1, false)!.frame.y).toBe(28);
    const inside = frameGeometry({ ...sheet, frame: { top: -10, right: 0, bottom: -10, left: 0, firstTop: 0 } }, page, 1, false)!;
    expect(inside.frame.y).toBe(58);
    expect(inside.frame.y + inside.frame.height).toBe(A4.height - 58);
  });

  it("stays on the paper", () => {
    const g = frameGeometry({ ...defaultSheet("fr"), frame: { top: 120, right: 120, bottom: 120, left: 120, firstTop: 0 } }, page, 1, false)!;
    expect(g.frame.x).toBe(0);
    expect(g.frame.y).toBe(0);
    expect(g.frame.x + g.frame.width).toBe(A4.width);
    expect(g.frame.y + g.frame.height).toBe(A4.height);
  });
});

describe("what dragging the frame changes", () => {
  const sheet = defaultSheet("fr");

  it("gives a mark column the width of its boundary's distance from the end edge, the totals staying as they are", () => {
    const next = columnsAfterDrag(sheet, "outer", 64 + 100);
    expect(next.marks!.width).toBe(100);
    expect(next.total!.width).toBe(64);
  });

  it("moves the boundary between the marks and the totals without moving the one next to the answers", () => {
    const next = columnsAfterDrag(sheet, "inner", 90);
    expect(next.total!.width).toBe(90);
    expect(next.marks!.width).toBe(128 - 90);
    expect(next.marks!.width + next.total!.width).toBe(128);
  });

  it("keeps the columns between their limits", () => {
    expect(columnsAfterDrag(sheet, "outer", 2).marks!.width).toBe(MIN_COLUMN);
    expect(columnsAfterDrag(sheet, "inner", 2000).total!.width).toBe(128 - MIN_COLUMN);
    expect(columnsAfterDrag(sheet, "outer", 2000).marks!.width).toBe(220);
  });

  it("resizes the only column of marks there is", () => {
    const one = { ...sheet, total: null };
    expect(columnsAfterDrag(one, "outer", 100).marks!.width).toBe(100);
    expect(columnsAfterDrag(one, "outer", 100).total).toBeNull();
    const other = { ...sheet, marks: null };
    expect(columnsAfterDrag(other, "outer", 90).total!.width).toBe(90);
  });

  it("moves an edge of the frame past the margins, or inside them", () => {
    expect(offsetsAfterDrag(sheet, page, "left", 20, false).left).toBe(28);
    expect(offsetsAfterDrag(sheet, page, "right", A4.width - 20, false).right).toBe(28);
    expect(offsetsAfterDrag(sheet, page, "bottom", A4.height - 60, false).bottom).toBe(-12);
    expect(offsetsAfterDrag(sheet, page, "top", 30, false).top).toBe(18);
  });

  it("lowers the top of the first page without touching the others, and raises them all when it goes above the margin", () => {
    const lowered = offsetsAfterDrag(sheet, page, "top", 148, true);
    expect(lowered.firstTop).toBe(100);
    expect(lowered.top).toBe(0);
    const raised = offsetsAfterDrag({ ...sheet, frame: { ...sheet.frame, firstTop: 100 } }, page, "top", 20, true);
    expect(raised.firstTop).toBe(0);
    expect(raised.top).toBe(28);
  });
});

describe("the room for text", () => {
  const doc = (sheet?: ReturnType<typeof defaultSheet>) => ({ pages: [page], blocks: [], meta: { title: "", lang: "fr" as const, templateId: "" }, ...(sheet ? { sheet } : {}) });

  it("is between the margins when there is no frame", () => {
    const b = contentBounds(doc(), 0);
    expect(b).toEqual({ left: DEFAULT_MARGINS.left, right: A4.width - DEFAULT_MARGINS.right, top: DEFAULT_MARGINS.top, bottom: A4.height - DEFAULT_MARGINS.bottom });
    expect(contentBounds(doc(defaultSheet("fr", "free")), 0)).toEqual(b);
  });

  it("is the answer column of the frame on bordered paper", () => {
    const g = frameGeometry(defaultSheet("fr"), page, 0, false)!;
    const b = contentBounds(doc(defaultSheet("fr")), 0);
    expect(b.left).toBe(g.content.x);
    expect(b.right).toBe(g.content.x + g.content.width);
    expect(b.top).toBe(g.content.y);
    expect(b.right - b.left).toBeLessThan(A4.width - 96 - 128);
  });

  it("is where a page's own margins are", () => {
    const wide: Page = { id: "w", margins: { top: 20, right: 30, bottom: 40, left: 50 } };
    const b = contentBounds({ pages: [wide], blocks: [], meta: { title: "", lang: "fr", templateId: "" } }, 0);
    expect(b).toEqual({ left: 50, right: A4.width - 30, top: 20, bottom: A4.height - 40 });
    expect(MM_TO_PX).toBeGreaterThan(3);
  });
});

describe("the header and the footer of a sheet's pages", () => {
  const meta = { title: "", lang: "fr" as const, templateId: "" };
  const tagged = (b: Block, role: "header" | "footer", y: number): Block => ({ ...b, meta: { role }, layout: { ...b.layout, pageId: "p1", y } });
  const header = tagged(createBlock("header", "fr", "p1", {}), "header", 20);
  const footer = tagged(createBlock("text", "fr", "p1", { text: "Page 1", style: "body" }), "footer", A4.height - 40);
  const docWith = (blocks: Block[]) => ({ pages: [page], blocks, meta, sheet: defaultSheet("fr") });

  it("starts the frame under the header, and stops it over the footer", () => {
    const limits = chromeLimits(docWith([header, footer]), 0);
    expect(limits.top).toBe(20 + blockHeight(header, 1, meta) + 10);
    expect(limits.bottom).toBe(A4.height - 40 - 10);
    const g = frameOf(docWith([header, footer]), 0)!;
    expect(g.frame.y).toBe(limits.top);
    expect(g.frame.y + g.frame.height).toBe(limits.bottom);
  });

  it("changes nothing when the page has neither, or when the footer is down in the margin", () => {
    expect(chromeLimits(docWith([]), 0)).toEqual({});
    const plain = frameOf(docWith([]), 0)!;
    const low = tagged(createBlock("text", "fr", "p1", { text: "x", style: "body" }), "footer", A4.height - 20);
    const g = frameOf(docWith([low]), 0)!;
    expect(g.frame.y + g.frame.height).toBe(plain.frame.y + plain.frame.height);
    // (and there is no frame on free paper, header or not)
    expect(frameOf({ pages: [page], blocks: [header], meta }, 0)).toBeNull();
    expect(frameOf({ pages: [page], blocks: [header], meta, sheet: defaultSheet("fr", "free") }, 0)).toBeNull();
  });

  it("is the room the answers have: they start under the titles, which are under the header", () => {
    const g = frameOf(docWith([header]), 0)!;
    expect(g.content.y).toBeGreaterThan(g.frame.y + g.head);
    expect(contentBounds(docWith([header]), 0).top).toBe(g.content.y);
  });
});

describe("the settings read from a file", () => {
  it("fills in what an older version lacks, and keeps what is there", () => {
    const s = normalizeSheet({ paper: "free", marks: { width: 80, title: "N" }, total: null, pad: true } as never, "ar");
    expect(s.paper).toBe("free");
    expect(s.marks).toEqual({ width: 80, title: "N" });
    expect(s.total).toBeNull();
    expect(s.pad).toBe(true);
    expect(s.headings).toBe("first");
    expect(s.answerTitle).toBe("عناصر الإجابة");
    expect(s.frame).toEqual({ top: 0, right: 0, bottom: 0, left: 0, firstTop: 0 });
  });

  it("takes defaults for settings that are not what they should be", () => {
    const s = normalizeSheet({ paper: "weird", marks: { width: "wide" }, headings: "sometimes", frame: { top: 9999, left: "x" }, line: { width: 99 } } as never, "fr");
    expect(s.paper).toBe("bordered");
    expect(s.marks!.width).toBe(64);
    expect(s.headings).toBe("first");
    expect(s.frame.top).toBe(120);
    expect(s.frame.left).toBe(0);
    expect(s.line.width).toBe(6);
    expect(normalizeSheet(undefined, "fr")).toEqual(defaultSheet("fr"));
  });
});

describe("keeping the stickers and the lines on the frame", () => {
  const mark = (id: string, y: number, data: Partial<MarkBlock>, x = 10): MarkBlock => ({
    ...(createBlock("mark", "fr", "p1", data) as MarkBlock),
    id,
    layout: { pageId: "p1", x, y, width: 50, height: 20 },
  });
  const rule = (id: string, y: number): RuleBlock => ({ ...(createBlock("rule", "fr", "p1", {}) as RuleBlock), id, layout: { pageId: "p1", x: 5, y, width: 300, height: 10 } });
  const docOf = (blocks: ExamDoc["blocks"], sheet = defaultSheet("fr")): ExamDoc => ({ version: 1, meta: { title: "", lang: "fr", templateId: "" }, pages: [page], blocks, sheet });
  const geo = frameGeometry(defaultSheet("fr"), page, 0, false)!;
  const at = (d: ExamDoc, id: string) => d.blocks.find((b) => b.id === id)!.layout;

  it("puts a mark and a sign in the marks column, a total in the totals column, and a line across the frame", () => {
    const d = settleSheet(docOf([mark("n", 300, { kind: "number", value: 1 }), mark("o", 340, { kind: "op", op: "+" }), mark("t", 300, { kind: "total", place: "free" }), rule("r", 500)]));
    expect(at(d, "n").x).toBe(geo.marks!.x0);
    expect(at(d, "n").width).toBe(geo.marks!.x1 - geo.marks!.x0);
    expect(at(d, "o").x).toBe(geo.marks!.x0);
    expect(at(d, "t").x).toBe(geo.total!.x0);
    expect(at(d, "t").width).toBe(64);
    expect(at(d, "r").x).toBe(geo.frame.x);
    expect(at(d, "r").width).toBe(geo.frame.width);
    expect(at(d, "n").height).toBe(markHeight({}));
  });

  it("follows the columns when they change", () => {
    const base = settleSheet(docOf([mark("n", 300, { kind: "number", value: 1 })]));
    const wider = { ...defaultSheet("fr"), marks: { width: 100, title: "" } };
    const d = settleSheet({ ...base, sheet: wider });
    const g = frameGeometry(wider, page, 0, false)!;
    expect(at(d, "n").x).toBe(g.marks!.x0);
    expect(at(d, "n").width).toBe(100);
  });

  it("leaves a sticker alone when its column is not there, and on free paper", () => {
    const noMarks = settleSheet(docOf([mark("n", 300, { kind: "number", value: 1 }, 123)], { ...defaultSheet("fr"), marks: null }));
    expect(at(noMarks, "n").x).toBe(123);
    const free = settleSheet(docOf([mark("n", 300, { kind: "number", value: 1 }, 77), rule("r", 400)], defaultSheet("fr", "free")));
    expect(at(free, "n").x).toBe(77);
    expect(at(free, "r").x).toBe(5);
    expect(at(free, "r").width).toBe(300);
  });

  it("puts a total in the middle of its row: between the line above and the line below", () => {
    const d = settleSheet(docOf([rule("r1", 200), rule("r2", 400), mark("t", 250, { kind: "total" })]));
    const h = markHeight({});
    // (the lines are at 205 and 405)
    expect(at(d, "t").y).toBeCloseTo(305 - h / 2, 1);
  });

  it("puts a total at the top or at the bottom of its row when asked", () => {
    const top = settleSheet(docOf([rule("r1", 200), rule("r2", 400), mark("t", 250, { kind: "total", place: "top" })]));
    expect(at(top, "t").y).toBe(209);
    const bottom = settleSheet(docOf([rule("r1", 200), rule("r2", 400), mark("t", 250, { kind: "total", place: "bottom" })]));
    expect(at(bottom, "t").y + markHeight({})).toBeCloseTo(401, 1);
  });

  it("takes the row from the frame when there is no line: the first row starts under the titles, the last ends at the bottom of the frame", () => {
    const d = settleSheet(docOf([rule("r1", 400), mark("a", 150, { kind: "total" }), mark("b", 600, { kind: "total" })]));
    const h = markHeight({});
    const top = geo.frame.y + geo.head;
    expect(at(d, "a").y).toBeCloseTo((top + 405) / 2 - h / 2, 1);
    expect(at(d, "b").y).toBeCloseTo((405 + geo.frame.y + geo.frame.height) / 2 - h / 2, 1);
  });

  it("puts a total against the marks of its row: in the middle of them, at the top of the first or the bottom of the last", () => {
    const h = markHeight({});
    const marks = [mark("a", 200, { kind: "number", value: 1 }), mark("b", 300, { kind: "number", value: 1 })];
    const centered = settleSheet(docOf([...marks, mark("t", 600, { kind: "total" })]));
    // (a row with no line: the total is in it, wherever it is on the page)
    expect(at(centered, "t").y).toBeCloseTo((200 + 300 + h) / 2 - h / 2, 1);
    expect(at(settleSheet(docOf([...marks, mark("t", 600, { kind: "total", place: "top" })])), "t").y).toBe(200);
    expect(at(settleSheet(docOf([...marks, mark("t", 600, { kind: "total", place: "bottom" })])), "t").y).toBeCloseTo(300, 1);
  });

  it("keeps a total with its marks when a line is put in under them, whatever order they were made in", () => {
    const marks = [mark("a", 200, { kind: "number", value: 1 }), mark("b", 300, { kind: "number", value: 1 })];
    const first = settleSheet(docOf([...marks, mark("t", 250, { kind: "total" })]));
    const y = at(first, "t").y;
    const cut = settleSheet({ ...first, blocks: [...first.blocks, rule("r", 600)] });
    expect(at(cut, "t").y).toBe(y);
    expect(cut).toBe(settleSheet(cut));
  });

  it("takes a total to the marks of the row it is in when a line is put between its marks", () => {
    const h = markHeight({});
    const marks = [mark("a", 200, { kind: "number", value: 1 }), mark("b", 400, { kind: "number", value: 1 })];
    const first = settleSheet(docOf([...marks, mark("t", 250, { kind: "total" })]));
    // the line at 300 puts the total (at the middle of 200 and 424) with the second mark
    const cut = settleSheet({ ...first, blocks: [...first.blocks, rule("r", 300)] });
    expect(at(cut, "t").y).toBeCloseTo(400, 1);
    expect(h).toBeGreaterThan(0);
  });

  it("falls back on the lines of the row when its marks are on another page", () => {
    const pages = [page, { id: "p2" }];
    const m = mark("a", 200, { kind: "number", value: 1 });
    const t: MarkBlock = { ...mark("t", 300, { kind: "total" }), layout: { pageId: "p2", x: 0, y: 300, width: 50, height: 20 } };
    const d = settleSheet({ ...docOf([m, t]), pages });
    const g2 = frameGeometry(defaultSheet("fr"), pages[1], 1, false)!;
    expect(at(d, "t").y).toBeCloseTo((g2.frame.y + g2.head + g2.frame.y + g2.frame.height) / 2 - markHeight({}) / 2, 1);
  });

  it("does not move a total put by hand (free)", () => {
    const d = settleSheet(docOf([rule("r1", 200), mark("t", 250, { kind: "total", place: "free" })]));
    expect(at(d, "t").y).toBe(250);
  });

  it("returns the same document when nothing has to move", () => {
    const first = settleSheet(docOf([rule("r1", 200), rule("r2", 400), mark("t", 250, { kind: "total" }), mark("n", 300, { kind: "number", value: 1 })]));
    expect(settleSheet(first)).toBe(first);
    expect(settleSheet({ ...first, sheet: undefined })).toEqual({ ...first, sheet: undefined });
  });

  it("says which blocks the frame holds", () => {
    const n = mark("n", 300, { kind: "number", value: 1 });
    expect(columnOf(n, geo)).toEqual({ x: geo.marks!.x0, width: 64 });
    expect(columnOf(rule("r", 1), geo)).toEqual({ x: geo.frame.x, width: geo.frame.width });
    expect(columnOf(n, null)).toBeNull();
    expect(columnOf(mark("w", 300, { kind: "text", text: "x" }), geo)).toBeNull();
  });
});
