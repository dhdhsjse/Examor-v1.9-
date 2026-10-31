// Real blocks inside a text box. A question type or a table picked while a text box is being typed in is a block like any
// other (it is edited, numbered, corrected and printed as usual), but it lives in the text: the box keeps room for it
// between its paragraphs (a "blockSlot" node of its document, tiptap-slot.ts), and this file places the block in that
// room, as wide as the text, each time the document changes. The block follows its box (move, resize, another page),
// and goes when its place in the text does, or when the box does.

import type { JSONContent } from "@tiptap/core";
import { blockHeights, createBlock, type BlockPreset } from "./blocks";
import { layoutTextbox, textboxPad } from "./blockLayout";
import { newId } from "./id";
import { slotsOf, textboxDoc, updateSlots } from "./textboxDoc";
import type { Block, BlockType, ExamDoc, Lang, TextboxBlock } from "./types";

// The block types that can sit in the text of a box.
const EMBEDDABLE: BlockType[] = ["mcq", "truefalse", "blank", "open", "match", "order", "classify", "table", "graph", "equation", "image"];
export const canEmbed = (type: BlockType) => EMBEDDABLE.includes(type);

// Blocks made for a box and put in its text, not in the exam yet: the text reaches the exam first (the editor's change), and
// the next sync finds the block here. They stay, so undoing and redoing the text brings the block back with it.
const made = new Map<string, Block>();

/** A new block for the text box `box`, ready to be put in its text (`slotContent`): it joins the exam with the text that holds its place. */
export function newEmbedded(box: TextboxBlock, type: BlockType, lang: Lang, preset: BlockPreset | undefined): { block: Block; slotContent: JSONContent[] } {
  const block = createBlock(type, lang, box.layout.pageId, { ...preset, width: box.layout.width });
  block.meta = { ...block.meta, slot: box.id };
  made.set(block.id, block);
  return { block, slotContent: [{ type: "blockSlot", attrs: { blockId: block.id, h: 0 } }, { type: "paragraph" }] };
}

/** The exam without the block `id`; a block of a text box takes its place in the text with it. */
export function removeBlock(d: ExamDoc, id: string): ExamDoc {
  made.delete(id);
  return {
    ...d,
    blocks: d.blocks
      .filter((b) => b.id !== id)
      .map((b) => (b.type === "textbox" && b.content ? { ...b, content: updateSlots(b.content, (s) => (s.id === id ? null : s)) } : b)),
  };
}

const SAME_LAYOUT = (a: Block["layout"], b: Block["layout"]) =>
  a.pageId === b.pageId && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/** The exam with every block of a text box in the room of its box (the same document when everything is in place already). */
export function syncEmbedded(d: ExamDoc): ExamDoc {
  const boxes = d.blocks.filter((b): b is TextboxBlock => b.type === "textbox" && !!b.content && slotsOf(b.content).length > 0);
  if (!boxes.length && !d.blocks.some((b) => b.meta?.slot)) return d;

  const byId = new Map(d.blocks.map((b) => [b.id, b]));
  const added: Block[] = [];
  const contents = new Map<string, JSONContent>();
  const claimed = new Set<string>();

  // 1. What each box holds: its blocks exist, and are its own (a copy of a box gets copies of the blocks).
  for (const box of boxes) {
    let content = textboxDoc(box);
    const own = new Set<string>();
    const resolve = (s: { id: string; h: number }) => {
      const found = byId.get(s.id) ?? made.get(s.id);
      if (!found) return null; // its block is gone (undo, a pasted box): the room goes
      if (found.meta?.slot === box.id && !own.has(found.id)) {
        own.add(found.id);
        if (!byId.has(found.id)) added.push(found);
        return s;
      }
      const copy = { ...structuredClone(found), id: newId(), meta: { ...found.meta, slot: box.id } } as Block;
      own.add(copy.id);
      added.push(copy);
      return { ...s, id: copy.id };
    };
    content = updateSlots(content, resolve);
    if (content !== box.content) contents.set(box.id, content);
    own.forEach((id) => claimed.add(id));
  }

  // 2. A block whose place in the text is gone goes too.
  const alive = (b: Block) => !b.meta?.slot || claimed.has(b.id);
  let blocks = [...d.blocks, ...added].filter(alive);
  blocks = blocks.map((b) => (contents.has(b.id) ? ({ ...b, content: contents.get(b.id)! } as Block) : b));

  // 3. Each block as wide as the text of its box; the rooms as tall as the blocks; the blocks in their rooms.
  const widthOf = (box: TextboxBlock) => Math.max(20, box.layout.width - textboxPad(box) * 2);
  const boxById = new Map(blocks.filter((b): b is TextboxBlock => b.type === "textbox").map((b) => [b.id, b]));
  blocks = blocks.map((b) => {
    const box = b.meta?.slot ? boxById.get(b.meta.slot) : undefined;
    if (!box || b.layout.width === widthOf(box)) return b;
    return { ...b, layout: { ...b.layout, width: widthOf(box) } } as Block;
  });
  const heights = blockHeights({ ...d, blocks });
  const placed = new Map<string, Block["layout"]>();
  blocks = blocks.map((b) => {
    if (b.type !== "textbox" || !b.content || !slotsOf(b.content).length) return b;
    const content = updateSlots(b.content, (s) => ({ ...s, h: Math.round(heights.get(s.id) ?? s.h) }));
    const box: TextboxBlock = content === b.content ? b : { ...b, content };
    const L = layoutTextbox(box, d.meta);
    for (const p of L.paragraphs) {
      if (p.slot) placed.set(p.slot.id, { ...box.layout, x: box.layout.x + p.x, y: box.layout.y + L.y + p.y, width: p.width, height: 0 });
    }
    return box;
  });
  blocks = blocks.map((b) => {
    const at = placed.get(b.id);
    if (!at || !b.meta?.slot) return b;
    const layout = { ...b.layout, pageId: at.pageId, x: at.x, y: at.y };
    return SAME_LAYOUT(layout, b.layout) ? b : ({ ...b, layout } as Block);
  });

  const same = blocks.length === d.blocks.length && blocks.every((b, i) => b === d.blocks[i]);
  return same ? d : { ...d, blocks };
}
