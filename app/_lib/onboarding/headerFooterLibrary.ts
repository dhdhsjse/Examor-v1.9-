// Reusable page chrome (headers and footers) inserted into ANY exam.
// Kept apart from templates.ts on purpose: that file holds whole starting exams.
// Every build() is pure and uses only existing block types.
import { PAGE_HEIGHT, PAGE_WIDTH } from "../a4";
import { blockHeight } from "../blockLayout";
import { createBlock, defaultHeaderFields } from "../blocks";
import type { Block, HeaderStyle, TextStyle } from "../types";
import type { HeaderFooterBuildCtx, HeaderFooterTemplate } from "../onboardingTypes";

const GAP = 10;
const contentWidth = (c: HeaderFooterBuildCtx) => PAGE_WIDTH - c.margins.left - c.margins.right;

// Tag a block so the wizard can find and replace it later.
function tag(b: Block, role: "header" | "footer", templateId: string): Block {
  return { ...b, meta: { role, templateId } };
}

// The exam header block, at height `y` of the printable area.
function examHeader(c: HeaderFooterBuildCtx, style: HeaderStyle, y: number): Block {
  const b = createBlock("header", c.lang, c.pageId, { style, fields: defaultHeaderFields(c.lang), width: contentWidth(c) });
  return { ...b, layout: { ...b.layout, x: c.margins.left, y } };
}

// A text block. `center` makes it as wide as its text and puts it in the middle of the printable area.
function textLine(c: HeaderFooterBuildCtx, text: string, style: TextStyle, y: number | "bottom", center = false): Block {
  const full = contentWidth(c);
  const width = center ? Math.min(full, Math.max(80, text.length * (style === "title" ? 11 : 7.6) + 28)) : full;
  const b = createBlock("text", c.lang, c.pageId, { text, style, width });
  const h = blockHeight(b, 1, c.lang);
  const top = y === "bottom" ? PAGE_HEIGHT - c.margins.bottom - h : y;
  const x = center ? c.margins.left + (full - width) / 2 : c.margins.left;
  return { ...b, layout: { ...b.layout, x, y: top, height: 0 } };
}

const rule = (c: HeaderFooterBuildCtx) => "─".repeat(Math.floor(contentWidth(c) / 8.6));

export const headerTemplates: HeaderFooterTemplate[] = [
  {
    id: "header.classic-school",
    kind: "header",
    nameKey: "Classic school header",
    build: (c) => [tag(examHeader(c, "classic", c.margins.top), "header", "header.classic-school")],
  },
  {
    id: "header.minimal-line",
    kind: "header",
    nameKey: "Minimal with line",
    build: (c) => [tag(examHeader(c, "minimal", c.margins.top), "header", "header.minimal-line")],
  },
  {
    id: "header.logo-left",
    kind: "header",
    nameKey: "Logo and title",
    build: (c) => {
      const logo = textLine(c, c.t("[ Logo ]"), "heading", c.margins.top);
      const title = textLine(c, defaultHeaderFields(c.lang).title, "title", c.margins.top + blockHeight(logo, 1, c.lang) + GAP);
      return [tag(logo, "header", "header.logo-left"), tag(title, "header", "header.logo-left")];
    },
  },
  {
    id: "header.arabic-bismillah",
    kind: "header",
    nameKey: "Arabic with Bismillah",
    build: (c) => {
      const top = textLine(c, "بسم الله الرحمن الرحيم", "heading", c.margins.top, true);
      const body = examHeader(c, "minimal", c.margins.top + blockHeight(top, 1, c.lang) + GAP);
      return [tag(top, "header", "header.arabic-bismillah"), tag(body, "header", "header.arabic-bismillah")];
    },
  },
];

export const footerTemplates: HeaderFooterTemplate[] = [
  {
    id: "footer.page-number",
    kind: "footer",
    nameKey: "Page number",
    build: (c) => [tag(textLine(c, c.t("Page {n} of {total}", { n: c.pageIndex + 1, total: c.pageCount }), "body", "bottom", true), "footer", "footer.page-number")],
  },
  {
    id: "footer.signature-line",
    kind: "footer",
    nameKey: "Name and score line",
    build: (c) => [tag(textLine(c, c.t("Name: ____________   Score: ____ / 20"), "body", "bottom"), "footer", "footer.signature-line")],
  },
  {
    id: "footer.arabic-page-number",
    kind: "footer",
    nameKey: "Arabic page number",
    build: (c) => [tag(textLine(c, `الصفحة ${c.pageIndex + 1} من ${c.pageCount}`, "body", "bottom", true), "footer", "footer.arabic-page-number")],
  },
  {
    id: "footer.blank-rule",
    kind: "footer",
    nameKey: "Thin rule",
    build: (c) => [tag(textLine(c, rule(c), "body", "bottom"), "footer", "footer.blank-rule")],
  },
];

export const defaultHeaderId = "header.classic-school";
export const defaultFooterId = "footer.page-number";

export const headerById = (id: string | undefined) => headerTemplates.find((h) => h.id === id) ?? headerTemplates[0];
export const footerById = (id: string | undefined) => footerTemplates.find((f) => f.id === id) ?? footerTemplates[0];
