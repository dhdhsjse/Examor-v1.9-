// The Tiptap editor of a text box (workspace/TextboxEditor.tsx): its extensions, the formatting of the
// selection, and the commands the format bar and the right panel send to it. What changes the document
// (case, sorting, clearing, paragraph attributes) is written as functions of an editor state that give a
// transaction, so it can be tested without a browser.

import { Extension, InputRule, type Editor, type JSONContent } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import type { Mark, Node as PMNode } from "@tiptap/pm/model";
import { Fragment, Slice } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import { isListKind, type ListKind } from "./lists";
import { cleanColor, cleanLineHeight, cleanSides, clampSpace, isDirection, paragraphAttrs, type Direction, type ParagraphFormat } from "./paragraphFormat";
import { sizeKey, stepSize } from "./fontSizes";
import { clipFromParagraphs, readClip } from "./richClipboard";
import { isTextEffect, isUnderlineStyle, type TextEffect as TextEffectKind, type UnderlineStyle } from "./richText";
import { caseChars, cycleCase, wordAt, type CaseMode } from "./textCase";
import { docFromParagraphs, docParagraphs, type DocParagraph } from "./textboxDoc";
import { IndentExtension, MAX_INDENT } from "./tiptap-indent";
import { ListMarkersExtension, ParagraphFormatExtension, type ListOptions } from "./tiptap-paragraph";
import { StyledUnderline, TextEffect } from "./tiptap-effects";
import { InlineMath } from "./tiptap-math";
import { Subscript, Superscript } from "./tiptap-script";
import type { ParagraphAlign } from "./types";

// Only what the canvas can draw (textboxDoc.ts): paragraphs, line breaks, formulas (tiptap-math.ts), bold / italic / underline /
// strikethrough, subscript / superscript, font, size, color, highlight, paragraph alignment, indent, lists,
// direction, spacing, shading and borders, and undo. Pasted headings, lists…
// arrive as plain paragraphs (a pasted list keeps its markers, see richClipboard.listsToParagraphs).
export const textboxExtensions = (list: ListOptions = { rtl: false, size: 14 }) => [
  StarterKit.configure({
    blockquote: false,
    bulletList: false,
    orderedList: false,
    listItem: false,
    listKeymap: false,
    code: false,
    codeBlock: false,
    heading: false,
    horizontalRule: false,
    link: false,
    underline: false, // (replaced by one that has kinds: tiptap-effects.ts)
    trailingNode: false,
    dropcursor: false,
    gapcursor: false,
  }),
  TextStyle,
  Color,
  FontFamily,
  FontSize,
  Highlight.configure({ multicolor: true }),
  // (after TextStyle: in the page's HTML a script is inside the span that sets the size, so em is of that size)
  StyledUnderline,
  TextEffect,
  Subscript,
  Superscript,
  InlineMath,
  TextAlign.configure({ types: ["paragraph"], alignments: ["left", "center", "right", "justify"] }),
  IndentExtension,
  ParagraphFormatExtension,
  ListMarkersExtension.configure(list),
  TextShortcuts.configure({ size: list.size }),
  AutoLists,
  ClipboardExtension,
];

export type StyleMark = "bold" | "italic" | "underline" | "strike";
export type Script = "sub" | "sup";

// The formatting at the selection (only what the words themselves carry; the box's own comes on top). What
// the paragraphs of the selection have is the value they share (undefined when they differ or have none).
export interface SelectionFormat {
  marks: Record<StyleMark, boolean>;
  underlineStyle?: UnderlineStyle; // the kind of underline when it is not a single line
  effect?: TextEffectKind;
  script?: Script;
  family?: string;
  size?: number;
  color?: string;
  highlight?: string;
  align?: ParagraphAlign;
  indent: { min: number; max: number }; // levels of the paragraphs of the selection
  list?: ListKind;
  dir?: Direction;
  lineHeight?: number;
  spaceBefore?: number;
  spaceAfter?: number;
  shading?: string;
  border?: string;
  borderColor?: string;
  paragraphs: number; // how many paragraphs the selection touches
  empty: boolean; // a cursor, nothing selected
}

