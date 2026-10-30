import { fontStack } from "./fonts";
import { isRtl, optionLabel, words } from "./i18n";
import { LIST_GAP, listMarkers } from "./lists";
import { linesHeight, measureText, runFont, wrapRich, type Piece, type RichLine, type TextFont } from "./measure";
import { parseRich, plainText, replaceBlanks, serializeRich, splitParagraphs, type Run } from "./richText";
import { docParagraphs, textboxDoc, type DocParagraph } from "./textboxDoc";
import { INDENT_PX, MAX_INDENT } from "./tiptap-indent";
import { fixOrder, shuffled } from "./shuffle";
import { shapesBounds } from "./shapes/geometry";
import { shownText, tableSheet } from "./table/display";
import { TABLE_HEADER_FILL, cellLook, hEdgeShown, isCovered, isPlainTable, mergeAt, tableMirrored, vEdgeShown, type CellLook } from "./table/model";
import type {
  BlankBlock,
  Block,
  ClassifyBlock,
  ExamDoc,
  ExamMeta,
  HeaderStyle,
  HeadingDecor,
  Lang,
  MatchBlock,
  McqBlock,
  OpenBlock,
  OrderBlock,
  PartNumbering,
  QuestionBlock,
  ParagraphAlign,
  BlockFont,
  TableBlock,
  TextBlock,
  TextboxBlock,
  TextboxSizing,
  TextStyle,
  TrueFalseBlock,
} from "./types";

// Shared sizes for drawing blocks (page pixels).
export const PAD = 10;
export const GAP = 8;
export const DEFAULT_SIZE = 14; // question text
export const ANSWER_LINE = 28; // spacing of dotted answer lines (at the default size)
export const CHOICE_W = 150; // "□ Vrai  □ Faux" column
export const TABLE_MIN_ROW = 28;
export const INK = "#111827";
export const ANSWER_COLOR = "#15803d"; // correction-sheet green
export const DEFAULT_ACCENT = "#4f46e5";

export const TEXT_STYLES: Record<TextStyle, { size: number; line: number; bold: boolean }> = {
  title: { size: 20, line: 28, bold: true },
  heading: { size: 16, line: 23, bold: true },
  body: { size: 14, line: 20, bold: false },
};

export const HEADER_HEIGHT: Record<HeaderStyle, number> = {
  classic: 150,
  modern: 136,
  minimal: 112,
  banner: 140,
  elegant: 134,
  official: 172,
  split: 136,
  compact: 78,
  evaluation: 176,
  playful: 140,
  cards: 128,
  accentbar: 126,
  bookmark: 124,
  gradient: 126,
  geometric: 132,
  chips: 124,
  editorial: 128,
  framed: 140,
  infogrid: 150,
  duotone: 128,
  monogram: 128,
  ticket: 130,
  floating: 132,
  algerian: 184,
};

// A font + its line height.
export interface Spec {
  font: TextFont;
  line: number;
}

// The fonts of one block: from the block itself, else from the exam settings.
export interface Fonts {
  lang: Lang;
  rtl: boolean;
  title: Spec;
  body: Spec;
  answer: Spec; // model answers on the correction sheet
  keyColor: string;
  hidePoints: boolean;
}

// `f`: the block's formatting (Home → Formatting): italic, underline, strikethrough and line spacing.
const spec = (family: string, size: number, bold: boolean, color: string, ratio: number, f?: BlockFont): Spec => ({
  font: { family, size, bold, italic: !!f?.italic, underline: !!f?.underline, strike: !!f?.strike, color },
  line: Math.round(size * ratio * (f?.lineHeight ?? 1)),
});

export function blockFonts(b: Block, meta: ExamMeta): Fonts {
  const family = fontStack(b.font?.family || meta.fontFamily);
  const size = b.font?.size ?? meta.fontSize ?? DEFAULT_SIZE;
  const color = b.font?.color ?? INK;
  const keyColor = meta.answerColor ?? ANSWER_COLOR;
  const answerSize = meta.answerSize ?? size;
  return {
    lang: meta.lang,
    rtl: isRtl(meta.lang),
    title: spec(family, size + 1, b.font?.bold ?? true, color, 21 / 15, b.font),
    body: spec(family, size, b.font?.bold ?? false, color, 20 / 14, b.font),
    answer: { ...spec(family, answerSize, false, keyColor, 2), line: answerLine(answerSize) },
    keyColor,
    hidePoints: !!meta.hidePoints,
  };
}

// Spacing of the dotted lines: grows when the answers are written bigger.
export const answerLine = (size: number) => Math.max(ANSWER_LINE, Math.round(size * 1.7));

// A wrapped piece of text placed at `y`.
export interface TextBox {
  lines: RichLine[];
  y: number;
  height: number;
}

function box(text: string, width: number, s: Spec, y: number): TextBox {
  const lines = wrapRich(text, Math.max(20, width), s.font, s.line);
  return { lines, y, height: linesHeight(lines) };
}

const pointsText = (points: number, F: Fonts) => (points > 0 && !F.hidePoints ? ` ${words(F.lang).pts(points)}` : "");

// "3. Question text (2 pts)"
export function questionTitle(b: QuestionBlock, n: number, F: Fonts): string {
  return `${n}. ${b.text}${pointsText(b.points, F)}`;
}

