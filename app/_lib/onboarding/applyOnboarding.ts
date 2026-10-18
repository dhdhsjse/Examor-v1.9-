import { DEFAULT_MARGINS } from "../a4";
import { newId } from "../id";
import { chromeFromRule, pageChromeBlocks } from "../pageChrome";
import type { ChromeRule, ExamDoc, Lang, PageMargins, PageScope } from "../types";
import type { T } from "../uiLang";
import type { OnboardingChoices } from "../onboardingTypes";
import { buildTypes, wantsFooter, wantsHeader } from "./buildTypes";
import { defaultFooterId, defaultHeaderId } from "./headerFooterLibrary";
import { marginById } from "./marginTemplates";

const NONE: PageScope = { mode: "none" };

export const pageMargins = (doc: ExamDoc, pageIndex: number): PageMargins => doc.pages[pageIndex]?.margins ?? DEFAULT_MARGINS;

// Turn the wizard choices into an exam. `existing` keeps its content blocks; its old
// header/footer blocks are replaced, and so are its header/footer settings (pageChrome.ts).
// Never mutates `existing`.
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
  const kept = chromeFromRule({ ...base, pages, meta: { ...base.meta, chrome: rule }, blocks: base.blocks.filter((b) => !b.meta?.role) }, rule);
  const chrome = pages.flatMap((_, i) => pageChromeBlocks(kept, i, ctx.t));
  return { ...kept, blocks: [...kept.blocks, ...chrome] };
}
