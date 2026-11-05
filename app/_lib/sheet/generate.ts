// Makes a correction sheet from the exam. Two ways: "answers" (a row per question: its number, its model answer, its marks) and "copy" (the exam
// itself, narrowed to the answer column, with its answers under the questions and the marks beside them). Either way the sheet is ordinary
// blocks (text, copies of the exam's blocks, mark stickers, row lines) that the teacher goes on editing; each carries `meta.source`, the id of the
// exam block it was made from (and a fingerprint of what it was made from), so the marks can be compared with the points of the questions, the
// answers that changed in the exam since can be told, and questions added later can be put in their place (links.ts, refresh.ts).
//
// Done in steps: the exam is read into items (a heading, a question with its answers, a block to copy), the items are laid one under the other in
// the answer column (page by page, flow.ts), then the marks and the lines are made from where the answers ended up.
import { blockHeight, layoutBlank, layoutClassify, layoutMatch, layoutMcq, layoutOpen, layoutOrder, layoutText, layoutTrueFalse, type TextBox } from "../blockLayout";
import { createBlock, isQuestion, questionNumbers } from "../blocks";
import { newId } from "../id";
import { plainText } from "../richText";
import { slotsOf, updateSlots } from "../textboxDoc";
import { syncEmbedded } from "../textboxSlots";
import type { Block, BlockLayout, BlockType, CorrectionDoc, ExamDoc, ExamMeta, HeaderBlock, Lang, MarkBlock, Page, QuestionBlock, RuleBlock, ShapeBlock, TextBlock, TextboxBlock } from "../types";
import { answerParts, printedWords } from "./answers";
import { blockSig, fingerprint, stable } from "./fingerprint";
import { boundsOf, newPageLike, place, type Item, type Pager } from "./flow";
import { frameGeometry } from "./frame";
import { RULE_HEIGHT, markHeight } from "./marks";
import { defaultSheet, type SheetConfig, type SheetPaper } from "./model";
import { noChrome } from "./part";
import { settleSheet } from "./settle";

export interface SheetMakeOptions {
  template: "answers" | "copy";
  paper: SheetPaper;
  /** Put the marks of the questions (their points) beside the answers */
  marks: boolean;
  /** The settings of the sheet it replaces (its columns, titles, frame…): kept */
  keep?: SheetConfig;
}

export type Template = SheetMakeOptions["template"];

export const GAP = 10; // between two items of the sheet
export const PART_GAP = 4; // between the answers to the sub-questions of one question
export const ROW_GAP = 14; // under a question: room for the line that closes its row
const TITLE_GAP = 14; // under the title of the sheet, over its frame

export const isHeading = (b: Block): b is TextBlock => b.type === "text" && b.style !== "body";

// A text box that is only the title of an exercise ("Exercice 2", "التمرين الثاني : ..."): a line of a few words that begins with the word for it
const TITLE_WORDS = /^(?:exercice|exercise|probl[eè]me|problem|activit[eé]|activity|situation|partie|part|التمرين|تمرين|الوضعية|وضعية|المسألة|مسألة|النشاط|نشاط|الجزء)(?=$|[\s\d:.\-–—)(،])/iu;
const MAX_TITLE = 80;

/** The words of a text box that is the title of an exercise (null: it is something else) */
export function titleOfBox(b: Block): string | null {
  if (b.type !== "textbox" || b.meta?.slot || b.meta?.role) return null;
  if (b.content && slotsOf(b.content).length) return null;
  const text = plainText(b.text ?? "").trim();
  return text && text.length <= MAX_TITLE && !text.includes("\n") && TITLE_WORDS.test(text) ? text : null;
}
export const isTitleBox = (b: Block): b is TextboxBlock => titleOfBox(b) !== null;
/** A block that opens an exercise: a heading, or a text box that is only the title of one */
export const isTitle = (b: Block) => isHeading(b) || isTitleBox(b);

// What can be a source: not a header or a footer of a page, not the header of the exam, not the lines and drawings the sheet makes its own
export const isSource = (b: Block) => !b.meta?.role && b.type !== "header" && b.type !== "divider" && b.type !== "shape" && b.type !== "mark" && b.type !== "rule";

