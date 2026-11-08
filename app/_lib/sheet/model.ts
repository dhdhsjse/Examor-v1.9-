// The correction sheet: the answer key of an exam, on pages of its own (ExamDoc.correction). Its settings: the paper (free, or bordered like the
// official answer keys: a frame with a column of marks and a column of totals), and the look of the marks. Nothing here is React or the browser.
import type { Lang } from "../types";

export type SheetPaper = "free" | "bordered";
/** What a correction sheet is made from: nothing, a row per question with its answer, or the exam itself with its answers */
export type SheetTemplate = "blank" | "answers" | "copy";

/** What the teacher chooses in the wizard: what the sheet is made from, on which paper, and whether the marks of the questions are put on it */
export interface SheetChoice {
  template: SheetTemplate;
  paper: SheetPaper;
  marks: boolean;
}
/** On which pages the titles of the columns are written */
export type HeadingScope = "first" | "all" | "none";

/** A column of the frame: its width (page px) and its title */
export interface SheetColumn {
  width: number;
  title: string;
}

/** How far the frame goes past the margin box on each side (px; negative: inside the margins), and how much lower it starts on the first page */
export interface FrameOffsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
  firstTop: number;
}

export interface SheetConfig {
  paper: SheetPaper;
  /** The column of the marks of each answer (null: none) */
  marks: SheetColumn | null;
  /** The column of the total of each row (null: none) */
  total: SheetColumn | null;
  /** The title over both mark columns ("Note") */
  markTitle: string;
  /** The title of the column of the answers */
  answerTitle: string;
  headings: HeadingScope;
  frame: FrameOffsets;
  line: { color: string; width: number };
  /** Whole marks under ten written with a zero first: "01" (always, now: the panel has no switch for it) */
  pad: boolean;
  /** false: the totals are not calculated (a total shows only what is typed in it); missing = calculated */
  autoTotals?: boolean;
}

export const MIN_COLUMN = 36;
export const MAX_COLUMN = 220;
export const MIN_ANSWER_WIDTH = 160;
export const MAX_OFFSET = 120;

const TITLES = {
  fr: { mark: "Note", marks: "Partielle", total: "Totale", answer: "Éléments de réponse" },
  ar: { mark: "العلامة", marks: "مجزأة", total: "مجموعة", answer: "عناصر الإجابة" },
};

export const defaultSheet = (lang: Lang, paper: SheetPaper = "bordered"): SheetConfig => {
  const w = TITLES[lang] ?? TITLES.fr;
  return {
    paper,
    marks: { width: 64, title: w.marks },
    total: { width: 64, title: w.total },
    markTitle: w.mark,
    answerTitle: w.answer,
    headings: "first",
    frame: { top: 0, right: 0, bottom: 0, left: 0, firstTop: 0 },
    line: { color: "#111111", width: 1.2 },
    pad: true,
  };
};

const num = (v: unknown, fallback: number, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback);

const column = (raw: unknown, fallback: SheetColumn | null): SheetColumn | null => {
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return fallback;
  const c = raw as Partial<SheetColumn>;
  return { width: num(c.width, fallback?.width ?? 64, MIN_COLUMN, MAX_COLUMN), title: typeof c.title === "string" ? c.title : (fallback?.title ?? "") };
};

/** A sheet read from a file: what an older version lacks gets its usual value */
export function normalizeSheet(raw: Partial<SheetConfig> | undefined, lang: Lang): SheetConfig {
  const d = defaultSheet(lang);
  if (!raw || typeof raw !== "object") return d;
  const f: Partial<FrameOffsets> = raw.frame ?? {};
  const side = (v: unknown) => num(v, 0, -MAX_OFFSET, MAX_OFFSET);
  return {
    paper: raw.paper === "free" ? "free" : "bordered",
    marks: raw.marks === undefined ? d.marks : column(raw.marks, d.marks),
    total: raw.total === undefined ? d.total : column(raw.total, d.total),
    markTitle: typeof raw.markTitle === "string" ? raw.markTitle : d.markTitle,
    answerTitle: typeof raw.answerTitle === "string" ? raw.answerTitle : d.answerTitle,
    headings: raw.headings === "all" || raw.headings === "none" ? raw.headings : "first",
    frame: { top: side(f.top), right: side(f.right), bottom: side(f.bottom), left: side(f.left), firstTop: num(f.firstTop, 0, 0, 600) },
    line: { color: typeof raw.line?.color === "string" ? raw.line.color : d.line.color, width: num(raw.line?.width, d.line.width, 0.5, 6) },
    pad: true, // (older sheets too: whole marks are always written 01, 02)
    ...(raw.autoTotals === false ? { autoTotals: false } : {}),
  };
}
