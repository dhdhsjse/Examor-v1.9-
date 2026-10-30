"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import type { Ctx } from "@/app/_features/core/types";
import { caseBlock, highlightBlock, isTextual, paragraphsBlock, scriptBlock, sortBlock, styleBlock, wholeStyle } from "@/app/_lib/blockText";
import { blockFonts, textboxSpec, textSpec } from "@/app/_lib/blockLayout";
import { isRtl } from "@/app/_lib/i18n";
import type { ListKind } from "@/app/_lib/lists";
import { cleanSides, type Direction, type ParagraphFormat } from "@/app/_lib/paragraphFormat";
import { useRichSession, type RichSession } from "@/app/_lib/richSession";
import { plainText, type RunStyle, type StylePatch, type TextEffect, type UnderlineStyle } from "@/app/_lib/richText";
import type { CaseMode } from "@/app/_lib/textCase";
import { clearFormat, docFromRich, docParagraphs, richFromDoc, textboxDoc, type WholeFormat } from "@/app/_lib/textboxDoc";
import * as cmd from "@/app/_lib/textboxEditor";
import { MAX_INDENT } from "@/app/_lib/tiptap-indent";
import type { Block, BlockFont, ExamMeta, ParagraphAlign, TextboxBlock } from "@/app/_lib/types";
import type { BlockPatch } from "@/app/_lib/useExam";
import { blockClip, richClip, tiptapClip, type ClipboardTarget } from "./clipboardTargets";
import { captureFormat, paintWords, type CopiedFormat } from "./painter";

export type StyleKey = cmd.StyleMark;
export type Script = cmd.Script;

// Where the formatting goes: the selected words of a text box being typed in (its Tiptap editor), the selected words of
// any other text being typed in (the plain-text editor), or the whole selected block.
export type Engine = "tiptap" | "rich" | "block";

// The paragraph part of the ribbon. What a block cannot have (a question has no lists, a text no space between its
// paragraphs…) is false in `can`, and its buttons are off.
export interface ParagraphTarget {
  can: { align: boolean; list: boolean; indent: boolean; dir: boolean; line: boolean; space: boolean; shading: boolean; border: boolean; sort: boolean };
  align?: ParagraphAlign;
  list?: ListKind;
  indent: { in: boolean; out: boolean }; // whether it can go further in / out
  level: number; // the indent, in levels
  dir?: Direction; // its own; undefined = the exam's
  dirShown: Direction; // the one it is written in
  lineHeight: number; // times the normal line
  spaceBefore: number; // px
  spaceAfter: number;
  shading?: string;
  border?: string; // the sides that have a line: some of "t", "b", "l", "r"
  borderColor?: string;
  setAlign: (align?: ParagraphAlign) => void;
  setList: (list: ListKind | null) => void;
  shiftIndent: (step: 1 | -1) => void;
  setLevel: (level: number) => void;
  setDirection: (dir: Direction | null) => void;
  setLineHeight: (lineHeight: number | null) => void; // null = the normal line
  setSpace: (space: { before?: number; after?: number }) => void;
  setShading: (color: string | null) => void;
  setBorder: (sides: string, color?: string) => void; // no sides = no border
  sort: (order: "asc" | "desc") => void;
}

// What the ribbon formats. The controls only talk to this, so the three engines work the same way.
export interface FormatTarget {
  engine: Engine;
  words: boolean; // true = the selected words, false = the whole block
  family?: string; // undefined = the default font
  size: number;
  style: Record<StyleKey, boolean>;
  underlineStyle?: UnderlineStyle; // the kind of underline when it is not a single line
  setUnderline: (kind: UnderlineStyle | "single" | null) => void; // the kind of underline of the words (null = none)
  canUnderlineStyle: boolean;
  effect?: TextEffect;
  setEffect: (effect?: TextEffect) => void;
  canEffect: boolean;
  script?: Script;
  canScript: boolean;
  color: string; // shown
  colorSet?: string; // chosen (undefined = automatic)
  highlight?: string;
  canHighlight: boolean;
  setFamily: (family?: string) => void;
  setSize: (size: number) => void;
  toggle: (key: StyleKey) => void;
  toggleScript: (script: Script) => void;
  setColor: (color?: string) => void;
  setHighlight: (color?: string) => void;
  changeCase: (mode: CaseMode | "cycle") => void;
  canChangeCase: boolean;
  clearFormatting: () => void;
  para: ParagraphTarget;
  clip: ClipboardTarget;
  insertText?: (text: string) => void; // type this where the cursor is in the text being typed in (the symbols); missing = nothing is being typed
  capture: () => CopiedFormat; // the look of this text, for the Format Painter
  paint?: (format: CopiedFormat) => void; // paint a look on the selected words (the words engines only)
}

