import { createBlock, defaultHeaderFields, nextFreeY, blockHeights, type BlockPreset } from "./blocks";
import { newId } from "./id";
import type { Block, BlockType, ExamDoc, HeaderStyle, Lang } from "./types";

export interface Template {
  id: string;
  name: string;
  description: string;
  lang: Lang;
  header: HeaderStyle | null;
  extras: { type: BlockType; preset?: BlockPreset }[]; // blocks stacked under the header
}

export const TEMPLATES: Template[] = [
  {
    id: "classic-fr",
    name: "Classique",
    description: "Boxed header with school, level and score box",
    lang: "fr",
    header: "classic",
    extras: [{ type: "text", preset: { text: "Exercice 1" } }],
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
    id: "minimal-fr",
    name: "Minimal",
    description: "Light header, maximum room for questions",
    lang: "fr",
    header: "minimal",
    extras: [],
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

// Build a fresh exam from a template: header on top, then the extra blocks stacked below.
export function buildDoc(t: Template): ExamDoc {
  const page = { id: newId() };
  const blocks: Block[] = [];
  const doc: ExamDoc = { version: 1, meta: { title: "Untitled exam", lang: t.lang, templateId: t.id }, pages: [page], blocks };

  const place = (b: Block) => {
    b.layout.y = nextFreeY(blocks, blockHeights(doc));
    blocks.push(b);
  };

  if (t.header) {
    place(createBlock("header", t.lang, page.id, { style: t.header, fields: defaultHeaderFields(t.lang) }));
  }
  for (const extra of t.extras) place(createBlock(extra.type, t.lang, page.id, extra.preset));
  return doc;
}

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
