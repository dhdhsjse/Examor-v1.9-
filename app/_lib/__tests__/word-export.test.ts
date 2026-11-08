import { describe, expect, it } from "vitest";
import { createBlock } from "../blocks";
import type { Block, ExamDoc } from "../types";
import { isPictureBlock, readingOrder } from "../wordExport";

const at = (id: string, type: Parameters<typeof createBlock>[0], pageId: string, x: number, y: number, preset: Record<string, unknown> = {}): Block => {
  const b = createBlock(type, "fr", pageId, preset);
  return { ...b, id, layout: { ...b.layout, x, y } };
};
const exam = (lang: "fr" | "ar", blocks: Block[]) => ({ version: 1, meta: { title: "T", lang }, pages: [{ id: "p1" }, { id: "p2" }], blocks }) as unknown as ExamDoc;

describe("the exam in Word", () => {
  it("reads the blocks page by page, top to bottom, then from the start side", () => {
    const blocks = [at("c", "text", "p2", 48, 60), at("b", "shape", "p1", 400, 100), at("a", "text", "p1", 48, 100), at("top", "text", "p1", 48, 20)];
    expect(readingOrder(exam("fr", blocks)).map((p) => p.map((b) => b.id))).toEqual([["top", "a", "b"], ["c"]]);
    // (Arabic: the block on the right first)
    expect(readingOrder(exam("ar", blocks))[0].map((b) => b.id)).toEqual(["top", "b", "a"]);
  });

  it("puts what is drawn in as pictures, and writes the rest", () => {
    expect(isPictureBlock(at("i", "image", "p1", 0, 0))).toBe(true);
    expect(isPictureBlock(at("s", "shape", "p1", 0, 0))).toBe(true);
    expect(isPictureBlock(at("q", "mcq", "p1", 0, 0))).toBe(false);
    expect(isPictureBlock(at("t", "table", "p1", 0, 0))).toBe(false);
    expect(isPictureBlock(at("t", "table", "p1", 0, 0, { shapes: [{ id: "x" }] }))).toBe(true);
  });
});