const inner = (b: Block) => b.layout.width - PAD * 2;

// x of a box placed `x` px from the start side of the block (mirrored in Arabic).
const startX = (b: Block, F: Fonts, x: number, width: number) => (F.rtl ? b.layout.width - x - width : x);

// A text box placed at x (block coordinates).
export interface PlacedBox extends TextBox {
  x: number;
  width: number;
}

const placed = (text: string, x: number, width: number, s: Spec, y: number): PlacedBox => ({ ...box(text, width, s, y), x, width });

export const MCQ_MARK = 30; // room for the circle / box before an option
const MCQ_COL_GAP = 14;

// Options under the question, in 1 to 4 columns (the first column is on the right in Arabic).
export function layoutMcq(b: McqBlock, n: number, meta: ExamMeta) {
  const F = blockFonts(b, meta);
  const title = box(questionTitle(b, n, F), inner(b), F.title, PAD);
  const cols = Math.max(1, Math.min(4, Math.round(b.columns ?? 1)));
  const colW = (inner(b) - MCQ_COL_GAP * (cols - 1)) / cols;
  let y = PAD + title.height + GAP;
  const options: (PlacedBox & { markX: number })[] = [];
  for (let r = 0; r * cols < b.options.length; r++) {
    const row = b.options.slice(r * cols, r * cols + cols).map((opt, k) => {
      const i = r * cols + k;
      const col = startX(b, F, PAD + k * (colW + MCQ_COL_GAP), colW); // left edge of the column
      const text = placed(`${optionLabel(i, F.lang)})  ${opt}`, F.rtl ? col : col + MCQ_MARK, colW - MCQ_MARK, F.body, y);
      return { ...text, markX: F.rtl ? col + colW - 9 : col + 9 };
    });
    options.push(...row);
    y += Math.max(...row.map((o) => o.height)) + 6;
  }
  return { F, title, options, height: y - (options.length ? 6 : GAP) + PAD };
}

export function layoutTrueFalse(b: TrueFalseBlock, n: number, meta: ExamMeta) {
  const F = blockFonts(b, meta);
  const title = box(questionTitle(b, n, F), inner(b), F.title, PAD);
  let y = PAD + title.height + GAP;
  const rows = b.statements.map((s, i) => {
    const t = box(`${i + 1}) ${s.text}`, inner(b) - CHOICE_W - 10, F.body, y);
    const row = { ...t, height: Math.max(t.height, F.body.line + 2) };
    y += row.height;
    // "Correct the false statements": one line under each statement (the student doesn't know which).
    const fix = b.justify ? answerArea(s.answer ? "" : (s.fix ?? ""), 1, F.rtl ? PAD : PAD + PART_INDENT, inner(b) - PART_INDENT, y, F) : null;
    if (fix) y += fix.height;
    y += 6;
    return { ...row, fix };
  });
  return { F, title, rows, height: y - (rows.length ? 6 : GAP) + PAD };
}

// A framed box of words (word bank), mixed up the same way every time for this block.
export interface WordBank {
  text: TextBox;
  x: number;
  y: number;
  width: number;
  height: number;
}

const BANK_PAD = 7;

function wordBank(words: string[], seed: string, b: Block, F: Fonts, y: number): WordBank | null {
  const clean = words.map((w) => plainText(w).trim().replace(/ +/g, " ")).filter(Boolean);
  if (!clean.length) return null;
  // Items stay whole on a line; " / " between them.
  const text = box(shuffled(clean, seed).join(" / "), inner(b) - BANK_PAD * 2 - 4, F.body, y + BANK_PAD);
  return { text, x: PAD, y, width: inner(b), height: text.height + BANK_PAD * 2 };
}

// Blanks: "[answer]" becomes "________" on the exam, "« answer »" (answer color) on the key.
export const blankAnswers = (s: string) => [...plainText(s).matchAll(/\[([^\]]*)\]/g)].map((m) => m[1]);
const blankExam = (s: string) => serializeRich(replaceBlanks(s, (a) => ({ text: "_".repeat(Math.max(8, a.length + 4)) })));
const blankKey = (s: string, color: string) => serializeRich(replaceBlanks(s, (a) => ({ text: `« ${a} »`, style: { color, b: true } })));

export function layoutBlank(b: BlankBlock, n: number, meta: ExamMeta) {
  const F = blockFonts(b, meta);
  const title = box(questionTitle(b, n, F), inner(b), F.title, PAD);
  let y = PAD + title.height + GAP;
  const bank = b.wordBank ? wordBank([...blankAnswers(b.content), ...(b.distractors ?? [])], b.id, b, F, y) : null;
  if (bank) y += bank.height + GAP + 2;
  const exam = box(blankExam(b.content), inner(b), F.body, y);
  const key = box(blankKey(b.content, F.keyColor), inner(b), F.body, y);
  // Same height in both modes, so nothing moves when switching to the key.
  return { F, title, bank, exam, key, height: y + Math.max(exam.height, key.height) + PAD };
}

// Dotted answer lines (and the model answer for the key) starting at `y`.
function answerArea(answer: string, lines: number, x: number, width: number, y: number, F: Fonts) {
  const text = box(answer, width, F.answer, y);
  const line = F.answer.line;
  const count = Math.max(lines, plainText(answer).trim() ? text.lines.length : 0);
  return { text, x, y, width, line, count, height: count * line };
}

