import { fontStack } from "./fonts";
import { isRtl, optionLabel, words } from "./i18n";
import { linesHeight, wrapRich, type RichLine, type TextFont } from "./measure";
import { plainText, replaceBlanks, serializeRich } from "./richText";
import { fixOrder, shuffled } from "./shuffle";
import type {
  BlankBlock,
  Block,
  ClassifyBlock,
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
  TableBlock,
  TextBlock,
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

const spec = (family: string, size: number, bold: boolean, color: string, ratio: number): Spec => ({
  font: { family, size, bold, italic: false, underline: false, color },
  line: Math.round(size * ratio),
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
    title: spec(family, size + 1, true, color, 21 / 15),
    body: spec(family, size, false, color, 20 / 14),
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
  return spec(fontStack(b.font?.family || meta.fontFamily), size, s.bold, color, s.line / s.size);
}

export interface Decoration {
  kind: HeadingDecor;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function layoutText(b: TextBlock, meta: ExamMeta) {
  const rtl = isRtl(meta.lang);
  const s = textSpec(b, meta);
  const w = b.layout.width;
  const W = inner(b);
  const kind = b.decor ?? "plain";
  const align: "left" | "right" | "center" | undefined = b.style === "title" ? "center" : undefined;
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
  const text = box(b.text, width, s, y);
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
  return { spec: s, text, x, width, align, deco, height: y + text.height + extra };
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

// In Arabic the first column is on the right.
export function layoutTable(b: TableBlock, meta: ExamMeta) {
  const F = blockFonts(b, meta);
  const rtl = F.rtl;
  const w = b.layout.width;
  const colW = tableColumnWidths(b);
  let acc = 0;
  const colX = colW.map((cw) => {
    const x = rtl ? w - acc - cw : acc;
    acc += cw;
    return x;
  });
  const boldBody: Spec = { ...F.body, font: { ...F.body.font, bold: true } };
  let y = 0;
  const rows = b.cells.map((row, r) => {
    const bold = b.header && r === 0;
    const cells = row.map((c, k) => box(c, (colW[k] ?? colW[0]) - 12, bold ? boldBody : F.body, 0));
    const h = Math.max(TABLE_MIN_ROW, b.rowHeights?.[r] ?? 0, ...cells.map((c) => c.height + 8));
    const out = { y, height: h, cells, bold };
    y += h;
    return out;
  });
  return { F, colX, colW, rows, height: y };
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
    case "table":
      return layoutTable(b, meta).height;
    case "header":
      return HEADER_HEIGHT[b.style] ?? HEADER_HEIGHT.classic;
    case "equation":
    case "image":
    case "graph":
      return b.layout.height;
  }
}
