"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { ListKind } from "@/app/_lib/lists";
import type { Direction } from "@/app/_lib/paragraphFormat";
import type { TextEffect, UnderlineStyle } from "@/app/_lib/richText";
import type { ParagraphAlign } from "@/app/_lib/types";
import type { FormatTarget, ParagraphTarget, Script } from "./formatTarget";

// The Format Painter of the Clipboard group: copy the look of some text, then paint it on words selected afterwards. One use
// (a click on the button) or until Esc (a double click). Like Word, the paragraph's formatting comes along when it was copied
// from a cursor in it (or from a whole block), not from selected words.

export interface CopiedFormat {
  char: { family?: string; size: number; bold: boolean; italic: boolean; underline: boolean; underlineStyle?: UnderlineStyle; strike: boolean; script?: Script; color?: string; highlight?: string; effect?: TextEffect };
  para?: { align?: ParagraphAlign; list?: ListKind; level: number; dir?: Direction; lineHeight: number; spaceBefore: number; spaceAfter: number; shading?: string; border?: string; borderColor?: string };
}

/** The look of what the target formats now. */
export function captureFormat(t: Omit<FormatTarget, "capture" | "paint">): CopiedFormat {
  const p = t.para;
  const wholeParagraph = t.engine === "block" || !t.clip.canCopy; // (a block, or a cursor: nothing selected)
  return {
    char: { family: t.family, size: t.size, bold: t.style.bold, italic: t.style.italic, underline: t.style.underline, underlineStyle: t.underlineStyle, strike: t.style.strike, script: t.script, color: t.colorSet, highlight: t.highlight, effect: t.effect },
    ...(wholeParagraph ? { para: { align: p.align, list: p.list, level: p.level, dir: p.dir, lineHeight: p.lineHeight, spaceBefore: p.spaceBefore, spaceAfter: p.spaceAfter, shading: p.shading, border: p.border, borderColor: p.borderColor } } : {}),
  };
}

/** Paint the copied look on the selected words of the target (only what is different: the words keep what already matches). */
export function paintWords(t: Omit<FormatTarget, "capture" | "paint">, f: CopiedFormat): void {
  const c = f.char;
  if (c.family !== t.family) t.setFamily(c.family);
  if (c.size !== t.size) t.setSize(c.size);
  for (const key of ["bold", "italic", "underline", "strike"] as const) if (c[key] !== t.style[key]) t.toggle(key);
  if (c.underline && c.underlineStyle !== t.underlineStyle) t.setUnderline(c.underlineStyle ?? "single");
  if (c.effect !== t.effect) t.setEffect(c.effect);
  if (c.script !== t.script) {
    if (c.script) t.toggleScript(c.script);
    else if (t.script) t.toggleScript(t.script);
  }
  if (c.color !== t.colorSet) t.setColor(c.color);
  if (c.highlight !== t.highlight) t.setHighlight(c.highlight);
  if (f.para) paintParagraph(t.para, f.para);
}

/** Give the paragraphs of the target the copied paragraph formatting (only what is different, and what the block can have). */
export function paintParagraph(para: ParagraphTarget, p: NonNullable<CopiedFormat["para"]>): void {
  const { can } = para;
  if (can.align && p.align !== para.align) para.setAlign(p.align);
  if (can.list && p.list !== para.list) para.setList(p.list ?? null);
  if (can.indent && p.level !== para.level) para.setLevel(p.level);
  if (can.dir && p.dir !== para.dir) para.setDirection(p.dir ?? null);
  if (can.line && p.lineHeight !== para.lineHeight) para.setLineHeight(p.lineHeight === 1 ? null : p.lineHeight);
  if (can.space && (p.spaceBefore !== para.spaceBefore || p.spaceAfter !== para.spaceAfter)) para.setSpace({ before: p.spaceBefore, after: p.spaceAfter });
  if (can.shading && p.shading !== para.shading) para.setShading(p.shading ?? null);
  if (can.border && (p.border !== para.border || p.borderColor !== para.borderColor)) para.setBorder(p.border ?? "", p.borderColor);
}

// ---- the painter being armed ----

export interface Painter {
  format: CopiedFormat;
  sticky: boolean; // keeps painting until Esc
}

let current: Painter | null = null;
let latest: FormatTarget | null = null; // what the ribbon on the screen formats now (see useFormatPainter)
const listeners = new Set<() => void>();

// While the painter is armed: the cursor is a brush, Esc puts it down, and the words selected with the mouse in the text on the
// page get the look. This is the store's, not a ribbon's, so it goes on when the panel changes (a paragraph's ribbon, then a text
// box's). A press in the ribbon itself does nothing: its buttons format the selection as usual.
const up = (e: MouseEvent) => {
  if ((e.target as Element | null)?.closest?.("[data-text-format]")) return;
  // (the editors take a moment to know what was selected)
  setTimeout(() => {
    const painter = current;
    const t = latest;
    if (!painter || !t?.paint || !t.words || !t.clip.canCopy) return;
    t.paint(painter.format);
    if (!painter.sticky) painterStore.clear();
  }, 80);
};
const key = (e: KeyboardEvent) => {
  if (e.key !== "Escape") return;
  e.stopPropagation();
  e.preventDefault();
  painterStore.clear();
};

const set = (next: Painter | null) => {
  const was = !!current;
  current = next;
  if (next && !was) {
    document.body.dataset.painter = "on";
    document.addEventListener("mouseup", up, true);
    document.addEventListener("keydown", key, true);
  } else if (!next && was) {
    delete document.body.dataset.painter;
    document.removeEventListener("mouseup", up, true);
    document.removeEventListener("keydown", key, true);
  }
  for (const l of listeners) l();
};

export const painterStore = {
  get: () => current,
  arm: (format: CopiedFormat, sticky: boolean) => set({ format, sticky }),
  clear: () => current && set(null),
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};

export const usePainter = (): Painter | null => useSyncExternalStore(painterStore.subscribe, painterStore.get, () => null);

/** The ribbon tells the painter what it formats now (the selected words), so the painter paints them when the mouse selects some. */
export function useFormatPainter(target: FormatTarget): void {
  useEffect(() => {
    latest = target;
    return () => {
      if (latest === target) latest = null;
    };
  });
}
