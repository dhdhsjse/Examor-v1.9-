import { CONTENT_WIDTH, PAGE_MARGIN } from "./a4";
import { pageSize } from "./pageFormats";
import { blockHeight } from "./blockLayout";
import { newId } from "./id";
import { defaultSize } from "./shapes";
import { EX_PX } from "./math";
import { plainText } from "./richText";
import { fixOrder, mixedOrder, seededRandom } from "./shuffle";
import type {
  Block,
  BlockData,
  BlockLayout,
  BlockType,
  ExamDoc,
  HeaderStyle,
  Lang,
  MatchBlock,
  McqBlock,
  OpenBlock,
  OrderBlock,
  OpenPart,
  Page,
  QuestionBlock,
  TextStyle,
} from "./types";
import type { BlockPatch } from "./useExam";

export const QUESTION_TYPES: BlockType[] = ["mcq", "truefalse", "blank", "open", "match", "order", "classify"];
export const isQuestion = (b: Block): b is QuestionBlock => QUESTION_TYPES.includes(b.type);

export const MAX_OPTIONS = 8;

// Name of each block type (English key, translated where shown).
export const BLOCK_TYPE_NAMES: Record<BlockType, string> = {
  mcq: "Multiple choice",
  truefalse: "True / False",
  blank: "Fill in the blank",
  open: "Open question",
  match: "Matching",
  order: "Put in order",
  classify: "Sort into groups",
  text: "Text",
  table: "Table",
  graph: "Function graph",
  equation: "Equation",
  image: "Image",
  header: "Exam header",
  textbox: "Text box",
  shape: "Shape",
};

// Questions start empty, so the teacher types right away instead of deleting sample text first.
// On screen, empty texts show a light "ghost" example (see `withHints`); it is never printed.
const EMPTY_QUESTIONS = {
  mcq: { text: "", options: ["", "", "", ""] },
  truefalse: { text: "", statements: ["", "", ""] },
  blank: { text: "", content: "" },
  open: { text: "" },
  match: { text: "", pairs: [1, 2, 3, 4].map(() => ({ left: "", right: "" })) },
  order: { text: "", items: ["", "", "", ""] },
  classify: { text: "", groups: [{ name: "", items: [] as string[] }, { name: "", items: [] as string[] }] },
};

// Starting text for new blocks, in the exam's language.
const DEFAULTS = {
  fr: {
    ...EMPTY_QUESTIONS,
    text: "Exercice 1",
    paragraph: "Écrivez votre texte ici.",
    table: ["Colonne 1", "Colonne 2", "Colonne 3"],
  },
  ar: {
    ...EMPTY_QUESTIONS,
    text: "التمرين الأول",
    paragraph: "اكتب النص هنا.",
    table: ["العمود 1", "العمود 2", "العمود 3"],
  },
};

// Title of the n-th exercise of the exam ("Exercice 2 :"), in the exam's language.
const AR_ORDINALS = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];
export function taskTitle(n: number, lang: Lang): string {
  return lang === "ar" ? `التمرين ${AR_ORDINALS[n - 1] ?? n} :` : `Exercice ${n} :`;
}

// Title for a new exercise: numbered after the exercise titles already in the exam (title blocks, and title
// lines typed in text boxes).
export function nextTaskTitle(blocks: Block[], lang: Lang): string {
  const isTask = lang === "ar" ? /^\s*التمرين/ : /^\s*exercice\b/i;
  let count = 0;
  for (const b of blocks) {
    if (b.type === "text" && b.style !== "body" && isTask.test(plainText(b.text))) count++;
    else if (b.type === "textbox") count += plainText(b.text).split("\n").filter((l) => isTask.test(l)).length;
  }
  return taskTitle(count + 1, lang);
}

