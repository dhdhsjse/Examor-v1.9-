// A real block among the paragraphs of a text box (textboxSlots.ts): a node of the document that keeps the room of the block
// (a table, a question…), which the page draws in that room. In the editor it is an empty frame of that height, so the text
// around it wraps as it will on the page. Double-clicking the frame leaves the text for the block, to edit it as usual.

import { Node } from "@tiptap/core";
import { BLOCK_SLOT } from "./textboxDoc";

export interface SlotOptions {
  onOpen: (blockId: string) => void;
}

export const BlockSlot = Node.create<SlotOptions>({
  name: BLOCK_SLOT,
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return { onOpen: () => {} };
  },

  addAttributes() {
    return { blockId: { default: "" }, h: { default: 0 } };
  },

  parseHTML() {
    return [{ tag: "div[data-block-slot]", getAttrs: (el) => ({ blockId: (el as HTMLElement).getAttribute("data-block-slot") ?? "" }) }];
  },

  renderHTML({ node }) {
    return ["div", { "data-block-slot": node.attrs.blockId, style: `height:${node.attrs.h}px` }];
  },

  renderText: () => "",

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("div");
      dom.className = "block-slot";
      dom.contentEditable = "false";
      dom.style.height = `${node.attrs.h}px`;
      dom.title = "Double-click to edit this block";
      dom.addEventListener("dblclick", () => this.options.onOpen(node.attrs.blockId));
      return {
        dom,
        update: (next) => {
          if (next.type !== node.type) return false;
          node = next;
          dom.style.height = `${next.attrs.h}px`;
          return true;
        },
      };
    };
  },
});
