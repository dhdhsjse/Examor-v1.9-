import { describe, expect, it } from "vitest";
import { fitTextboxes, layoutTextbox, sizingAfterResize, textboxFit } from "../blockLayout";
import { createBlock } from "../blocks";
import { docFromRich } from "../textboxDoc";
import type { ExamDoc, TextboxBlock } from "../types";

const meta = { lang: "fr" } as ExamDoc["meta"];

function box(text: string, patch: Partial<TextboxBlock> = {}): TextboxBlock {
  const b = createBlock("textbox", "fr", "", {}) as TextboxBlock;
  return { ...b, text, content: docFromRich(text), layout: { ...b.layout, width: 300, height: 200 }, ...patch };
}

describe("text box resizing (Figma's auto width / auto height / fixed)", () => {
  it("fixed (the default) keeps the height it was given", () => {
    expect(layoutTextbox(box("a"), meta).height).toBe(200);
    expect(textboxFit(box("a"), meta)).toBeNull();
  });

  it("auto height is just as tall as the text, in the width given", () => {
    const b = box("a", { sizing: "auto-height" });
    const L = layoutTextbox(b, meta);
    expect(L.height).toBeLessThan(200);
    expect(L.width + L.x * 2).toBe(300);
    expect(textboxFit(b, meta)).toEqual({ height: Math.round(L.height) });
  });

  it("auto width is as wide as the longest line, and never wraps it", () => {
    const short = layoutTextbox(box("ab", { sizing: "auto-width" }), meta);
    const long = layoutTextbox(box("a much longer line of text than the box was ever given room for", { sizing: "auto-width" }), meta);
    expect(short.width).toBeLessThan(long.width);
    expect(long.width + long.x * 2).toBeGreaterThan(300);
    expect(long.paragraphs[0].lines).toHaveLength(1);
  });

  it("follows the text in the same change of the document", () => {
    const b = box("ab", { sizing: "auto-width" });
    const d = { meta, pages: [], blocks: [b] } as unknown as ExamDoc;
    const fitted = fitTextboxes(d);
    expect(fitted.blocks[0].layout.width).toBeLessThan(300);
    expect(fitTextboxes(fitted)).toBe(fitted); // nothing more to change: the same document
  });

  it("dragging an edge gives up the automatic size it changes", () => {
    const auto = box("ab", { sizing: "auto-width" });
    expect(sizingAfterResize(auto, meta, { width: 500, height: layoutTextbox(auto, meta).height })).toBe("auto-height");
    expect(sizingAfterResize(auto, meta, { height: 400 })).toBe("fixed");
    const tall = box("ab", { sizing: "auto-height" });
    expect(sizingAfterResize(tall, meta, { width: 500, height: layoutTextbox(tall, meta).height })).toBe("auto-height");
    expect(sizingAfterResize(box("ab"), meta, { height: 400 })).toBeUndefined();
  });
});
