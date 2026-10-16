import type { T } from "./uiLang";
import type { Block, Lang, PageMargins, PageScope } from "./types";

// A4 margin preset. Values are page pixels (see a4.ts). `nameKey` is the English text (translated with t).
export type MarginTemplate = {
  id: string;
  nameKey: string;
  margins: PageMargins;
  recommended?: boolean;
};

// What structural chrome the pages carry.
export type BuildType = "header-footer" | "header-only" | "footer-only" | "none";

export type HeaderFooterBuildCtx = {
  pageId: string;
  pageIndex: number; // 0 = first page
  pageCount: number;
  margins: PageMargins;
  lang: Lang;
  now: Date;
  examTitle: string;
  t: T;
};

// A header or footer layout from the dedicated library. Plain data + a pure build function.
export type HeaderFooterTemplate = {
  id: string;
  kind: "header" | "footer";
  nameKey: string;
  build: (ctx: HeaderFooterBuildCtx) => Block[];
};

// Choices made in the wizard, before a document is created.
export type OnboardingChoices = {
  marginId: string;
  build: BuildType;
  headerScope: PageScope;
  footerScope: PageScope;
  headerId?: string;
  footerId?: string;
};
