import { describe, expect, it } from "vitest";
import { createBlock, firstFreeY } from "../blocks";
import type { Block, BlockType } from "../types";

const at = (type: BlockType, id: string, y: number, height = 100, x = 100, width = 200): Block => {
  const b = createBlock(type, "fr", "p1", {});
  return { ...b, id, layout: { ...b.layout, pageId: "p1", x, y, width, height } } as Block;
};
const heights = (blocks: Block[]) => new Map(blocks.map((b) => [b.id, b.layout.height]));

describe("where a new block goes on a page", () => {
  it("a page emptied at the top, with a block left low on it: the new block goes at the top", () => {
    const blocks = [at("equation", "low", 900, 50)];
    expect(firstFreeY(blocks, heights(blocks), 38, 1085, 200, 100, 200)).toBe(38);
  });

  it("goes in the first gap big enough for it, under the blocks above", () => {
    const blocks = [at("text", "a", 38, 100), at("text", "b", 200, 100), at("text", "c", 600, 100)];
    // (152 → 200: too small for 100 + gaps; 314 → 600: fits)
    expect(firstFreeY(blocks, heights(blocks), 38, 1085, 100, 100, 200)).toBe(314);
  });

  it("blocks beside it (another column) do not take its room", () => {
    const blocks = [at("image", "side", 38, 500, 500, 200)];
    expect(firstFreeY(blocks, heights(blocks), 38, 1085, 100, 100, 200)).toBe(38);
  });

  it("no gap big enough: no room on that page", () => {
    const blocks = [at("text", "a", 38, 500), at("text", "b", 560, 500)];
    expect(firstFreeY(blocks, heights(blocks), 38, 1085, 200, 100, 200)).toBeNull();
  });
});
