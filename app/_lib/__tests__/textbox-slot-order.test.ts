import { describe, expect, it } from "vitest";
import { createBlock } from "../blocks";
import { slotsOf } from "../textboxDoc";
import { canStepSlot, moveSlotTo, newEmbedded, stepSlot, syncEmbedded } from "../textboxSlots";
import type { Block, ExamDoc, TextboxBlock } from "../types";

const meta = { lang: "fr" } as ExamDoc["meta"];

// A text box holding two questions, one under the other, as the editor makes it.
function twoQuestions() {
  const b = createBlock("textbox", "fr", "p1", { width: 300, sizing: "auto-height" }) as TextboxBlock;
  let box: TextboxBlock = { ...b, layout: { ...b.layout, x: 40, y: 100 }, text: "", content: { type: "doc", content: [{ type: "paragraph" }] } };
  const a = newEmbedded(box, "mcq", "fr", undefined);
  const c = newEmbedded(box, "open", "fr", undefined);
  box = { ...box, content: { type: "doc", content: [{ type: "paragraph" }, ...a.slotContent, ...c.slotContent] } };
  const doc = syncEmbedded({ meta, pages: [{ id: "p1" }], blocks: [box] } as unknown as ExamDoc);
  return { doc, first: a.block.id, second: c.block.id };
}

const order = (d: ExamDoc) => slotsOf((d.blocks.find((b) => b.type === "textbox") as TextboxBlock).content!).map((s) => s.id);
const blockOf = (d: ExamDoc, id: string) => d.blocks.find((b) => b.id === id) as Block;

describe("moving the blocks of a text box above or below each other", () => {
  it("swaps two questions with the step buttons", () => {
    const { doc, first, second } = twoQuestions();
    expect(order(doc)).toEqual([first, second]);
    expect(canStepSlot(doc, first, 1)).toBe(true);
    const moved = syncEmbedded(stepSlot(doc, second, -1));
    expect(order(moved)).toEqual([second, first]);
    expect(blockOf(moved, second).layout.y).toBeLessThan(blockOf(moved, first).layout.y);
  });

  it("drops a question below the other one", () => {
    const { doc, first, second } = twoQuestions();
    const below = blockOf(doc, second).layout.y + 500;
    expect(order(moveSlotTo(doc, first, below))).toEqual([second, first]);
  });

  it("drops a question above the other one", () => {
    const { doc, first, second } = twoQuestions();
    expect(order(moveSlotTo(doc, second, blockOf(doc, first).layout.y - 5))).toEqual([second, first]);
  });

  it("stays when dropped where it was", () => {
    const { doc, first } = twoQuestions();
    const b = blockOf(doc, first);
    expect(moveSlotTo(doc, first, b.layout.y + 2)).toBe(doc);
  });
});