const withCapture = (t: Omit<FormatTarget, "capture">): FormatTarget => ({ ...t, capture: () => captureFormat(t) });

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

// What a text block keeps for its paragraph formatting (a text box keeps it in its paragraphs).
const PARAGRAPH_FIELDS = { indent: undefined, list: undefined, dir: undefined, shading: undefined, border: undefined, borderColor: undefined };

// Has the block been formatted (so "Clear all formatting" has something to do)?
export const isFormatted = (b: Block) =>
  !!b.font ||
  (b.type === "text" && (!!b.align || !!b.list || !!b.indent || !!b.dir || !!b.shading || !!b.border || b.text !== plainText(b.text))) ||
  (b.type === "textbox" && (!!b.align || !!b.dir || !!b.valign || b.text !== plainText(b.text) || !!b.content));

// Back to the exam's look: font, alignment, direction, place in the box, list, indent, shading, borders, and the words lose their
// own formatting. (A text box keeps its fill, border and inner margin.)
export function resetFormatting(ctx: Ctx, b: Block) {
  const plain = b.type === "text" || b.type === "textbox" ? plainText(b.text) : undefined;
  const patch: BlockPatch =
    b.type === "textbox"
      ? ({ valign: undefined, dir: undefined, content: docFromRich(plain ?? ""), text: plain } as BlockPatch)
      : b.type === "text"
        ? ({ ...PARAGRAPH_FIELDS, text: plain } as BlockPatch)
        : {};
  ctx.shell.updateBlock(b.id, { font: undefined, ...(isParagraph(b) ? { align: undefined } : {}), ...patch } as BlockPatch, "format-reset");
}

const STYLE_FONT: Record<StyleKey, keyof BlockFont> = { bold: "bold", italic: "italic", underline: "underline", strike: "strike" };
const RUN_KEY: Record<StyleKey, "b" | "i" | "u" | "x"> = { bold: "b", italic: "i", underline: "u", strike: "x" };

// The value the items share (undefined when they differ, or there are none).
const common = <T,>(values: T[]): T | undefined => (values.length && values.every((v) => v === values[0]) ? values[0] : undefined);

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max));
const examDirection = (meta: ExamMeta): Direction => (isRtl(meta.lang) ? "rtl" : "ltr");

// ---- the whole block ----

