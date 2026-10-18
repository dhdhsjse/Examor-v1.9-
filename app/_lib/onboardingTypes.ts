import type { T } from "./uiLang";
import type { Block, HeaderStyle, Lang, PageMargins, PageScope } from "./types";

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
  pageSize: { width: number; height: number }; // page pixels
  lang: Lang;
  now: Date;
  examTitle: string;
  t: T;
  data: Record<string, string>; // texts typed in Page layout → Header and footer (missing = defaults)
};

// A text of a header/footer the teacher can change. `label` is an English key (translated).
export type HeaderFooterField = { key: string; label: string };

// A header or footer layout from the dedicated library. Plain data + a pure build function.
export type HeaderFooterTemplate = {
  id: string;
  kind: "header" | "footer";
  nameKey: string;
  sketch?: HeaderStyle; // preview: the exam header style it uses
  sample?: string; // preview: its text (English key), for text-only headers and footers
  fields?: HeaderFooterField[]; // texts that can be typed for it (HeaderFooterBuildCtx.data)
  countsPages?: boolean; // shows the page count: rebuilt when pages are added or removed
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
