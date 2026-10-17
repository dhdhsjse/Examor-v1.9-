import { CONTENT_WIDTH, PAGE_HEIGHT, PAGE_MARGIN, PAGE_WIDTH } from "./a4";
import { createBlock, defaultHeaderFields, nextFreeY, blockHeights, type BlockPreset } from "./blocks";
import { renderFigure, type Params } from "./figures";
import { newId } from "./id";
import { svgSize, svgUrl } from "./library";
import { EXAMPLES } from "./templateExamples";
import type { Block, BlockType, ExamDoc, HeaderFields, HeaderStyle, Lang, PageMargins } from "./types";

// A block stacked under the header: a block with its preset, or a library figure.
export type TemplateItem = { type: BlockType; preset?: BlockPreset } | { figure: string; params?: Params; width?: number };

export interface Template {
  id: string;
  name: string;
  description: string;
  lang: Lang;
  header: HeaderStyle | null;
  extras: TemplateItem[]; // blocks stacked under the header (they flow onto new pages)
  kind?: "layout" | "example"; // missing = "layout" (an empty starting page)
  subject?: string; // English key, shown on example cards
  title?: string; // name of the exam (also the header's title)
  fields?: Partial<HeaderFields>; // header text of an example
  accent?: string; // header color
}

const LAYOUTS: Template[] = [
  {
    id: "classic-fr",
    name: "Classique",
    description: "Boxed header with school, level and score box",
    lang: "fr",
    header: "classic",
    extras: [{ type: "text", preset: { text: "Exercice 1" } }],
  },
  {
    id: "official-fr",
    name: "Officiel",
    description: "Ministry line, framed title, student lines and score box",
    lang: "fr",
    header: "official",
    extras: [{ type: "text", preset: { text: "Exercice 1", decor: "underline" } }],
  },
  {
    id: "modern-fr",
    name: "Moderne",
    description: "Colored title band and round score badge",
    lang: "fr",
    header: "modern",
    extras: [{ type: "text", preset: { text: "Exercice 1" } }],
  },
  {
    id: "split-fr",
    name: "Deux cartes",
    description: "Exam details and student details side by side",
    lang: "fr",
    header: "split",
    extras: [{ type: "text", preset: { text: "Exercice 1", decor: "bar" } }],
  },
  {
    id: "minimal-fr",
    name: "Minimal",
    description: "Light header, maximum room for questions",
    lang: "fr",
    header: "minimal",
    extras: [],
  },
  {
    id: "compact-fr",
    name: "Compact",
    description: "Three thin lines: the most room for questions",
    lang: "fr",
    header: "compact",
    extras: [],
  },
  {
    id: "primary-fr",
    name: "Primaire",
    description: "Colorful band with stars, for young pupils",
    lang: "fr",
    header: "playful",
    extras: [{ type: "text", preset: { text: "Exercice 1", decor: "pill", accent: "#0ea5e9" } }],
  },
  {
    id: "qcm-fr",
    name: "QCM",
    description: "Ready multiple-choice quiz with instructions",
    lang: "fr",
    header: "modern",
    extras: [
      { type: "text", preset: { style: "body", text: "Pour chaque question, cochez la bonne réponse." } },
      { type: "mcq" },
      { type: "mcq" },
      { type: "mcq" },
    ],
  },
  {
    id: "classic-ar",
    name: "كلاسيكي",
    description: "Arabic classic header, right-to-left",
    lang: "ar",
    header: "classic",
    extras: [{ type: "text", preset: { text: "التمرين الأول" } }],
  },
  {
    id: "official-ar",
    name: "رسمي",
    description: "Arabic official header with the ministry line",
    lang: "ar",
    header: "official",
    extras: [{ type: "text", preset: { text: "التمرين الأول", decor: "underline" } }],
  },
  {
    id: "devoir-ar",
    name: "فرض محروس",
    description: "Arabic test with true/false and open questions",
    lang: "ar",
    header: "minimal",
    extras: [
      { type: "text", preset: { text: "التمرين الأول" } },
      { type: "truefalse" },
      { type: "text", preset: { text: "التمرين الثاني" } },
      { type: "open" },
    ],
  },
  {
    id: "blank-fr",
    name: "Page blanche",
    description: "Empty A4 page, no header",
    lang: "fr",
    header: null,
    extras: [],
  },
];

export const TEMPLATES: Template[] = [...LAYOUTS, ...EXAMPLES];

// An image block showing a library figure (editable in Properties like one added from the library).
function figureBlock(id: string, params: Params | undefined, width: number | undefined, lang: Lang, pageId: string): Block | null {
  const r = renderFigure(id, params, lang);
  if (!r) return null;
  const { w, h } = svgSize(r.svg);
  const bw = Math.min(CONTENT_WIDTH, width ?? w);
  const b = createBlock("image", lang, pageId, { src: svgUrl(r.svg), ratio: w / h, width: bw, height: (bw * h) / w, figure: { id, params: r.params } });
  // Figures are centered on the page.
  return { ...b, layout: { ...b.layout, x: (PAGE_WIDTH - bw) / 2 } };
}

// Build a fresh exam from a template: header on top, then the extra blocks stacked below,
// going on to a new page when one is full.
export function buildDoc(t: Template): ExamDoc {
  let page = { id: newId() };
  const pages = [page];
  const blocks: Block[] = [];
  const title = t.title ?? "Untitled exam";
  const doc: ExamDoc = { version: 1, meta: { title, lang: t.lang, templateId: t.id }, pages, blocks };

  const place = (b: Block) => {
    const heights = blockHeights(doc);
    const onPage = blocks.filter((x) => x.layout.pageId === page.id);
    let y = nextFreeY(onPage, heights);
    const h = heights.get(b.id) ?? blockHeights({ ...doc, blocks: [b] }).get(b.id) ?? 0;
    if (onPage.length && y + h > PAGE_HEIGHT - PAGE_MARGIN) {
      page = { id: newId() };
      pages.push(page);
      y = PAGE_MARGIN;
    }
    b.layout.pageId = page.id;
    b.layout.y = y;
    blocks.push(b);
  };

  if (t.header) {
    const fields = { ...defaultHeaderFields(t.lang), ...(t.title ? { title: t.title } : {}), ...t.fields };
    place(createBlock("header", t.lang, page.id, { style: t.header, fields, ...(t.accent ? { accent: t.accent } : {}) }));
  }
  for (const extra of t.extras) {
    const b = "figure" in extra ? figureBlock(extra.figure, extra.params, extra.width, t.lang, page.id) : createBlock(extra.type, t.lang, page.id, extra.preset);
    if (b) place(b);
  }
  return doc;
}

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];

// Move a template's blocks from the default 48px margins onto the margins the user chose.
export function fitToMargins(doc: ExamDoc, m: PageMargins): ExamDoc {
  const width = PAGE_WIDTH - m.left - m.right;
  return {
    ...doc,
    pages: doc.pages.map((p) => ({ ...p, margins: { ...m } })),
    blocks: doc.blocks.map((b) => ({
      ...b,
      layout: {
        ...b.layout,
        x: b.layout.x - PAGE_MARGIN + m.left,
        y: b.layout.y - PAGE_MARGIN + m.top,
        width: b.layout.width === CONTENT_WIDTH ? width : b.layout.width,
      },
    })),
  };
}