function blockParagraph(ctx: Ctx, b: Block): ParagraphTarget {
  const { shell, doc } = ctx;
  const text = b.type === "text" ? b : null;
  const box = b.type === "textbox" ? b : null;
  const paragraphs = box ? docParagraphs(textboxDoc(box)) : [];
  const own = <K extends keyof ParagraphFormat>(key: K) => common(paragraphs.map((p) => p[key]));
  const levels = box && paragraphs.length ? paragraphs.map((p) => p.indent) : [text?.indent ?? 0];
  const dir = text ? text.dir : box ? (own("dir") ?? box.dir) : undefined;
  const border = text ? text.border : box ? own("border") : undefined;
  const textual = !!text || !!box;

  // A text block keeps these in itself; a text box in each of its paragraphs.
  const set = (field: string, changes: Partial<Record<keyof ParagraphFormat, unknown>>, patch: BlockPatch) => {
    if (text) shell.updateBlock(text.id, patch, field);
    else if (box) shell.updateBlock(box.id, paragraphsBlock(box, changes), field);
  };
  const orUndefined = <V,>(v: V | null | undefined | "") => (v === null || v === "" ? undefined : v);

  return {
    can: { align: textual, list: textual, indent: textual, dir: textual, line: true, space: !!box, shading: textual, border: textual, sort: textual },
    align: text?.align ?? box?.align,
    list: text ? text.list : own("list"),
    indent: { in: Math.min(...levels) < MAX_INDENT, out: Math.max(...levels) > 0 },
    level: Math.min(...levels),
    dir,
    dirShown: dir ?? examDirection(doc.meta),
    lineHeight: b.font?.lineHeight ?? (box ? own("lineHeight") : undefined) ?? 1,
    spaceBefore: box ? (own("spaceBefore") ?? 0) : 0,
    spaceAfter: box ? (own("spaceAfter") ?? 0) : 0,
    shading: text ? text.shading : own("shading"),
    border: cleanSides(border) || undefined,
    borderColor: text ? text.borderColor : own("borderColor"),
    // The alignment and the direction of a text box are the box's (its paragraphs lose their own, like a format of the whole box).
    setAlign: (align) => shell.updateBlock(b.id, { align, ...contentPatch(b, "align") } as BlockPatch, "align"),
    setList: (list) => set("list", { list }, { list: orUndefined(list) } as BlockPatch),
    shiftIndent: (step) => {
      if (text) shell.updateBlock(text.id, { indent: clamp((text.indent ?? 0) + step, 0, MAX_INDENT) || undefined } as BlockPatch, "indent");
      else if (box) shell.updateBlock(box.id, paragraphsBlock(box, (p) => ({ indent: clamp(p.indent + step, 0, MAX_INDENT) })), "indent");
    },
    setLevel: (level) => {
      const n = clamp(level, 0, MAX_INDENT);
      if (text) shell.updateBlock(text.id, { indent: n || undefined } as BlockPatch, "indent");
      else if (box) shell.updateBlock(box.id, paragraphsBlock(box, { indent: n }), "indent");
    },
    setDirection: (d) => shell.updateBlock(b.id, { dir: d ?? undefined, ...contentPatch(b, "dir") } as BlockPatch, "dir"),
    setLineHeight: (n) => setFont(ctx, b, { lineHeight: n && n !== 1 ? n : undefined }, "line-height", "lineHeight"),
    setSpace: (space) =>
      box &&
      shell.updateBlock(
        box.id,
        paragraphsBlock(box, { ...(space.before !== undefined ? { spaceBefore: space.before || undefined } : {}), ...(space.after !== undefined ? { spaceAfter: space.after || undefined } : {}) }),
        "space",
      ),
    setShading: (color) => set("shading", { shading: color }, { shading: orUndefined(color) } as BlockPatch),
    setBorder: (sides, color) => {
      const clean = cleanSides(sides);
      set("border", { border: clean || undefined, borderColor: clean ? color : undefined }, { border: clean || undefined, borderColor: clean ? color : undefined } as BlockPatch);
    },
    sort: (order) => {
      const patch = isTextual(b) ? sortBlock(b, order, doc.meta.lang) : null;
      if (patch) shell.updateBlock(b.id, patch, "sort");
    },
  };
}

