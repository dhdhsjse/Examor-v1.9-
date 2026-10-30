// Reusable page chrome (headers and footers) inserted into ANY exam.
// Kept apart from templates.ts on purpose: that file holds whole starting exams.
// Every build() is pure and uses only existing block types.
import { blockHeight } from "../blockLayout";
import { createBlock, defaultHeaderFields } from "../blocks";
import { decodeStyle, isRich, parseRich, plainText, serializeRich } from "../richText";
import { mmToPx } from "../a4";
import type { Block, BlockFont, ExamMeta, HeaderFields, HeaderStyle, Lang, PageMargins, TextAlign, TextStyle } from "../types";
import type { HeaderFooterBuildCtx, HeaderFooterField, HeaderFooterTemplate } from "../onboardingTypes";

// Default exam settings: heights only need the language here.
const metaOf = (c: HeaderFooterBuildCtx): ExamMeta => ({ title: c.examTitle, lang: c.lang, templateId: "" });

const GAP = 10;
const contentWidth = (c: HeaderFooterBuildCtx) => c.pageSize.width - c.margins.left - c.margins.right;

// How far the texts of a page header stay from the edges of the paper: the page margins, so they line
// up with the questions, and never closer than 8 mm, where printers leave the paper blank.
const MIN_HEADER_INSET = mmToPx(8);
export const headerInset = (m: PageMargins) => ({ left: Math.max(m.left, MIN_HEADER_INSET), right: Math.max(m.right, MIN_HEADER_INSET) });

// Tag a block so the wizard can find and replace it later. `field`: the text of the settings it shows,
// so typing it on the page changes the settings (pageChrome.ts).
function tag(b: Block, role: "header" | "footer", templateId: string, field?: string): Block {
  return { ...b, meta: { role, templateId, ...(field ? { field } : {}) } };
}

// The texts of an exam header that can be typed (keys of HeaderFields).
const HEADER_FIELDS: HeaderFooterField[] = [
  { key: "title", label: "Exam title" },
  { key: "school", label: "School" },
  { key: "subject", label: "Subject" },
  { key: "level", label: "Level / class" },
  { key: "duration", label: "Duration" },
  { key: "year", label: "School year" },
  { key: "outOf", label: "Graded out of" },
];
const OFFICIAL_FIELDS: HeaderFooterField[] = [{ key: "authority", label: "Ministry / authority line" }, ...HEADER_FIELDS];
const ALGERIAN_FIELDS: HeaderFooterField[] = [
  { key: "republic", label: "Republic line" },
  { key: "authority", label: "Ministry / authority line" },
  { key: "directorate", label: "Directorate" },
  ...HEADER_FIELDS,
];

// The default texts of the Algerian exam header.
const algerianDefaults = (lang: Lang): Partial<HeaderFields> =>
  lang === "ar"
    ? {
        republic: "الجمهورية الجزائرية الديمقراطية الشعبية",
        authority: "وزارة التربية الوطنية",
        directorate: "مديرية التربية لولاية ...",
        school: "ثانوية ...",
        title: "اختبار الفصل الأول",
        level: "السنة الثالثة ثانوي",
        duration: "ساعتان",
      }
    : {
        republic: "République Algérienne Démocratique et Populaire",
        authority: "Ministère de l'Éducation Nationale",
        directorate: "Direction de l'Éducation de la wilaya de ...",
        school: "Lycée ...",
        title: "Examen du premier trimestre",
        level: "3ème année secondaire",
        duration: "2 heures",
      };
const TEXT_FIELD: HeaderFooterField[] = [{ key: "text", label: "Text" }];

// A typed text, or the default one.
const typed = (c: HeaderFooterBuildCtx, key: string, fallback: string) => c.data[key]?.trim() || fallback;

// The header fields: the defaults of the language, with the typed texts over them. Besides the texts,
// `data` holds `outOf` (a number), `autoOutOf` ("1" = the total of the questions), `accent` (a color)
// and `fontFamily` (the header's font; missing = the exam's).
function headerFields(c: HeaderFooterBuildCtx, defaults?: (lang: Lang) => Partial<HeaderFields>) {
  const base = { ...defaultHeaderFields(c.lang), ...defaults?.(c.lang) };
  const outOf = Number(c.data.outOf);
  return {
    ...base,
    ...Object.fromEntries(Object.entries(c.data).filter(([k, v]) => k in base && k !== "outOf" && v.trim())),
    outOf: Number.isFinite(outOf) && outOf >= 1 ? Math.round(outOf) : base.outOf,
    ...(c.data.autoOutOf === "1" ? { autoOutOf: true } : {}),
  };
}

