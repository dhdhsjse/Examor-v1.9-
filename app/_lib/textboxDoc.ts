// The text of a text box as a Tiptap document (TextboxBlock.content): what the HTML editor on the page
// edits. The canvas still draws it with Konva: each paragraph becomes styled runs (richText.ts), wrapped
// and drawn like every other text, so it stays sharp at any zoom and in the PDF.

import type { JSONContent } from "@tiptap/core";
import { paragraphAttrs, paragraphFormat, type ParagraphFormat } from "./paragraphFormat";
import { isTextEffect, isUnderlineStyle, parseRich, patchStyle, serializeRich, type Run, type RunStyle, type StylePatch } from "./richText";
import { MATH_CHAR, keepDrawing, newInlineMath, type InlineMath } from "./inlineMath";
import { MAX_INDENT } from "./tiptap-indent";

/** The name of a formula node in the text box's document (tiptap-math.ts), and its attributes ↔ the formula. */
export const INLINE_MATH = "inlineMath";
export const mathAttrs = (m: InlineMath) => ({ latex: m.latex, w: m.w, h: m.h, d: m.d, ...(m.svg ? { svg: m.svg } : {}) });
export function mathOfAttrs(attrs: Record<string, unknown> | undefined): InlineMath {
  const latex = typeof attrs?.latex === "string" ? attrs.latex : "";
  const guess = newInlineMath(latex);
  const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback);
  const svg = typeof attrs?.svg === "string" && attrs.svg ? { svg: attrs.svg } : {};
  if (svg.svg) keepDrawing(latex, svg.svg); // (the canvas finds it by the LaTeX: the styled string it wraps does not carry it)
  return { latex, w: num(attrs?.w, guess.w), h: num(attrs?.h, guess.h), d: typeof attrs?.d === "number" && attrs.d >= 0 ? attrs.d : guess.d, ...svg };
}

type Mark = NonNullable<JSONContent["marks"]>[number];

// One paragraph, ready to draw: its runs and its own formatting (alignment, indent level, list, direction, spacing,
// shading and borders; what it does not set is the box's).
export interface DocParagraph extends ParagraphFormat {
  runs: Run[];
}