export type AnswerArea = ReturnType<typeof answerArea>;
export const PART_INDENT = 18;

// Top of the written answer so it sits ON the dotted lines (Konva centers text in its line box,
// with the baseline ~0.38 × size below the center).
export const answerTextTop = (a: AnswerArea, size: number) => a.y + a.line / 2 - 7 - 0.38 * size;
// y of the k-th dotted line.
export const dottedLineY = (a: AnswerArea, k: number) => a.y + (k + 1) * a.line - 4;

// Numbering styles offered for sub-questions.
export const PART_NUMBERINGS: { value: PartNumbering; label: string }[] = [
  { value: "1a", label: "1a)" },
  { value: "a", label: "a)" },
  { value: "1.1", label: "1.1)" },
  { value: "i", label: "i)" },
  { value: "1", label: "1)" },
  { value: "none", label: "—" },
];

const roman = (n: number) => ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"][n - 1] ?? String(n);

// "1a)" in French, "1-أ)" in Arabic — or the teacher's own name / numbering style.
export function partLabel(b: OpenBlock, n: number, i: number, lang: Lang): string {
  const own = b.parts?.[i]?.label?.trim();
  if (own) return own;
  const letter = lang === "ar" ? optionLabel(i, lang) : String.fromCharCode(97 + i);
  switch (b.partNumbering ?? "1a") {
    case "1a":
      return lang === "ar" ? `${n}-${letter})` : `${n}${letter})`;
    case "a":
      return `${letter})`;
    case "1.1":
      return `${n}.${i + 1})`;
    case "i":
      return `${roman(i + 1)})`;
    case "1":
      return `${i + 1})`;
    case "none":
      return "";
  }
}

export function layoutOpen(b: OpenBlock, n: number, meta: ExamMeta) {
  const F = blockFonts(b, meta);
  const title = box(questionTitle(b, n, F), inner(b), F.title, PAD);
  let y = PAD + title.height + GAP;
  // The statement (data, a short text…) under the question.
  const context = b.context && plainText(b.context).trim() ? box(b.context, inner(b), F.body, y - 2) : null;
  if (context) y = context.y + context.height + GAP;
  const main = answerArea(b.answer, b.lines, PAD, inner(b), y, F);
  y += main.height;
  // Sub-questions: label + text, then their own answer lines.
  const parts = (b.parts ?? []).map((p, i) => {
    const label = partLabel(b, n, i, F.lang);
    const text = box(`${label ? `${label} ` : ""}${p.text}${pointsText(p.points, F)}`, inner(b) - PART_INDENT, F.body, y + 4);
    y = text.y + text.height;
    // The indent is on the right in Arabic.
    const area = answerArea(p.answer, p.lines, F.rtl ? PAD : PAD + PART_INDENT, inner(b) - PART_INDENT, y, F);
    y += area.height;
    return { text, area };
  });
  return { F, title, context, main, parts, height: y + PAD };
}

// Squares of the "grid" answer style (about 5 mm on paper).
export const GRID_STEP = 14;

// ---- Matching: two columns, a dot after each left item and before each right item ----

export const MATCH_DOT = 4; // radius

export function layoutMatch(b: MatchBlock, n: number, meta: ExamMeta) {
  const F = blockFonts(b, meta);
  const title = box(questionTitle(b, n, F), inner(b), F.title, PAD);
  const W = inner(b);
  const mid = Math.max(60, Math.min(140, W * 0.24)); // room for the student's lines
  const colW = (W - mid) / 2;
  const order = fixOrder(b.order, b.pairs.length);
  let y = PAD + title.height + GAP + 2;
  const rows = b.pairs.map((p, r) => {
    const right = b.pairs[order[r]];
    const left = placed(`${r + 1}. ${p.left}`, startX(b, F, PAD, colW - 16), colW - 16, F.body, y);
    const rightBox = placed(`${String.fromCharCode(97 + r)}. ${right?.right ?? ""}`, startX(b, F, PAD + colW + mid + 16, colW - 16), colW - 16, F.body, y);
    const height = Math.max(left.height, rightBox.height, F.body.line);
    const dotY = y + F.body.line / 2;
    const row = {
      y,
      height,
      left,
      right: rightBox,
      pair: order[r], // which pair's right item is printed on this row
      leftDot: { x: F.rtl ? b.layout.width - PAD - colW + 4 : PAD + colW - 4, y: dotY },
      rightDot: { x: F.rtl ? b.layout.width - PAD - colW - mid - 4 : PAD + colW + mid + 4, y: dotY },
    };
    y += height + 10;
    return row;
  });
  return { F, title, rows, height: y - (rows.length ? 10 : GAP) + PAD };
}

// ---- Ordering ----

export const RANK_BOX = 22;