// Ghost examples shown in empty question texts, in the exam's language.
const HINTS = {
  fr: {
    question: "Écrivez votre question ici",
    option: (n: number) => `Option ${n}`,
    truefalse: "Répondez par Vrai ou Faux :",
    statements: ["Première affirmation", "Deuxième affirmation", "Troisième affirmation"],
    blank: "Complétez les phrases :",
    content: "Le soleil se lève à l'[est] et se couche à l'[ouest].",
    match: "Reliez chaque élément à sa correspondance :",
    left: (n: number) => `Élément ${n}`,
    right: (n: number) => `Correspondance ${n}`,
    order: "Remettez dans le bon ordre :",
    items: ["Première étape", "Deuxième étape", "Troisième étape", "Quatrième étape"],
    classify: "Classez les mots suivants dans le tableau :",
    groups: ["Noms", "Verbes"],
    part: "Sous-question",
    statement: "Énoncé (facultatif) : données, texte, situation…",
  },
  ar: {
    question: "اكتب سؤالك هنا",
    option: (n: number) => `الاختيار ${n}`,
    truefalse: "أجب بصحيح أو خطأ :",
    statements: ["العبارة الأولى", "العبارة الثانية", "العبارة الثالثة"],
    blank: "أتمم الفراغات :",
    content: "عاصمة المغرب هي [الرباط].",
    match: "اربط كل عنصر بما يناسبه :",
    left: (n: number) => `العنصر ${n}`,
    right: (n: number) => `المقابل ${n}`,
    order: "رتب ما يلي ترتيبا صحيحا :",
    items: ["المرحلة الأولى", "المرحلة الثانية", "المرحلة الثالثة", "المرحلة الرابعة"],
    classify: "صنف الكلمات التالية في الجدول :",
    groups: ["أسماء", "أفعال"],
    part: "سؤال فرعي",
    statement: "السند (اختياري) : معطيات، نص، وضعية…",
  },
};

// The ghost examples of an open question's question and statement, for its texts being typed in (InlineEditor).
export function openHints(lang: Lang) {
  const h = HINTS[lang] ?? HINTS.fr;
  return { question: h.question, statement: h.statement };
}

const GHOST = "#b4b9c3";
// An empty text gets its example in light grey; a filled one stays as it is.
const ghost = (value: string, hint: string | undefined) => (value.trim() || !hint ? value : `⁅c=${GHOST}⁆${hint}⁅/⁆`);

// The block as drawn on screen: empty question texts show a ghost example. Only for the editor
// canvas: the saved block stays empty, and printing / export draw the real block.
// (Only one-line texts, so the block keeps the height computed from its real content.) `statement`: an open question without
// a statement also shows its ghost statement line (the selected one: it is one line taller on screen, see screenHeights).
export function withHints(b: Block, lang: Lang, opts: { statement?: boolean } = {}): Block {
  const h = HINTS[lang] ?? HINTS.fr;
  switch (b.type) {
    case "mcq":
      return { ...b, text: ghost(b.text, h.question), options: b.options.map((o, i) => ghost(o, h.option(i + 1))) };
    case "truefalse":
      return { ...b, text: ghost(b.text, h.truefalse), statements: b.statements.map((s, i) => ({ ...s, text: ghost(s.text, h.statements[i] ?? h.statements[0]) })) };
    case "blank":
      return { ...b, text: ghost(b.text, h.blank), content: ghost(b.content, h.content) };
    case "open":
      return {
        ...b,
        text: ghost(b.text, h.question),
        ...(opts.statement ? { context: ghost(b.context ?? "", h.statement) } : {}),
        parts: b.parts?.map((p, i) => ({ ...p, text: ghost(p.text, `${h.part} ${i + 1}`) })),
      };
    case "match":
      return { ...b, text: ghost(b.text, h.match), pairs: b.pairs.map((p, i) => ({ ...p, left: ghost(p.left, h.left(i + 1)), right: ghost(p.right, h.right(i + 1)) })) };
    case "order":
      // "Sentence" style: the words are the items, they are not shown one per line.
      if (b.style === "sentence") return { ...b, text: ghost(b.text, h.order) };
      return { ...b, text: ghost(b.text, h.order), items: b.items.map((it, i) => ghost(it, h.items[i] ?? h.items[0])) };
    case "classify":
      return { ...b, text: ghost(b.text, h.classify), groups: b.groups.map((g, i) => ({ ...g, name: ghost(g.name, h.groups[i]) })) };
    default:
      return b;
  }
}

