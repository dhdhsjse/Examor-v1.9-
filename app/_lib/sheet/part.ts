// The exam and its correction sheet are two documents in one file: each has its own pages and blocks (and header and footer), and shares the exam's
// language, fonts and settings. The editor works on one of them at a time, as an ordinary ExamDoc: `viewOf` gives it, `mergeView` puts a changed one back.
import { defaultFooterId, defaultHeaderId } from "../onboarding/headerFooterLibrary";
import { pageChromeBlocks, syncChrome } from "../pageChrome";
import { fixOverflow, shiftBelow } from "./flow";
import { contentBounds } from "./frame";
import { settleTextboxes } from "../textboxSlots";
import type { T } from "../uiLang";
import { newId } from "../id";
import type { CorrectionDoc, ExamDoc, HeaderFooterConfig, Page } from "../types";
import { defaultSheet, normalizeSheet, type SheetPaper } from "./model";
import { settleSheet } from "./settle";

/** Which document the editor shows */
export type Part = "exam" | "sheet";

export const hasSheet = (d: ExamDoc) => !!d.correction;

/** The document the editor works on: the exam itself, or the correction sheet as a document of its own (with its paper in `sheet`) */
export function viewOf(full: ExamDoc, part: Part): ExamDoc {
  const c = full.correction;
  if (part === "exam" || !c) return full;
  return { version: 1, meta: full.meta, pages: c.pages, blocks: c.blocks, globalHeader: c.globalHeader, globalFooter: c.globalFooter, sheet: c.sheet };
}

/** The whole file, with the changes made to the document that was shown (`view`) */
export function mergeView(full: ExamDoc, view: ExamDoc, part: Part): ExamDoc {
  const c = full.correction;
  if (part === "exam" || !c) return view;
  const sheet = view.sheet ?? c.sheet;
  const same = view.pages === c.pages && view.blocks === c.blocks && view.globalHeader === c.globalHeader && view.globalFooter === c.globalFooter && view.meta === full.meta && sheet === c.sheet;
  if (same) return full;
  return { ...full, meta: view.meta, correction: { ...c, sheet, pages: view.pages, blocks: view.blocks, globalHeader: view.globalHeader, globalFooter: view.globalFooter } };
}

/** A document read from a file or from the autosave: the settings of its correction sheet that an older version lacks get their usual value */
export function readCorrection(doc: ExamDoc): ExamDoc {
  const c = doc.correction;
  if (!c || typeof c !== "object" || !Array.isArray(c.pages) || !Array.isArray(c.blocks)) return dropCorrection(doc);
  return { ...doc, correction: { ...c, sheet: normalizeSheet(c.sheet, doc.meta.lang) } };
}

/**
 * The part a step of the undo history touched: where to look after undoing or redoing it. null: both, or only the settings they share (the
 * language, a font…), so the view stays where it is.
 */
export function partChanged(a: ExamDoc, b: ExamDoc): Part | null {
  const exam = a.pages !== b.pages || a.blocks !== b.blocks || a.globalHeader !== b.globalHeader || a.globalFooter !== b.globalFooter;
  const sheet = a.correction !== b.correction;
  if (sheet && !exam) return "sheet";
  if (exam && !sheet) return "exam";
  return null;
}

// A header or footer that is switched off: the sheet has none until the teacher turns one on (and the exam's rule for its headers is not applied to it)
const off = (templateId: string): HeaderFooterConfig => ({ enabled: false, templateId, data: {} });

/** The exam with a new, empty correction sheet: one page like the exam's first, on the paper chosen */
export function createCorrection(full: ExamDoc, paper: SheetPaper): ExamDoc {
  const first = full.pages[0];
  const page: Page = { id: newId(), ...(first?.margins ? { margins: { ...first.margins } } : {}), ...(first?.format ? { format: { ...first.format } } : {}) };
  return {
    ...full,
    correction: { sheet: defaultSheet(full.meta.lang, paper), pages: [page], blocks: [], globalHeader: off(defaultHeaderId), globalFooter: off(defaultFooterId), template: "blank" },
  };
}

/** The exam with this correction sheet (a made one replaces the one it has) */
export const withCorrection = (full: ExamDoc, correction: CorrectionDoc): ExamDoc => ({ ...full, correction });

/**
 * `after` (the file after a change that may have given the sheet more pages, or fewer) with the header and footer of the pages the sheet gained, as the
 * exam's pages get theirs (the rows on such a page go down under its header; the ones that no longer fit pass on to a page of their own, which gets its
 * header too), and "Page 1 of N" brought up to date on the others
 */
export function withSheetChrome(before: ExamDoc, after: ExamDoc, t: T | undefined): ExamDoc {
  if (!t || !before.correction || !after.correction || before.correction === after.correction) return after;
  const was = viewOf(before, "sheet");
  let view = viewOf(after, "sheet");
  if (was.pages.length === view.pages.length) return after;
  // (where the rows can start on a page: under its header, whatever the paper)
  const top = (v: ExamDoc, i: number) => contentBounds({ ...v, sheet: { ...v.sheet!, paper: "bordered" } }, i).top;
  let done = was.pages.length;
  for (let round = 0; round < 8 && view.pages.length > done; round++) {
    for (let i = done; i < view.pages.length; i++) {
      const chrome = pageChromeBlocks(view, i, t);
      if (!chrome.length) continue;
      const before0 = top(view, i);
      view = { ...view, blocks: [...view.blocks, ...chrome] };
      view = shiftBelow(view, i, -Infinity, top(view, i) - before0);
    }
    done = view.pages.length;
    view = fixOverflow(view);
  }
  // (what moved: the blocks in a text box follow their box, the totals and lines their rows)
  view = settleSheet(settleTextboxes(view));
  return mergeView(after, syncChrome(was, view, t, { pageCount: true }), "sheet");
}

/** The header and footer a correction sheet starts with: none (the exam's rule for its headers is not applied to it) */
export const noChrome = () => ({ globalHeader: off(defaultHeaderId), globalFooter: off(defaultFooterId) });

/** The exam without its correction sheet */
export function dropCorrection(full: ExamDoc): ExamDoc {
  if (!full.correction) return full;
  const rest = { ...full };
  delete rest.correction;
  return rest;
}
