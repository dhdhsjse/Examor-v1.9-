"use client";

import type { Editor } from "@tiptap/core";
import type { Ctx } from "@/app/_features/core/types";
import { readClip, type ClipSource, type PasteMode } from "@/app/_lib/richClipboard";
import type { RichSession } from "@/app/_lib/richSession";
import type { DocParagraph } from "@/app/_lib/textboxDoc";
import * as cmd from "@/app/_lib/textboxEditor";

// The Clipboard group of the ribbon: what Copy, Cut and Paste do on the text being typed in (the selected words, with their
// formatting: the editors' own copy and paste, see RichEditable and textboxEditor) or, with a block selected, on the block.
export interface ClipboardTarget {
  canCopy: boolean; // words are selected, or a block
  copy: () => void;
  cut: () => void;
  paste: (mode?: PasteMode) => void; // `mode`: what the paste keeps (Paste ▾); missing = by where it comes from
}

// The clipboard as the browser lets a page read it: only after a click, and it may ask the person first. null = it did not allow.
export async function readSystemClipboard(): Promise<ClipSource | null> {
  try {
    const src: ClipSource = {};
    if (navigator.clipboard.read) {
      for (const item of await navigator.clipboard.read()) {
        if (item.types.includes("text/html")) src.html ??= await (await item.getType("text/html")).text();
        if (item.types.includes("text/plain")) src.text ??= await (await item.getType("text/plain")).text();
      }
    } else {
      src.text = await navigator.clipboard.readText();
    }
    return src;
  } catch {
    try {
      return { text: await navigator.clipboard.readText() };
    } catch {
      return null;
    }
  }
}

// Paste into the text: read the clipboard, then hand the paragraphs to the editor.
async function pasteInto(ctx: Ctx, mode: PasteMode | undefined, into: (paragraphs: DocParagraph[], inherit: boolean) => void) {
  const src = await readSystemClipboard();
  if (!src) return ctx.shell.notify(ctx.t("The browser did not allow the paste: press Ctrl+V"));
  const paragraphs = readClip(src, mode);
  if (!paragraphs) return ctx.shell.notify(ctx.t("Nothing to paste"));
  into(paragraphs, mode === "text" || !src.html);
}

// The whole selected block.
export const blockClip = (ctx: Ctx): ClipboardTarget => ({
  canCopy: !!ctx.shell.selected,
  copy: () => ctx.shell.copyBlock(false),
  cut: () => ctx.shell.copyBlock(true),
  paste: () => void readSystemClipboard().then(ctx.shell.pasteClip),
});

// The words selected in a text box.
export const tiptapClip = (ctx: Ctx, editor: Editor, hasSelection: boolean): ClipboardTarget => ({
  canCopy: hasSelection,
  // (the editor's own copy event writes the clipboard; the button only asks for it)
  copy: () => {
    editor.view.focus();
    document.execCommand("copy");
  },
  cut: () => {
    editor.view.focus();
    document.execCommand("cut");
  },
  paste: (mode) => void pasteInto(ctx, mode, (paragraphs) => cmd.pasteParagraphs(editor, paragraphs)),
});

// The words selected in any other text.
export const richClip = (ctx: Ctx, session: RichSession): ClipboardTarget => ({
  canCopy: session.hasSelection,
  copy: () => {
    session.handle.focus();
    document.execCommand("copy");
  },
  cut: () => {
    session.handle.focus();
    document.execCommand("cut");
  },
  paste: (mode) =>
    void pasteInto(ctx, mode, (paragraphs, inherit) => {
      session.handle.focus();
      session.handle.paste(paragraphs, inherit);
    }),
});