export function layoutOrder(b: OrderBlock, n: number, meta: ExamMeta) {
  const F = blockFonts(b, meta);
  const title = box(questionTitle(b, n, F), inner(b), F.title, PAD);
  const order = fixOrder(b.order, b.items.length);
  let y = PAD + title.height + GAP;

  if (b.style === "sentence") {
    // The mixed-up words, then a line to write the sentence (the key writes it on the line).
    const words = box(order.map((i) => b.items[i]).join("  /  "), inner(b), F.body, y);
    y += words.height + 4;
    const area = answerArea(b.items.join(" "), 1, PAD, inner(b), y, F);
    return { F, title, sentence: { words, area }, rows: [], height: y + area.height + PAD };
  }

  const rows = order.map((item) => {
    const text = placed(b.items[item] ?? "", startX(b, F, PAD + RANK_BOX + 10, inner(b) - RANK_BOX - 10), inner(b) - RANK_BOX - 10, F.body, y);
    const height = Math.max(text.height, RANK_BOX + 2);
    const row = { y, height, text, item, boxX: startX(b, F, PAD, RANK_BOX), boxY: y + (F.body.line - RANK_BOX) / 2 };
    y += height + 6;
    return row;
  });
  return { F, title, sentence: null, rows, height: y - (rows.length ? 6 : GAP) + PAD };
}

// ---- Classification: a box of words, then a table with one column per category ----

export function layoutClassify(b: ClassifyBlock, n: number, meta: ExamMeta) {
  const F = blockFonts(b, meta);
  const title = box(questionTitle(b, n, F), inner(b), F.title, PAD);
  let y = PAD + title.height + GAP;
  const bank = b.hideBank ? null : wordBank(b.groups.flatMap((g) => g.items), b.id, b, F, y);
  if (bank) y += bank.height + GAP + 2;

  const cols = Math.max(1, b.groups.length);
  const W = inner(b);
  const colW = W / cols;
  const bold: Spec = { ...F.body, font: { ...F.body.font, bold: true } };
  const heads = b.groups.map((g, c) => placed(g.name, startX(b, F, PAD + c * colW + 6, colW - 12), colW - 12, bold, y + 4));
  const headH = Math.max(TABLE_MIN_ROW, ...heads.map((h) => h.height + 8));
  const rowCount = Math.max(1, ...b.groups.map((g) => g.items.length));
  const rowH = Math.max(TABLE_MIN_ROW, F.answer.line + 2);
  const colX = b.groups.map((_, c) => startX(b, F, PAD + c * colW, colW));
  const table = { y, colX, colW, headH, rowH, rowCount, height: headH + rowCount * rowH };
  return { F, title, bank, heads, table, height: y + table.height + PAD };
}

// ---- Text blocks (titles, headings, paragraphs) and their decorations ----

export function textSpec(b: TextBlock, meta: ExamMeta): Spec {
  const s = TEXT_STYLES[b.style];
  const scale = (meta.fontSize ?? DEFAULT_SIZE) / DEFAULT_SIZE;
  const size = b.font?.size ?? Math.round(s.size * scale);
  const decor = b.decor ?? "plain";
  // White text on filled decorations, unless the teacher picked a color.
  const color = b.font?.color ?? (decor === "band" || decor === "pill" ? "#ffffff" : INK);
  return spec(fontStack(b.font?.family || meta.fontFamily), size, b.font?.bold ?? s.bold, color, s.line / s.size, b.font);
}

export const TEXTBOX_PAD = 8; // room between a text box's edge and its text (TextboxBlock.padding)
export const TEXTBOX_MAX_PAD = 40;

// The text of a text box: the block's formatting, else the exam's body text.
export function textboxSpec(b: TextboxBlock, meta: ExamMeta): Spec {
  const size = b.font?.size ?? meta.fontSize ?? DEFAULT_SIZE;
  return spec(fontStack(b.font?.family || meta.fontFamily), size, b.font?.bold ?? false, b.font?.color ?? INK, 20 / 14, b.font);
}

// Room between a text box's edge and its text (kept small enough to leave the text some width).
// (A narrow box keeps some room for its text; an auto-width box grows around its margin instead.)
export const textboxPad = (b: TextboxBlock) =>
  Math.max(0, Math.min(b.padding ?? TEXTBOX_PAD, TEXTBOX_MAX_PAD, b.sizing === "auto-width" ? Infinity : (b.layout.width - 20) / 2));

// The writing direction of a text or text box: its own, else the exam's.
export const blockRtl = (b: { dir?: "ltr" | "rtl" }, meta: ExamMeta) => (b.dir ? b.dir === "rtl" : isRtl(meta.lang));

// The marker of a list item as a line of its own (a piece of text in the font the item starts with), placed
// where it is drawn: `x` / `width` and `y` (the top of the first line of the item), in the block's own coordinates.
export interface ListMarker {
  line: RichLine;
  x: number;
  y: number;
  width: number;
}

// The line of a marker: the marker text in the font the item starts with (size, face, color), not underlined or highlighted.
function markerLine(text: string, runs: Run[], base: TextFont, first: RichLine | undefined): RichLine {
  const start = runs.find((r) => r.text.length > 0);
  const f = start ? runFont(start.style, base) : base;
  const font: TextFont = { ...f, size: f.script ? (f.scriptBase ?? f.size) : f.size, underline: false, strike: false, highlight: undefined, script: undefined, scriptBase: undefined };
  const width = measureText(text, font);
  const piece: Piece = { text, x: 0, width, font };
  return { pieces: [piece], width, height: first?.height ?? font.size, size: first?.size ?? font.size };
}

