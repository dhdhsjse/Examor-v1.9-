// Reusable page chrome (headers and footers) inserted into ANY exam.
// Kept apart from templates.ts on purpose: that file holds whole starting exams.
// Every build() is pure and uses only existing block types.
import { PAGE_HEIGHT, PAGE_WIDTH } from "../a4";
import { blockHeight } from "../blockLayout";
import { createBlock, defaultHeaderFields } from "../blocks";
import type { Block, ExamMeta, HeaderStyle, TextStyle } from "../types";
import type { HeaderFooterBuildCtx, HeaderFooterTemplate } from "../onboardingTypes";

// Default exam settings: heights only need the language here.
const metaOf = (c: HeaderFooterBuildCtx): ExamMeta => ({ title: c.examTitle, lang: c.lang, templateId: "" });

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
  const h = blockHeight(b, 1, metaOf(c));
  const top = y === "bottom" ? PAGE_HEIGHT - c.margins.bottom - h : y;
  const x = center ? c.margins.left + (full - width) / 2 : c.margins.left;
  return { ...b, layout: { ...b.layout, x, y: top, height: 0 } };
}

const rule = (c: HeaderFooterBuildCtx) => "─".repeat(Math.floor(contentWidth(c) / 8.6));

// A header made of one exam header block of `style`.
const styled = (id: string, nameKey: string, style: HeaderStyle): HeaderFooterTemplate => ({
  id,
  kind: "header",
  nameKey,
  sketch: style,
  build: (c) => [tag(examHeader(c, style, c.margins.top), "header", id)],
});

// A footer of one centered line, in the exam's language.
const centered = (id: string, nameKey: string, sample: string, text: (c: HeaderFooterBuildCtx) => string): HeaderFooterTemplate => ({
  id,
  kind: "footer",
  nameKey,
  sample,
  build: (c) => [tag(textLine(c, text(c), "body", "bottom", true), "footer", id)],
});

export const headerTemplates: HeaderFooterTemplate[] = [
  styled("header.classic-school", "Classic school header", "classic"),
  styled("header.official", "Official (ministry)", "official"),
  styled("header.modern", "Modern band", "modern"),
  styled("header.split", "Two cards", "split"),
  styled("header.minimal-line", "Minimal with line", "minimal"),
  styled("header.compact", "Compact (more room)", "compact"),
  styled("header.banner", "Dark banner", "banner"),
  styled("header.elegant", "Elegant rules", "elegant"),
  styled("header.cards", "Name cards", "cards"),
  styled("header.evaluation", "With comments and signature", "evaluation"),
  styled("header.playful", "Primary school", "playful"),
  styled("header.accentbar", "Accent bar", "accentbar"),
  styled("header.bookmark", "Bookmark", "bookmark"),
  styled("header.gradient", "Gradient", "gradient"),
  styled("header.geometric", "Geometric", "geometric"),
  styled("header.chips", "Info chips", "chips"),
  styled("header.editorial", "Editorial", "editorial"),
  styled("header.framed", "Framed title", "framed"),
  styled("header.infogrid", "Info grid", "infogrid"),
  styled("header.duotone", "Duotone", "duotone"),
  styled("header.monogram", "Monogram", "monogram"),
  styled("header.ticket", "Ticket", "ticket"),
  styled("header.floating", "Floating card", "floating"),
  {
    id: "header.logo-left",
    kind: "header",
    nameKey: "Logo and title",
    sample: "[ Logo ]",
    build: (c) => {
      const logo = textLine(c, c.t("[ Logo ]"), "heading", c.margins.top);
      const title = textLine(c, defaultHeaderFields(c.lang).title, "title", c.margins.top + blockHeight(logo, 1, metaOf(c)) + GAP);
      return [tag(logo, "header", "header.logo-left"), tag(title, "header", "header.logo-left")];
    },
  },
  {
    id: "header.arabic-bismillah",
    kind: "header",
    nameKey: "Arabic with Bismillah",
    sample: "بسم الله الرحمن الرحيم",
    build: (c) => {
      const top = textLine(c, "بسم الله الرحمن الرحيم", "heading", c.margins.top, true);
      const body = examHeader(c, "minimal", c.margins.top + blockHeight(top, 1, metaOf(c)) + GAP);
      return [tag(top, "header", "header.arabic-bismillah"), tag(body, "header", "header.arabic-bismillah")];
    },
  },
];

export const footerTemplates: HeaderFooterTemplate[] = [
  {
    id: "footer.page-number",
    kind: "footer",
    nameKey: "Page number",
    sample: "Page 1 of 2",
    build: (c) => [tag(textLine(c, c.t("Page {n} of {total}", { n: c.pageIndex + 1, total: c.pageCount }), "body", "bottom", true), "footer", "footer.page-number")],
  },
  {
    id: "footer.signature-line",
    kind: "footer",
    nameKey: "Name and score line",
    sample: "Name: ____________   Score: ____ / 20",
    build: (c) => [tag(textLine(c, c.t("Name: ____________   Score: ____ / 20"), "body", "bottom"), "footer", "footer.signature-line")],
  },
  centered("footer.good-luck", "Good luck", "Good luck!", (c) => (c.lang === "ar" ? "بالتوفيق والنجاح" : "Bon courage !")),
  centered("footer.title-page", "Exam name and page", "Exam — 1/2", (c) => `${c.examTitle}  —  ${c.pageIndex + 1}/${c.pageCount}`),
  centered("footer.turn-over", "“Turn over” on every page but the last", "Turn over →", (c) =>
    c.pageIndex < c.pageCount - 1 ? (c.lang === "ar" ? "← اقلب الصفحة" : "Tournez la page →") : c.lang === "ar" ? "انتهى" : "Fin de l'épreuve",
  ),
  {
    id: "footer.teacher",
    kind: "footer",
    nameKey: "Teacher's signature",
    sample: "Teacher's signature: ____________",
    build: (c) => [tag(textLine(c, c.lang === "ar" ? "توقيع الأستاذ(ة) : ....................      ملاحظات : ...................................." : "Visa du professeur : ....................      Observations : ....................................", "body", "bottom"), "footer", "footer.teacher")],
  },
  {
    id: "footer.arabic-page-number",
    kind: "footer",
    nameKey: "Arabic page number",
    sample: "الصفحة 1 من 2",
    build: (c) => [tag(textLine(c, `الصفحة ${c.pageIndex + 1} من ${c.pageCount}`, "body", "bottom", true), "footer", "footer.arabic-page-number")],
  },
  {
    id: "footer.blank-rule",
    kind: "footer",
    nameKey: "Thin rule",
    sample: "────────────",
    build: (c) => [tag(textLine(c, rule(c), "body", "bottom"), "footer", "footer.blank-rule")],
  },
];

export const defaultHeaderId = "header.classic-school";
export const defaultFooterId = "footer.page-number";

export const headerById = (id: string | undefined) => headerTemplates.find((h) => h.id === id) ?? headerTemplates[0];
export const footerById = (id: string | undefined) => footerTemplates.find((f) => f.id === id) ?? footerTemplates[0];