export const DEFAULT_LATEX = ""; // new equations start empty: the teacher types right away

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
  // A text box starts as a small box; its handles make it any size.
  if (type === "textbox") {
    layout.width = width ?? 300;
    layout.height = height ?? 100;
  }
  // A shape starts at its usual size (a line is flat: its height is 0).
  if (type === "shape") {
    const [w, h] = defaultSize((data as { shape?: string }).shape ?? "rect");
    layout.width = width ?? w;
    layout.height = height ?? h;
  }
  // Graphs have a fixed size (resized with the corner handles).
  if (type === "graph" && width === undefined) {
    layout.width = 320;
    layout.height = 320;
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
        return { type, text: d.open.text, lines: 4, answer: "", points: 3, parts: [] };
      case "match":
        return { type, text: d.match.text, pairs: d.match.pairs.map((p) => ({ ...p })), order: [], points: 2 };
      case "order":
        return { type, text: d.order.text, items: [...d.order.items], order: [], points: 2, style: "list" as const };
      case "classify":
        return { type, text: d.classify.text, groups: d.classify.groups.map((g) => ({ name: g.name, items: [...g.items] })), points: 2 };
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
      case "graph":
        return { type, functions: ["x^2 - 2"], xMin: -5, xMax: 5, yMin: -4, yMax: 6, grid: true };
      case "header":
        return { type, style: "classic" as HeaderStyle, fields: defaultHeaderFields(lang) };
      case "textbox":
        return { type, text: "" };
      case "shape":
        return { type, shape: "rect" };
    }
  })();

  const block = { ...base, ...data, id, layout } as Block;
  // Matching / ordering start mixed up (the same way for the same block).
  if ((block.type === "match" || block.type === "order") && !block.order.length) {
    block.order = mixedOrder(block.type === "match" ? block.pairs.length : block.items.length, seededRandom(id));
  }
  return block;
}

export function defaultHeaderFields(lang: Lang) {
  return lang === "ar"
    ? {
        authority: "المملكة المغربية — وزارة التربية الوطنية والتعليم الأولي والرياضة",
        school: "الثانوية الإعدادية",
        title: "فرض محروس رقم 1",
        subject: "الرياضيات",
        level: "الثالثة إعدادي",
        duration: "ساعة واحدة",
        year: "2025/2026",
        outOf: 20,
      }
    : {
        authority: "Royaume du Maroc — Ministère de l'Éducation Nationale",
        school: "Collège ...",
        title: "Devoir surveillé n°1",
        subject: "Mathématiques",
        level: "3ème année",
        duration: "1 heure",
        year: "2025/2026",
        outOf: 20,
      };
}

// A short plain name for a block (library cards, saved blocks).
export function blockLabel(b: Block): string {
  const text = b.type === "header" ? b.fields.title : "text" in b ? (b.text ?? "") : "";
  const plain = plainText(text).replace(/\s+/g, " ").trim();
  return plain.length > 60 ? `${plain.slice(0, 57)}…` : plain;
}

// ---- Multiple choice ----

// The correct options: one, or several when the question allows it.
export const mcqAnswers = (b: McqBlock): number[] =>
  b.multi ? (b.corrects ?? [b.correct]).filter((i) => i >= 0 && i < b.options.length) : [b.correct];

// Click on option i: it becomes the answer, or (several answers) it is ticked / unticked.
export function toggleMcq(b: McqBlock, i: number): BlockPatch {
  if (!b.multi) return { correct: i };
  const cur = mcqAnswers(b);
  const next = cur.includes(i) ? cur.filter((k) => k !== i) : [...cur, i].sort((a, c) => a - c);
  return { corrects: next, correct: next[0] ?? 0 };
}

// Remove option i; the correct answers keep pointing at the same options.
export function removeOption(b: McqBlock, i: number): BlockPatch {
  const shift = (k: number) => (k > i ? k - 1 : k);
  const corrects = mcqAnswers(b).filter((k) => k !== i).map(shift);
  return {
    options: b.options.filter((_, k) => k !== i),
    correct: b.correct === i ? (corrects[0] ?? 0) : shift(b.correct),
    ...(b.multi ? { corrects } : {}),
  };
}

