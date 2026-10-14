import { CONTENT_WIDTH, PAGE_MARGIN } from "./a4";
import { blockHeight } from "./blockLayout";
import { newId } from "./id";
import { EX_PX } from "./math";
import type { Block, BlockData, BlockLayout, BlockType, ExamDoc, HeaderStyle, Lang, Page, QuestionBlock, TextStyle } from "./types";

export const QUESTION_TYPES: BlockType[] = ["mcq", "truefalse", "blank", "open"];
export const isQuestion = (b: Block): b is QuestionBlock => QUESTION_TYPES.includes(b.type);

// Starting text for new blocks, in the exam's language.
const DEFAULTS = {
  fr: {
    mcq: { text: "Écrivez votre question ici", options: ["Option 1", "Option 2", "Option 3", "Option 4"] },
    truefalse: {
      text: "Répondez par Vrai ou Faux :",
      statements: ["Première affirmation", "Deuxième affirmation", "Troisième affirmation"],
    },
    blank: { text: "Complétez les phrases :", content: "Le soleil se lève à l'[est] et se couche à l'[ouest]." },
    open: { text: "Répondez à la question suivante :" },
    text: "Exercice 1",
    paragraph: "Écrivez votre texte ici.",
    table: ["Colonne 1", "Colonne 2", "Colonne 3"],
  },
  ar: {
    mcq: { text: "اكتب سؤالك هنا", options: ["الاختيار 1", "الاختيار 2", "الاختيار 3", "الاختيار 4"] },
    truefalse: { text: "أجب بصحيح أو خطأ :", statements: ["العبارة الأولى", "العبارة الثانية", "العبارة الثالثة"] },
    blank: { text: "أتمم الفراغات :", content: "عاصمة المغرب هي [الرباط]." },
    open: { text: "أجب عن السؤال التالي :" },
    text: "التمرين الأول",
    paragraph: "اكتب النص هنا.",
    table: ["العمود 1", "العمود 2", "العمود 3"],
  },
};

export const DEFAULT_LATEX = "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}";

// Partial data used to customize a new block (from a tool preset or a library asset).
export type BlockPreset = BlockData & { width?: number; height?: number };

// Create a new block of `type` at a position.
export function createBlock(type: BlockType, lang: Lang, pageId: string, preset: BlockPreset = {}): Block {
  const d = DEFAULTS[lang];
  const { width, height, ...data } = preset;
  const layout: BlockLayout = {
    pageId,
    x: PAGE_MARGIN,
    y: PAGE_MARGIN,
    width: width ?? CONTENT_WIDTH,
    height: height ?? 0,
  };
  const id = newId();
  // Equations start small; MathJax gives the real size right after.
  if (type === "equation" && width === undefined) {
    layout.width = 20 * EX_PX;
    layout.height = 4 * EX_PX;
  }

  const base = (() => {
    switch (type) {
      case "mcq":
        return { type, text: d.mcq.text, options: [...d.mcq.options], correct: 0, points: 1 };
      case "truefalse":
        return {
          type,
          text: d.truefalse.text,
          statements: d.truefalse.statements.map((text, i) => ({ text, answer: i % 2 === 0 })),
          points: 2,
        };
      case "blank":
        return { type, text: d.blank.text, content: d.blank.content, points: 2 };
      case "open":
        return { type, text: d.open.text, lines: 4, answer: "", points: 3 };
      case "text": {
        const style = (data as { style?: TextStyle }).style ?? "heading";
        return { type, text: style === "body" ? d.paragraph : d.text, style };
      }
      case "table":
        return { type, cells: [d.table, ["", "", ""], ["", "", ""]], header: true };
      case "equation":
        return { type, latex: DEFAULT_LATEX, svg: "", exW: 20, exH: 4 };
      case "image":
        return { type, src: "", ratio: 1 };
      case "header":
        return { type, style: "classic" as HeaderStyle, fields: defaultHeaderFields(lang) };
    }
  })();

  return { ...base, ...data, id, layout } as Block;
}

export function defaultHeaderFields(lang: Lang) {
  return lang === "ar"
    ? { school: "الثانوية الإعدادية", title: "فرض محروس رقم 1", subject: "الرياضيات", level: "الثالثة إعدادي", duration: "ساعة واحدة", year: "2025/2026", outOf: 20 }
    : { school: "Collège ...", title: "Devoir surveillé n°1", subject: "Mathématiques", level: "3ème année", duration: "1 heure", year: "2025/2026", outOf: 20 };
}

// Question numbers in reading order: page by page, top to bottom.
export function questionNumbers(blocks: Block[], pages: Page[]): Map<string, number> {
  const pageIndex = new Map(pages.map((p, i) => [p.id, i]));
  const sorted = blocks
    .filter(isQuestion)
    .sort(
      (a, b) =>
        (pageIndex.get(a.layout.pageId) ?? 0) - (pageIndex.get(b.layout.pageId) ?? 0) || a.layout.y - b.layout.y,
    );
  return new Map(sorted.map((b, i) => [b.id, i + 1]));
}

// Height of every block, keyed by id.
export function blockHeights(doc: ExamDoc): Map<string, number> {
  const numbers = questionNumbers(doc.blocks, doc.pages);
  return new Map(doc.blocks.map((b) => [b.id, blockHeight(b, numbers.get(b.id) ?? 1, doc.meta.lang)]));
}

// Y position just below the lowest block of a page, so new blocks stack neatly.
export function nextFreeY(blocks: Block[], heights: Map<string, number>): number {
  const gap = 14;
  return blocks.reduce((bottom, b) => Math.max(bottom, b.layout.y + (heights.get(b.id) ?? 0) + gap), PAGE_MARGIN);
}