const ALIGNS: ParagraphAlign[] = ["left", "center", "right", "justify"];

// ---- the paragraphs of the selection ----

export interface PlacedParagraph {
  node: PMNode;
  pos: number;
}

// The paragraphs the selection touches (the one with the cursor when nothing is selected).
export function selectedParagraphs(state: EditorState): PlacedParagraph[] {
  const { from, to } = state.selection;
  const out: PlacedParagraph[] = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name !== "paragraph") return true;
    out.push({ node, pos });
    return false;
  });
  return out;
}

const common = <T,>(values: T[]): T | undefined => (values.length && values.every((v) => v === values[0]) ? values[0] : undefined);

export function selectionFormat(editor: Editor): SelectionFormat {
  const style = editor.getAttributes("textStyle");
  const size = parseFloat(style.fontSize ?? "");
  const paragraphs = selectedParagraphs(editor.state).map((p) => p.node.attrs);
  const attr = (key: string) => common(paragraphs.map((a) => a[key] ?? null)) ?? undefined;
  const align = attr("textAlign");
  const list = attr("list");
  const dir = attr("dir");
  const levels = paragraphs.map((a) => Number(a.indent) || 0);
  return {
    marks: { bold: editor.isActive("bold"), italic: editor.isActive("italic"), underline: editor.isActive("underline"), strike: editor.isActive("strike") },
    underlineStyle: editor.isActive("underline") && isUnderlineStyle(editor.getAttributes("underline").style) ? editor.getAttributes("underline").style : undefined,
    effect: editor.isActive("textEffect") && isTextEffect(editor.getAttributes("textEffect").kind) ? editor.getAttributes("textEffect").kind : undefined,
    script: editor.isActive("subscript") ? "sub" : editor.isActive("superscript") ? "sup" : undefined,
    family: typeof style.fontFamily === "string" && style.fontFamily ? style.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "") : undefined,
    size: size > 0 ? size : undefined,
    color: style.color || undefined,
    highlight: editor.isActive("highlight") ? (editor.getAttributes("highlight").color ?? "#fef08a") : undefined,
    align: ALIGNS.includes(align as ParagraphAlign) ? (align as ParagraphAlign) : undefined,
    indent: levels.length ? { min: Math.min(...levels), max: Math.max(...levels) } : { min: 0, max: 0 },
    list: isListKind(list) ? list : undefined,
    dir: isDirection(dir) ? dir : undefined,
    lineHeight: cleanLineHeight(attr("lineHeight")),
    spaceBefore: paragraphs.length ? (common(paragraphs.map((a) => clampSpace(a.spaceBefore))) ?? undefined) : 0,
    spaceAfter: paragraphs.length ? (common(paragraphs.map((a) => clampSpace(a.spaceAfter))) ?? undefined) : 0,
    shading: cleanColor(attr("shading")),
    border: cleanSides(attr("border")) || undefined,
    borderColor: cleanColor(attr("borderColor")),
    paragraphs: paragraphs.length,
    empty: editor.state.selection.empty,
  };
}

// ---- words ----

// The selected words (or what is typed next) get these; undefined = back to the box's own.
export const setFamily = (editor: Editor, family?: string) =>
  family ? editor.chain().focus().setFontFamily(family).run() : editor.chain().focus().unsetFontFamily().run();
export const setSize = (editor: Editor, size?: number) =>
  size ? editor.chain().focus().setFontSize(`${size}px`).run() : editor.chain().focus().unsetFontSize().run();
export const setColor = (editor: Editor, color?: string) => (color ? editor.chain().focus().setColor(color).run() : editor.chain().focus().unsetColor().run());
export const setHighlight = (editor: Editor, color?: string) =>
  color ? editor.chain().focus().setHighlight({ color }).run() : editor.chain().focus().unsetHighlight().run();
