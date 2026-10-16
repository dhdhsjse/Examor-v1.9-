import { blockHeights } from "../blocks";
import type { BuildType } from "../onboardingTypes";
import { buildDoc, fitToMargins, type Template } from "../templates";
import type { ExamDoc, PageScope } from "../types";
import type { T } from "../uiLang";
import { applyOnboarding } from "./applyOnboarding";
import { marginById } from "./marginTemplates";

const GAP = 10;

// What the setup window chose for the header and footer (library ids, or null for none).
export type ChromeChoice = {
  header: string | null;
  headerScope: PageScope;
  footer: string | null;
  footerScope: PageScope;
};

// Where the body of the first page can start: below the header chrome, or at the top margin.
function bodyTop(doc: ExamDoc, top: number): number {
  const first = doc.pages[0];
  const heights = blockHeights(doc);
  const bottoms = doc.blocks.filter((b) => b.meta?.role === "header" && b.layout.pageId === first?.id).map((b) => b.layout.y + (heights.get(b.id) ?? 0));
  return bottoms.length ? Math.max(...bottoms) + GAP : top;
}

// Replace the header/footer of `doc` with the chosen ones. A header that appears pushes the body
// of the first page down; when it goes away the body moves back up.
export function applyChrome(doc: ExamDoc, marginId: string, c: ChromeChoice, t: T): ExamDoc {
  const top = marginById(marginId).margins.top;
  const build: BuildType = c.header && c.footer ? "header-footer" : c.header ? "header-only" : c.footer ? "footer-only" : "none";
  const before = bodyTop(doc, top);
  const next = applyOnboarding(
    { marginId, build, headerScope: c.headerScope, footerScope: c.footerScope, headerId: c.header ?? undefined, footerId: c.footer ?? undefined },
    doc,
    { t, lang: doc.meta.lang },
  );
  const shift = bodyTop(next, top) - before;
  if (!shift) return next;
  const firstId = next.pages[0]?.id;
  return {
    ...next,
    blocks: next.blocks.map((b) => (!b.meta?.role && b.layout.pageId === firstId ? { ...b, layout: { ...b.layout, y: b.layout.y + shift } } : b)),
  };
}

// A new exam from a template: its body on the chosen margins, with the chosen header and footer.
export function examFromLayout(template: Template, marginId: string, c: ChromeChoice, t: T): ExamDoc {
  const body = fitToMargins(buildDoc(template), marginById(marginId).margins);
  return applyChrome(body, marginId, c, t);
}