// The whole block.
export function blockTarget(ctx: Ctx, b: Block): FormatTarget {
  const shown = shownFont(b, ctx.doc.meta);
  const textual = isTextual(b);
  const whole: RunStyle = textual ? wholeStyle(b) : {};
  const edit = (patch: BlockPatch | null, field: string) => patch && ctx.shell.updateBlock(b.id, patch, field);
  // (a kind of underline, like an effect, belongs to the words: the whole block gives it to every word, and keeps no underline of its own)
  const setUnderline = (kind: UnderlineStyle | "single" | null) => {
    if (!isTextual(b)) return;
    const font = { ...b.font };
    delete font.underline;
    const patch = styleBlock(b, kind === null ? { u: null } : kind === "single" ? { u: true, ul: null } : { ul: kind });
    ctx.shell.updateBlock(b.id, { ...patch, font: Object.keys(font).length ? font : undefined } as BlockPatch, "underline");
  };
  return withCapture({
    engine: "block",
    words: false,
    family: b.font?.family,
    size: shown.size,
    style: { bold: shown.bold, italic: shown.italic, underline: shown.underline || !!whole.u, strike: !!shown.strike },
    underlineStyle: whole.ul,
    setUnderline,
    canUnderlineStyle: textual,
    effect: whole.fx,
    setEffect: (effect) => textual && edit(styleBlock(b, { fx: effect ?? null }), "effect"),
    canEffect: textual,
    script: whole.sub ? "sub" : whole.sup ? "sup" : undefined,
    canScript: textual,
    color: shown.color,
    colorSet: b.font?.color,
    highlight: whole.hl,
    canHighlight: textual,
    setFamily: (family) => setFont(ctx, b, { family }, "font", "family"),
    setSize: (size) => setFont(ctx, b, { size }, "font-size", "size"),
    // Bold is kept as `false` (titles are bold by default); the others go back to "off" = missing.
    toggle: (key) => {
      if (key === "underline" && whole.u) return setUnderline(null); // (every word is underlined: that is what goes)
      const on = key === "bold" ? shown.bold : key === "italic" ? shown.italic : key === "underline" ? shown.underline : !!shown.strike;
      setFont(ctx, b, { [STYLE_FONT[key]]: key === "bold" ? !on : on ? undefined : true }, `font-${key}`, key);
    },
    toggleScript: (script) => textual && edit(scriptBlock(b, whole[script] ? undefined : script), "script"),
    setColor: (color) => setFont(ctx, b, { color }, "font-color", "color"),
    setHighlight: (color) => textual && edit(highlightBlock(b, color), "highlight"),
    changeCase: (mode) => textual && edit(caseBlock(b, mode), "case"),
    canChangeCase: textual,
    clearFormatting: () => resetFormatting(ctx, b),
    para: blockParagraph(ctx, b),
    clip: blockClip(ctx),
  });
}

// ---- the selected words of a text box ----

function tiptapParagraph(ctx: Ctx, b: Block, editor: Editor, sel: cmd.SelectionFormat): ParagraphTarget {
  const box = b as TextboxBlock;
  return {
    can: { align: true, list: true, indent: true, dir: true, line: true, space: true, shading: true, border: true, sort: true },
    align: sel.align ?? box.align,
    list: sel.list,
    indent: { in: sel.indent.min < MAX_INDENT, out: sel.indent.max > 0 },
    level: sel.indent.min,
    dir: sel.dir ?? box.dir,
    dirShown: sel.dir ?? box.dir ?? examDirection(ctx.doc.meta),
    lineHeight: sel.lineHeight ?? b.font?.lineHeight ?? 1,
    spaceBefore: sel.spaceBefore ?? 0,
    spaceAfter: sel.spaceAfter ?? 0,
    shading: sel.shading,
    border: sel.border,
    borderColor: sel.borderColor,
    setAlign: (a) => cmd.setAlign(editor, a),
    setList: (list) => cmd.setList(editor, list),
    shiftIndent: (step) => (step > 0 ? cmd.indent(editor) : cmd.outdent(editor)),
    setLevel: (level) => cmd.setParagraphs(editor, { indent: clamp(level, 0, MAX_INDENT) }),
    setDirection: (d) => cmd.setDirection(editor, d),
    setLineHeight: (n) => cmd.setLineHeight(editor, n && n !== 1 ? n : null),
    setSpace: (space) => cmd.setSpace(editor, space),
    setShading: (color) => cmd.setShading(editor, color),
    setBorder: (sides, color) => cmd.setBorder(editor, sides, color),
    sort: (order) => cmd.sortParagraphs(editor, order, ctx.doc.meta.lang),
  };
}