export const toggleScript = (editor: Editor, script: Script) => (script === "sub" ? editor.chain().focus().toggleSubscript().run() : editor.chain().focus().toggleSuperscript().run());
export const clearMarks = (editor: Editor) => editor.chain().focus().unsetAllMarks().run();
// The kind of underline of the selected words: a single line, another kind, or none (null).
export const setUnderlineKind = (editor: Editor, kind: UnderlineStyle | "single" | null) =>
  kind === null ? editor.chain().focus().unsetMark("underline").run() : editor.chain().focus().setMark("underline", { style: kind === "single" ? null : kind }).run();
// A text effect on the selected words (undefined = none).
export const setTextEffect = (editor: Editor, effect?: TextEffectKind) =>
  effect ? editor.chain().focus().setMark("textEffect", { kind: effect }).run() : editor.chain().focus().unsetMark("textEffect").run();

// Alignment of the paragraphs of the selection (undefined = the box's).
export const setAlign = (editor: Editor, align?: ParagraphAlign) =>
  align ? editor.chain().focus().setTextAlign(align).run() : editor.chain().focus().unsetTextAlign().run();
// Indent of the paragraphs of the selection, one level more or less.
export const indent = (editor: Editor) => editor.chain().focus().indent().run();
export const outdent = (editor: Editor) => editor.chain().focus().outdent().run();

// Bold / italic / underline / strikethrough of the selection. When the whole box has it (`boxHas`), the
// words cannot drop it alone: every word gets it as its own instead, the box's is removed (`dropBoxStyle`),
// then the selection loses it. The text looks the same, except the selection.
export function toggleStyle(editor: Editor, mark: StyleMark, boxHas: boolean, dropBoxStyle: () => void) {
  if (!boxHas) return editor.chain().focus().toggleMark(mark).run();
  dropBoxStyle();
  return editor
    .chain()
    .focus()
    .command(({ tr, state }) => {
      tr.addMark(0, tr.doc.content.size, state.schema.marks[mark].create());
      return true;
    })
    .unsetMark(mark)
    .run();
}

// ---- paragraphs: attributes ----

const ATTR_KEY: Record<keyof ParagraphFormat, string> = {
  align: "textAlign",
  indent: "indent",
  list: "list",
  dir: "dir",
  lineHeight: "lineHeight",
  spaceBefore: "spaceBefore",
  spaceAfter: "spaceAfter",
  shading: "shading",
  border: "border",
  borderColor: "borderColor",
};

// A transaction that sets these attributes (null / undefined / "" = take it off) on the paragraphs of the selection.
export function paragraphAttrsTr(state: EditorState, patch: Partial<Record<keyof ParagraphFormat, unknown>>): Transaction | null {
  const tr = state.tr;
  let changed = false;
  for (const { node, pos } of selectedParagraphs(state)) {
    const attrs: Record<string, unknown> = { ...node.attrs };
    for (const [key, value] of Object.entries(patch)) {
      const next = value === undefined || value === "" ? null : value;
      if ((attrs[ATTR_KEY[key as keyof ParagraphFormat]] ?? null) !== next) {
        attrs[ATTR_KEY[key as keyof ParagraphFormat]] = next;
        changed = true;
      }
    }
    tr.setNodeMarkup(pos, undefined, attrs);
  }
  return changed ? tr : null;
}

// Dispatch a transaction made from the state, then give the focus back to the editor.
function run(editor: Editor, make: (state: EditorState) => Transaction | null): boolean {
  const tr = make(editor.state);
  if (!tr) return false;
  editor.view.dispatch(tr);
  editor.view.focus();
  return true;
}

export const setParagraphs = (editor: Editor, patch: Partial<Record<keyof ParagraphFormat, unknown>>) => run(editor, (state) => paragraphAttrsTr(state, patch));
export const setList = (editor: Editor, list: ListKind | null) => setParagraphs(editor, { list });
export const setDirection = (editor: Editor, dir: Direction | null) => setParagraphs(editor, { dir });
export const setLineHeight = (editor: Editor, lineHeight: number | null) => setParagraphs(editor, { lineHeight });
export const setSpace = (editor: Editor, space: { before?: number; after?: number }) =>
  setParagraphs(editor, { ...(space.before !== undefined ? { spaceBefore: space.before || null } : {}), ...(space.after !== undefined ? { spaceAfter: space.after || null } : {}) });