// The room a list item keeps in front of its text for the marker (a wider marker makes its own room).
const markerGap = (line: RichLine | null) => (line ? Math.max(LIST_GAP, Math.ceil(line.width) + 6) : 0);

// What is drawn behind a paragraph: its shading and the lines of its border, in the block's own coordinates.
export interface ParagraphBox {
  x: number;
  y: number;
  width: number;
  height: number;
  shading?: string;
  border?: string;
  borderColor?: string;
}

// A paragraph of a text box, wrapped: `y` is from the top of the text, `x` / `width` its own (indented
// from the start side).
export interface TextboxParagraph {
  lines: RichLine[];
  x: number;
  y: number;
  width: number;
  align?: ParagraphAlign;
  rtl: boolean;
  marker?: ListMarker;
  box?: ParagraphBox;
}

const BOX_PAD = 3; // how far a shading or a border goes beyond the text (px)

// A text box: its paragraphs (textboxDoc.ts) wrapped inside the box, each with its own alignment, direction,
// spacing, list marker and shading (else the box's), the text placed at the top / middle / bottom. The box is
// as tall as it was made, or taller when the text needs it; with an automatic size (`sizing`) it is just as tall as its text, and
// as wide as its longest line for "auto-width". `hint`: drawn instead while the box is empty (one styled paragraph).
export function layoutTextbox(b: TextboxBlock, meta: ExamMeta, hint?: string) {
  if (b.sizing !== "auto-width") return layoutTextboxIn(b, meta, Math.max(20, b.layout.width - textboxPad(b) * 2), hint);
  // As wide as the longest line: laid out with no limit first, then in that width (so the alignments and the right-to-left lines fit it).
  const natural = layoutTextboxIn(b, meta, NO_WRAP, hint).natural;
  return layoutTextboxIn(b, meta, Math.max(MIN_AUTO_WIDTH, Math.ceil(natural) + 1), hint);
}

const NO_WRAP = 100_000;
const MIN_AUTO_WIDTH = 8; // an empty auto-width box keeps room for the cursor

/** The size a text box takes from its text (`sizing`), where it differs from the one stored in its layout; null when it has none. */
export function textboxFit(b: TextboxBlock, meta: ExamMeta): { width?: number; height?: number } | null {
  if (!b.sizing || b.sizing === "fixed") return null;
  const L = layoutTextbox(b, meta);
  const width = Math.round(L.width + L.x * 2);
  const height = Math.round(L.height);
  const fit: { width?: number; height?: number } = {};
  if (b.sizing === "auto-width" && width !== b.layout.width) fit.width = width;
  if (height !== b.layout.height) fit.height = height;
  return fit.width === undefined && fit.height === undefined ? null : fit;
}

/** The document with every auto-sized text box at the size of its text (the same document when none has to change). */
export function fitTextboxes(d: ExamDoc): ExamDoc {
  let changed = false;
  const blocks = d.blocks.map((b) => {
    if (b.type !== "textbox") return b;
    const fit = textboxFit(b, d.meta);
    if (!fit) return b;
    changed = true;
    return { ...b, layout: { ...b.layout, ...fit } };
  });
  return changed ? { ...d, blocks } : d;
}

// What a drag of the box's edge does to its automatic size, as in Figma: a new height makes it "fixed", a new width makes an
// "auto-width" box "auto-height" (the text wraps in the width given).
export function sizingAfterResize(b: TextboxBlock, meta: ExamMeta, size: { width?: number; height?: number }): TextboxSizing | undefined {
  if (!b.sizing || b.sizing === "fixed") return b.sizing;
  if (size.height !== undefined && Math.abs(size.height - layoutTextbox(b, meta).height) > 1) return "fixed";
  if (b.sizing === "auto-width" && size.width !== undefined && Math.abs(size.width - b.layout.width) > 1) return "auto-height";
  return b.sizing;
}

