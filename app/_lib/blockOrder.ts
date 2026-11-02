import type { Block, BlockType } from "./types";

// Objects placed freely on the page (a text box, a picture, a shape, a graph, a table, an equation) may lie on top of each other. The
// questions and the text blocks flow down the page instead: dropping one on another pushes the other down (see pushDownOverlaps).
const FLOATING: BlockType[] = ["textbox", "shape", "image", "equation", "graph", "table"];
export const isFloating = (b: Block) => FLOATING.includes(b.type);

// How a block moves through the layers: to the very top / bottom, or past the next block it overlaps.
export type BlockOrder = "front" | "back" | "forward" | "backward";

// The layers are the order of the blocks in the document: the last one is drawn on top. `heights` are the drawn heights.
const covers = (a: Block, b: Block, heights: Map<string, number>) =>
  a.layout.pageId === b.layout.pageId &&
  a.layout.x < b.layout.x + b.layout.width &&
  b.layout.x < a.layout.x + a.layout.width &&
  a.layout.y < b.layout.y + (heights.get(b.id) ?? 0) &&
  b.layout.y < a.layout.y + (heights.get(a.id) ?? 0);

// The blocks with a block moved in the layers (the same array when it does not move).
export function reorderBlock(blocks: Block[], id: string, order: BlockOrder, heights: Map<string, number>): Block[] {
  const from = blocks.findIndex((b) => b.id === id);
  if (from < 0) return blocks;
  const me = blocks[from];
  let to = from;
  if (order === "front") to = blocks.length - 1;
  else if (order === "back") to = 0;
  else {
    // One step = past the next block that is in its way, not past every block of the other pages
    const step = order === "forward" ? 1 : -1;
    for (let i = from + step; i >= 0 && i < blocks.length; i += step) {
      if (covers(me, blocks[i], heights)) {
        to = i;
        break;
      }
    }
  }
  if (to === from) return blocks;
  const next = [...blocks];
  next.splice(from, 1);
  next.splice(to, 0, me);
  return next;
}

// The blocks under a point of a page (page pixels), the one on top first.
export function blocksAt(blocks: Block[], heights: Map<string, number>, pageId: string, x: number, y: number): Block[] {
  return blocks
    .filter((b) => b.layout.pageId === pageId && x >= b.layout.x && x <= b.layout.x + b.layout.width && y >= b.layout.y && y <= b.layout.y + Math.max(heights.get(b.id) ?? 0, 4))
    .reverse();
}

// Alt+click: the block under the one selected (or the top one when it is not among them), back to the top after the last.
export function nextUnder(stack: Block[], selectedId: string | null): Block | undefined {
  const at = stack.findIndex((b) => b.id === selectedId);
  return stack[at < 0 ? 0 : (at + 1) % stack.length];
}