/** The blocks in reading order: page by page, top to bottom */
export function readingOrder<T extends Block>(exam: Pick<ExamDoc, "pages">, list: T[]): T[] {
  const page = new Map(exam.pages.map((p, i) => [p.id, i]));
  return [...list].sort((a, b) => (page.get(a.layout.pageId) ?? 0) - (page.get(b.layout.pageId) ?? 0) || a.layout.y - b.layout.y || a.layout.x - b.layout.x);
}

/** The questions and the titles of the exam, in reading order (what a sheet of the answers is made of; the questions in a text box too) */
export const questionsAndHeadings = (exam: ExamDoc): Block[] => readingOrder(exam, exam.blocks.filter((b) => isSource(b) && (isQuestion(b) || isTitle(b))));

/** The questions of the exam in reading order */
export const questionsOf = (exam: ExamDoc): QuestionBlock[] => readingOrder(exam, exam.blocks.filter((b): b is QuestionBlock => isSource(b) && isQuestion(b)));

/** The blocks of the exam a sheet of the exam's copy is made of, in reading order (the blocks in the text of a text box come with their box) */
export const copyOrder = (exam: ExamDoc): Block[] => readingOrder(exam, exam.blocks.filter((b) => isSource(b) && !b.meta?.slot));

/** What a sheet made as `template` is made of, in reading order */
export const sourcesFor = (exam: ExamDoc, template: Template): Block[] => (template === "answers" ? questionsAndHeadings(exam) : copyOrder(exam));

export interface Ctx extends Pager {
  exam: ExamDoc;
  lang: Lang;
  numbers: Map<string, number>;
}

/** The room to lay a sheet out in: `pages` and `sheet` are those of the sheet (the paper counts as bordered), `chrome` its headers and footers */
export function ctxOf(exam: ExamDoc, sheet: SheetConfig, pages: Page[], chrome: Block[] = []): Ctx {
  return { exam, meta: exam.meta, lang: exam.meta.lang, sheet: { ...sheet, paper: "bordered" }, pages, chrome, numbers: questionNumbers(exam.blocks, exam.pages) };
}

// ---- shapes on the pictures ----

// The shapes drawn on a picture, a graph, a formula, a table or a text box (an arrow on a diagram, a frame around a word) follow it to the sheet; the
// others (a line across the page, a frame around everything) are left out.
const HOSTS: BlockType[] = ["image", "graph", "equation", "table", "textbox"];
const HOSTED = 0.5; // the part of a shape that has to be over a block for the shape to belong to it

function covered(shape: Block, host: Block, exam: ExamDoc): number {
  const sh = Math.max(shape.layout.height, 1);
  const sw = Math.max(shape.layout.width, 1);
  const hh = blockHeight(host, 1, exam.meta);
  const w = Math.min(shape.layout.x + sw, host.layout.x + host.layout.width) - Math.max(shape.layout.x, host.layout.x);
  const h = Math.min(shape.layout.y + sh, host.layout.y + hh) - Math.max(shape.layout.y, host.layout.y);
  return w > 0 && h > 0 ? (w * h) / (sw * sh) : 0;
}

/** The shapes of the exam by the block each lies on */
export function hostedShapes(exam: ExamDoc): Map<string, ShapeBlock[]> {
  const out = new Map<string, ShapeBlock[]>();
  const hosts = exam.blocks.filter((b) => HOSTS.includes(b.type) && !b.meta?.slot && !b.meta?.role);
  for (const s of exam.blocks) {
    if (s.type !== "shape" || s.meta?.role) continue;
    let best: Block | null = null;
    let most = HOSTED - 1e-9;
    for (const h of hosts) {
      if (h.layout.pageId !== s.layout.pageId) continue;
      const c = covered(s, h, exam);
      if (c > most) {
        best = h;
        most = c;
      }
    }
    if (best) out.set(best.id, [...(out.get(best.id) ?? []), s]);
  }
  return out;
}

/** What the sheet remembers of a block of the exam it copies: its content, and the shapes on it */
export function copySig(exam: ExamDoc, src: Block, shapes: ShapeBlock[] = hostedShapes(exam).get(src.id) ?? []): string {
  if (!shapes.length) return blockSig(src);
  const on = (s: ShapeBlock) => stable({ x: s.layout.x - src.layout.x, y: s.layout.y - src.layout.y, w: s.layout.width, h: s.layout.height });
  return fingerprint([blockSig(src), ...shapes.map((s) => blockSig(s) + on(s))].join("|"));
}

