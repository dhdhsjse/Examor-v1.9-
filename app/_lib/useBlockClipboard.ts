"use client";

import { useEffect } from "react";
import { blockOfClip, clipOfBlock, heldBlock, holdBlock } from "./blockClipboard";
import { readClip, richFromParagraphs, type ClipSource } from "./richClipboard";
import type { Block } from "./types";
import type { T } from "./uiLang";

interface Options {
  selected: Block | undefined;
  active: boolean; // no dialog or studio is open over the page
  deleteBlock: (id: string) => void;
  pasteBlock: (block: Block) => void;
  addText: (rich: string) => void; // a new paragraph with this text
  notify: (message: string) => void;
  t: T;
}

// Put a block's text on the system clipboard (the Copy button; Ctrl+C writes it in the copy event itself).
async function writeSystemClipboard(clip: Required<ClipSource>) {
  try {
    await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([clip.html], { type: "text/html" }), "text/plain": new Blob([clip.text], { type: "text/plain" }) })]);
  } catch {
    try {
      await navigator.clipboard.writeText(clip.text);
    } catch {
      // (the browser did not allow it: the block is still kept in the app, and pastes there)
    }
  }
}

// Copy, cut and paste of whole blocks, for when no text is being typed in (the text editors have their own, see
// RichEditable and textboxEditor): Ctrl+C, Ctrl+X and Ctrl+V on the page, and the Clipboard buttons of the ribbon. Text on the clipboard
// that does not come from a block is pasted as a new paragraph.
export function useBlockClipboard({ selected, active, deleteBlock, pasteBlock, addText, notify, t }: Options) {
  // `data`: the clipboard of a copy event (Ctrl+C); without it (the buttons) the clipboard is written here.
  const copyBlock = (cut: boolean, data?: DataTransfer | null) => {
    if (!selected) return false;
    holdBlock(selected);
    const clip = clipOfBlock(selected);
    if (data) {
      data.setData("text/html", clip.html);
      data.setData("text/plain", clip.text);
    } else {
      void writeSystemClipboard(clip);
    }
    if (cut) deleteBlock(selected.id);
    return true;
  };

  // `src` null: the clipboard could not be read (the browser asks first): the block copied in the app is pasted, if there is one.
  const pasteClip = (src: ClipSource | null) => {
    const block = src ? blockOfClip(src) : heldBlock();
    if (block) return pasteBlock(block);
    const paragraphs = src ? readClip(src) : null;
    if (paragraphs?.length && paragraphs.some((p) => p.runs.length)) return addText(richFromParagraphs(paragraphs, true));
    notify(src ? t("Nothing to paste") : t("The browser did not allow the paste: press Ctrl+V"));
  };

  // The events of the page: not while typing (the editor or the field has its own), not with words selected somewhere (the browser copies them).
  useEffect(() => {
    // (the editors change the page while they handle an event, so this is looked at first, in the capture phase, and with the focused element too)
    const isTyping = (el: Element | null) => !!el && ((el as HTMLElement).isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "MATH-FIELD"].includes(el.tagName));
    const free = (e: Event) => active && !isTyping(e.target as Element | null) && !isTyping(document.activeElement) && !window.getSelection()?.toString();
    const onCopy = (cut: boolean) => (e: ClipboardEvent) => {
      if (!free(e) || !selected) return;
      e.preventDefault();
      copyBlock(cut, e.clipboardData);
    };
    const onPaste = (e: ClipboardEvent) => {
      if (!free(e) || !e.clipboardData) return;
      e.preventDefault();
      pasteClip({ html: e.clipboardData.getData("text/html"), text: e.clipboardData.getData("text/plain") });
    };
    const copy = onCopy(false);
    const cut = onCopy(true);
    document.addEventListener("copy", copy, true);
    document.addEventListener("cut", cut, true);
    document.addEventListener("paste", onPaste, true);
    return () => {
      document.removeEventListener("copy", copy, true);
      document.removeEventListener("cut", cut, true);
      document.removeEventListener("paste", onPaste, true);
    };
  });

  return { copyBlock: (cut: boolean) => copyBlock(cut), pasteClip };
}