export const setShading = (editor: Editor, color: string | null) => setParagraphs(editor, { shading: color });
export const setBorder = (editor: Editor, sides: string, color?: string) => setParagraphs(editor, { border: cleanSides(sides) || null, borderColor: cleanSides(sides) ? (color ?? null) : null });

// ---- clearing, case, sorting ----

// Back to the box's own look: the words of the selection lose their formatting, and its paragraphs theirs.
export function clearAllTr(state: EditorState): Transaction {
  const { from, to, empty } = state.selection;
  const tr = state.tr;
  for (const { node, pos } of selectedParagraphs(state)) tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...paragraphAttrs({}) });
  // (stored marks last: a step that changes the document forgets them)
  if (!empty) tr.removeMark(from, to);
  else tr.setStoredMarks([]);
  return tr;
}
export const clearAll = (editor: Editor) => run(editor, clearAllTr);

// The range a case change applies to: the selection, or with only a cursor the word around it (a sentence case
// changes its whole paragraph).
function caseRange(state: EditorState, mode: CaseMode): { from: number; to: number } | null {
  const { from, to, empty, $from } = state.selection;
  if (!empty) return { from, to };
  const parent = $from.parent;
  const start = $from.start();
  if (mode === "sentence") return parent.content.size ? { from: start, to: start + parent.content.size } : null;
  const word = wordAt(parent.textBetween(0, parent.content.size, "\n", "\n"), $from.parentOffset);
  return word ? { from: start + word.start, to: start + word.end } : null;
}

// A transaction that changes the case of the selected text (marks stay on their letters), or null when nothing changes.
export function changeCaseTr(state: EditorState, mode: CaseMode): Transaction | null {
  const range = caseRange(state, mode);
  if (!range) return null;
  const segments: { pos: number; text: string; marks: readonly Mark[]; block: PMNode | null }[] = [];
  state.doc.nodesBetween(range.from, range.to, (node, pos, parent) => {
    if (!node.isText || !node.text) return true;
    const a = Math.max(range.from, pos);
    const b = Math.min(range.to, pos + node.nodeSize);
    if (b > a) segments.push({ pos: a, text: node.text.slice(a - pos, b - pos), marks: node.marks, block: parent });
    return false;
  });
  if (!segments.length) return null;
  // One run of characters for the whole selection (a line break between paragraphs), so a sentence can span styles.
  const chars: string[] = [];
  const owner: number[] = [];
  segments.forEach((seg, i) => {
    if (i > 0 && seg.block !== segments[i - 1].block) {
      chars.push("\n");
      owner.push(-1);
    }
    for (const ch of seg.text) {
      chars.push(ch);
      owner.push(i);
    }
  });
  const mapped = caseChars(chars, mode);
  const texts = segments.map(() => "");
  mapped.forEach((out, k) => {
    if (owner[k] >= 0) texts[owner[k]] += out;
  });
  if (texts.every((t, i) => t === segments[i].text)) return null;
  const tr = state.tr;
  let delta = 0;
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (texts[i] === seg.text) continue;
    tr.replaceWith(seg.pos, seg.pos + seg.text.length, state.schema.text(texts[i], seg.marks));
    delta += texts[i].length - seg.text.length;
  }
  if (!state.selection.empty) tr.setSelection(TextSelection.create(tr.doc, range.from, Math.max(range.from, range.to + delta)));
  return tr;
}
export const changeCase = (editor: Editor, mode: CaseMode) => run(editor, (state) => changeCaseTr(state, mode));

// The text the selection covers, for Shift+F3 (which case comes next).
const selectedText = (state: EditorState) => {
  const range = caseRange(state, "lower");
  return range ? state.doc.textBetween(range.from, range.to, "\n", "\n") : "";
};
export const cycleCaseOf = (editor: Editor) => {
  const text = selectedText(editor.state);
  return text ? changeCase(editor, cycleCase(text)) : false;
};

