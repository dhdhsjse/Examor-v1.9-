// The sheet and the exam it was made from. Each block made from the exam says which block it came from (`meta.source`), so the two can be compared:
// the marks of a row against the points of its questions (and either set from the other), the questions that are not in the sheet yet (they can be put
// in), what the sheet has of questions the exam no longer has (it can be taken out). One thing is kept in step by itself: a mark changed on the sheet
// sets the points of its question in the exam (`syncPoints`: the sheet is the one followed). The rest is the teacher's to do.
// Every function takes the whole file and gives back the whole file.
import { isQuestion, questionNumbers } from "../blocks";
import type { Block, ExamDoc, MarkBlock, OpenBlock, QuestionBlock } from "../types";
import { anchorsOf, copySig, generateCorrection, hostedShapes, markSlots, questionsOf, sourcesOf, stickersFor, totalsColumn, type SheetMakeOptions } from "./generate";
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
  /** The points of the exam can be set from the marks of the sheet: the row has a mark to go by (a question with no mark at all, or a row
   *  that adds up to less than nothing, cannot) */
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

/** What the marks of each sub-question of an open question add up to (one with no mark: 0), when every mark of the question is a number given to
 *  one of its sub-questions */
function partMarks(sheetBlocks: Block[], q: OpenBlock): number[] | null {
  const parts = q.parts ?? [];
  const mine = sheetBlocks.filter((b): b is MarkBlock => isMark(b) && b.meta?.source?.id === q.id && b.kind !== "total");
  if (!mine.length || mine.some((m) => m.kind !== "number" || m.meta?.source?.part === undefined || m.meta.source.part >= parts.length)) return null;
  return parts.map((_, i) => mine.filter((m) => m.meta?.source?.part === i).reduce((s, m) => s + (m.value ?? 0), 0));
}

/** `total` shared out as `weights` are (evenly when they are all 0), to the thousandth: the biggest share takes what the rounding left */
function split(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  const out = weights.map((w) => round3(sum > 0 ? (total * w) / sum : total / weights.length));
  const big = out.indexOf(Math.max(...out));
  out[big] = round3(out[big] + total - out.reduce((s, v) => s + v, 0));
  return out;
}

/** The question worth `total` points: a question with sub-questions gives each the marks the sheet has for it, or (when those do not add up to
 *  `total`: a typed total, several questions in one row) shares `total` out as its points were */
function withPoints(q: QuestionBlock, total: number, sheetBlocks: Block[]): QuestionBlock {
  if (q.type !== "open" || !q.parts?.length) return { ...q, points: round3(total) } as QuestionBlock;
  const own = partMarks(sheetBlocks, q);
  const values = own && Math.abs(own.reduce((s, v) => s + v, 0) - total) <= SAME ? own : split(total, q.parts.map((p) => p.points));
  const parts = q.parts.map((p, i) => ({ ...p, points: round3(values[i]) }));
  return { ...q, parts, points: round3(parts.reduce((s, p) => s + p.points, 0)) };
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
    const marked = row.marks.some((m) => m.kind === "number") || row.totals.some((m) => m.manual);
    const adoptable = marked && row.score >= 0;
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
        made.push(...stickersFor(q, markSlots(q, mine, n, exam.meta), exam.meta.lang, exam.meta, totalsColumn(sheet.sheet)));
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

/** The points of the questions `ids` set from the marks of their rows in the sheet (the ones that can be: see `adoptable`). Several questions in one
 *  row share its marks as their points were. */
export function adoptMarks(full: ExamDoc, ids: string[], report = linkReport(full)): ExamDoc {
  const c = full.correction;
  if (!report || !c) return full;
  const sheet = viewOf(full, "sheet");
  const wanted = new Set(ids);
  const byId = new Map(questionsOf(full).map((q) => [q.id, q]));
  const points = new Map<string, QuestionBlock>();
  for (const d of report.diffs) {
    if (!d.adoptable || !d.questions.some((q) => wanted.has(q.id))) continue;
    const qs = d.questions.flatMap((q) => byId.get(q.id) ?? []);
    if (qs.length !== d.questions.length) continue;
    const shares = qs.length === 1 ? [d.sheet] : split(d.sheet, qs.map((q) => q.points));
    qs.forEach((q, i) => points.set(q.id, withPoints(q, shares[i], sheet.blocks)));
  }
  if (!points.size) return full;
  const next = { ...full, blocks: full.blocks.map((b) => points.get(b.id) ?? b) };
  return c.template === "copy" ? recopyPoints(full, next, points) : next;
}

/** On a copy of the exam: the copies of the questions whose points changed take them too, and remember the question as it is now (else they would
 *  be told "changed in the exam"). A copy that was behind already stays as it was. */
function recopyPoints(before: ExamDoc, after: ExamDoc, changed: Map<string, QuestionBlock>): ExamDoc {
  const shapesBefore = hostedShapes(before);
  const shapesAfter = hostedShapes(after);
  let touched = false;
  const blocks = after.correction!.blocks.map((b) => {
    const src = b.meta?.source;
    const q = src ? changed.get(src.id) : undefined;
    const old = q && before.blocks.find((x) => x.id === q.id);
    if (!src || !q || !old || b.type !== q.type || src.sig === undefined || src.sig !== copySig(before, old, shapesBefore.get(q.id) ?? [])) return b;
    touched = true;
    const copy = b as QuestionBlock;
    const parts = copy.type === "open" && q.type === "open" && copy.parts ? { parts: copy.parts.map((p, i) => ({ ...p, points: q.parts?.[i]?.points ?? p.points })) } : {};
    return { ...copy, points: q.points, ...parts, meta: { ...b.meta, source: { ...src, sig: copySig(after, q, shapesAfter.get(q.id) ?? []) } } } as Block;
  });
  return touched ? { ...after, correction: { ...after.correction!, blocks } } : after;
}

/**
 * After a change made on the sheet: where the marks of a row no longer agree with the points of the exam, the sheet is followed and the points of
 * the exam are set from its marks (no warning is left behind). Only the rows that this change made disagree are taken: a row that disagreed the same
 * way before (the points were changed in the exam since) is left for the teacher to settle, so a change of points in the exam is not undone by moving
 * something on the sheet.
 */
export function syncPoints(before: ExamDoc, after: ExamDoc): ExamDoc {
  const now = linkReport(after);
  if (!now?.diffs.some((d) => d.adoptable)) return after;
  const key = (d: MarksDiff) => `${d.questions.map((q) => `${q.id}:${q.points}`).join("+")}=${d.sheet}`;
  const was = new Set((linkReport(before)?.diffs ?? []).map(key));
  const ids = now.diffs.filter((d) => d.adoptable && !was.has(key(d))).flatMap((d) => d.questions.map((q) => q.id));
  return ids.length ? adoptMarks(after, ids, now) : after;
}

/** The whole sheet made again from the exam (its settings kept), as the wizard says; the old one goes */
export function rebuildSheet(full: ExamDoc, opts: Omit<SheetMakeOptions, "keep">): ExamDoc {
  const keep = full.correction?.sheet;
  return withCorrection(full, generateCorrection(full, { ...opts, ...(keep ? { keep } : {}) }));
}
