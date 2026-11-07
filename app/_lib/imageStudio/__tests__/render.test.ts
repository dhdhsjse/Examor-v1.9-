import { describe, expect, it } from "vitest";
import type { ImageBlock } from "../../types";
import { drawingsSvg, imageEditOf, imageEditPatch, madeElsewhere } from "../render";

const block = (patch: Partial<ImageBlock> = {}): ImageBlock => ({
  id: "b1",
  type: "image",
  src: "data:image/png;base64,AAAA",
  ratio: 2,
  layout: { pageId: "p1", x: 0, y: 0, width: 300, height: 150 },
  ...patch,
} as ImageBlock);

describe("the Image Studio and its block", () => {
  it("opens a picture never edited at its size on the page", () => {
    expect(imageEditOf(block())).toEqual({ base: "data:image/png;base64,AAAA", width: 300, height: 150 });
  });

  it("opens an edited picture with what it was edited with", () => {
    const imageEdit = { base: "data:image/png;base64,BBBB", width: 300, height: 150, crop: { x: 0, y: 0, w: 100, h: 100 } };
    expect(imageEditOf(block({ imageEdit }))).toBe(imageEdit);
  });

  it("keeps the scale of the page: a cropped picture gets smaller", () => {
    const edit = { base: "x", width: 300, height: 150, crop: { x: 50, y: 0, w: 150, h: 150 } };
    const p = imageEditPatch(block(), edit, { src: "new", ratio: 1 });
    expect(p).toMatchObject({ src: "new", ratio: 1, imageEdit: edit, layout: { width: 150, height: 150 } });
  });

  it("follows the size the block was given on the page", () => {
    const before = { base: "x", width: 300, height: 150, crop: { x: 0, y: 0, w: 100, h: 50 } };
    // (the block was made twice as big on the page after its first crop)
    const b = block({ imageEdit: before, layout: { pageId: "p1", x: 0, y: 0, width: 200, height: 100 } });
    const p = imageEditPatch(b, { ...before, crop: { x: 0, y: 0, w: 150, h: 75 } }, { src: "new", ratio: 2 });
    expect(p.layout).toEqual({ width: 300, height: 150 });
  });

  it("forgets the edit when nothing is left of it", () => {
    const p = imageEditPatch(block(), { base: "x", width: 300, height: 150 }, { src: "x", ratio: 2 });
    expect(p).toMatchObject({ src: "x", imageEdit: undefined, layout: { width: 300, height: 150 } });
  });

  it("makes a library figure or a Studio's picture a plain picture once it is changed, not before", () => {
    const b = block({ figure: { id: "f", params: {} }, chartStudio: {} as ImageBlock["chartStudio"] } as Partial<ImageBlock>);
    expect(madeElsewhere(b)).toBe(true);
    expect(madeElsewhere(block())).toBe(false);
    const cropped = imageEditPatch(b, { base: "x", width: 300, height: 150, crop: { x: 0, y: 0, w: 100, h: 100 } }, { src: "new", ratio: 1 });
    expect(cropped).toHaveProperty("figure", undefined);
    expect(cropped).toHaveProperty("chartStudio", undefined);
    const untouched = imageEditPatch(b, { base: "x", width: 300, height: 150 }, { src: "x", ratio: 2 });
    expect(untouched).not.toHaveProperty("figure");
    expect(untouched).not.toHaveProperty("chartStudio");
  });

  it("draws the drawings over the part kept", () => {
    const svg = drawingsSvg({ shapes: [] }, { x: 10, y: 20, w: 100, h: 50 }, 200, 100);
    expect(svg).toContain('viewBox="10 20 100 50"');
    expect(svg).toContain('width="200" height="100"');
  });
});
