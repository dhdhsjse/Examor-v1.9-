// The sheet and the exam it was made from. Each block made from the exam says which block it came from (`meta.source`), so the two can be compared:
// the marks of a row against the points of its questions (and either set from the other), the questions that are not in the sheet yet (they can be put
// in), what the sheet has of questions the exam no longer has (it can be taken out). Nothing is kept in step by itself: the sheet is the teacher's.
// Every function takes the whole file and gives back the whole file.
import { isQuestion, questionNumbers } from "../blocks";
import type { Block, ExamDoc, MarkBlock, OpenBlock, QuestionBlock } from "../types";
import { anchorsOf, generateCorrection, markSlots, questionsOf, sourcesOf, stickersFor, type SheetMakeOptions } from "./generate";
import { isMark, sheetScores } from "./marks";
import type { SheetTemplate } from "./model";
import { settleSheet } from "./settle";
import { mergeView, viewOf, withCorrection } from "./part";
import { addTotals } from "./totals";
import { addQuestions, packSheet, refitSheet, refreshSources, restyleAnswers, staleSources, type AnswerLook, type StaleSource } from "./refresh";

export interface MarksDiff {
  /** The questions of the row (several when the line between them is gone) */
  questions: { id: string; n: number; points: number }[];
  /** What the exam gives them together */
  exam: number;
  /** What their row of the sheet adds up to */
  sheet: number;
  /** The points of the exam can be set from the marks of the sheet (a question with sub-questions needs a mark for each of them) */
  adoptable: boolean;
}

