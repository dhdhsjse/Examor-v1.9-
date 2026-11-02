import { describe, expect, it } from "vitest";
import { blocksAt, isFloating, nextUnder, reorderBlock } from "../blockOrder";
import { pushDownOverlaps } from "../blocks";
import type { Block } from "../types";

// A block of a given type, enough for the layers (only `id`, `type` and `layout` matter here)
const block = (id: string, type: Block["type"], x: number, y: number, width = 100, pageId = "p1"): Block =>
  ({ id, type, layout: { pageId, x, y, width, height: 100 } }) as unknown as Block;
const heights = (blocks: Block[]) => new Map(blocks.map((b) => [b.id, 100]));
const ids = (blocks: Block[]) => blocks.map((b) => b.id);

describe("layers: the order of the blocks in the document", () => {
  const list = [block("img", "image", 0, 0), block("far", "shape", 400, 400), block("box", "textbox", 50, 50), block("shp", "shape", 60, 60)];

  it("brings to the front and sends to the back", () => {
    expect(ids(reorderBlock(list, "img", "front", heights(list)))).toEqual(["far", "box", "shp", "img"]);
    expect(ids(reorderBlock(list, "shp", "back", heights(list)))).toEqual(["shp", "img", "far", "box"]);
  });

  it("does nothing (same array) when it is there already", () => {
    expect(reorderBlock(list, "shp", "front", heights(list))).toBe(list);
    expect(reorderBlock(list, "img", "back", heights(list))).toBe(list);
    expect(reorderBlock(list, "nope", "front", heights(list))).toBe(list);
  });

  it("one layer = past the next block it overlaps, not past the ones far away", () => {
    // img is over nothing yet at index 0: forward goes past `box` (the next one that covers it), skipping `far`
    expect(ids(reorderBlock(list, "img", "forward", heights(list)))).toEqual(["far", "box", "img", "shp"]);
    expect(ids(reorderBlock(list, "shp", "backward", heights(list)))).toEqual(["img", "far", "shp", "box"]);
  });

  it("a block that overlaps nothing does not change layer", () => {
    expect(reorderBlock(list, "far", "forward", heights(list))).toBe(list);
    expect(reorderBlock(list, "far", "backward", heights(list))).toBe(list);
  });

  it("blocks of other pages are not in the way", () => {
    const two = [block("a", "image", 0, 0), block("b", "textbox", 0, 0, 100, "p2")];
    expect(reorderBlock(two, "a", "forward", heights(two))).toBe(two);
  });
});

describe("Alt+click: the blocks under a point", () => {
  const list = [block("img", "image", 0, 0), block("box", "textbox", 50, 50), block("shp", "shape", 60, 60)];
  it("lists the top block first", () => {
    expect(ids(blocksAt(list, heights(list), "p1", 70, 70))).toEqual(["shp", "box", "img"]);
    expect(ids(blocksAt(list, heights(list), "p1", 10, 10))).toEqual(["img"]);
    expect(blocksAt(list, heights(list), "p2", 70, 70)).toEqual([]);
  });
  it("goes one block down each time and back to the top", () => {
    const stack = blocksAt(list, heights(list), "p1", 70, 70);
    expect(nextUnder(stack, null)?.id).toBe("shp");
    expect(nextUnder(stack, "shp")?.id).toBe("box");
    expect(nextUnder(stack, "img")?.id).toBe("shp");
  });
});

describe("dropping a block on another one", () => {
  it("a picture and a text box lie on top of each other: nothing is pushed down", () => {
    const list = [block("img", "image", 0, 100), block("box", "textbox", 0, 100)];
    const next = pushDownOverlaps(list, "box", heights(list), 1000);
    expect(next.map((b) => b.layout.y)).toEqual([100, 100]);
    expect(isFloating(list[0]) && isFloating(list[1])).toBe(true);
  });

  it("questions still push each other down (the one dropped keeps its place)", () => {
    const list = [block("q1", "mcq", 0, 100), block("q2", "open", 0, 100)];
    const next = pushDownOverlaps(list, "q2", heights(list), 1000);
    expect(next.find((b) => b.id === "q2")?.layout.y).toBe(100);
    expect(next.find((b) => b.id === "q1")?.layout.y).toBeGreaterThanOrEqual(200);
  });
});