// The exam header block, at height `y` of the printable area, from one edge of the paper to the other:
// its bands and rules reach the edges, its texts stay at the margins (`inset`).
// `data["align.<field>"]`: the alignment chosen for one of its texts.
function examHeader(c: HeaderFooterBuildCtx, style: HeaderStyle, y: number, defaults?: (lang: Lang) => Partial<HeaderFields>): Block {
  const accent = c.data.accent?.trim();
  const family = c.data.fontFamily?.trim();
  const aligns = Object.fromEntries(Object.entries(c.data).flatMap(([k, v]) => (k.startsWith("align.") && v ? [[k.slice(6), v as TextAlign]] : [])));
  const b = createBlock("header", c.lang, c.pageId, { style, fields: headerFields(c, defaults), width: c.pageSize.width, ...(accent ? { accent } : {}) });
  return {
    ...b,
    ...(family ? { font: { family } } : {}),
    ...(Object.keys(aligns).length ? { aligns } : {}),
    inset: headerInset(c.margins),
    layout: { ...b.layout, x: 0, y },
  } as Block;
}

// The biggest size of the styled words of a text (0 = none).
const biggest = (text: string) => Math.max(0, ...parseRich(text).map((r) => r.style.size ?? 0));

// A text block. `align` makes it as wide as its text and puts it at that side (or the middle) of the
// printable area; without it, it is as wide as the printable area.
function textLine(c: HeaderFooterBuildCtx, text: string, style: TextStyle, y: number | "bottom", align?: TextAlign | boolean, font?: BlockFont): Block {
  const full = contentWidth(c);
  const a = align === true ? "center" : align || undefined;
  const k = Math.max(1, (font?.size ?? 13) / 13, biggest(text) / 13);
  const width = a ? Math.min(full, Math.max(80, plainText(text).length * (style === "title" ? 11 : 7.6) * k + 28)) : full;
  const created = createBlock("text", c.lang, c.pageId, { text, style, width });
  const b = font ? { ...created, font } : created;
  const h = blockHeight(b, 1, metaOf(c));
  const top = y === "bottom" ? c.pageSize.height - c.margins.bottom - h : y;
  const x = a === "center" ? c.margins.left + (full - width) / 2 : a === "right" ? c.margins.left + full - width : c.margins.left;
  return { ...b, layout: { ...b.layout, x, y: top, height: 0 } };
}

// A footer line, as set in Page layout → Header and footer or on the page: `data.align`, the font
// (`fontFamily`, `fontSize`, `color`), and for a text that is not typed (page numbers) `data.style`, the
// look of the whole line. `field`: the line's text can be typed (data[field]).
function footerLine(c: HeaderFooterBuildCtx, id: string, text: string, opts: { field?: string; center?: boolean } = {}): Block {
  const look = !opts.field && c.data.style && !isRich(text) ? decodeStyle(c.data.style) : null;
  const shown = look ? serializeRich([{ text, style: look }]) : text;
  const size = Number(c.data.fontSize);
  const font: BlockFont = {
    ...(c.data.fontFamily ? { family: c.data.fontFamily } : {}),
    ...(size > 0 ? { size } : {}),
    ...(c.data.color ? { color: c.data.color } : {}),
  };
  const align = (c.data.align as TextAlign | undefined) || (opts.center ? "center" : undefined);
  return tag(textLine(c, shown, "body", "bottom", align, Object.keys(font).length ? font : undefined), "footer", id, opts.field);
}

const rule = (c: HeaderFooterBuildCtx) => "─".repeat(Math.floor(contentWidth(c) / 8.6));

// A header made of one exam header block of `style` (`defaults`: its own default texts).
const styled = (id: string, nameKey: string, style: HeaderStyle, defaults?: (lang: Lang) => Partial<HeaderFields>): HeaderFooterTemplate => ({
  id,
  kind: "header",
  nameKey,
  sketch: style,
  fields: style === "algerian" ? ALGERIAN_FIELDS : style === "official" ? OFFICIAL_FIELDS : HEADER_FIELDS,
  build: (c) => [tag(examHeader(c, style, c.margins.top, defaults), "header", id)],
});