// The paragraphs of the selection in alphabetical order (a selection of one paragraph: the whole text).
export function sortParagraphsTr(state: EditorState, order: "asc" | "desc", locale: string): Transaction | null {
  let chosen = selectedParagraphs(state);
  if (chosen.length < 2) {
    chosen = [];
    state.doc.forEach((node, pos) => {
      if (node.type.name === "paragraph") chosen.push({ node, pos });
    });
  }
  if (chosen.length < 2) return null;
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
  const key = (n: PMNode) => n.textBetween(0, n.content.size, "\n", "\n").trim();
  const sorted = [...chosen].sort((a, b) => (order === "asc" ? 1 : -1) * collator.compare(key(a.node), key(b.node)));
  if (sorted.every((p, i) => p === chosen[i])) return null;
  const from = chosen[0].pos;
  const to = chosen[chosen.length - 1].pos + chosen[chosen.length - 1].node.nodeSize;
  const tr = state.tr.replaceWith(from, to, Fragment.from(sorted.map((p) => p.node)));
  return tr.setSelection(TextSelection.create(tr.doc, from + 1, Math.max(from + 1, tr.mapping.map(to) - 1)));
}
export const sortParagraphs = (editor: Editor, order: "asc" | "desc", locale: string) => run(editor, (state) => sortParagraphsTr(state, order, locale));

// ---- copying and pasting ----

// The paragraphs the selection covers, as the clipboard carries them (the first and the last may be partial).
export function selectionParagraphs(state: EditorState): DocParagraph[] {
  if (state.selection.empty) return [];
  return docParagraphs({ type: "doc", content: (state.selection.content().content.toJSON() ?? []) as JSONContent[] });
}

// A transaction that puts pasted paragraphs at the selection: the first one joins the text it lands in (and the last the text
// after it), the ones between come whole. Pasted on an empty paragraph, the first keeps its own formatting (a bullet stays a bullet).
export function pasteParagraphsTr(state: EditorState, paragraphs: DocParagraph[]): Transaction | null {
  if (!paragraphs.length || (paragraphs.length === 1 && !paragraphs[0].runs.length)) return null;
  const nodes = (docFromParagraphs(paragraphs).content ?? []).map((n) => state.schema.nodeFromJSON(n));
  const { $from, empty } = state.selection;
  const tr = state.tr;
  if (empty && $from.parent.type.name === "paragraph" && $from.parent.content.size === 0 && nodes.length > 1) {
    tr.setNodeMarkup($from.before(), undefined, { ...$from.parent.attrs, ...nodes[0].attrs });
  }
  tr.replaceSelection(new Slice(Fragment.from(nodes), 1, 1));
  return tr.scrollIntoView().setMeta("uiEvent", "paste");
}
export const pasteParagraphs = (editor: Editor, paragraphs: DocParagraph[]) => run(editor, (state) => pasteParagraphsTr(state, paragraphs));

// Copy, cut and paste with the formatting: what the app copies is read back exactly (words, lists, spacing…), what comes from other
// programs keeps its emphasis and lists (richClipboard.ts).
export const ClipboardExtension = Extension.create({
  name: "richClipboard",

  addProseMirrorPlugins() {
    const copy = (cut: boolean) => (view: EditorView, event: Event) => {
      const data = (event as ClipboardEvent).clipboardData;
      const paragraphs = selectionParagraphs(view.state);
      if (!data || !paragraphs.length) return false;
      const clip = clipFromParagraphs(paragraphs);
      event.preventDefault();
      data.setData("text/html", clip.html);
      data.setData("text/plain", clip.text);
      if (cut) view.dispatch(view.state.tr.deleteSelection().scrollIntoView().setMeta("uiEvent", "cut"));
      return true;
    };
    return [
      new Plugin({
        key: new PluginKey("richClipboard"),
        props: {
          handlePaste: (view, event) => {
            const data = event.clipboardData;
            const paragraphs = data ? readClip({ html: data.getData("text/html"), text: data.getData("text/plain") }) : null;
            const tr = paragraphs ? pasteParagraphsTr(view.state, paragraphs) : null;
            if (!tr) return false;
            event.preventDefault();
            view.dispatch(tr);
            return true;
          },
          handleDOMEvents: { copy: copy(false), cut: copy(true) },
        },
      }),
    ];
  },
});

