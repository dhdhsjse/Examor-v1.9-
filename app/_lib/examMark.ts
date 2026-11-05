// The mark the exam is graded out of ("Graded out of": 20, 10, 5…) is written in three places: the exam's own setting (`meta.fullMark`, what the status bar and
// the checks read), the score of an exam header block, and the score of the page headers (`data.outOf`). These keep them the same.
import { fullMark } from "./blocks";
import { chromeConfig, chromeTemplate, globalChrome, setChrome } from "./pageChrome";
import type { Block, ExamDoc, HeaderFooterConfig } from "./types";
import type { T } from "./uiLang";

export const MIN_FULL_MARK = 1;
export const MAX_FULL_MARK = 200;

export const clampFullMark = (v: number) => Math.max(MIN_FULL_MARK, Math.min(MAX_FULL_MARK, Math.round(Number.isFinite(v) ? v : 20)));

const grades = (c: HeaderFooterConfig | undefined) => !!c?.enabled && !!chromeTemplate("header", c.templateId).fields?.some((f) => f.key === "outOf");

/** What the exam is graded out of, as the paper says it: the header's number when it has one that is not the total of the questions, else the setting */
export function examFullMark(doc: ExamDoc): number {
  const base = fullMark(doc);
  if (base.fromHeader) return base.value;
  const c = chromeConfig(doc, 0, "header");
  const n = Number(c?.data.outOf);
  if (grades(c) && c?.data.autoOutOf !== "1" && Number.isFinite(n) && n >= 1) return Math.round(n);
  return base.value;
}

/** The exam graded out of `value`: the setting, an exam header block, and every page header that shows a score (a fixed number, no longer the total) */
export function withFullMark(doc: ExamDoc, value: number, t: T | undefined): ExamDoc {
  const v = clampFullMark(value);
  let next: ExamDoc = {
    ...doc,
    meta: { ...doc.meta, fullMark: v },
    blocks: doc.blocks.map((b): Block => (b.type === "header" ? { ...b, fields: { ...b.fields, outOf: v, autoOutOf: false } } : b)),
  };
  if (!t) return next;
  const fixed = (c: HeaderFooterConfig): HeaderFooterConfig => {
    const data: Record<string, string> = { ...c.data, outOf: String(v) };
    delete data.autoOutOf;
    return { ...c, data };
  };
  const global = globalChrome(next, "header");
  if (global && grades(global)) next = setChrome(next, "header", fixed(global), undefined, t);
  for (const page of next.pages) {
    if (page.header && grades(page.header)) next = setChrome(next, "header", fixed(page.header), page.id, t);
  }
  return next;
}