function layoutTextboxIn(b: TextboxBlock, meta: ExamMeta, width: number, hint?: string) {
  const s = textboxSpec(b, meta);
  const pad = textboxPad(b);
  const boxRtl = blockRtl(b, meta);
  const empty: DocParagraph = { runs: [], indent: 0, spaceBefore: 0, spaceAfter: 0 };
  const source: DocParagraph[] = hint ? [{ ...empty, runs: parseRich(hint) }] : docParagraphs(textboxDoc(b));
  const items = source.length ? source : [empty];
  const rtls = items.map((p) => (p.dir ? p.dir === "rtl" : boxRtl));
  const markers = listMarkers(items.map((p, i) => ({ list: p.list, level: p.indent, arabic: rtls[i] })));
  let top = 0;
  let natural = 0; // the width the longest line takes, with its indent and list marker
  const paragraphs: TextboxParagraph[] = items.map((p, i) => {
    const rtl = rtls[i];
    // Indented from the start side, keeping some room for the text.
    const indent = Math.min(Math.min(p.indent, MAX_INDENT) * INDENT_PX, Math.max(0, width - 20));
    top += p.spaceBefore;
    // The marker of a list item, then the room it takes before the text.
    const markerText = markers[i];
    const probe = markerText ? markerLine(markerText, p.runs, s.font, undefined) : null;
    const gap = Math.min(markerGap(probe), Math.max(0, width - indent - 20));
    // An empty paragraph is an empty line. Its own line spacing replaces the box's.
    const line = p.lineHeight ? Math.round(s.font.size * (20 / 14) * p.lineHeight) : s.line;
    const textWidth = width - indent - gap;
    const lines = wrapRich(serializeRich(p.runs) || " ", textWidth, s.font, line);
    natural = Math.max(natural, indent + gap + Math.max(0, ...lines.map((l) => l.width)));
    const out: TextboxParagraph = { lines, x: pad + (rtl ? 0 : indent + gap), y: top, width: textWidth, align: p.align ?? b.align, rtl };
    if (markerText) {
      const placed = markerLine(markerText, p.runs, s.font, lines[0]);
      out.marker = { line: placed, x: rtl ? pad + width - indent - placed.width : pad + indent, y: top, width: placed.width };
    }
    const h = linesHeight(lines);
    if (p.shading || p.border) {
      out.box = {
        x: Math.max(0, pad + (rtl ? 0 : indent) - BOX_PAD),
        y: top - 1,
        width: width - indent + BOX_PAD * 2,
        height: h + 2,
        ...(p.shading ? { shading: p.shading } : {}),
        ...(p.border ? { border: p.border, ...(p.borderColor ? { borderColor: p.borderColor } : {}) } : {}),
      };
    }
    top += h + p.spaceAfter;
    return out;
  });
  const content = Math.max(top, s.line);
  // An automatic size has no room under the text; a fixed one keeps the height it was given.
  const height = b.sizing === "auto-width" || b.sizing === "auto-height" ? content + pad * 2 : Math.max(b.layout.height, content + pad * 2);
  const free = height - content - pad * 2;
  const y = pad + (b.valign === "middle" ? free / 2 : b.valign === "bottom" ? free : 0);
  const align: ParagraphAlign | undefined = b.align;
  return { spec: s, paragraphs, x: pad, y, width, content, height, align, natural };
}

