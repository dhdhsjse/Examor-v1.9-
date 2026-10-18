import { DEFAULT_MARGINS } from "../a4";
import { newId } from "../id";
import type { Block, ChromeRule, ExamDoc, Lang, PageMargins, PageScope } from "../types";
import type { T } from "../uiLang";
import type { OnboardingChoices } from "../onboardingTypes";
import { buildTypes, wantsFooter, wantsHeader } from "./buildTypes";
import { defaultFooterId, defaultHeaderId, footerById, headerById } from "./headerFooterLibrary";
import { marginById } from "./marginTemplates";
import { scopePages } from "./pageScope";

const NONE: PageScope = { mode: "none" };

export const pageMargins = (doc: ExamDoc, pageIndex: number): PageMargins => doc.pages[pageIndex]?.margins ?? DEFAULT_MARGINS;

// The header/footer blocks page `pageIndex` should carry under `rule`.
export function chromeBlocksForPage(doc: ExamDoc, pageIndex: number, rule: ChromeRule, t: T): Block[] {
  const page = doc.pages[pageIndex];
  if (!page) return [];
  const ctx = {
    pageId: page.id,
    pageIndex,
    pageCount: doc.pages.length,
    margins: pageMargins(doc, pageIndex),
    lang: doc.meta.lang,
    now: new Date(),
    examTitle: doc.meta.title,
    t,
  };
  const out: Block[] = [];
  if (scopePages(rule.header, doc.pages.length).includes(pageIndex)) out.push(...headerById(rule.headerId).build(ctx));
  if (scopePages(rule.footer, doc.pages.length).includes(pageIndex)) out.push(...footerById(rule.footerId).build(ctx));
  return out;
}

// Turn the wizard choices into an exam. `existing` keeps its content blocks; its old
// header/footer blocks are replaced. Never mutates `existing`.
export function applyOnboarding(choices: OnboardingChoices, existing: ExamDoc | null, ctx: { t: T; lang: Lang }): ExamDoc {
  const margins = marginById(choices.marginId).margins;
  const base: ExamDoc = existing ?? {
    version: 1,
    meta: { title: "Untitled exam", lang: ctx.lang, templateId: "blank-fr" },
    pages: [{ id: newId() }],
    blocks: [],
  };
  const build = buildTypes.some((b) => b.id === choices.build) ? choices.build : "none";
  const rule: ChromeRule = {
    header: wantsHeader(build) ? choices.headerScope : NONE,
    footer: wantsFooter(build) ? choices.footerScope : NONE,
    headerId: choices.headerId ?? defaultHeaderId,
    footerId: choices.footerId ?? defaultFooterId,
  };

  const pages = base.pages.map((p) => ({ ...p, margins: { ...margins } }));
  const kept: ExamDoc = { ...base, pages, meta: { ...base.meta, chrome: rule }, blocks: base.blocks.filter((b) => !b.meta?.role) };
  const chrome = pages.flatMap((_, i) => chromeBlocksForPage(kept, i, rule, ctx.t));
  return { ...kept, blocks: [...kept.blocks, ...chrome] };
}
