// The text of a text box as a Tiptap document (TextboxBlock.content): what the HTML editor on the page
// edits. The canvas still draws it with Konva: each paragraph becomes styled runs (richText.ts), wrapped
// and drawn like every other text, so it stays sharp at any zoom and in the PDF.

import type { JSONContent } from "@tiptap/core";
import { parseRich, serializeRich, type Run, type RunStyle } from "./richText";
import { MAX_INDENT } from "./tiptap-indent";
import type { ParagraphAlign, TextboxBlock } from "./types";

type Mark = NonNullable<JSONContent["marks"]>[number];

const ALIGNS: ParagraphAlign[] = ["left", "center", "right", "justify"];

// One paragraph, ready to draw: its runs, its own alignment (missing = the box's) and indent level.
export interface DocParagraph {
  runs: Run[];
  align?: ParagraphAlign;
  indent: number;
}

// A font name as stored by the editor: the first family of a CSS list, without quotes.
const fontName = (css: string) => css.split(",")[0].trim().replace(/^["']|["']$/g, "");

function styleOf(marks: Mark[] | undefined): RunStyle {
  const st: RunStyle = {};
  for (const m of marks ?? []) {
    const a = (m.attrs ?? {}) as Record<string, unknown>;
    if (m.type === "bold") st.b = true;
    else if (m.type === "italic") st.i = true;
    else if (m.type === "underline") st.u = true;
    else if (m.type === "strike") st.x = true;
    else if (m.type === "highlight") st.hl = typeof a.color === "string" && a.color ? a.color : "#fef08a";
    else if (m.type === "textStyle") {
      if (typeof a.color === "string" && a.color) st.color = a.color;
      if (typeof a.fontFamily === "string" && a.fontFamily) st.font = fontName(a.fontFamily);
      const size = typeof a.fontSize === "string" ? parseFloat(a.fontSize) : NaN;
      if (size > 0) st.size = size;
    }
  }
  return st;
}

function marksOf(st: RunStyle): Mark[] {
  const marks: Mark[] = [];
  if (st.b) marks.push({ type: "bold" });
  if (st.i) marks.push({ type: "italic" });
  if (st.u) marks.push({ type: "underline" });
  if (st.x) marks.push({ type: "strike" });
  if (st.hl) marks.push({ type: "highlight", attrs: { color: st.hl } });
  if (st.color || st.font || st.size) {
    marks.push({ type: "textStyle", attrs: { color: st.color ?? null, fontFamily: st.font ?? null, fontSize: st.size ? `${st.size}px` : null } });
  }
  return marks;
}

// The paragraphs of a document (a line break inside one is "\n" in its runs).
export function docParagraphs(doc: JSONContent): DocParagraph[] {
  return (doc.content ?? []).map((p) => {
    const runs: Run[] = (p.content ?? []).map((n) => ({ text: n.type === "hardBreak" ? "\n" : (n.text ?? ""), style: styleOf(n.marks) }));
    const align = p.attrs?.textAlign;
    const indent = Math.max(0, Math.min(MAX_INDENT, Math.round(Number(p.attrs?.indent) || 0)));
    return { runs, align: ALIGNS.includes(align) ? align : undefined, indent };
  });
}

// A styled text of the older text boxes (or a preset) as a document: one paragraph per line.
export function docFromRich(text: string): JSONContent {
  const paragraphs: Run[][] = [[]];
  for (const run of parseRich(text)) {
    run.text.split("\n").forEach((part, i) => {
      if (i > 0) paragraphs.push([]);
      if (part) paragraphs[paragraphs.length - 1].push({ text: part, style: run.style });
    });
  }
  return {
    type: "doc",
    content: paragraphs.map((runs) => ({
      type: "paragraph",
      ...(runs.length ? { content: runs.map((r) => ({ type: "text", text: r.text, ...(marksOf(r.style).length ? { marks: marksOf(r.style) } : {}) })) } : {}),
    })),
  };
}

// The same text as a styled string, kept in TextboxBlock.text (labels, hints, search, older versions).
export const richFromDoc = (doc: JSONContent) => docParagraphs(doc).map((p) => serializeRich(p.runs)).join("\n");

// What the box shows: its document, or the one made from its styled text (older files).
export const textboxDoc = (b: TextboxBlock): JSONContent => b.content ?? docFromRich(b.text);

// A format applied to the whole box from the right panel (box selected, not being typed in) replaces the
// same format set on single words, like in Word.
export type WholeFormat = "family" | "size" | "color" | "bold" | "italic" | "underline" | "strike" | "highlight" | "align";

const MARK_OF: Partial<Record<WholeFormat, string>> = { bold: "bold", italic: "italic", underline: "underline", strike: "strike", highlight: "highlight" };
const STYLE_ATTR: Partial<Record<WholeFormat, string>> = { family: "fontFamily", size: "fontSize", color: "color" };

export function clearFormat(doc: JSONContent, format: WholeFormat): JSONContent {
  const markType = MARK_OF[format];
  const attr = STYLE_ATTR[format];
  const clean = (marks: Mark[] | undefined) =>
    (marks ?? []).flatMap((m): Mark[] => {
      if (m.type === markType) return [];
      if (attr && m.type === "textStyle") {
        const attrs = { ...m.attrs, [attr]: null };
        return Object.values(attrs).some((v) => v !== null && v !== undefined) ? [{ ...m, attrs }] : [];
      }
      return [m];
    });
  return {
    ...doc,
    content: (doc.content ?? []).map((p) => ({
      ...p,
      ...(format === "align" ? { attrs: { ...p.attrs, textAlign: null } } : {}),
      ...(p.content ? { content: p.content.map((n) => (n.marks ? { ...n, marks: clean(n.marks) } : n)) } : {}),
    })),
  };
}

// Highlight every word of the box (undefined = no highlight anywhere).
export function highlightAll(doc: JSONContent, color?: string): JSONContent {
  const cleared = clearFormat(doc, "highlight");
  if (!color) return cleared;
  return {
    ...cleared,
    content: (cleared.content ?? []).map((p) => ({
      ...p,
      ...(p.content ? { content: p.content.map((n) => (n.type === "text" ? { ...n, marks: [...(n.marks ?? []), { type: "highlight", attrs: { color } }] } : n)) } : {}),
    })),
  };
}

// Indent every paragraph of the box by `step` levels (whole-box formatting, between 0 and MAX_INDENT).
export function indentAll(doc: JSONContent, step: number): JSONContent {
  return {
    ...doc,
    content: (doc.content ?? []).map((p) => {
      if (p.type !== "paragraph") return p;
      const level = Math.max(0, Math.min(MAX_INDENT, (Number(p.attrs?.indent) || 0) + step));
      return { ...p, attrs: { ...p.attrs, indent: level } };
    }),
  };
}

// The deepest indent level in the box.
export const maxIndent = (doc: JSONContent) => Math.max(0, ...docParagraphs(doc).map((p) => p.indent));
