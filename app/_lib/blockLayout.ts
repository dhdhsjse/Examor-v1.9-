import { fontStack } from "./fonts";
import { isRtl, optionLabel, words } from "./i18n";
import { linesHeight, wrapRich, type RichLine, type TextFont } from "./measure";
import { plainText, replaceBlanks, serializeRich } from "./richText";
import type {
  BlankBlock,
  Block,
  ExamMeta,
  HeaderStyle,
  HeadingDecor,
  Lang,
  McqBlock,
  OpenBlock,
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

export const HEADER_HEIGHT: Record<HeaderStyle, number> = { classic: 150, modern: 136, minimal: 112, banner: 140, elegant: 134 };

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

export function layoutMcq(b: McqBlock, n: number, meta: ExamMeta) {
  const F = blockFonts(b, meta);
  const title = box(questionTitle(b, n, F), inner(b), F.title, PAD);
  let y = PAD + title.height + GAP;
  const options = b.options.map((opt, i) => {
    const t = box(`${optionLabel(i, F.lang)})  ${opt}`, inner(b) - 30, F.body, y);
    y += t.height + 6;
    return t;
  });
  return { F, title, options, height: y - (options.length ? 6 : GAP) + PAD };
}

export function layoutTrueFalse(b: TrueFalseBlock, n: number, meta: ExamMeta) {
  const F = blockFonts(b, meta);
  const title = box(questionTitle(b, n, F), inner(b), F.title, PAD);
  let y = PAD + title.height + GAP;
  const rows = b.statements.map((s, i) => {
    const t = box(`${i + 1}) ${s.text}`, inner(b) - CHOICE_W - 10, F.body, y);
    const row = { ...t, height: Math.max(t.height, F.body.line + 2) };
    y += row.height + 6;
    return row;
  });
  return { F, title, rows, height: y - (rows.length ? 6 : GAP) + PAD };
}

// Blanks: "[answer]" becomes "________" on the exam, "« answer »" (answer color) on the key.
export const blankAnswers = (s: string) => [...plainText(s).matchAll(/\[([^\]]*)\]/g)].map((m) => m[1]);
const blankExam = (s: string) => serializeRich(replaceBlanks(s, (a) => ({ text: "_".repeat(Math.max(8, a.length + 4)) })));
const blankKey = (s: string, color: string) => serializeRich(replaceBlanks(s, (a) => ({ text: `« ${a} »`, style: { color, b: true } })));

export function layoutBlank(b: BlankBlock, n: number, meta: ExamMeta) {
  const F = blockFonts(b, meta);
  const title = box(questionTitle(b, n, F), inner(b), F.title, PAD);
  const y = PAD + title.height + GAP;
  const exam = box(blankExam(b.content), inner(b), F.body, y);
  const key = box(blankKey(b.content, F.keyColor), inner(b), F.body, y);
  // Same height in both modes, so nothing moves when switching to the key.
  return { F, title, exam, key, height: y + Math.max(exam.height, key.height) + PAD };
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
  return { F, title, main, parts, height: y + PAD };
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