// Insert an empty option at i (the correct answers follow).
export function insertOption(b: McqBlock, i: number): BlockPatch {
  const shift = (k: number) => (k >= i ? k + 1 : k);
  return {
    options: [...b.options.slice(0, i), "", ...b.options.slice(i)],
    correct: shift(b.correct),
    ...(b.multi ? { corrects: mcqAnswers(b).map(shift) } : {}),
  };
}

// ---- Matching and ordering: the printed order is kept in `order` ----

// Insert item `at` into a stored order: later indexes move up, the new one lands at a random place.
function orderWithNew(order: number[], n: number, at: number): number[] {
  const kept = fixOrder(order, n).map((k) => (k >= at ? k + 1 : k));
  kept.splice(Math.floor(Math.random() * (kept.length + 1)), 0, at);
  return kept;
}

const orderWithout = (order: number[], n: number, i: number) =>
  fixOrder(order, n)
    .filter((k) => k !== i)
    .map((k) => (k > i ? k - 1 : k));

export function addPair(b: MatchBlock, at = b.pairs.length): BlockPatch {
  return { pairs: [...b.pairs.slice(0, at), { left: "", right: "" }, ...b.pairs.slice(at)], order: orderWithNew(b.order, b.pairs.length, at) };
}

export function removePair(b: MatchBlock, i: number): BlockPatch {
  return { pairs: b.pairs.filter((_, k) => k !== i), order: orderWithout(b.order, b.pairs.length, i) };
}

export function addOrderItem(b: OrderBlock, at = b.items.length): BlockPatch {
  return { items: [...b.items.slice(0, at), "", ...b.items.slice(at)], order: orderWithNew(b.order, b.items.length, at) };
}

export function removeOrderItem(b: OrderBlock, i: number): BlockPatch {
  return { items: b.items.filter((_, k) => k !== i), order: orderWithout(b.order, b.items.length, i) };
}

// "Sentence" style: the words of the correct sentence are the items. A new word count mixes them again.
export function setSentence(b: OrderBlock, sentence: string): BlockPatch {
  const items = sentence.split(/\s+/).filter(Boolean);
  return { items, order: items.length === b.items.length ? b.order : mixedOrder(items.length) };
}

// Mix the printed order again.
export const reshuffle = (n: number): BlockPatch => ({ order: mixedOrder(n) });

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
  return new Map(doc.blocks.map((b) => [b.id, blockHeight(b, numbers.get(b.id) ?? 1, doc.meta)]));
}

// The heights as drawn on screen: the selected open question without a statement shows its ghost statement line
// (withHints), so it is that much taller there. Printing and placing blocks use the real heights.
export function screenHeights(doc: ExamDoc, heights: Map<string, number>, selectedId: string | null): Map<string, number> {
  const b = doc.blocks.find((x) => x.id === selectedId);
  if (b?.type !== "open" || plainText(b.context ?? "").trim()) return heights;
  const n = questionNumbers(doc.blocks, doc.pages).get(b.id) ?? 1;
  return new Map(heights).set(b.id, blockHeight(withHints(b, doc.meta.lang, { statement: true }), n, doc.meta));
}

// Y position just below the lowest block of a page, so new blocks stack neatly.
export function nextFreeY(blocks: Block[], heights: Map<string, number>, top = PAGE_MARGIN): number {
  const gap = 14;
  // Footers sit at the bottom of the page: they don't count as "content so far".
  return blocks.filter((b) => b.meta?.role !== "footer").reduce((bottom, b) => Math.max(bottom, b.layout.y + (heights.get(b.id) ?? 0) + gap), top);
}

// Lowest y a new block may reach on a page: above its footer, or the bottom margin.
export function pageBottom(onPage: Block[], page: Page): number {
  const footers = onPage.filter((b) => b.meta?.role === "footer").map((b) => b.layout.y - 14);
  return Math.min(pageSize(page).height - (page.margins?.bottom ?? PAGE_MARGIN), ...footers);
}