// A font name as stored by the editor: the first family of a CSS list, without quotes.
const fontName = (css: string) => css.split(",")[0].trim().replace(/^["']|["']$/g, "");

function styleOf(marks: Mark[] | undefined): RunStyle {
  const st: RunStyle = {};
  for (const m of marks ?? []) {
    const a = (m.attrs ?? {}) as Record<string, unknown>;
    if (m.type === "bold") st.b = true;
    else if (m.type === "italic") st.i = true;
    else if (m.type === "underline") {
      st.u = true;
      if (isUnderlineStyle(a.style)) st.ul = a.style;
    } else if (m.type === "textEffect") {
      if (isTextEffect(a.kind)) st.fx = a.kind;
    }
    else if (m.type === "strike") st.x = true;
    else if (m.type === "subscript") st.sub = true;
    else if (m.type === "superscript") st.sup = true;
    else if (m.type === "highlight") st.hl = typeof a.color === "string" && a.color ? a.color : "#fef08a";
    else if (m.type === "textStyle") {
      if (typeof a.color === "string" && a.color) st.color = a.color;
      if (typeof a.fontFamily === "string" && a.fontFamily) st.font = fontName(a.fontFamily);
      const size = typeof a.fontSize === "string" ? parseFloat(a.fontSize) : NaN;
      if (size > 0) st.size = size;
    }
  }
  if (st.sub && st.sup) delete st.sup;
  return st;
}

function marksOf(st: RunStyle): Mark[] {
  const marks: Mark[] = [];
  if (st.b) marks.push({ type: "bold" });
  if (st.i) marks.push({ type: "italic" });
  if (st.u) marks.push(st.ul ? { type: "underline", attrs: { style: st.ul } } : { type: "underline" });
  if (st.x) marks.push({ type: "strike" });
  if (st.sub) marks.push({ type: "subscript" });
  else if (st.sup) marks.push({ type: "superscript" });
  if (st.hl) marks.push({ type: "highlight", attrs: { color: st.hl } });
  if (st.fx) marks.push({ type: "textEffect", attrs: { kind: st.fx } });
  if (st.color || st.font || st.size) {
    marks.push({ type: "textStyle", attrs: { color: st.color ?? null, fontFamily: st.font ?? null, fontSize: st.size ? `${st.size}px` : null } });
  }
  return marks;
}

// A formula node (tiptap-math.ts) is one MATH_CHAR whose style carries the formula.
function runOf(n: JSONContent): Run {
  if (n.type === "hardBreak") return { text: "\n", style: styleOf(n.marks) };
  if (n.type === INLINE_MATH) return { text: MATH_CHAR, style: { ...styleOf(n.marks), math: mathOfAttrs(n.attrs) } };
  return { text: n.text ?? "", style: styleOf(n.marks) };
}
const runsOf = (p: JSONContent): Run[] => (p.content ?? []).map(runOf);

// The paragraphs of a document (a line break inside one is "\n" in its runs).
export function docParagraphs(doc: JSONContent): DocParagraph[] {
  return (doc.content ?? []).map((p) => ({ runs: runsOf(p), ...paragraphFormat(p.attrs, MAX_INDENT) }));
}

// A paragraph node: its runs as text (and line breaks), and its formatting as attributes.
function paragraphNode(runs: Run[], format?: Partial<ParagraphFormat>): JSONContent {
  const content: JSONContent[] = [];
  for (const r of runs) {
    const marks = marksOf(r.style);
    const withMarks = marks.length ? { marks } : {};
    // Each character of a formula's run is that formula.
    const math = r.style.math;
    if (math) {
      for (const ch of r.text) if (ch === MATH_CHAR) content.push({ type: INLINE_MATH, attrs: mathAttrs(math), ...withMarks });
      continue;
    }
    r.text.split("\n").forEach((part, i) => {
      if (i > 0) content.push({ type: "hardBreak" });
      if (part) content.push({ type: "text", text: part, ...withMarks });
    });
  }
  return { type: "paragraph", ...(format ? { attrs: paragraphAttrs(format) } : {}), ...(content.length ? { content } : {}) };
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
  return { type: "doc", content: paragraphs.map((runs) => paragraphNode(runs)) };
}

// A document from paragraphs, with their formatting (what a transform of the text gives back).
export const docFromParagraphs = (paragraphs: DocParagraph[]): JSONContent => ({
  type: "doc",
  content: (paragraphs.length ? paragraphs : [{ runs: [], indent: 0, spaceBefore: 0, spaceAfter: 0 }]).map(({ runs, ...format }) => paragraphNode(runs, format)),
});

// The same text as a styled string, kept in TextboxBlock.text (labels, hints, search, older versions).
export const richFromDoc = (doc: JSONContent) => docParagraphs(doc).map((p) => serializeRich(p.runs)).join("\n");

// What the box shows: its document, or the one made from its styled text (older files).
export const textboxDoc = (b: { content?: JSONContent; text: string }): JSONContent => b.content ?? docFromRich(b.text);

// A format applied to the whole box from the right panel (box selected, not being typed in) replaces the
// same format set on single words, like in Word.
export type WholeFormat = "family" | "size" | "color" | "bold" | "italic" | "underline" | "strike" | "highlight" | "script" | "align" | "lineHeight" | "dir";

const MARK_OF: Partial<Record<WholeFormat, string[]>> = {
  bold: ["bold"],
  italic: ["italic"],
  underline: ["underline"],
  strike: ["strike"],
  highlight: ["highlight"],
  script: ["subscript", "superscript"],
};
const STYLE_ATTR: Partial<Record<WholeFormat, string>> = { family: "fontFamily", size: "fontSize", color: "color" };
const PARAGRAPH_ATTR: Partial<Record<WholeFormat, string>> = { align: "textAlign", lineHeight: "lineHeight", dir: "dir" };

export function clearFormat(doc: JSONContent, format: WholeFormat): JSONContent {
  const markTypes = MARK_OF[format] ?? [];
  const attr = STYLE_ATTR[format];
  const paragraphAttr = PARAGRAPH_ATTR[format];
  const clean = (marks: Mark[] | undefined) =>
    (marks ?? []).flatMap((m): Mark[] => {
      if (markTypes.includes(m.type)) return [];
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
      ...(paragraphAttr ? { attrs: { ...p.attrs, [paragraphAttr]: null } } : {}),
      ...(p.content ? { content: p.content.map((n) => (n.marks ? { ...n, marks: clean(n.marks) } : n)) } : {}),
    })),
  };
}

