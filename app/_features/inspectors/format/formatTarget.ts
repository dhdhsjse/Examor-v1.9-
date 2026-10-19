"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import type { Ctx } from "@/app/_features/core/types";
import { blockFonts, textboxSpec, textSpec } from "@/app/_lib/blockLayout";
import { plainText } from "@/app/_lib/richText";
import { clearFormat, docFromRich, highlightAll, indentAll, maxIndent, richFromDoc, textboxDoc, type WholeFormat } from "@/app/_lib/textboxDoc";
import { MAX_INDENT } from "@/app/_lib/tiptap-indent";
import * as cmd from "@/app/_lib/textboxEditor";
import type { Block, BlockFont, ExamMeta, ParagraphAlign } from "@/app/_lib/types";
import type { BlockPatch } from "@/app/_lib/useExam";

export type StyleKey = cmd.StyleMark;

// What the ribbon formats: the selected words of the text box being typed in (its Tiptap editor), or the
// whole selected block. The controls only talk to this, so both work the same way.
export interface FormatTarget {
  words: boolean; // true = the selected words, false = the whole block
  family?: string; // undefined = the default font
  size: number;
  style: Record<StyleKey, boolean>;
  color: string; // shown
  colorSet?: string; // chosen (undefined = automatic)
  align?: ParagraphAlign;
  canAlign: boolean;
  highlight?: string;
  canHighlight: boolean;
  // Paragraph indent (text boxes): null = not for this block; else whether it can go further in / out.
  indent: { in: boolean; out: boolean } | null;
  setFamily: (family?: string) => void;
  setSize: (size: number) => void;
  toggle: (key: StyleKey) => void;
  setColor: (color?: string) => void;
  setAlign: (align?: ParagraphAlign) => void;
  setHighlight: (color?: string) => void;
  shiftIndent: (step: 1 | -1) => void;
}

// How the block's main text looks now (its own formatting, else the exam's).
export function shownFont(b: Block, meta: ExamMeta) {
  const s = b.type === "text" ? textSpec(b, meta) : b.type === "textbox" ? textboxSpec(b, meta) : blockFonts(b, meta).body;
  return s.font;
}

// A text box's text with a format removed from its words (the whole box gets it instead), as a patch.
const contentPatch = (b: Block, format: WholeFormat): BlockPatch => {
  if (b.type !== "textbox") return {};
  const content = clearFormat(textboxDoc(b), format);
  return { content, text: richFromDoc(content) };
};

// Change the block's own font (a value left undefined goes back to the default; nothing left = no font).
// `field`: changes of the same kind in a row are one undo step (e.g. typing a size). A text box's words
// lose the same format, so the whole box shows it (like formatting a selected shape in Word).
export function setFont(ctx: Ctx, b: Block, patch: Partial<BlockFont>, field = "font", format?: WholeFormat) {
  const next = { ...b.font, ...patch } as Record<string, unknown>;
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
  ctx.shell.updateBlock(b.id, { font: Object.keys(next).length ? (next as BlockFont) : undefined, ...(format ? contentPatch(b, format) : {}) } as BlockPatch, field);
}

const isParagraph = (b: Block) => b.type === "text" || b.type === "textbox";

// Has the block been formatted (so "Reset formatting" has something to do)?
export const isFormatted = (b: Block) =>
  !!b.font || (isParagraph(b) && !!(b as { align?: string }).align) || (b.type === "textbox" && (!!b.valign || b.text !== plainText(b.text) || !!b.content));

// Back to the exam's look: font, alignment, place in the box, and a text box's words lose their own
// formatting. (A text box keeps its fill, border and inner margin.)
export function resetFormatting(ctx: Ctx, b: Block) {
  const box: BlockPatch = b.type === "textbox" ? ({ valign: undefined, content: docFromRich(plainText(b.text)), text: plainText(b.text) } as BlockPatch) : {};
  ctx.shell.updateBlock(b.id, { font: undefined, ...(isParagraph(b) ? { align: undefined } : {}), ...box } as BlockPatch, "format-reset");
}

const STYLE_FONT: Record<StyleKey, keyof BlockFont> = { bold: "bold", italic: "italic", underline: "underline", strike: "strike" };