/** What the sheet remembers of the heading or content block `src` it was made from, as `template` makes it */
export const sigFor = (exam: ExamDoc, template: Template, src: Block, hosted?: Map<string, ShapeBlock[]>): string =>
  template === "answers" ? (isTitleBox(src) ? fingerprint(titleOfBox(src) ?? "") : blockSig(src)) : copySig(exam, src, (hosted ?? hostedShapes(exam)).get(src.id) ?? []);

// ---- reading the exam ----

/** A block of the sheet that is a copy of an exam block */
function copyOf(exam: ExamDoc, src: Block, layout: Partial<BlockLayout>, sig = blockSig(src)): Block {
  return { ...structuredClone(src), id: newId(), meta: { source: { id: src.id, sig } }, layout: { ...src.layout, pageId: "", y: 0, ...layout } } as Block;
}

// (on a sheet of the answers the title of an exercise is centered and underlined, as on the official answer keys; a heading with a look of its own keeps it)
export function headingItem(ctx: Ctx, b: TextBlock | TextboxBlock, x: number, width: number, official: boolean): Item {
  if (b.type === "textbox") {
    // (the title of an exercise typed in a text box becomes a heading of the sheet)
    const t = createBlock("text", ctx.lang, "", { text: titleOfBox(b) ?? "", style: "heading", width }) as TextBlock;
    const heading: TextBlock = { ...t, align: "center", font: { ...t.font, underline: true }, meta: { source: { id: b.id, sig: sigFor(ctx.exam, "answers", b) } }, layout: { pageId: "", x, y: 0, width, height: 0 } };
    return { blocks: [heading], height: blockHeight(heading, 1, ctx.meta), gap: GAP, keepWithNext: true };
  }
  const plain = !b.decor || b.decor === "plain";
  const copy = copyOf(ctx.exam, b, { x, width });
  if (official && plain && copy.type === "text") Object.assign(copy, { align: "center", font: { ...copy.font, underline: true } });
  return { blocks: [copy], height: blockHeight(copy, 1, ctx.meta), gap: GAP, keepWithNext: true };
}

/** The answer to a question: a block of text for each part of it, one under the other */
export function answerItem(ctx: Ctx, q: QuestionBlock, x: number, width: number): Item {
  const n = ctx.numbers.get(q.id) ?? 1;
  const blocks: Block[] = [];
  let y = 0;
  for (const p of answerParts(q, n, ctx.lang)) {
    const text = createBlock("text", ctx.lang, "", { text: p.text, style: "body", width }) as TextBlock;
    text.meta = { source: { id: q.id, ...(p.part !== undefined ? { part: p.part } : {}), sig: fingerprint(p.text) } };
    text.layout = { pageId: "", x, y, width, height: 0 };
    blocks.push(text);
    y += blockHeight(text, 1, ctx.meta) + PART_GAP;
  }
  return { blocks, height: Math.max(0, y - PART_GAP), gap: ROW_GAP };
}

/** How a copied block fits the answer column: text and questions take its whole width; a picture, a formula or a graph is narrowed to it, in proportion */
export function fit(b: Block, x: number, width: number): Partial<BlockLayout> {
  const centered = (w: number) => x + (width - w) / 2;
  switch (b.type) {
    case "image": {
      const w = Math.min(b.layout.width, width);
      return { x: centered(w), width: w, height: w / (b.ratio || 1) };
    }
    case "equation":
    case "graph": {
      const k = Math.min(1, width / Math.max(1, b.layout.width));
      return { x: centered(b.layout.width * k), width: b.layout.width * k, height: b.layout.height * k };
    }
    case "table":
    case "textbox":
      return { x, width: Math.min(b.layout.width, width) };
    default:
      return { x, width };
  }
}