// Change one sub-question; the question's points stay the sum of its parts.
export function patchPart(parts: OpenPart[], i: number, patch: Partial<OpenPart>): BlockPatch {
  const next = parts.map((p, k) => (k === i ? { ...p, ...patch } : p));
  return { parts: next, points: next.reduce((s, p) => s + p.points, 0) };
}

// After a block is dropped: blocks it covers are pushed down below it (and so on),
// so nothing overlaps and the reading order (question numbers) matches what you see.
export function pushDownOverlaps(blocks: Block[], movedId: string, heights: Map<string, number>, pageHeight: number): Block[] {
  const gap = 14;
  const moved = blocks.find((b) => b.id === movedId);
  if (!moved) return blocks;
  const h = (b: Block) => heights.get(b.id) ?? 0;
  const sideBySide = (a: Block, b: Block) => a.layout.x + a.layout.width <= b.layout.x || b.layout.x + b.layout.width <= a.layout.x;
  const samePage = blocks.filter((b) => b.layout.pageId === moved.layout.pageId && !sideBySide(b, moved) && b.id !== movedId);

  // A block that starts higher but reaches into the dropped one: the dropped one goes below it.
  let y = moved.layout.y;
  for (const b of [...samePage].sort((a, c) => a.layout.y - c.layout.y)) {
    if (b.layout.y < y && b.layout.y + h(b) > y) y = b.layout.y + h(b) + gap;
  }
  y = Math.min(y, pageHeight - h(moved));

  // Blocks below are pushed down one after the other.
  const placed = new Map<string, number>([[movedId, y]]);
  let bottom = y + h(moved);
  for (const b of samePage.filter((b) => b.layout.y >= moved.layout.y).sort((a, c) => a.layout.y - c.layout.y)) {
    if (b.layout.y >= bottom) break; // not covered: the rest stays where it is
    const ny = Math.min(bottom + gap, pageHeight - h(b));
    placed.set(b.id, ny);
    bottom = ny + h(b);
  }
  return blocks.map((b) => (placed.has(b.id) && placed.get(b.id) !== b.layout.y ? { ...b, layout: { ...b.layout, y: placed.get(b.id)! } } : b));
}

// Sum of the points of every question.
export const totalPoints = (blocks: Block[]) => blocks.filter(isQuestion).reduce((s, q) => s + q.points, 0);

// The mark the exam is graded out of: the header's "/ 20", else the exam setting (20).
// `auto` = the header follows the total of the questions (so it can't be exceeded).
export function fullMark(doc: ExamDoc): { value: number; auto: boolean; fromHeader: boolean } {
  const header = doc.blocks.find((b) => b.type === "header");
  if (header?.type === "header") {
    const auto = !!header.fields.autoOutOf;
    return { value: auto ? totalPoints(doc.blocks) || header.fields.outOf : header.fields.outOf, auto, fromHeader: true };
  }
  return { value: doc.meta.fullMark ?? 20, auto: false, fromHeader: false };
}

// ---- Sub-questions of an open question ----

const sumParts = (parts: OpenPart[]) => parts.reduce((s, p) => s + p.points, 0);

// Add a sub-question at the end. The first one takes the place of the main answer lines.
export function addPart(b: OpenBlock): BlockPatch {
  const parts = b.parts ?? [];
  const next = [...parts, { text: "", lines: 2, answer: "", points: 1 }];
  return { parts: next, points: sumParts(next), ...(parts.length ? {} : { lines: 0 }) };
}

export function removePart(b: OpenBlock, i: number): BlockPatch {
  const next = (b.parts ?? []).filter((_, k) => k !== i);
  return { parts: next, ...(next.length ? { points: sumParts(next) } : { lines: 4 }) };
}

// Drag a sub-question to another place (its own name and points go with it).
export function movePart(b: OpenBlock, from: number, to: number): BlockPatch {
  const next = [...(b.parts ?? [])];
  const [moved] = next.splice(from, 1);
  if (!moved) return {};
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
  return { parts: next };
}
