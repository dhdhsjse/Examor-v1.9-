import { describe, expect, it } from "vitest";
import { createBlock } from "../blocks";
import { MAX_FULL_MARK, clampFullMark, examFullMark, withFullMark } from "../examMark";
import { headerTemplates } from "../onboarding/headerFooterLibrary";
import { chromeConfig, globalChrome } from "../pageChrome";
import type { ExamDoc, HeaderBlock, ExamMeta } from "../types";

const meta: ExamMeta = { title: "x", lang: "fr", templateId: "t" };
const t = (k: string) => k;
const graded = headerTemplates.find((h) => h.fields?.some((f) => f.key === "outOf"))!;
const base = (): ExamDoc => ({ version: 1, meta, pages: [{ id: "p1" }], blocks: [] });
const withHeader = (data: Record<string, string>): ExamDoc => ({ ...base(), globalHeader: { enabled: true, templateId: graded.id, data } });

describe("what the exam is graded out of", () => {
  it("is 20 until it is set, and a whole number from 1 to 200", () => {
    expect(examFullMark(base())).toBe(20);
    expect(clampFullMark(0)).toBe(1);
    expect(clampFullMark(500)).toBe(MAX_FULL_MARK);
    expect(clampFullMark(7.6)).toBe(8);
    expect(clampFullMark(Number.NaN)).toBe(20);
  });

  it("can be 10 or 5: the setting is changed", () => {
    expect(withFullMark(base(), 10, t).meta.fullMark).toBe(10);
    expect(examFullMark(withFullMark(base(), 5, t))).toBe(5);
  });

  it("is read from the page header when it has a number of its own", () => {
    expect(examFullMark(withHeader({ outOf: "15" }))).toBe(15);
    expect(examFullMark(withHeader({ outOf: "15", autoOutOf: "1" }))).toBe(20);
  });

  it("changes the score of the page header with it, and stops following the total of the questions", () => {
    const next = withFullMark(withHeader({ outOf: "20", autoOutOf: "1" }), 10, t);
    const data = globalChrome(next, "header")!.data;
    expect(data.outOf).toBe("10");
    expect(data.autoOutOf).toBeUndefined();
    expect(examFullMark(next)).toBe(10);
    // (the blocks of the header say it too)
    expect(next.blocks.some((b) => b.meta?.role === "header")).toBe(true);
  });

  it("changes the header of a page that has its own", () => {
    const doc: ExamDoc = { ...base(), pages: [{ id: "p1", header: { enabled: true, templateId: graded.id, data: { outOf: "20" } } }] };
    const next = withFullMark(doc, 5, t);
    expect(chromeConfig(next, 0, "header")!.data.outOf).toBe("5");
  });

  it("changes an exam header block", () => {
    const header = createBlock("header", "fr", "p1") as HeaderBlock;
    const next = withFullMark({ ...base(), blocks: [header] }, 10, t);
    const h = next.blocks.find((b): b is HeaderBlock => b.type === "header")!;
    expect(h.fields.outOf).toBe(10);
    expect(h.fields.autoOutOf).toBe(false);
    expect(examFullMark(next)).toBe(10);
  });
});