/** A copy of a block of the exam that is not a question; a text box comes with copies of the blocks in its text, a picture with the shapes on it */
export function contentItem(ctx: Ctx, b: Block, x: number, width: number): Item {
  const blocks: Block[] = [];
  const shapes = hostedShapes(ctx.exam).get(b.id) ?? [];
  let copy = copyOf(ctx.exam, b, fit(b, x, width), copySig(ctx.exam, b, shapes));
  if (copy.type === "textbox" && copy.content && slotsOf(copy.content).length) {
    const inside = new Map(slotsOf(copy.content).flatMap((s) => (ctx.exam.blocks.some((o) => o.id === s.id) ? [[s.id, newId()] as const] : [])));
    copy = { ...copy, content: updateSlots(copy.content, (s) => (inside.has(s.id) ? { ...s, id: inside.get(s.id)! } : null)) };
    for (const [from, to] of inside) {
      const src = ctx.exam.blocks.find((o) => o.id === from)!;
      blocks.push({ ...structuredClone(src), id: to, meta: { slot: copy.id, source: { id: src.id, sig: blockSig(src) } }, layout: { ...src.layout, pageId: "", y: 0 } } as Block);
    }
  }
  // (a text box as wide as its text but wider than the column keeps the width of the column, and its height follows its text)
  if (copy.type === "textbox" && copy.sizing === "auto-width" && b.layout.width >= width) copy = { ...copy, sizing: "auto-height" };
  const height = blockHeight(copy, 1, ctx.meta);

  // The shapes keep their place on the block, in proportion to it (a text or a table that was narrowed is read again, so what was on it is left out)
  const k = b.layout.width > 0 ? copy.layout.width / b.layout.width : 1;
  const follows = shapes.length > 0 && (k >= 1 - 1e-6 || b.type === "image" || b.type === "graph" || b.type === "equation");
  const on: Block[] = follows
    ? shapes.map(
        (s) =>
          ({
            ...structuredClone(s),
            id: newId(),
            meta: { source: { id: s.id, sig: blockSig(s), host: b.id } },
            layout: { pageId: "", x: copy.layout.x + (s.layout.x - b.layout.x) * k, y: (s.layout.y - b.layout.y) * k, width: s.layout.width * k, height: s.layout.height * k },
          }) as Block,
      )
    : [];
  const top = Math.min(0, ...on.map((s) => s.layout.y));
  const bottom = Math.max(height, ...on.map((s) => s.layout.y + s.layout.height));
  const all = [copy, ...blocks, ...on].map((x2) => (top < 0 ? ({ ...x2, layout: { ...x2.layout, y: x2.layout.y - top } } as Block) : x2));
  return { blocks: all, height: bottom - top, gap: GAP };
}

export function questionItem(ctx: Ctx, q: QuestionBlock, x: number, width: number): Item {
  const copy = copyOf(ctx.exam, q, { x, width });
  return { blocks: [copy], height: blockHeight(copy, ctx.numbers.get(q.id) ?? 1, ctx.meta), gap: ROW_GAP };
}

/** The item a block of the exam makes on a sheet made as `template` (null: nothing of it goes on that sheet) */
export function itemFor(ctx: Ctx, template: Template, b: Block, x: number, width: number): Item | null {
  if (template === "answers") {
    if (isHeading(b) || isTitleBox(b)) return headingItem(ctx, b, x, width, true);
    return isQuestion(b) ? answerItem(ctx, b, x, width) : null;
  }
  if (isHeading(b)) return headingItem(ctx, b, x, width, false);
  return isQuestion(b) ? questionItem(ctx, b, x, width) : contentItem(ctx, b, x, width);
}

// ---- the marks and the lines ----

/** Where the first line of a text is (its middle, in the block's own coordinates) */
const firstLine = (box: TextBox) => box.y + (box.lines[0]?.height ?? 20) / 2;

/** The box of the question itself (its number, its text) of any kind of question */
function titleBox(b: QuestionBlock, n: number, meta: ExamMeta): TextBox {
  switch (b.type) {
    case "mcq":
      return layoutMcq(b, n, meta).title;
    case "truefalse":
      return layoutTrueFalse(b, n, meta).title;
    case "blank":
      return layoutBlank(b, n, meta).title;
    case "open":
      return layoutOpen(b, n, meta).title;
    case "match":
      return layoutMatch(b, n, meta).title;
    case "order":
      return layoutOrder(b, n, meta).title;
    case "classify":
      return layoutClassify(b, n, meta).title;
  }
}

/** A mark the sheet gives: where (the middle of its line, on a page), what, and for which sub-question */
export interface Slot {
  pageId: string;
  y: number;
  value: number;
  part?: number;
}

