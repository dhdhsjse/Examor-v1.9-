import { describe, expect, it } from "vitest";
import { fitTextboxes } from "../blockLayout";
import { createBlock } from "../blocks";
import { slotsOf } from "../textboxDoc";
import { newEmbedded, removeBlock, syncEmbedded } from "../textboxSlots";
import type { ExamDoc, TextboxBlock } from "../types";

const meta = { lang: "fr" } as ExamDoc["meta"];
const page = { id: "p1" };

function textbox(): TextboxBlock {
  const b = createBlock("textbox", "fr", "p1", { width: 300, sizing: "auto-height" }) as TextboxBlock;
  return { ...b, layout: { ...b.layout, x: 40, y: 100 }, text: "Q", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Question" }] }] } };
}

// What the editor does when a question is picked: the text gets the room, and the exam gets the block with it.
function withTable(d: ExamDoc): { doc: ExamDoc; id: string } {
  const box = d.blocks[0] as TextboxBlock;
  const { block, slotContent } = newEmbedded(box, "table", "fr", undefined);
  const content = { type: "doc", content: [...(box.content?.content ?? []), ...slotContent] };
  return { doc: syncEmbedded({ ...d, blocks: [{ ...box, content }] }), id: block.id };
}

const exam = (): ExamDoc => ({ meta, pages: [page], blocks: [textbox()] }) as unknown as ExamDoc;

describe("blocks placed in a text box", () => {
  it("joins the exam in the room kept for it, as wide as the text", () => {
    const { doc, id } = withTable(exam());
    const box = doc.blocks[0] as TextboxBlock;
    const child = doc.blocks.find((b) => b.id === id)!;
    expect(child.meta?.slot).toBe(box.id);
    expect(child.layout.width).toBe(300 - 16);
    expect(child.layout.x).toBe(40 + 8);
    expect(child.layout.y).toBeGreaterThan(100);
    expect(slotsOf(box.content!)[0].h).toBeGreaterThan(0);
  });

  it("makes the box as tall as its text and the block", () => {
    const { doc } = withTable(exam());
    const box = fitTextboxes(doc).blocks[0] as TextboxBlock;
    expect(box.layout.height).toBeGreaterThan(slotsOf(box.content!)[0].h);
  });

  it("follows its box when the box moves", () => {
    const { doc, id } = withTable(exam());
    const moved = syncEmbedded({ ...doc, blocks: doc.blocks.map((b) => (b.type === "textbox" ? { ...b, layout: { ...b.layout, y: 400 } } : b)) });
    const before = doc.blocks.find((b) => b.id === id)!.layout.y;
    expect(moved.blocks.find((b) => b.id === id)!.layout.y).toBe(before + 300);
  });

  it("is settled: syncing again changes nothing", () => {
    const { doc } = withTable(exam());
    expect(syncEmbedded(doc)).toBe(doc);
  });

  it("goes when its place in the text goes", () => {
    const { doc, id } = withTable(exam());
    const box = doc.blocks[0] as TextboxBlock;
    const gone = syncEmbedded({ ...doc, blocks: [{ ...box, content: { type: "doc", content: [{ type: "paragraph" }] } }, ...doc.blocks.slice(1)] });
    expect(gone.blocks.find((b) => b.id === id)).toBeUndefined();
  });

  it("goes with its box", () => {
    const { doc, id } = withTable(exam());
    const gone = syncEmbedded(removeBlock(doc, doc.blocks[0].id));
    expect(gone.blocks.find((b) => b.id === id)).toBeUndefined();
  });

  it("deleting the block takes its place in the text away", () => {
    const { doc, id } = withTable(exam());
    const next = syncEmbedded(removeBlock(doc, id));
    expect(next.blocks).toHaveLength(1);
    expect(slotsOf((next.blocks[0] as TextboxBlock).content!)).toHaveLength(0);
  });

  it("a copy of the box gets its own copy of the block", () => {
    const { doc, id } = withTable(exam());
    const box = doc.blocks[0] as TextboxBlock;
    const copy = { ...structuredClone(box), id: "copy" };
    const next = syncEmbedded({ ...doc, blocks: [...doc.blocks, copy] });
    const mine = next.blocks.filter((b) => b.meta?.slot === "copy");
    expect(mine).toHaveLength(1);
    expect(mine[0].id).not.toBe(id);
    expect(next.blocks.filter((b) => b.meta?.slot === box.id)).toHaveLength(1);
  });
});