// A footer of one centered line, in the exam's language. `editable`: the text can be typed instead.
const centered = (
  id: string,
  nameKey: string,
  sample: string,
  text: (c: HeaderFooterBuildCtx) => string,
  opts: { editable?: boolean; countsPages?: boolean } = {},
): HeaderFooterTemplate => ({
  id,
  kind: "footer",
  nameKey,
  sample,
  ...(opts.editable ? { fields: TEXT_FIELD } : {}),
  ...(opts.countsPages ? { countsPages: true } : {}),
  build: (c) => [opts.editable ? footerLine(c, id, typed(c, "text", text(c)), { field: "text", center: true }) : footerLine(c, id, text(c), { center: true })],
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
  styled("header.algerian", "Algerian exam", "algerian", algerianDefaults),
  {
    id: "header.logo-left",
    kind: "header",
    nameKey: "Logo and title",
    sample: "[ Logo ]",
    fields: [{ key: "logo", label: "Logo text" }, HEADER_FIELDS[0]],
    build: (c) => {
      const logo = textLine(c, typed(c, "logo", c.t("[ Logo ]")), "heading", c.margins.top);
      const title = textLine(c, headerFields(c).title, "title", c.margins.top + blockHeight(logo, 1, metaOf(c)) + GAP);
      return [tag(logo, "header", "header.logo-left", "logo"), tag(title, "header", "header.logo-left", "title")];
    },
  },
  {
    id: "header.arabic-bismillah",
    kind: "header",
    nameKey: "Arabic with Bismillah",
    sample: "بسم الله الرحمن الرحيم",
    fields: [{ key: "text", label: "Top line" }, ...HEADER_FIELDS],
    build: (c) => {
      const top = textLine(c, typed(c, "text", "بسم الله الرحمن الرحيم"), "heading", c.margins.top, true);
      const body = examHeader(c, "minimal", c.margins.top + blockHeight(top, 1, metaOf(c)) + GAP);
      return [tag(top, "header", "header.arabic-bismillah", "text"), tag(body, "header", "header.arabic-bismillah")];
    },
  },
];

export const footerTemplates: HeaderFooterTemplate[] = [
  {
    id: "footer.page-number",
    kind: "footer",
    nameKey: "Page number",
    sample: "Page 1 of 2",
    countsPages: true,
    build: (c) => [footerLine(c, "footer.page-number", c.t("Page {n} of {total}", { n: c.pageIndex + 1, total: c.pageCount }), { center: true })],
  },
  {
    id: "footer.signature-line",
    kind: "footer",
    nameKey: "Name and score line",
    sample: "Name: ____________   Score: ____ / 20",
    fields: TEXT_FIELD,
    build: (c) => [footerLine(c, "footer.signature-line", typed(c, "text", c.t("Name: ____________   Score: ____ / 20")), { field: "text" })],
  },
  centered("footer.good-luck", "Good luck", "Good luck!", (c) => (c.lang === "ar" ? "بالتوفيق والنجاح" : "Bon courage !"), { editable: true }),
  centered("footer.title-page", "Exam name and page", "Exam — 1/2", (c) => `${c.examTitle}  —  ${c.pageIndex + 1}/${c.pageCount}`, { countsPages: true }),
  centered(
    "footer.turn-over",
    "“Turn over” on every page but the last",
    "Turn over →",
    (c) => (c.pageIndex < c.pageCount - 1 ? (c.lang === "ar" ? "← اقلب الصفحة" : "Tournez la page →") : c.lang === "ar" ? "انتهى" : "Fin de l'épreuve"),
    { countsPages: true },
  ),
  {
    id: "footer.teacher",
    kind: "footer",
    nameKey: "Teacher's signature",
    sample: "Teacher's signature: ____________",
    fields: TEXT_FIELD,
    build: (c) => [
      footerLine(
        c,
        "footer.teacher",
        typed(c, "text", c.lang === "ar" ? "توقيع الأستاذ(ة) : ....................      ملاحظات : ...................................." : "Visa du professeur : ....................      Observations : ...................................."),
        { field: "text" },
      ),
    ],
  },
  {
    id: "footer.arabic-page-number",
    kind: "footer",
    nameKey: "Arabic page number",
    sample: "الصفحة 1 من 2",
    countsPages: true,
    build: (c) => [footerLine(c, "footer.arabic-page-number", `الصفحة ${c.pageIndex + 1} من ${c.pageCount}`, { center: true })],
  },
  {
    id: "footer.blank-rule",
    kind: "footer",
    nameKey: "Thin rule",
    sample: "────────────",
    build: (c) => [footerLine(c, "footer.blank-rule", rule(c))],
  },
];

export const defaultHeaderId = "header.classic-school";
export const defaultFooterId = "footer.page-number";

// The header template drawn with an exam header style (the first one for styles without their own).
export const headerTemplateForStyle = (style: HeaderStyle) => headerTemplates.find((h) => h.sketch === style) ?? headerTemplates[0];

export const headerById = (id: string | undefined) => headerTemplates.find((h) => h.id === id) ?? headerTemplates[0];
export const footerById = (id: string | undefined) => footerTemplates.find((f) => f.id === id) ?? footerTemplates[0];

// The settings text (HeaderFooterConfig.data key) a header/footer text block shows, if it can be typed.
// Footers of older files have no `meta.field`: their template tells.
export function chromeTextField(b: Block): string | undefined {
  if (!b.meta?.role) return undefined;
  if (b.meta.field) return b.meta.field;
  return b.meta.role === "footer" && footerById(b.meta.templateId).fields?.some((f) => f.key === "text") ? "text" : undefined;
}