const earns = (v: number) => Number.isFinite(v) && v > 0;
const round3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * The marks of question `q` beside its blocks `anchors` on the sheet: one for each sub-question of an open question, else one; level with the first
 * line of the answer (or, on a copy of the exam, of the question). `n`: the number the question has on the sheet.
 */
export function markSlots(q: QuestionBlock, anchors: Block[], n: number, meta: ExamMeta): Slot[] {
  const out: Slot[] = [];
  const parts = q.type === "open" ? (q.parts ?? []) : [];
  const texts = anchors.filter((b): b is TextBlock => b.type === "text");
  if (texts.length) {
    for (const b of texts) {
      const part = b.meta?.source?.part;
      if (part === undefined && parts.length) continue; // (the answer typed for the question itself, over its sub-questions: no mark of its own)
      const value = part !== undefined ? (parts[part]?.points ?? 0) : q.points;
      if (earns(value)) out.push({ pageId: b.layout.pageId, y: b.layout.y + firstLine(layoutText(b, meta).text), value: round3(value), ...(part !== undefined ? { part } : {}) });
    }
    return out;
  }
  const copy = anchors.find(isQuestion);
  if (!copy) return out;
  if (copy.type === "open" && parts.length) {
    layoutOpen(copy, n, meta).parts.forEach((p, i) => {
      const value = parts[i]?.points ?? 0;
      if (earns(value)) out.push({ pageId: copy.layout.pageId, y: copy.layout.y + firstLine(p.text), value: round3(value), part: i });
    });
    return out;
  }
  if (earns(q.points)) out.push({ pageId: copy.layout.pageId, y: copy.layout.y + firstLine(titleBox(copy, n, meta)), value: round3(q.points) });
  return out;
}

/** A mark sticker of question `q` (`part`: of that sub-question) level with `middle` on a page */
export function stickerFor(q: QuestionBlock, pageId: string, middle: number, data: Partial<MarkBlock>, lang: Lang, meta: ExamMeta, part?: number): MarkBlock {
  const b = createBlock("mark", lang, pageId, data) as MarkBlock;
  const h = markHeight(b, meta.fontSize);
  return { ...b, meta: { source: { id: q.id, ...(part !== undefined ? { part } : {}) } }, layout: { ...b.layout, pageId, x: 0, y: Math.round((middle - h / 2) * 100) / 100, width: 56, height: h } };
}

/** The stickers of a question: a mark for each slot, and a total when there are two or more (it follows its marks, see settle.ts) */
export function stickersFor(q: QuestionBlock, slots: Slot[], lang: Lang, meta: ExamMeta): MarkBlock[] {
  const marks = slots.map((s) => stickerFor(q, s.pageId, s.y, { kind: "number", value: s.value }, lang, meta, s.part));
  if (marks.length < 2) return marks;
  return [...marks, stickerFor(q, slots[0].pageId, (slots[0].y + slots[slots.length - 1].y) / 2, { kind: "total", place: "center" }, lang, meta)];
}

/** The line that closes the row of a question: under its blocks, thick when an exercise ends there */
export function lineAfter(q: QuestionBlock, anchors: Block[], n: number, pages: Page[], lang: Lang, meta: ExamMeta, exercise: boolean): RuleBlock | null {
  const pageOf = (b: Block) => pages.findIndex((p) => p.id === b.layout.pageId);
  const last = Math.max(...anchors.map(pageOf));
  if (last < 0) return null;
  const bottom = Math.max(...anchors.filter((b) => pageOf(b) === last).map((b) => b.layout.y + blockHeight(b, n, meta)));
  const pageId = pages[last].id;
  const rule = createBlock("rule", lang, pageId, exercise ? { line: "exercise" } : {}) as RuleBlock;
  return { ...rule, meta: { source: { id: q.id } }, layout: { ...rule.layout, pageId, x: 0, y: Math.round((bottom + 5 - RULE_HEIGHT / 2) * 100) / 100, width: 100, height: RULE_HEIGHT } };
}

/** The blocks of the sheet by the exam block they were made from (the marks and the lines left out) */
export function sourcesOf(blocks: Block[]): Map<string, Block[]> {
  const by = new Map<string, Block[]>();
  for (const b of blocks) {
    const id = b.meta?.source?.id;
    if (!id || b.type === "mark" || b.type === "rule") continue;
    by.set(id, [...(by.get(id) ?? []), b]);
  }
  return by;
}