// Every word of the box with its style changed by `patch` (a style of the styled texts, richText.ts), or with no style at all.
export function styleDoc(doc: JSONContent, patch: StylePatch | "clear"): JSONContent {
  return docFromParagraphs(docParagraphs(doc).map((p) => ({ ...p, runs: p.runs.map((r) => ({ ...r, style: patch === "clear" ? {} : patchStyle(r.style, patch) })) })));
}

// Highlight every word of the box (undefined = no highlight anywhere).
export const highlightAll = (doc: JSONContent, color?: string): JSONContent => styleDoc(doc, { hl: color ?? null });

// Every word of the box as a subscript or a superscript (undefined = neither).
export const scriptAll = (doc: JSONContent, script?: "sub" | "sup"): JSONContent => styleDoc(doc, { sub: script === "sub" ? true : null, sup: script === "sup" ? true : null });

// The letters of the whole box changed by `fn` (one entry per character, as textCase.caseChars gives), each word keeping
// its style and each paragraph its formatting. The paragraphs are one text for `fn`, with a line break between them.
export function mapDocChars(doc: JSONContent, fn: (chars: string[]) => string[]): JSONContent {
  const paragraphs = docParagraphs(doc);
  const chars: string[] = [];
  paragraphs.forEach((p, i) => {
    if (i) chars.push("\n");
    for (const r of p.runs) chars.push(...r.text);
  });
  const mapped = fn(chars);
  let at = 0;
  return docFromParagraphs(
    paragraphs.map((p, i) => {
      if (i) at++; // (the line break between two paragraphs)
      return {
        ...p,
        runs: p.runs.map((r) => {
          const n = [...r.text].length;
          const text = mapped.slice(at, at + n).join("");
          at += n;
          return { ...r, text };
        }),
      };
    }),
  );
}

const ATTR_OF: Record<keyof ParagraphFormat, string> = {
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

export type ParagraphChanges = Partial<Record<keyof ParagraphFormat, unknown>>;

// Set the formatting of every paragraph of the box: a key given as undefined (or "") takes that formatting off.
// `patch` may also be a function of each paragraph (its position and its formatting now).
export function setParagraphs(doc: JSONContent, patch: ParagraphChanges | ((p: DocParagraph, i: number) => ParagraphChanges)): JSONContent {
  const formats = docParagraphs(doc);
  return {
    ...doc,
    content: (doc.content ?? []).map((p, i) => {
      if (p.type !== "paragraph") return p;
      const changes = typeof patch === "function" ? patch(formats[i], i) : patch;
      const attrs: Record<string, unknown> = { ...p.attrs };
      for (const [key, value] of Object.entries(changes)) attrs[ATTR_OF[key as keyof ParagraphFormat]] = value === undefined || value === "" ? null : value;
      return { ...p, attrs };
    }),
  };
}

// Indent every paragraph of the box by `step` levels (whole-box formatting, between 0 and MAX_INDENT).
export const indentAll = (doc: JSONContent, step: number): JSONContent => setParagraphs(doc, (p) => ({ indent: Math.max(0, Math.min(MAX_INDENT, p.indent + step)) }));

// The deepest indent level in the box.
export const maxIndent = (doc: JSONContent) => Math.max(0, ...docParagraphs(doc).map((p) => p.indent));

// The paragraphs of the box in alphabetical order (ascending or descending), numbers counted as numbers; the
// formatting of each stays with it.
export function sortDocParagraphs(doc: JSONContent, order: "asc" | "desc", locale: string): JSONContent {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
  const key = (p: DocParagraph) => p.runs.map((r) => r.text).join("").trim();
  const sorted = [...docParagraphs(doc)].sort((a, b) => (order === "asc" ? 1 : -1) * collator.compare(key(a), key(b)));
  return docFromParagraphs(sorted);
}