export interface Decoration {
  kind: HeadingDecor;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function layoutText(b: TextBlock, meta: ExamMeta) {
  const rtl = blockRtl(b, meta);
  const s = textSpec(b, meta);
  const w = b.layout.width;
  const W = inner(b);
  const kind = b.decor ?? "plain";
  const align: ParagraphAlign | undefined = b.align ?? (b.style === "title" ? "center" : undefined);
  let x = PAD;
  let width = W;
  let y = PAD / 2;
  let deco: Decoration | null = null;
  let extra = PAD; // room under the text

  switch (kind) {
    case "bar":
      width = W - 14;
      x = rtl ? PAD : PAD + 14;
      y = PAD / 2 + 2;
      extra = PAD + 4;
      break;
    case "band":
    case "boxed":
      x = PAD + 6;
      width = W - 12;
      y = 8;
      extra = 8;
      break;
    case "pill":
      x = PAD + 14;
      width = W - 28;
      y = 7;
      extra = 7;
      break;
    case "underline":
      extra = PAD + 6;
      break;
  }
  // Indented from the start side (Home → Paragraph), and in front of the text of a list the room for its markers.
  const indent = Math.min(Math.max(0, Math.min(b.indent ?? 0, MAX_INDENT)) * INDENT_PX, Math.max(0, width - 40));
  const markers: ListMarker[] = [];
  let text: TextBox;
  const items = b.list ? splitParagraphs(b.text) : null;
  if (items && b.list) {
    // Every line is an item: its text is wrapped on its own, all with the same room for the markers.
    const labels = listMarkers(items.map(() => ({ list: b.list, level: 0, arabic: rtl })));
    const gap = Math.min(Math.max(...items.map((p, i) => markerGap(markerLine(labels[i] as string, parseRich(p), s.font, undefined)))), Math.max(0, width - indent - 40));
    const textW = width - indent - gap;
    const lines: RichLine[] = [];
    let top = y;
    items.forEach((p, i) => {
      const own = wrapRich(p || " ", textW, s.font, s.line);
      const placed = markerLine(labels[i] as string, parseRich(p), s.font, own[0]);
      markers.push({ line: placed, x: rtl ? x + width - indent - placed.width : x + indent, y: top, width: placed.width });
      lines.push(...own);
      top += linesHeight(own);
    });
    text = { lines, y, height: linesHeight(lines) };
    if (!rtl) x += indent + gap;
    width = textW;
  } else {
    if (indent && !rtl) x += indent;
    width -= indent;
    text = box(b.text, width, s, y);
  }
  const textW = Math.max(0, ...text.lines.map((l) => l.width));

  switch (kind) {
    case "underline": {
      const uw = Math.min(W, textW);
      const ux = align === "center" ? (w - uw) / 2 : rtl ? w - PAD - uw : PAD;
      deco = { kind, x: ux, y: y + text.height + 2, width: uw, height: 3 };
      break;
    }
    case "bar":
      deco = { kind, x: rtl ? w - PAD - 4 : PAD, y: y, width: 4, height: text.height };
      break;
    case "band":
    case "boxed":
      deco = { kind, x: 0, y: 0, width: w, height: text.height + 16 };
      break;
    case "pill": {
      const pw = Math.min(W, textW + 28);
      const px = align === "center" ? (w - pw) / 2 : rtl ? w - PAD - pw : PAD;
      deco = { kind, x: px, y: 0, width: pw, height: text.height + 14 };
      break;
    }
    case "rule": {
      // A line after the (first line of the) text, to the end of the block.
      const first = text.lines[0]?.width ?? 0;
      const midY = y + (text.lines[0]?.height ?? s.line) / 2;
      const gap = 12;
      deco =
        align === "center"
          ? { kind, x: PAD, y: midY, width: W, height: first } // drawn on both sides of the text
          : { kind, x: rtl ? PAD : PAD + first + gap, y: midY, width: Math.max(0, W - first - gap), height: 0 };
      break;
    }
  }
  // A shading or a border round the text (not under a decoration of its own).
  const around =
    kind === "plain" && (b.shading || b.border)
      ? {
          x: Math.max(0, (rtl ? PAD : PAD + indent) - BOX_PAD),
          y: text.y - 3,
          width: W - indent + BOX_PAD * 2,
          height: text.height + 6,
          ...(b.shading ? { shading: b.shading } : {}),
          ...(b.border ? { border: b.border, ...(b.borderColor ? { borderColor: b.borderColor } : {}) } : {}),
        }
      : null;
  return { spec: s, text, x, width, align, deco, rtl, markers, box: around satisfies ParagraphBox | null, height: y + text.height + extra };
}

export const TABLE_MIN_COL = 24;

// Width of each column in px (the teacher can drag the lines; missing = equal columns).
export function tableColumnWidths(b: TableBlock): number[] {
  const cols = Math.max(1, b.cells[0]?.length ?? 1);
  const w = b.layout.width;
  const shares = b.colWidths?.length === cols ? b.colWidths : null;
  const sum = shares ? shares.reduce((s, v) => s + v, 0) : 0;
  return Array.from({ length: cols }, (_, c) => (shares && sum > 0 ? (shares[c] / sum) * w : w / cols));
}

// One cell of a laid-out table (a merged cell is one box): where it is, its text, how it is drawn. `fill` and `align` are only
// set where the table asks for them.
export interface TableCellBox {
  r: number;
  c: number;
  x: number;
  y: number;
  w: number;
  h: number;
  text: TextBox;
  /** Top of the text, in block coordinates */
  textY: number;
  spec: Spec;
  align?: "left" | "center" | "right";
  fill?: string;
}

export interface TableLayout {
  F: Fonts;
  colX: number[];
  colW: number[];
  rows: { y: number; height: number; cells: TextBox[]; bold: boolean }[];
  height: number;
  /** Every cell (a merged one once), for drawing and for typing in */
  cellBoxes: TableCellBox[];
  /** Whether the table has any of the extras (merges, looks, borders, formulas): a plain one is drawn the way tables always were */
  ext: boolean;
  /** The first column is on the right (an Arabic exam, or a table flipped in a French one): the text keeps the exam's direction */
  mirror: boolean;
  /** With extras: the lines to draw, as [x1, y1, x2, y2] */
  lines: [number, number, number, number][];
}

// In Arabic the first column is on the right.
export function layoutTable(b: TableBlock, meta: ExamMeta): TableLayout {
  const F = blockFonts(b, meta);
  const mirror = tableMirrored(b, F.rtl);
  const w = b.layout.width;
  const colW = tableColumnWidths(b);
  let acc = 0;
  const colX = colW.map((cw) => {
    const x = mirror ? w - acc - cw : acc;
    acc += cw;
    return x;
  });
  if (!isPlainTable(b)) return layoutTableExt(b, F, mirror, colW, colX);
  const boldBody: Spec = { ...F.body, font: { ...F.body.font, bold: true } };
  let y = 0;
  const cellBoxes: TableCellBox[] = [];
  const rows = b.cells.map((row, r) => {
    const bold = b.header && r === 0;
    const spec = bold ? boldBody : F.body;
    const cells = row.map((c, k) => box(c, (colW[k] ?? colW[0]) - 12, spec, 0));
    const h = Math.max(TABLE_MIN_ROW, b.rowHeights?.[r] ?? 0, ...cells.map((c) => c.height + 8));
    const out = { y, height: h, cells, bold };
    cells.forEach((text, c) => cellBoxes.push({ r, c, x: colX[c], y, w: colW[c], h, text, textY: y + (h - text.height) / 2, spec, align: bold ? "center" : undefined }));
    y += h;
    return out;
  });
  return { F, colX, colW, rows, height: y, cellBoxes, ext: false, mirror, lines: [] };
}

export { TABLE_HEADER_FILL };

// A table with merged cells, cell looks, borders, banding or formulas.
function layoutTableExt(b: TableBlock, F: Fonts, mirror: boolean, colW: number[], colX: number[]): TableLayout {
  const w = b.layout.width;
  const rowsN = b.cells.length;
  const colsN = colW.length;
  const sheet = tableSheet(b);
  const body = F.body.font;

  // the text of every cell that is not under a merged cell
  type Item = { r: number; c: number; rs: number; cs: number; x: number; w: number; spec: Spec; text: TextBox; look: CellLook };
  const items: Item[] = [];
  const logical: TextBox[][] = b.cells.map((row) => row.map(() => ({ lines: [], y: 0, height: 0 })));
  for (let r = 0; r < rowsN; r++)
    for (let c = 0; c < colsN; c++) {
      if (isCovered(b, r, c)) continue;
      const m = mergeAt(b, r, c);
      const rs = m?.rs ?? 1;
      const cs = Math.min(m?.cs ?? 1, colsN - c);
      const span = Array.from({ length: cs }, (_, k) => c + k);
      const width = span.reduce((s, k) => s + colW[k], 0);
      const x = Math.min(...span.map((k) => colX[k]));
      const look = cellLook(b, r, c);
      const size = look.size ?? body.size;
      const font = { ...body, family: look.family ? fontStack(look.family) : body.family, size, bold: look.bold ?? body.bold, italic: look.italic ?? body.italic, color: look.color ?? body.color };
      const spec: Spec = { font, line: size === body.size ? F.body.line : Math.round(size * (20 / 14)) };
      const text = box(shownText(b, sheet, r, c, F.lang), width - 12, spec, 0);
      logical[r][c] = text;
      items.push({ r, c, rs, cs, x, w: width, spec, text, look });
    }

  // heights: a row fits its single-row cells; a merged cell over several rows asks the last of them for what it lacks
  const heights = Array.from({ length: rowsN }, (_, r) => Math.max(TABLE_MIN_ROW, b.rowHeights?.[r] ?? 0));
  for (const it of items) if (it.rs === 1) heights[it.r] = Math.max(heights[it.r], it.text.height + 8);
  for (const it of items) {
    if (it.rs <= 1) continue;
    const have = heights.slice(it.r, it.r + it.rs).reduce((s, v) => s + v, 0);
    const need = it.text.height + 8;
    if (need > have) heights[Math.min(it.r + it.rs, rowsN) - 1] += need - have;
  }
  let y = 0;
  const ys = heights.map((h) => {
    const top = y;
    y += h;
    return top;
  });
  const height = y;
  const rows = heights.map((h, r) => ({ y: ys[r], height: h, cells: logical[r], bold: b.header && r === 0 }));

  const cellBoxes: TableCellBox[] = items.map((it) => {
    const top = ys[it.r];
    const h = heights.slice(it.r, it.r + it.rs).reduce((s, v) => s + v, 0);
    const valign = it.look.valign;
    const textY = valign === "top" ? top + 4 : valign === "bottom" ? top + h - it.text.height - 4 : top + (h - it.text.height) / 2;
    return { r: it.r, c: it.c, x: it.x, y: top, w: it.w, h, text: it.text, textY, spec: it.spec, align: it.look.align, fill: it.look.fill };
  });

  // the lines: every edge of the grid that is drawn, except inside a merged cell
  const lines: TableLayout["lines"] = [];
  for (let i = 0; i <= rowsN; i++)
    for (let c = 0; c < colsN; c++) {
      if (!hEdgeShown(b, rowsN, i, c)) continue;
      const above = i > 0 ? mergeAt(b, i - 1, c) : undefined;
      if (i > 0 && i < rowsN && above && above === mergeAt(b, i, c)) continue;
      const yy = i === rowsN ? height : ys[i];
      lines.push([colX[c], yy, colX[c] + colW[c], yy]);
    }
  for (let j = 0; j <= colsN; j++)
    for (let r = 0; r < rowsN; r++) {
      if (!vEdgeShown(b, colsN, j, r)) continue;
      const before = j > 0 ? mergeAt(b, r, j - 1) : undefined;
      if (j > 0 && j < colsN && before && before === mergeAt(b, r, j)) continue;
      const x = mirror ? (j === 0 ? w : colX[j - 1]) : j === colsN ? w : colX[j];
      lines.push([x, ys[r], x, ys[r] + heights[r]]);
    }
  return { F, colX, colW, rows, height, cellBoxes, ext: true, mirror, lines };
}

// A table is as high as its rows, or lower if a shape drawn over it goes below them.
export function tableHeight(b: TableBlock, meta: ExamMeta): number {
  const rows = layoutTable(b, meta).height;
  const shapes = shapesBounds(b.shapes);
  return shapes ? Math.max(rows, Math.ceil(shapes.maxY)) : rows;
}

// Height of any block (used for stacking, snapping and thumbnails).
export function blockHeight(b: Block, n: number, meta: ExamMeta): number {
  switch (b.type) {
    case "mcq":
      return layoutMcq(b, n, meta).height;
    case "truefalse":
      return layoutTrueFalse(b, n, meta).height;
    case "blank":
      return layoutBlank(b, n, meta).height;
    case "open":
      return layoutOpen(b, n, meta).height;
    case "match":
      return layoutMatch(b, n, meta).height;
    case "order":
      return layoutOrder(b, n, meta).height;
    case "classify":
      return layoutClassify(b, n, meta).height;
    case "text":
      return layoutText(b, meta).height;
    case "textbox":
      return layoutTextbox(b, meta).height;
    case "table":
      return tableHeight(b, meta);
    case "header":
      return HEADER_HEIGHT[b.style] ?? HEADER_HEIGHT.classic;
    case "equation":
    case "image":
    case "graph":
    case "shape":
      return b.layout.height;
  }
}