// What the words don't set themselves comes from the box.
function tiptapTarget(ctx: Ctx, b: Block, editor: Editor, sel: cmd.SelectionFormat): FormatTarget {
  const shown = shownFont(b, ctx.doc.meta);
  const box = { bold: shown.bold, italic: shown.italic, underline: shown.underline, strike: !!shown.strike };
  const target: Omit<FormatTarget, "capture" | "paint"> = {
    engine: "tiptap",
    words: true,
    family: sel.family ?? b.font?.family,
    size: sel.size ?? shown.size,
    style: { bold: box.bold || sel.marks.bold, italic: box.italic || sel.marks.italic, underline: box.underline || sel.marks.underline, strike: box.strike || sel.marks.strike },
    underlineStyle: sel.underlineStyle,
    setUnderline: (kind) => cmd.setUnderlineKind(editor, kind),
    canUnderlineStyle: true,
    effect: sel.effect,
    setEffect: (effect) => cmd.setTextEffect(editor, effect),
    canEffect: true,
    script: sel.script,
    canScript: true,
    color: sel.color ?? shown.color,
    colorSet: sel.color,
    highlight: sel.highlight,
    canHighlight: true,
    setFamily: (family) => cmd.setFamily(editor, family),
    setSize: (size) => cmd.setSize(editor, size),
    toggle: (key) => cmd.toggleStyle(editor, key, box[key], () => setFont(ctx, b, { [STYLE_FONT[key]]: key === "bold" ? false : undefined }, `font-${key}`)),
    toggleScript: (script) => cmd.toggleScript(editor, script),
    setColor: (color) => cmd.setColor(editor, color),
    setHighlight: (color) => cmd.setHighlight(editor, color),
    changeCase: (mode) => (mode === "cycle" ? cmd.cycleCaseOf(editor) : cmd.changeCase(editor, mode)),
    canChangeCase: true,
    clearFormatting: () => cmd.clearAll(editor),
    para: tiptapParagraph(ctx, b, editor, sel),
    clip: tiptapClip(ctx, editor, !sel.empty),
    insertText: (text) => void editor.chain().focus().insertContent(text).run(),
  };
  return withCapture({ ...target, paint: (f) => paintWords(target, f) });
}

// ---- the selected words of any other text ----

// The words go through the plain-text editor on the page; the paragraph is the block's (a text block has lists, indent…).
function richTarget(ctx: Ctx, b: Block, session: RichSession): FormatTarget {
  const base = blockTarget(ctx, b);
  const st = session.style;
  const h = session.handle;
  const target: Omit<FormatTarget, "capture" | "paint"> = {
    ...base,
    engine: "rich",
    words: true,
    family: st.font ?? base.family,
    size: st.size ?? base.size,
    style: { bold: base.style.bold || !!st.b, italic: base.style.italic || !!st.i, underline: base.style.underline || !!st.u, strike: base.style.strike || !!st.x },
    underlineStyle: st.ul,
    setUnderline: (kind) => h.apply((kind === null ? { u: null } : kind === "single" ? { u: true, ul: null } : { ul: kind }) satisfies StylePatch),
    canUnderlineStyle: true,
    effect: st.fx,
    setEffect: (effect) => h.apply({ fx: effect ?? null }),
    canEffect: true,
    script: st.sub ? "sub" : st.sup ? "sup" : undefined,
    canScript: true,
    color: st.color ?? base.color,
    colorSet: st.color,
    highlight: st.hl,
    canHighlight: true,
    setFamily: (family) => h.apply({ font: family ?? null }),
    setSize: (size) => h.apply({ size }),
    toggle: (key) => h.toggle(RUN_KEY[key]),
    toggleScript: (script) => h.toggle(script),
    setColor: (color) => h.apply({ color: color ?? null }),
    setHighlight: (color) => h.apply({ hl: color ?? null }),
    changeCase: (mode) => h.changeCase(mode),
    canChangeCase: true,
    clearFormatting: () => h.apply("clear"),
    clip: richClip(ctx, session),
    insertText: (text) => session.handle.insert(text),
  };
  return withCapture({ ...target, paint: (f) => paintWords(target, f) });
}

// The target of the ribbon for block `b`: the words selected in the text box or the text being typed in (the ribbon
// follows the selection), else the whole block.
export function useFormatTarget(ctx: Ctx, b: Block | undefined): FormatTarget | null {
  const editor = b?.type === "textbox" ? ctx.shell.textEditor : null;
  const sel = useEditorState({ editor, selector: ({ editor: e }) => (e ? cmd.selectionFormat(e) : null) });
  const session = useRichSession();
  if (!b) return null;
  if (editor && sel) return tiptapTarget(ctx, b, editor, sel);
  if (session && session.blockId === b.id) {
    // (with words selected they are what the buttons format; with only a cursor the block is, but the clipboard still is the text's)
    return session.hasSelection ? richTarget(ctx, b, session) : { ...blockTarget(ctx, b), clip: richClip(ctx, session), insertText: (text: string) => session.handle.insert(text) };
  }
  return blockTarget(ctx, b);
}
