import { describe, expect, it } from "vitest";
import { blockHeight, CAPTION_GAP, layoutImageCaption } from "../blockLayout";
import type { ExamMeta, ImageBlock } from "../types";

const fr: ExamMeta = { title: "t", lang: "fr", templateId: "x" };
const image = (extra: Partial<ImageBlock> = {}): ImageBlock => ({
  id: "i",
  type: "image",
  src: "",
  ratio: 2,
  layout: { pageId: "p", x: 0, y: 0, width: 300, height: 150 },
  ...extra,
});

describe("image caption", () => {
  it("an image without a caption is as tall as its picture", () => {
    expect(layoutImageCaption(image(), fr)).toBeNull();
    expect(layoutImageCaption(image({ caption: "   " }), fr)).toBeNull();
    expect(blockHeight(image(), 1, fr)).toBe(150);
  });

  it("the caption sits under the picture and makes the block taller", () => {
    const b = image({ caption: "Figure 1 : une cellule végétale" });
    const c = layoutImageCaption(b, fr)!;
    expect(c.y).toBe(150 + CAPTION_GAP);
    expect(c.lines.length).toBe(1);
    expect(c.width).toBe(300);
    expect(blockHeight(b, 1, fr)).toBe(c.y + c.height);
  });

  it("by default the caption is italic, centered and a bit smaller than the exam text", () => {
    const c = layoutImageCaption(image({ caption: "Photo" }), { ...fr, fontSize: 14 })!;
    expect(c.align).toBe("center");
    expect(c.lines[0].pieces[0].font).toMatchObject({ italic: true, bold: false, size: 12 });
  });

  it("the caption's toolbar settings change its look", () => {
    const b = image({ caption: "Photo", captionStyle: { size: 20, bold: true, italic: false, underline: true, color: "#dc2626", family: "Georgia", align: "right" } });
    const c = layoutImageCaption(b, fr)!;
    expect(c.align).toBe("right");
    expect(c.lines[0].pieces[0].font).toMatchObject({ size: 20, bold: true, italic: false, underline: true, color: "#dc2626" });
    expect(c.lines[0].pieces[0].font.family.startsWith("Georgia")).toBe(true);
    // a bigger caption makes the block taller
    expect(blockHeight(b, 1, fr)).toBeGreaterThan(blockHeight(image({ caption: "Photo" }), 1, fr));
  });

  it("a long caption wraps to the picture's width", () => {
    const b = image({ caption: "Une très longue description de la photo ".repeat(6), layout: { pageId: "p", x: 0, y: 0, width: 120, height: 60 } });
    const c = layoutImageCaption(b, fr)!;
    expect(c.lines.length).toBeGreaterThan(1);
    expect(blockHeight(b, 1, fr)).toBeGreaterThan(60 + CAPTION_GAP + c.lines[0].height);
  });
});