// The whole block.
export function blockTarget(ctx: Ctx, b: Block): FormatTarget {
  const shown = shownFont(b, ctx.doc.meta);
  const align = isParagraph(b) ? (b as { align?: ParagraphAlign }).align : undefined;
  return {
    words: false,
    family: b.font?.family,
    size: shown.size,
    style: { bold: shown.bold, italic: shown.italic, underline: shown.underline, strike: !!shown.strike },
    color: shown.color,
    colorSet: b.font?.color,
    align,
    canAlign: isParagraph(b),
    canHighlight: b.type === "textbox",
    indent: b.type === "textbox" ? { in: true, out: maxIndent(textboxDoc(b)) > 0 } : null,
    setFamily: (family) => setFont(ctx, b, { family }, "font", "family"),
    setSize: (size) => setFont(ctx, b, { size }, "font-size", "size"),
    // Bold is kept as `false` (titles are bold by default); the others go back to "off" = missing.
    toggle: (key) => {
      const on = key === "bold" ? shown.bold : key === "italic" ? shown.italic : key === "underline" ? shown.underline : !!shown.strike;
      setFont(ctx, b, { [STYLE_FONT[key]]: key === "bold" ? !on : on ? undefined : true }, `font-${key}`, key);
    },
    setColor: (color) => setFont(ctx, b, { color }, "font-color", "color"),
    setAlign: (a) => ctx.shell.updateBlock(b.id, { align: a, ...contentPatch(b, "align") } as BlockPatch, "align"),
    setHighlight: (color) => {
      if (b.type !== "textbox") return;
      const content = highlightAll(textboxDoc(b), color);
      ctx.shell.updateBlock(b.id, { content, text: richFromDoc(content) } as BlockPatch, "highlight");
    },
    // The whole box: every paragraph.
    shiftIndent: (step) => b.type === "textbox" && ctx.shell.updateBlock(b.id, { content: indentAll(textboxDoc(b), step) } as BlockPatch, "indent"),
  };
}

// The selected words of the text box being typed in. What the words don't set themselves comes from the box.
function editorTarget(ctx: Ctx, b: Block, editor: Editor, sel: cmd.SelectionFormat): FormatTarget {
  const shown = shownFont(b, ctx.doc.meta);
  const box = { bold: shown.bold, italic: shown.italic, underline: shown.underline, strike: !!shown.strike };
  const boxAlign = (b as { align?: ParagraphAlign }).align;
  return {
    words: true,
    family: sel.family ?? b.font?.family,
    size: sel.size ?? shown.size,
    style: { bold: box.bold || sel.marks.bold, italic: box.italic || sel.marks.italic, underline: box.underline || sel.marks.underline, strike: box.strike || sel.marks.strike },
    color: sel.color ?? shown.color,
    colorSet: sel.color,
    align: sel.align ?? boxAlign,
    canAlign: true,
    highlight: sel.highlight,
    canHighlight: true,
    indent: { in: sel.indent.min < MAX_INDENT, out: sel.indent.max > 0 },
    setFamily: (family) => cmd.setFamily(editor, family),
    setSize: (size) => cmd.setSize(editor, size),
    toggle: (key) => cmd.toggleStyle(editor, key, box[key], () => setFont(ctx, b, { [STYLE_FONT[key]]: key === "bold" ? false : undefined }, `font-${key}`)),
    setColor: (color) => cmd.setColor(editor, color),
    setAlign: (a) => cmd.setAlign(editor, a),
    setHighlight: (color) => cmd.setHighlight(editor, color),
    shiftIndent: (step) => (step > 0 ? cmd.indent(editor) : cmd.outdent(editor)),
  };
}

// The target of the ribbon for block `b`: its words while it is a text box being typed in (the ribbon
// follows the selection in the editor), else the whole block.
export function useFormatTarget(ctx: Ctx, b: Block | undefined): FormatTarget | null {
  const editor = b?.type === "textbox" ? ctx.shell.textEditor : null;
  const sel = useEditorState({ editor, selector: ({ editor: e }) => (e ? cmd.selectionFormat(e) : null) });
  if (!b) return null;
  return editor && sel ? editorTarget(ctx, b, editor, sel) : blockTarget(ctx, b);
}