// ---- lists ----

// The list keys, like Word's: Enter on an empty item takes it out of the list (a deeper one first goes one level
// up), Backspace at the start of an item takes the marker off and keeps the text, Tab and Shift+Tab move an item
// down and up a level. Tab in other text indents the paragraph when the cursor is at its start (or several are selected) and
// otherwise leaves a gap, like a tab; the focus never leaves the text.
function listParagraph(state: EditorState): PlacedParagraph | null {
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type.name !== "paragraph" || !isListKind($from.parent.attrs.list)) return null;
  return { node: $from.parent, pos: $from.before() };
}

export const TextShortcuts = Extension.create<{ size: number }>({
  name: "textShortcuts",
  priority: 200, // (before the editor's own Enter, which would split the paragraph)

  addOptions() {
    return { size: 14 }; // the size of the box's text, which Ctrl+Shift+> and < start from
  },

  // Ctrl+Shift+> and Ctrl+Shift+<: the next usual size for the selected words (the shortcuts below are by key name, this is by the character).
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("sizeKeys"),
        props: {
          handleKeyDown: (_view, event) => {
            const way = sizeKey(event);
            if (!way) return false;
            const size = this.editor ? (selectionFormat(this.editor).size ?? this.options.size) : this.options.size;
            event.preventDefault();
            return setSize(this.editor, stepSize(size, way === "up"));
          },
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const item = listParagraph(editor.state);
        if (!item || item.node.content.size > 0) return false;
        const level = Number(item.node.attrs.indent) || 0;
        return run(editor, (state) => paragraphAttrsTr(state, level > 0 ? { indent: level - 1 } : { list: null }));
      },
      Backspace: ({ editor }) => {
        // (a list that was just made by typing "- " goes back to the "- " first)
        if (editor.commands.undoInputRule()) return true;
        const item = listParagraph(editor.state);
        if (!item || editor.state.selection.$from.parentOffset !== 0) return false;
        return run(editor, (state) => paragraphAttrsTr(state, { list: null }));
      },
      Tab: ({ editor }) => {
        const { state } = editor;
        const inList = !!listParagraph(state) || selectedParagraphs(state).some((p) => isListKind(p.node.attrs.list));
        if (inList || !state.selection.empty || state.selection.$from.parentOffset === 0) return editor.commands.indent() || true;
        return editor.commands.insertContent(TAB);
      },
      "Shift-Tab": ({ editor }) => editor.commands.outdent() || true,
      "Shift-F3": ({ editor }) => cycleCaseOf(editor),
      "Mod-Space": ({ editor }) => clearAll(editor),
    };
  },
});

// What a Tab in the middle of a line leaves: a gap that the canvas draws like any text.
const TAB = "\u00a0\u00a0\u00a0\u00a0";

// Typing "- " (or "* ", "• ") at the start of a paragraph starts a bullet list, "1. " or "1) " a numbered one, "a. " and "A. " lettered
// ones, like Word's autoformat. Backspace right after takes it back to the text that was typed (see TextShortcuts).
const LIST_STARTS: { find: RegExp; list: ListKind }[] = [
  { find: /^[-*•]\s$/, list: "bullet" },
  { find: /^1\.\s$/, list: "decimal" },
  { find: /^1\)\s$/, list: "decimal-paren" },
  { find: /^a[.)]\s$/, list: "lower-alpha" },
  { find: /^A[.)]\s$/, list: "upper-alpha" },
];

export const AutoLists = Extension.create({
  name: "autoLists",

  addInputRules() {
    return LIST_STARTS.map(
      ({ find, list }) =>
        new InputRule({
          find,
          handler: ({ state, range, chain }) => {
            // only a paragraph that is not an item yet, and where the typed text is all that is in front of the cursor
            if (isListKind(state.selection.$from.parent.attrs.list)) return null;
            chain().deleteRange(range).updateAttributes("paragraph", { list }).run();
          },
        }),
    );
  },
});

// The deepest a list item can go.
export const MAX_LIST_LEVEL = MAX_INDENT;