/** The blocks of a question on the sheet, the answers to its sub-questions in order */
export const anchorsOf = (by: Map<string, Block[]>, id: string): Block[] => [...(by.get(id) ?? [])].sort((a, b) => (a.meta?.source?.part ?? -1) - (b.meta?.source?.part ?? -1));

/** The marks and the lines of the questions `list` (in exam order), from where their blocks are in `doc` */
export function decorate(ctx: Ctx, doc: ExamDoc, list: QuestionBlock[], marks: boolean): Block[] {
  const by = sourcesOf(doc.blocks);
  const numbers = questionNumbers(doc.blocks, doc.pages);
  const order = questionsAndHeadings(ctx.exam);
  const out: Block[] = [];
  for (const q of list) {
    const mine = anchorsOf(by, q.id);
    if (!mine.length) continue;
    const n = numbers.get((mine.find(isQuestion) ?? mine[0]).id) ?? ctx.numbers.get(q.id) ?? 1;
    if (marks) out.push(...stickersFor(q, markSlots(q, mine, n, ctx.meta), ctx.lang, ctx.meta));
    const next = order[order.findIndex((b) => b.id === q.id) + 1];
    const line = lineAfter(q, mine, n, doc.pages, ctx.lang, ctx.meta, !!next && isTitle(next));
    if (line) out.push(line);
  }
  return out;
}

// ---- the whole sheet ----

/** The title of the sheet and, under it, the title of the exam: blocks across the first page, from `top` */
function titleOf(ctx: Ctx, page: Page, x: number, width: number, top: number): { blocks: Block[]; bottom: number } {
  const header = ctx.exam.blocks.find((b): b is HeaderBlock => b.type === "header");
  const examTitle = plainText((header?.fields.title ?? "").trim());
  const blocks: Block[] = [];
  let y = top;
  const add = (b: Block) => {
    const at = { ...b, layout: { ...b.layout, pageId: page.id, x, y, width } } as Block;
    blocks.push(at);
    y += blockHeight(at, 1, ctx.meta);
  };
  add(createBlock("text", ctx.lang, page.id, { text: printedWords(ctx.lang).title, style: "title", width }));
  if (examTitle) add(createBlock("text", ctx.lang, page.id, { text: examTitle, style: "body", align: "center", width }));
  return { blocks, bottom: y };
}

/** The correction sheet of `exam`, made as `opts` say */
export function generateCorrection(exam: ExamDoc, opts: SheetMakeOptions): CorrectionDoc {
  const meta = exam.meta;
  const lang = meta.lang;
  const base = opts.keep ?? defaultSheet(lang, opts.paper);
  const first = newPageLike(exam.pages);
  const ctx = ctxOf(exam, { ...base, frame: { ...base.frame, firstTop: 0 } }, [first]);

  // The title goes across the frame, on the first page; the frame starts under it
  const geo = frameGeometry(ctx.sheet, first, 0, lang === "ar")!;
  const title = titleOf(ctx, first, geo.frame.x, geo.frame.width, geo.frame.y);
  ctx.sheet = { ...ctx.sheet, frame: { ...ctx.sheet.frame, firstTop: Math.ceil(title.bottom - geo.frame.y + TITLE_GAP) } };

  const room = boundsOf(ctx, 0);
  const x = room.left;
  const width = room.right - room.left;

  // What the sheet is made of, in reading order
  const items = sourcesFor(exam, opts.template)
    .map((b) => itemFor(ctx, opts.template, b, x, width))
    .filter((it): it is Item => it !== null);

  // The marks and the lines follow where the answers are (a text box puts the questions in its text in their room first)
  let doc: ExamDoc = { version: 1, meta, pages: ctx.pages, blocks: [...title.blocks, ...place(ctx, items, 0, room.top)], sheet: ctx.sheet };
  doc = syncEmbedded(doc);
  doc = { ...doc, blocks: [...doc.blocks, ...decorate(ctx, doc, questionsOf(exam), opts.marks)] };
  doc = settleSheet(doc);

  return { sheet: { ...ctx.sheet, paper: opts.paper }, pages: ctx.pages, blocks: doc.blocks, template: opts.template, ...noChrome() };
}
