import { optionLabel, words } from "./i18n";
import { wrapText } from "./measure";
import type {
  BlankBlock,
  Block,
  HeaderStyle,
  Lang,
  McqBlock,
  OpenBlock,
  QuestionBlock,
  TableBlock,
  TextBlock,
  TextStyle,
  TrueFalseBlock,
} from "./types";

// Shared sizes for drawing blocks (page pixels).
export const PAD = 10;
export const GAP = 8;
export const TITLE = { size: 15, line: 21 };
export const BODY = { size: 14, line: 20 };
export const ANSWER_LINE = 28; // spacing of dotted answer lines
export const CHOICE_W = 150; // "□ Vrai  □ Faux" column
export const TABLE_MIN_ROW = 28;

export const TEXT_STYLES: Record<TextStyle, { size: number; line: number; bold: boolean }> = {
  title: { size: 20, line: 28, bold: true },
  heading: { size: 16, line: 23, bold: true },
  body: { size: 14, line: 20, bold: false },
};

export const HEADER_HEIGHT: Record<HeaderStyle, number> = { classic: 150, modern: 136, minimal: 112 };

// A wrapped piece of text placed at `y`.
export interface TextBox {
  lines: string[];
  y: number;
  height: number;
}

function box(text: string, width: number, spec: { size: number; line: number }, bold: boolean, y: number): TextBox {
  const lines = wrapText(text, Math.max(20, width), spec.size, bold);
  return { lines, y, height: lines.length * spec.line };
}

// "3. Question text (2 pts)"
export function questionTitle(b: QuestionBlock, n: number, lang: Lang): string {
  const pts = b.points > 0 ? ` ${words(lang).pts(b.points)}` : "";
  return `${n}. ${b.text}${pts}`;
}

const inner = (b: Block) => b.layout.width - PAD * 2;

export function layoutMcq(b: McqBlock, n: number, lang: Lang) {
  const title = box(questionTitle(b, n, lang), inner(b), TITLE, true, PAD);
  let y = PAD + title.height + GAP;
  const options = b.options.map((opt, i) => {
    const t = box(`${optionLabel(i, lang)})  ${opt}`, inner(b) - 30, BODY, false, y);
    y += t.height + 6;
    return t;
  });
  return { title, options, height: y - (options.length ? 6 : GAP) + PAD };
}

export function layoutTrueFalse(b: TrueFalseBlock, n: number, lang: Lang) {
  const title = box(questionTitle(b, n, lang), inner(b), TITLE, true, PAD);
  let y = PAD + title.height + GAP;
  const rows = b.statements.map((s, i) => {
    const t = box(`${i + 1}) ${s.text}`, inner(b) - CHOICE_W - 10, BODY, false, y);
    const rowH = Math.max(t.height, 22);
    const row = { ...t, height: rowH };
    y += rowH + 6;
    return row;
  });
  return { title, rows, height: y - (rows.length ? 6 : GAP) + PAD };
}

// Blanks: "[answer]" becomes "________" on the exam, "« answer »" on the key.
const BLANK_RE = /\[([^\]]*)\]/g;
export const blankExamText = (s: string) => s.replace(BLANK_RE, (_, a: string) => "_".repeat(Math.max(8, a.length + 4)));
export const blankKeyText = (s: string) => s.replace(BLANK_RE, (_, a: string) => `« ${a} »`);
export const blankAnswers = (s: string) => [...s.matchAll(BLANK_RE)].map((m) => m[1]);

export function layoutBlank(b: BlankBlock, n: number, lang: Lang) {
  const title = box(questionTitle(b, n, lang), inner(b), TITLE, true, PAD);
  const y = PAD + title.height + GAP;
  const exam = box(blankExamText(b.content), inner(b), BODY, false, y);
  const key = box(blankKeyText(b.content), inner(b), BODY, false, y);
  // Same height in both modes, so nothing moves when switching to the key.
  return { title, exam, key, height: y + Math.max(exam.height, key.height) + PAD };
}

export function layoutOpen(b: OpenBlock, n: number, lang: Lang) {
  const title = box(questionTitle(b, n, lang), inner(b), TITLE, true, PAD);
  const y = PAD + title.height + GAP;
  const answer = box(b.answer, inner(b), { size: BODY.size, line: ANSWER_LINE }, false, y);
  const lineCount = Math.max(b.lines, b.answer.trim() ? answer.lines.length : 0);
  return { title, answer, linesY: y, lineCount, height: y + lineCount * ANSWER_LINE + PAD };
}

export function layoutText(b: TextBlock) {
  const s = TEXT_STYLES[b.style];
  const t = box(b.text, inner(b), s, s.bold, PAD / 2);
  return { text: t, height: t.height + PAD };
}

export function layoutTable(b: TableBlock) {
  const cols = Math.max(1, b.cells[0]?.length ?? 1);
  const colW = b.layout.width / cols;
  let y = 0;
  const rows = b.cells.map((row, r) => {
    const bold = b.header && r === 0;
    const cells = row.map((c) => box(c, colW - 12, BODY, bold, 0));
    const h = Math.max(TABLE_MIN_ROW, ...cells.map((c) => c.height + 8));
    const out = { y, height: h, cells, bold };
    y += h;
    return out;
  });
  return { colW, rows, height: y };
}

// Height of any block (used for stacking, snapping and thumbnails).
export function blockHeight(b: Block, n: number, lang: Lang): number {
  switch (b.type) {
    case "mcq":
      return layoutMcq(b, n, lang).height;
    case "truefalse":
      return layoutTrueFalse(b, n, lang).height;
    case "blank":
      return layoutBlank(b, n, lang).height;
    case "open":
      return layoutOpen(b, n, lang).height;
    case "text":
      return layoutText(b).height;
    case "table":
      return layoutTable(b).height;
    case "header":
      return HEADER_HEIGHT[b.style];
    case "equation":
    case "image":
      return b.layout.height;
  }
}
