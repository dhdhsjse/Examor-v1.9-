import { describe, expect, it } from "vitest";
import { createBlock } from "../blocks";
import { measurer, moveRule } from "../sheet/flow";
import { generateCorrection } from "../sheet/generate";
import { viewOf, withCorrection } from "../sheet/part";
import type { Block, ExamDoc, ExamMeta, RuleBlock } from "../types";

const fr: ExamMeta = { title: "Devoir", lang: "fr", templateId: "t" };
const put = <T extends Block>(b: T, y: number): T => ({ ...b, layout: { ...b.layout, pageId: "e1", y } });
const mcq = (y: number) => put(createBlock("mcq", "fr", "e1", { text: "Capitale ?", options: ["Lyon", "Paris"], correct: 1, points: 1 }), y);

// a sheet of the answers of three questions: a row each, a line under each
const sheet = (): ExamDoc => {
  const exam: ExamDoc = { version: 1, meta: fr, pages: [{ id: "e1" }], blocks: [mcq(120), mcq(260), mcq(400)] };
  return viewOf(withCorrection(exam, generateCorrection(exam, { template: "answers", paper: "bordered", marks: true })), "sheet");
};
const rulesOf = (doc: ExamDoc) => doc.blocks.filter((b): b is RuleBlock => b.type === "rule").sort((a, z) => a.layout.y - z.layout.y);
const yOf = (doc: ExamDoc, id: string) => doc.blocks.find((b) => b.id === id)!.layout.y;

describe("a row line moved up or down", () => {
  it("makes its row taller, and everything under it follows", () => {
    const doc = sheet();
    const [first] = rulesOf(doc);
    const under = doc.blocks.filter((b) => b.layout.y > first.layout.y);
    const over = doc.blocks.filter((b) => b.layout.y + measurer(doc)(b) < first.layout.y && !b.meta?.role);
    const next = moveRule(doc, first.id, first.layout.pageId, first.layout.y + 40)!;
    expect(yOf(next, first.id)).toBeCloseTo(first.layout.y + 40);
    for (const b of under) expect(yOf(next, b.id)).toBeCloseTo(b.layout.y + 40);
    for (const b of over) expect(yOf(next, b.id)).toBeCloseTo(b.layout.y);
  });

  it("makes its row shorter, and the rows under it come up", () => {
    const doc = sheet();
    const moved = moveRule(doc, rulesOf(doc)[0].id, "", 0); // (another page: not this move)
    expect(moved).toBeNull();
    const [first, second] = rulesOf(doc);
    const lower = moveRule(doc, first.id, first.layout.pageId, first.layout.y + 30)!;
    const back = moveRule(lower, first.id, first.layout.pageId, first.layout.y)!;
    expect(yOf(back, first.id)).toBeCloseTo(first.layout.y);
    expect(yOf(back, second.id)).toBeCloseTo(second.layout.y);
  });

  it("sends the rows that no longer fit to the next page", () => {
    const doc = sheet();
    const [first] = rulesOf(doc);
    const page = first.layout.pageId;
    const next = moveRule(doc, first.id, page, 5000)!; // (as low as the page goes)
    const moved = next.blocks.filter((b) => b.layout.pageId !== page);
    expect(next.pages.length).toBeGreaterThan(doc.pages.length);
    expect(moved.some((b) => b.type !== "rule" && !b.meta?.role)).toBe(true);
    const height = measurer(next);
    const bottom = Math.max(...next.blocks.filter((b) => b.layout.pageId === page && b.type !== "rule" && b.type !== "mark" && !b.meta?.role).map((b) => b.layout.y + height(b)));
    expect(bottom).toBeLessThanOrEqual(yOf(next, first.id) + height(first));
  });

  it("never goes up past what is in its row", () => {
    const doc = sheet();
    const [first] = rulesOf(doc);
    const next = moveRule(doc, first.id, first.layout.pageId, 0)!;
    const height = measurer(next);
    const row = next.blocks.filter((b) => b.type !== "rule" && !b.meta?.role && b.layout.y < first.layout.y && b.layout.y + height(b) / 2 > 0);
    const lowest = Math.max(...row.filter((b) => b.layout.y + height(b) / 2 < first.layout.y).map((b) => b.layout.y + height(b)));
    expect(yOf(next, first.id)).toBeGreaterThanOrEqual(lowest - 5);
  });
});