export interface SheetReport {
  template: SheetTemplate;
  /** Some of the blocks of the sheet say which block of the exam they come from (a blank sheet has none: nothing can be compared) */
  linked: boolean;
  /** The questions of the exam that have nothing in the sheet */
  missing: { id: string; n: number }[];
  /** What the sheet has of blocks the exam no longer has (the ids of those blocks) */
  orphans: string[];
  diffs: MarksDiff[];
  /** The answers, copies and titles of the sheet that the exam has changed since they were made (they can be brought up to date where they stand) */
  stale: StaleSource[];
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;
const SAME = 1e-6;

/** The marks of the sub-questions of an open question, one for each, when the sheet has exactly one mark for each of them */
function partMarks(sheetBlocks: Block[], q: OpenBlock): number[] | null {
  const parts = q.parts ?? [];
  const mine = sheetBlocks.filter((b): b is MarkBlock => isMark(b) && b.meta?.source?.id === q.id && b.kind !== "total");
  if (mine.some((m) => m.kind !== "number" || m.meta?.source?.part === undefined)) return null;
  const values: number[] = [];
  for (let i = 0; i < parts.length; i++) {
    const own = mine.filter((m) => m.meta?.source?.part === i);
    if (own.length !== 1) return null;
    values.push(own[0].value ?? 0);
  }
  return values;
}

/** The sheet of `full` against its exam (null: it has no sheet) */
export function linkReport(full: ExamDoc): SheetReport | null {
  const c = full.correction;
  if (!c) return null;
  const sheet = viewOf(full, "sheet");
  const template = c.template ?? "blank";
  const sources = new Set(sheet.blocks.flatMap((b) => (b.meta?.source ? [b.meta.source.id] : [])));
  if (!sources.size) return { template, linked: false, missing: [], orphans: [], diffs: [], stale: [] };

  const numbers = questionNumbers(full.blocks, full.pages);
  const questions = questionsOf(full);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const known = new Set(full.blocks.map((b) => b.id));
  const missing = questions.filter((q) => !sources.has(q.id)).map((q) => ({ id: q.id, n: numbers.get(q.id) ?? 0 }));
  const orphans = [...sources].filter((id) => !known.has(id));

  // A row of the sheet against the points of the questions whose marks are in it
  const diffs: MarksDiff[] = [];
  const covered = new Set<string>();
  for (const row of sheetScores(sheet).rows) {
    const ids = [...new Set([...row.marks, ...row.totals].flatMap((b) => (b.meta?.source && byId.has(b.meta.source.id) ? [b.meta.source.id] : [])))];
    if (!ids.length) continue;
    ids.forEach((id) => covered.add(id));
    const qs = ids.map((id) => byId.get(id)!);
    const exam = round3(qs.reduce((s, q) => s + q.points, 0));
    if (Math.abs(exam - row.score) <= SAME) continue;
    const one = qs.length === 1 ? qs[0] : null;
    const adoptable = !!one && (one.type !== "open" || !one.parts?.length || partMarks(sheet.blocks, one) !== null);
    diffs.push({ questions: qs.map((q) => ({ id: q.id, n: numbers.get(q.id) ?? 0, points: q.points })), exam, sheet: row.score, adoptable });
  }
  // a question that has answers in the sheet and no mark at all
  for (const q of questions) {
    if (!sources.has(q.id) || covered.has(q.id) || !(q.points > 0)) continue;
    diffs.push({ questions: [{ id: q.id, n: numbers.get(q.id) ?? 0, points: q.points }], exam: round3(q.points), sheet: 0, adoptable: false });
  }
  diffs.sort((a, b) => a.questions[0].n - b.questions[0].n);
  const stale = template === "answers" || template === "copy" ? staleSources(full, sheet, template) : [];
  return { template, linked: true, missing, orphans, diffs, stale };
}

/** What can be done to bring the sheet and the exam in step (Shell.sheetFix): each is one undo step */
export type SheetFix = {
  addMissing: (ids?: string[]) => void; // the questions the sheet lacks put in their place among its rows (none given: all of them)
  refresh: (ids?: string[]) => void; // the answers that changed in the exam brought up to date where they stand (none given: all of them)
  refit: () => void; // the answers fitted to the answer column again, after its frame was changed
  pack: () => void; // the rows laid out again from the first one, page after page (rows that were pushed to the next page come back)
  restyle: (look: AnswerLook) => void; // the answers in a new size and color (the rows under make room)
  addTotals: () => void; // the total sticker that each row with several marks lacks
  removeOrphans: () => void; // what the sheet has of questions that are gone taken out
  resetMarks: (ids: string[]) => void; // the marks of these questions made again from their points
  adoptMarks: (ids: string[]) => void; // the points of these questions set from the marks of the sheet
};

/** Apply a change to the sheet as a document, with the exam to look at: the whole file back */
function onSheet(full: ExamDoc, fn: (sheet: ExamDoc, exam: ExamDoc) => ExamDoc): ExamDoc {
  if (!full.correction) return full;
  const sheet = viewOf(full, "sheet");
  return mergeView(full, settleSheet(fn(sheet, full)), "sheet");
}

/** The questions of the exam that are not in the sheet put in their place among its rows (`ids`: only these; none: all of them), as it was made */
export function addMissing(full: ExamDoc, ids?: string[]): ExamDoc {
  const c = full.correction;
  if (!c || (c.template !== "answers" && c.template !== "copy")) return full;
  const report = linkReport(full);
  const wanted = (ids ?? report?.missing.map((m) => m.id) ?? []).filter((id) => report?.missing.some((m) => m.id === id));
  const template = c.template;
  return onSheet(full, (sheet, exam) => addQuestions(exam, sheet, template, wanted, sheet.blocks.some(isMark)));
}

/** The answers and copies the exam has changed since (`ids`: only these; none: all of them) made again where they stand: the rows under make room */
export function refreshStale(full: ExamDoc, ids?: string[]): ExamDoc {
  const c = full.correction;
  const report = linkReport(full);
  if (!c || !report || (c.template !== "answers" && c.template !== "copy")) return full;
  const wanted = (ids ?? report.stale.map((s) => s.id)).filter((id) => report.stale.some((s) => s.id === id));
  if (!wanted.length) return full;
  const template = c.template;
  return onSheet(full, (sheet, exam) => refreshSources(exam, sheet, template, wanted));
}

/** The answers and copies fitted to the answer column as it is now: after the frame or its columns were changed */
export function refitAnswers(full: ExamDoc): ExamDoc {
  const c = full.correction;
  if (!c || (c.template !== "answers" && c.template !== "copy")) return full;
  const template = c.template;
  return onSheet(full, (sheet, exam) => refitSheet(exam, sheet, template));
}

/** The answers of a sheet of the answers in a new size and/or color */
export function restyleFull(full: ExamDoc, look: AnswerLook): ExamDoc {
  const c = full.correction;
  if (!c || c.template !== "answers") return full;
  return onSheet(full, (sheet, exam) => restyleAnswers(exam, sheet, look));
}

/** The totals that the rows with several marks lack (any sheet, whatever it was made from) */
export function addRowTotals(full: ExamDoc): ExamDoc {
  if (!full.correction) return full;
  return mergeView(full, addTotals(viewOf(full, "sheet")), "sheet");
}

/** The rows laid out again from the first one, page after page */
export function packRows(full: ExamDoc): ExamDoc {
  const c = full.correction;
  if (!c || (c.template !== "answers" && c.template !== "copy")) return full;
  return onSheet(full, (sheet) => packSheet(sheet));
}

/** What the sheet has of blocks the exam no longer has taken out (the marks and lines that were made for them too) */
export function removeOrphans(full: ExamDoc): ExamDoc {
  const orphans = new Set(linkReport(full)?.orphans ?? []);
  if (!orphans.size) return full;
  return onSheet(full, (sheet) => ({ ...sheet, blocks: sheet.blocks.filter((b) => !(b.meta?.source && orphans.has(b.meta.source.id))) }));
}

/** The marks of the questions `ids` made again from their points, level with their answers; the old ones go */
export function resetMarks(full: ExamDoc, ids: string[]): ExamDoc {
  const wanted = new Set(ids);
  return onSheet(full, (sheet, exam) => {
    const by = sourcesOf(sheet.blocks);
    const sheetNumbers = questionNumbers(sheet.blocks, sheet.pages);
    const examNumbers = questionNumbers(exam.blocks, exam.pages);
    let blocks = sheet.blocks;
    const made: Block[] = [];
    for (const q of questionsOf(exam).filter((x) => wanted.has(x.id))) {
      const mine = anchorsOf(by, q.id);
      const own = (b: Block) => isMark(b) && b.meta?.source?.id === q.id;
      if (mine.length) {
        const n = sheetNumbers.get((mine.find(isQuestion) ?? mine[0]).id) ?? examNumbers.get(q.id) ?? 1;
        blocks = blocks.filter((b) => !own(b));
        made.push(...stickersFor(q, markSlots(q, mine, n, exam.meta), exam.meta.lang, exam.meta));
        continue;
      }
      // (its answers are gone: the first of its marks takes the points of the question, the others go)
      const first = blocks.find((b): b is MarkBlock => isMark(b) && b.meta?.source?.id === q.id && b.kind === "number");
      if (!first) continue;
      blocks = blocks.filter((b) => !own(b) || b === first).map((b) => (b === first ? ({ ...b, value: round3(q.points), meta: { source: { id: q.id } } } as Block) : b));
    }
    return { ...sheet, blocks: [...blocks, ...made] };
  });
}

/** The points of the questions `ids` set from the marks of their rows in the sheet (the ones that can be: see `adoptable`) */
export function adoptMarks(full: ExamDoc, ids: string[]): ExamDoc {
  const report = linkReport(full);
  const c = full.correction;
  if (!report || !c) return full;
  const sheet = viewOf(full, "sheet");
  const wanted = new Set(ids);
  const points = new Map<string, QuestionBlock>();
  for (const d of report.diffs) {
    if (!d.adoptable || d.questions.length !== 1 || !wanted.has(d.questions[0].id)) continue;
    const q = questionsOf(full).find((x) => x.id === d.questions[0].id);
    if (!q) continue;
    if (q.type === "open" && q.parts?.length) {
      const marks = partMarks(sheet.blocks, q);
      if (!marks) continue;
      const next = q.parts.map((p, i) => ({ ...p, points: round3(marks[i]) }));
      points.set(q.id, { ...q, parts: next, points: round3(next.reduce((s, p) => s + p.points, 0)) });
    } else points.set(q.id, { ...q, points: round3(Math.max(0, d.sheet)) } as QuestionBlock);
  }
  if (!points.size) return full;
  return { ...full, blocks: full.blocks.map((b) => points.get(b.id) ?? b) };
}

/** The whole sheet made again from the exam (its settings kept), as the wizard says; the old one goes */
export function rebuildSheet(full: ExamDoc, opts: Omit<SheetMakeOptions, "keep">): ExamDoc {
  const keep = full.correction?.sheet;
  return withCorrection(full, generateCorrection(full, { ...opts, ...(keep ? { keep } : {}) }));
}
