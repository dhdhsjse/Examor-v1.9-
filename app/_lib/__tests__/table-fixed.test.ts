import { describe, expect, it } from "vitest";
import { studioBlock, studioTableOf, tablePatch, tablePreset } from "../../_components/table-studio/tablePreset";
import { blockHeight, layoutTable, tableFrame, tableHeight } from "../blockLayout";
import { editRegions } from "../editRegions";
import { findAll, replaceAll } from "../findReplace";
import { newPictureItem, newShapeItem } from "../shapes";
import { fixedScale, isFixedTable } from "../table";
import type { ExamMeta, TableBlock } from "../types";

const fr: ExamMeta = { title: "t", lang: "fr", templateId: "x" };
const layout = { pageId: "p", x: 0, y: 0, width: 400, height: 0 };
const table = (extra: Partial<TableBlock> = {}): TableBlock => ({ id: "t", type: "table", cells: [["a", "b"], ["c", "d"]], header: true, layout, ...extra });
const over = () => newShapeItem("rect", { x: 10, y: 5, w: 50, h: 20 });
const picture = () => newPictureItem({ src: "data:image/png;base64,AAAA", ratio: 2 }, { w: 400, h: 100 });

describe("a table with shapes or pictures over it", () => {
  it("is fixed like a picture: only a table that has some is", () => {
    expect(isFixedTable(table())).toBe(false);
    expect(isFixedTable(table({ shapes: [] }))).toBe(false);
    expect(isFixedTable(table({ shapes: [over()] }))).toBe(true);
    expect(isFixedTable(table({ shapes: [picture()] }))).toBe(true);
  });

  it("is scaled from the width they were put in to the width of the block", () => {
    const b = table({ shapes: [over()], base: 800 });
    expect(fixedScale(b, 400)).toBe(0.5);
    expect(fixedScale(b, 800)).toBe(1);
    expect(fixedScale(b, 1200)).toBe(1.5);
    expect(fixedScale(table({ base: 800 }), 400)).toBe(1); // (nothing over it: not fixed)
    expect(fixedScale(table({ shapes: [over()] }), 400)).toBe(1); // (made before the base existed: drawn as it was)
    expect(fixedScale(b, 0)).toBe(1);
  });

  it("is laid out at that width and as high as it is drawn, whatever the block's width", () => {
    const wide = table({ shapes: [over()], base: 800, layout: { ...layout, width: 800 } });
    const small = { ...wide, layout: { ...layout, width: 400 } };
    const frame = tableFrame(small);
    expect(frame.k).toBe(0.5);
    expect(frame.block.layout.width).toBe(800);
    expect(layoutTable(frame.block, fr).colW).toEqual(layoutTable(wide, fr).colW); // (the same columns: the table does not change shape)
    expect(tableHeight(small, fr)).toBeCloseTo(tableHeight(wide, fr) * 0.5);
    expect(blockHeight(small, 1, fr)).toBeCloseTo(blockHeight(wide, 1, fr) * 0.5);
  });

  it("is as high as the lowest shape or picture, scaled", () => {
    const low = newShapeItem("rect", { x: 0, y: 300, w: 50, h: 40 });
    const b = table({ shapes: [low], base: 800, layout: { ...layout, width: 400 } });
    expect(tableHeight(b, fr)).toBeGreaterThanOrEqual(340 * 0.5);
  });

  it("is a table like any other when it has none, or is at the width it was made in", () => {
    const plain = table();
    expect(tableFrame(plain)).toEqual({ block: plain, k: 1 });
    expect(tableFrame(table({ shapes: [over()], base: 400 })).k).toBe(1);
  });

  it("has nothing to type in on the page: its cells are changed in the Table Studio", () => {
    expect(editRegions(table(), 1, fr, "exam")).toHaveLength(4);
    expect(editRegions(table({ shapes: [over()], base: 400 }), 1, fr, "exam")).toEqual([]);
  });

  it("is left alone by find and replace", () => {
    const opts = { matchCase: false, wholeWord: false };
    const fixed = table({ id: "fixed", shapes: [over()], base: 400 });
    expect(findAll([table(), fixed], "a", opts).map((m) => m.blockId)).toEqual(["t"]);
    expect(replaceAll([table(), fixed], "a", opts, "z").patches.map((p) => p.id)).toEqual(["t"]);
  });
});

describe("what the Table Studio hands back", () => {
  const studio = (extra: Record<string, unknown> = {}) => ({ cells: [["a"]], header: true, width: 500, ...extra }) as Parameters<typeof tablePatch>[0];

  it("records the width the shapes and pictures were put in", () => {
    expect(tablePatch(studio({ shapes: [over()] }))).toMatchObject({ base: 500, layout: { width: 500 } });
    expect(tablePreset(studio({ shapes: [picture()] })).base).toBe(500);
  });

  it("takes it off when there is no shape or picture any more (the table is a plain one again)", () => {
    const patch = tablePatch(studio({ shapes: [] }));
    expect("base" in patch && patch.base).toBeUndefined();
    expect("base" in patch).toBe(true); // (the key is there, undefined: the block loses it)
    expect(tablePreset(studio()).base).toBeUndefined();
  });

  it("opens a block with its shapes and pictures, and not its base (the Studio's width is it)", () => {
    const t = studioTableOf(table({ shapes: [picture()], base: 400 }));
    expect(t.shapes).toHaveLength(1);
    expect(t.width).toBe(400);
    expect("base" in t).toBe(false);
  });

  it("makes the Studio's table a block, with or without what is over it", () => {
    const t = studio({ shapes: [over()] });
    expect(studioBlock(t, "x").shapes).toHaveLength(1);
    expect(studioBlock(t, "x", false).shapes).toBeUndefined();
    expect(studioBlock(t, "x").layout.width).toBe(500);
  });
});
