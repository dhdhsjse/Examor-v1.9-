import { describe, expect, it } from "vitest";
import { createBlock, pushDownOverlaps } from "../blocks";
import type { Block, BlockType } from "../types";

const at = (type: BlockType, id: string, y: number, height = 100): Block => {
  const b = createBlock(type, "fr", "p1", {});
  return { ...b, id, layout: { ...b.layout, pageId: "p1", x: 100, y, width: 200, height } } as Block;
};
const heights = (blocks: Block[]) => new Map(blocks.map((b) => [b.id, b.layout.height]));
const yOf = (blocks: Block[], id: string) => blocks.find((b) => b.id === id)!.layout.y;

describe("dropping a block over another one", () => {
  it("a photo dropped on a shape stays where it was dropped (and the shape does not move)", () => {
    const blocks = [at("shape", "shape", 100, 300), at("image", "photo", 150)];
    const out = pushDownOverlaps(blocks, "photo", heights(blocks), 1123);
    expect(yOf(out, "photo")).toBe(150);
    expect(yOf(out, "shape")).toBe(100);
  });

  it("a photo dropped on another photo stays there", () => {
    const blocks = [at("image", "a", 100, 200), at("image", "b", 150)];
    const out = pushDownOverlaps(blocks, "b", heights(blocks), 1123);
    expect(yOf(out, "b")).toBe(150);
    expect(yOf(out, "a")).toBe(100);
  });

  it("a shape dropped on a photo leaves the photo where it is", () => {
    const blocks = [at("image", "photo", 150), at("shape", "shape", 100, 300)];
    const out = pushDownOverlaps(blocks, "shape", heights(blocks), 1123);
    expect(yOf(out, "photo")).toBe(150);
  });

  it("a photo dropped on a table stays on it (and the table does not move)", () => {
    const blocks = [at("table", "table", 100, 300), at("image", "photo", 150)];
    const out = pushDownOverlaps(blocks, "photo", heights(blocks), 1123);
    expect(yOf(out, "photo")).toBe(150);
    expect(yOf(out, "table")).toBe(100);
  });

  it("a table dropped on a photo leaves the photo where it is", () => {
    const blocks = [at("image", "photo", 150), at("table", "table", 100, 300)];
    const out = pushDownOverlaps(blocks, "table", heights(blocks), 1123);
    expect(yOf(out, "photo")).toBe(150);
  });

  it("a photo dropped on a question still goes below it", () => {
    const blocks = [at("open", "q", 100, 200), at("image", "photo", 150)];
    const out = pushDownOverlaps(blocks, "photo", heights(blocks), 1123);
    expect(yOf(out, "photo")).toBeGreaterThanOrEqual(300);
  });
});

describe("graphs, tables and pictures over a text box", () => {
  for (const type of ["graph", "table", "image"] as BlockType[]) {
    it(`a ${type} dropped on a text box stays where it was dropped (and the box does not move)`, () => {
      const blocks = [at("textbox", "box", 100, 300), at(type, "x", 150)];
      const out = pushDownOverlaps(blocks, "x", heights(blocks), 1123);
      expect(yOf(out, "x")).toBe(150);
      expect(yOf(out, "box")).toBe(100);
    });

    it(`a text box dropped on a ${type} leaves it where it is`, () => {
      const blocks = [at(type, "x", 150), at("textbox", "box", 100, 300)];
      const out = pushDownOverlaps(blocks, "box", heights(blocks), 1123);
      expect(yOf(out, "x")).toBe(150);
      expect(yOf(out, "box")).toBe(100);
    });
  }

  it("a graph dropped on a question still goes below it", () => {
    const blocks = [at("open", "q", 100, 200), at("graph", "g", 150)];
    const out = pushDownOverlaps(blocks, "g", heights(blocks), 1123);
    expect(yOf(out, "g")).toBeGreaterThanOrEqual(300);
  });

  it("a table dropped on a graph still goes below it", () => {
    const blocks = [at("graph", "g", 100, 200), at("table", "t", 150)];
    const out = pushDownOverlaps(blocks, "t", heights(blocks), 1123);
    expect(yOf(out, "t")).toBeGreaterThanOrEqual(300);
  });
});
