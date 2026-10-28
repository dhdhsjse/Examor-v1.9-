// Copying a whole block (Ctrl+C or the Copy button of the ribbon with a block selected and no text being typed in). The block
// is kept here, and in the browser's storage so that it survives a reload and can be pasted in another exam; the system
// clipboard gets its text (for other programs) and the id of the block, which says that the clipboard still is our copy.

import type { ClipSource } from "./richClipboard";
import { plainText } from "./richText";
import type { Block } from "./types";

const KEY = "examBuilder.clipboardBlock";
let held: Block | null = null;

export function holdBlock(block: Block): void {
  held = structuredClone(block);
  try {
    localStorage.setItem(KEY, JSON.stringify(held));
  } catch {
    // (storage full or blocked: the copy still works until the page is closed)
  }
}

export function heldBlock(): Block | null {
  if (held) return held;
  try {
    const raw = localStorage.getItem(KEY);
    held = raw ? (JSON.parse(raw) as Block) : null;
  } catch {
    held = null;
  }
  return held;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** What copying the block puts on the system clipboard: its text for other programs, and its id. */
export function clipOfBlock(block: Block): Required<ClipSource> {
  const text = block.type === "text" || block.type === "textbox" ? plainText(block.text) : "";
  return { text, html: `<div data-examor-block="${block.id}">${esc(text).replace(/\n/g, "<br>")}</div>` };
}

/** The block a clipboard carries, when it still is our copy of it (nothing was copied since); null otherwise. */
export function blockOfClip(src: ClipSource): Block | null {
  const m = /data-examor-block="([^"]+)"/.exec(src.html ?? "");
  const block = m ? heldBlock() : null;
  return block && block.id === m?.[1] ? block : null;
}
