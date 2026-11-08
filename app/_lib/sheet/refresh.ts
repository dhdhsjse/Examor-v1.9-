// Keeping a sheet in step with the exam without making it again. A sheet is the teacher's once made (the marks they changed, the lines they moved), so
// these change only what they are asked to: put a question that is not in the sheet in its place among the rows, bring the answers that changed in the
// exam up to date where they stand (the rows under them make room), fit the answers to the frame again after it was changed. Pure: documents in,
// documents out.
import { blockHeight } from "../blockLayout";
import { BLOCK_TYPE_NAMES, createBlock, isQuestion, questionNumbers } from "../blocks";
import { plainText } from "../richText";
import { settleTextboxes } from "../textboxSlots";
import type { Block, BlockType, ExamDoc, MarkBlock, QuestionBlock, RuleBlock, TextBlock } from "../types";
import { answerParts } from "./answers";
import { fingerprint } from "./fingerprint";
import { boundsOf, fixOverflow, insertAt, measurer, reflowAll, shiftBelow, type Cut } from "./flow";
import {
  GAP,
  PART_GAP,
  ROW_GAP,
  anchorsOf,
  ctxOf,
  decorate,
  fit,
  hostedShapes,
  isTitle,
  itemFor,
  markSlots,
  questionsOf,
  readingOrder,
  sigFor,
  sourcesFor,
  sourcesOf,
  stickerFor,
  titleOfBox,
  totalsColumn,
  type Ctx,
  type Template,
} from "./generate";
import { RULE_HEIGHT, isMark, isRule, markHeight } from "./marks";
import { frameOf } from "./frame";
import { columnOf, settleSheet } from "./settle";

const round2 = (v: number) => Math.round(v * 100) / 100;

const ctxFor = (exam: ExamDoc, doc: ExamDoc): Ctx => ctxOf(exam, doc.sheet!, doc.pages, doc.blocks.filter((b) => b.meta?.role));

/** The blocks of the sheet that stand for the exam block `id`: its copies or answers, the shapes on it, and what is in the text of its copy */
export function blocksOfSource(doc: Pick<ExamDoc, "blocks">, id: string): Block[] {
  const own = doc.blocks.filter((b) => (b.meta?.source?.id === id && !isMark(b) && !isRule(b)) || b.meta?.source?.host === id);
  const ids = new Set(own.map((b) => b.id));
  return [...own, ...doc.blocks.filter((b) => b.meta?.slot && ids.has(b.meta.slot) && !ids.has(b.id))];
}

/** What is refreshed for the exam block `id`: itself, or the text box its copy is in (a block in a text box is copied with its box) */
function unitOf(doc: ExamDoc, id: string): string {
  const clone = doc.blocks.find((b) => b.meta?.source?.id === id && b.meta?.slot);
  const host = clone && doc.blocks.find((b) => b.id === clone.meta!.slot);
  return host?.meta?.source?.id ?? id;
}

// ---- the answers that changed in the exam ----

/** An answer, a copy or a title of the sheet that is no longer what the exam says */
export interface StaleSource {
  /** The exam block */
  id: string;
  /** The number of the question in the exam (null: not a question) */
  n: number | null;
  type: BlockType;
  /** The words of a title; for any other block, what it is */
  title: string;
  /** `title` is the teacher's own words (a title), not the name of a kind of block */
  named: boolean;
  /** The answer was changed on the sheet too: refreshing it replaces what was written there */
  edited: boolean;
}

const MAX_TITLE_SHOWN = 40;

/** What the exam says now and the sheet does not: the blocks it copied or answered that have changed since (the exam in reading order) */
export function staleSources(exam: ExamDoc, sheet: ExamDoc, template: Template): StaleSource[] {
  const by = sourcesOf(sheet.blocks);
  const numbers = questionNumbers(exam.blocks, exam.pages);
  const hosted = template === "copy" ? hostedShapes(exam) : undefined;
  const found: StaleSource[] = [];
  for (const [id, blocks] of by) {
    const src = exam.blocks.find((b) => b.id === id);
    if (!src || src.type === "shape" || src.type === "mark" || src.type === "rule") continue;
    let stale = false;
    let edited = false;
    if (template === "answers" && isQuestion(src)) {
      const texts = blocks.filter((b): b is TextBlock => b.type === "text");
      const parts = answerParts(src, numbers.get(id) ?? 1, exam.meta.lang);
      for (const p of parts) {
        const mine = texts.find((b) => b.meta?.source?.part === p.part);
        if (!mine) {
          stale = true; // (a sub-question the sheet has no answer for)
          continue;
        }
        const sig = mine.meta?.source?.sig;
        if (sig === undefined) continue;
        if (fingerprint(p.text) !== sig) stale = true;
        if (fingerprint(mine.text) !== sig) edited = true;
      }
      if (texts.some((b) => b.meta?.source?.sig !== undefined && !parts.some((p) => p.part === b.meta?.source?.part))) stale = true; // (and one the exam no longer has)
    } else {
      const sig = blocks.find((b) => b.meta?.source?.sig !== undefined)?.meta?.source?.sig;
      stale = sig !== undefined && sigFor(exam, template, src, hosted) !== sig;
    }
    if (!stale) continue;
    const words = src.type === "text" ? plainText(src.text).trim() : titleOfBox(src);
    found.push({ id, n: isQuestion(src) ? (numbers.get(id) ?? null) : null, type: src.type, title: words ? words.slice(0, MAX_TITLE_SHOWN) : BLOCK_TYPE_NAMES[src.type], named: !!words, edited });
  }
  const order = new Map(readingOrder(exam, exam.blocks).map((b, i) => [b.id, i]));
  return found.sort((a, z) => (order.get(a.id) ?? 0) - (order.get(z.id) ?? 0));
}

// ---- the marks follow the answers ----

/**
 * The marks of the questions `qs` level with their answers again, where the answers are now. A sub-question that has no mark gets one (its points), a mark of
 * a sub-question that is gone goes, and a question that became one with several marks gets its total.
 */
function alignMarks(exam: ExamDoc, doc: ExamDoc, qs: QuestionBlock[]): ExamDoc {
  const ctx = ctxFor(exam, doc);
  const numbers = questionNumbers(doc.blocks, doc.pages);
  // (with a column of totals every row has its total, even a row of one mark: it is neither taken away nor left missing)
  const column = totalsColumn(doc.sheet);
  const least = column ? 1 : 2;
  let blocks = doc.blocks;
  const added: Block[] = [];
  for (const q of qs) {
    const mine = anchorsOf(sourcesOf(blocks), q.id);
    const linked = blocks.filter((b): b is MarkBlock => isMark(b) && b.meta?.source?.id === q.id);
    if (!mine.length || !linked.length) continue; // (marks left out, or none for this question)
    const n = numbers.get((mine.find(isQuestion) ?? mine[0]).id) ?? ctx.numbers.get(q.id) ?? 1;
    const slots = markSlots(q, mine, n, ctx.meta);
    const marks = linked.filter((m) => m.kind === "number");
    const used = new Set<string>();
    const moved = new Map<string, Block>();
    for (const s of slots) {
      const m = marks.find((x) => !used.has(x.id) && x.meta?.source?.part === s.part);
      if (!m) {
        added.push(stickerFor(q, s.pageId, s.y, { kind: "number", value: s.value }, ctx.lang, ctx.meta, s.part));
        continue;
      }
      used.add(m.id);
      moved.set(m.id, { ...m, layout: { ...m.layout, pageId: s.pageId, y: round2(s.y - markHeight(m, ctx.meta.fontSize) / 2) } });
    }
    const gone = new Set(marks.filter((m) => !used.has(m.id)).map((m) => m.id));
    const total = linked.find((m) => m.kind === "total");
    if (total && !total.manual && slots.length < least) gone.add(total.id);
    if (!total && (column || marks.length < 2) && slots.length >= least) added.push(stickerFor(q, slots[0].pageId, (slots[0].y + slots[slots.length - 1].y) / 2, { kind: "total", place: "center" }, ctx.lang, ctx.meta));
    blocks = blocks.filter((b) => !gone.has(b.id)).map((b) => moved.get(b.id) ?? b);
  }
  return added.length || blocks !== doc.blocks ? { ...doc, blocks: [...blocks, ...added] } : doc;
}

// ---- refreshing in place ----

/** The answer blocks of question `q` as the exam says them now: the block of each sub-question that has one is kept (its look too), with the new words */
function freshAnswers(ctx: Ctx, q: QuestionBlock, old: Block[], pageId: string, top: number): TextBlock[] {
  const texts = old.filter((b): b is TextBlock => b.type === "text" && b.meta?.source?.id === q.id).sort((a, z) => a.layout.y - z.layout.y);
  const first = texts[0];
  const room = boundsOf(ctx, Math.max(0, ctx.pages.findIndex((p) => p.id === pageId)));
  const x = first?.layout.x ?? room.left;
  const width = first?.layout.width ?? room.right - room.left;
  let y = top;
  return answerParts(q, ctx.numbers.get(q.id) ?? 1, ctx.lang).map((p) => {
    const mine = texts.find((b) => b.meta?.source?.part === p.part);
    const made = createBlock("text", ctx.lang, pageId, { text: p.text, style: "body", width }) as TextBlock;
    const base: TextBlock = mine ?? { ...made, layout: { pageId, x, y: 0, width, height: 0 } };
    const b: TextBlock = {
      ...base,
      text: p.text,
      meta: { ...base.meta, source: { id: q.id, ...(p.part !== undefined ? { part: p.part } : {}), sig: fingerprint(p.text) } },
      layout: { ...base.layout, pageId, y: round2(y) },
    };
    y += blockHeight(b, 1, ctx.meta) + PART_GAP;
    return b;
  });
}

/** The blocks that stand for the exam block `id` made again from the exam as it is, where they stand; the rows under them make room (or close up) */
function refreshOne(exam: ExamDoc, doc: ExamDoc, template: Template, id: string): ExamDoc {
  const src = exam.blocks.find((b) => b.id === id);
  const old = blocksOfSource(doc, id);
  if (!src || !old.length) return doc;
  const ctx = ctxFor(exam, doc);
  const index = new Map(doc.pages.map((p, i) => [p.id, i]));
  const height = measurer(doc);
  const first = [...old].sort((a, z) => (index.get(a.layout.pageId) ?? 0) - (index.get(z.layout.pageId) ?? 0) || a.layout.y - z.layout.y)[0];
  const page = index.get(first.layout.pageId) ?? 0;
  const pageId = doc.pages[page].id;
  const here = old.filter((b) => b.layout.pageId === pageId);
  const top = Math.min(...here.map((b) => b.layout.y));
  const oldBottom = Math.max(...here.map((b) => b.layout.y + height(b)));

  let fresh: Block[];
  if (template === "answers" && isQuestion(src)) fresh = freshAnswers(ctx, src, old, pageId, top);
  else {
    const room = boundsOf(ctx, page);
    const item = itemFor(ctx, template, src, room.left, room.right - room.left);
    if (!item) return doc;
    fresh = item.blocks.map((b) => ({ ...b, layout: { ...b.layout, pageId, y: round2(top + b.layout.y) } }) as Block);
    // (a single block keeps its id: the selection stays on it)
    const main = here.find((b) => b.meta?.source?.id === id);
    if (fresh.length === 1 && main) fresh = [{ ...fresh[0], id: main.id } as Block];
  }

  const dropped = new Set(old.map((b) => b.id));
  const reused = new Map(fresh.filter((f) => dropped.has(f.id)).map((f) => [f.id, f]));
  const blocks = [...doc.blocks.filter((b) => !dropped.has(b.id) || reused.has(b.id)).map((b) => reused.get(b.id) ?? b), ...fresh.filter((f) => !dropped.has(f.id))];
  const next = settleTextboxes({ ...doc, blocks });
  const after = measurer(next);
  const bottom = Math.max(...fresh.map((f) => { const b = next.blocks.find((x) => x.id === f.id)!; return b.layout.y + after(b); }));
  return shiftBelow(next, page, oldBottom, bottom - oldBottom, new Set(fresh.map((f) => f.id)));
}

/**
 * The sheet with the exam blocks `ids` made again from the exam as it is now, each where it stands: its answer, its copy, its title. What is under them
 * moves to make room (onto the next page when it must), their marks are level with the new answers again; nothing else is touched.
 */
export function refreshSources(exam: ExamDoc, sheet: ExamDoc, template: Template, ids: string[]): ExamDoc {
  if (!sheet.sheet) return sheet;
  let doc = sheet;
  const units = [...new Set(ids.map((id) => unitOf(sheet, id)))];
  // (from the top: what each one moves is the next one's)
  const at = (id: string) => {
    const index = new Map(sheet.pages.map((p, i) => [p.id, i]));
    const b = blocksOfSource(sheet, id)[0];
    return b ? (index.get(b.layout.pageId) ?? 0) * 1e6 + b.layout.y : Infinity;
  };
  units.sort((a, z) => at(a) - at(z));
  for (const id of units) doc = refreshOne(exam, doc, template, id);
  if (doc === sheet) return sheet;
  doc = settleTextboxes(fixOverflow(doc));
  const touched = new Set(units);
  doc = alignMarks(exam, doc, questionsOf(exam).filter((q) => touched.has(unitOf(doc, q.id))));
  return settleSheet(doc);
}

// ---- putting questions in their place ----

/** Where the blocks of `after` end on the sheet (null: the top of the sheet): the place the next thing goes, and where it starts */
function placeAfter(doc: ExamDoc, ctx: Ctx, after: Block | null): { cut: Cut; startTop: number } {
  const mine = after ? blocksOfSource(doc, after.id) : [];
  if (!after || !mine.length) {
    const room = boundsOf(ctx, 0);
    return { cut: { page: 0, y: room.top - 1 }, startTop: room.top };
  }
  const index = new Map(doc.pages.map((p, i) => [p.id, i]));
  const height = measurer(doc);
  const last = Math.max(...mine.map((b) => index.get(b.layout.pageId) ?? 0));
  const bottom = Math.max(...mine.filter((b) => (index.get(b.layout.pageId) ?? 0) === last).map((b) => b.layout.y + height(b)));
  // (a question is closed by its line: what is put in goes under it)
  const line = doc.blocks.find((b) => isRule(b) && b.meta?.source?.id === after.id && index.get(b.layout.pageId) === last && b.layout.y + RULE_HEIGHT / 2 >= bottom - 1);
  if (line) {
    const middle = line.layout.y + RULE_HEIGHT / 2;
    return { cut: { page: last, y: middle + 1 }, startTop: middle + ROW_GAP - RULE_HEIGHT / 2 };
  }
  return { cut: { page: last, y: bottom }, startTop: bottom + (isQuestion(after) ? ROW_GAP : GAP) };
}

/**
 * The sheet with the questions `ids` of the exam put in their place among its rows (after what comes before them in the exam), made as the template it
 * was made from does: their answer or copy, their marks and their line, and the title of the exercise they open when the sheet lacks it. The rows under
 * make room, onto the next page when they must. A question in a text box goes with its box.
 */
export function addQuestions(exam: ExamDoc, sheet: ExamDoc, template: Template, ids: string[], marks: boolean): ExamDoc {
  if (!sheet.sheet) return sheet;
  const wanted = new Set(ids);
  const order = sourcesFor(exam, template);
  const byId = new Map(exam.blocks.map((b) => [b.id, b]));
  const have = new Set(sourcesOf(sheet.blocks).keys());

  // What is put in: the questions asked for. A question in a text box (a copy of the exam) comes with its box: if the box is there, it is made again.
  const chosen = new Set<string>();
  const hosts = new Set<string>();
  const embedded: QuestionBlock[] = [];
  for (const q of questionsOf(exam)) {
    if (!wanted.has(q.id) || have.has(q.id)) continue;
    const host = template === "copy" && q.meta?.slot ? byId.get(q.meta.slot) : undefined;
    if (!host) chosen.add(q.id);
    else if (have.has(host.id)) {
      hosts.add(host.id);
      embedded.push(q);
    } else chosen.add(host.id);
  }
  // the title of the exercise each opens, when the sheet has none
  order.forEach((b, k) => {
    if (!chosen.has(b.id) || isTitle(b)) return;
    const above = order.slice(0, k).reverse().find(isTitle);
    if (above && !have.has(above.id)) chosen.add(above.id);
  });
  if (!chosen.size && !hosts.size) return sheet;

  let doc = sheet;
  if (hosts.size) doc = refreshSources(exam, doc, template, [...hosts]);

  // The runs: what is put in one after the other with nothing of the sheet between them goes in at once, after what comes before it in the exam
  const runs: { after: Block | null; items: Block[] }[] = [];
  let run: { after: Block | null; items: Block[] } | null = null;
  let last: Block | null = null;
  for (const b of order) {
    if (chosen.has(b.id) && !have.has(b.id)) {
      if (!run) runs.push((run = { after: last, items: [] }));
      run.items.push(b);
    } else if (have.has(b.id)) {
      run = null;
      last = b;
    }
  }
  for (const r of runs) {
    let ctx = ctxFor(exam, doc);
    const { cut, startTop } = placeAfter(doc, ctx, r.after);
    const room = boundsOf(ctx, cut.page);
    const items = r.items.flatMap((b) => itemFor(ctx, template, b, room.left, room.right - room.left) ?? []);
    doc = settleTextboxes(insertAt(doc, cut, items, startTop));
    // (the line under what comes before is thick when an exercise follows it, thin when it is the same one)
    const above = r.after && doc.blocks.find((b): b is RuleBlock => isRule(b) && b.meta?.source?.id === r.after!.id);
    const want = isTitle(r.items[0]) ? "exercise" : "row";
    if (above && above.line !== "hidden" && (above.line ?? "row") !== want) doc = { ...doc, blocks: doc.blocks.map((b) => (b === above ? { ...above, line: want } : b)) };
    // marks and a line for each question that came in (and for the ones in a text box that came with its box)
    ctx = ctxFor(exam, doc);
    const came = new Set(r.items.map((b) => b.id));
    const hasLine = (id: string) => doc.blocks.some((b) => isRule(b) && b.meta?.source?.id === id);
    const qs = questionsOf(exam).filter((q) => (came.has(q.id) || came.has(q.meta?.slot ?? "")) && !hasLine(q.id));
    doc = { ...doc, blocks: [...doc.blocks, ...decorate(ctx, doc, qs, marks, totalsColumn(sheet.sheet))] };
  }
  // the questions that came into a box that was there: their marks and their line
  if (embedded.length) {
    const ctx = ctxFor(exam, doc);
    doc = { ...doc, blocks: [...doc.blocks, ...decorate(ctx, doc, embedded, marks, totalsColumn(sheet.sheet))] };
  }
  return settleSheet(doc);
}

// ---- closing up ----

/**
 * The rows laid out again from the first one, page after page: a row that was passed on to the next page by a longer answer comes back when it fits,
 * and the pages that are left empty go. (Refreshing an answer only ever pushes rows on; this is the way back.)
 */
export function packSheet(sheet: ExamDoc): ExamDoc {
  if (!sheet.sheet) return sheet;
  const packed = reflowAll(sheet);
  if (packed === sheet) return sheet;
  return settleSheet(settleTextboxes(packed));
}

// ---- fitting to the frame ----

/**
 * Every answer and copy of the sheet fitted to the answer column as it is now (after the columns or the edges of the frame were moved): the text wraps
 * again, the pictures are narrowed or widened to it, the rows under make room, and the marks are level with their answers again.
 */
export function refitSheet(exam: ExamDoc, sheet: ExamDoc, template: Template): ExamDoc {
  if (!sheet.sheet) return sheet;
  const examBlock = new Map(exam.blocks.map((b) => [b.id, b]));
  const index0 = new Map(sheet.pages.map((p, i) => [p.id, i]));
  const ids = sheet.blocks
    .filter((b) => b.meta?.source && !b.meta.slot && !isMark(b) && !isRule(b) && b.type !== "shape" && examBlock.has(b.meta.source.id))
    .sort((a, z) => (index0.get(a.layout.pageId) ?? 0) - (index0.get(z.layout.pageId) ?? 0) || a.layout.y - z.layout.y)
    .map((b) => b.id);
  let doc = sheet;
  for (const id of ids) {
    const cur = doc.blocks.find((b) => b.id === id);
    const src = cur?.meta?.source && examBlock.get(cur.meta.source.id);
    if (!cur || !src) continue;
    const page = doc.pages.findIndex((p) => p.id === cur.layout.pageId);
    const room = boundsOf(ctxFor(exam, doc), Math.max(0, page));
    const x = room.left;
    const width = room.right - room.left;
    const before = measurer(doc)(cur);
    const patch = template === "answers" && cur.type === "text" ? { x, width } : fit(src, x, width);
    // (it fits already)
    if ((["x", "width", "height"] as const).every((k) => patch[k] === undefined || Math.abs(patch[k] - (cur.layout[k] ?? 0)) < 0.01)) continue;
    const next: Block = { ...cur, layout: { ...cur.layout, ...patch } } as Block;
    let blocks = doc.blocks.map((b) => (b.id === id ? next : b));
    // the shapes on a picture follow it
    const k = src.layout.width > 0 ? next.layout.width / src.layout.width : 1;
    blocks = blocks.map((b) => {
      const s = b.meta?.source?.host === src.id ? examBlock.get(b.meta.source.id) : undefined;
      if (!s) return b;
      return { ...b, layout: { ...b.layout, x: next.layout.x + (s.layout.x - src.layout.x) * k, y: round2(next.layout.y + (s.layout.y - src.layout.y) * k), width: s.layout.width * k, height: s.layout.height * k } } as Block;
    });
    const settled = settleTextboxes({ ...doc, blocks });
    const now = settled.blocks.find((b) => b.id === id)!;
    doc = shiftBelow(settled, Math.max(0, page), cur.layout.y + before, now.layout.y + measurer(settled)(now) - (cur.layout.y + before), new Set([id]));
  }
  if (doc === sheet) return sheet;
  doc = settleTextboxes(fixOverflow(doc));
  doc = alignMarks(exam, doc, questionsOf(exam));
  return settleSheet(doc);
}

/**
 * The blocks of a sheet that are not made from the exam (written or put there by the teacher: texts, text boxes, pictures, tables…) fitted to the
 * answer column as it is now: a text takes the column's width, anything else wider than it is narrowed to it (its height in step) and anything
 * sticking out is moved into it. The rows under make room. Marks, lines and shapes stay where they are, and so does what is above the frame's rows
 * (the sheet's title).
 */
export function refitLoose(exam: ExamDoc, sheet: ExamDoc): ExamDoc {
  if (!sheet.sheet) return sheet;
  const index0 = new Map(sheet.pages.map((p, i) => [p.id, i]));
  const fromExam = new Set(exam.blocks.map((b) => b.id));
  const ids = sheet.blocks
    .filter((b) => !b.meta?.role && !b.meta?.slot && !isMark(b) && !isRule(b) && b.type !== "shape" && !(b.meta?.source && fromExam.has(b.meta.source.id)))
    .sort((a, z) => (index0.get(a.layout.pageId) ?? 0) - (index0.get(z.layout.pageId) ?? 0) || a.layout.y - z.layout.y)
    .map((b) => b.id);
  let doc = sheet;
  for (const id of ids) {
    const cur = doc.blocks.find((b) => b.id === id);
    if (!cur) continue;
    const page = doc.pages.findIndex((p) => p.id === cur.layout.pageId);
    const room = boundsOf(ctxFor(exam, doc), Math.max(0, page));
    const width = room.right - room.left;
    // (above the frame's rows, or held by the column of the marks or of the totals: it stays)
    if (!(width > 0) || cur.layout.y < room.top - 0.5 || columnOf(cur, frameOf(doc, Math.max(0, page)))) continue;
    const flows = cur.type === "text" || isQuestion(cur);
    const w = flows ? width : Math.min(cur.layout.width, width);
    const k = cur.layout.width > 0 ? w / cur.layout.width : 1;
    const x = flows ? room.left : Math.max(room.left, Math.min(cur.layout.x, room.right - w));
    const height = !flows && cur.layout.height > 0 && k !== 1 ? cur.layout.height * k : cur.layout.height;
    if (Math.abs(x - cur.layout.x) < 0.01 && Math.abs(w - cur.layout.width) < 0.01 && Math.abs(height - cur.layout.height) < 0.01) continue; // (it fits already)
    const before = measurer(doc)(cur);
    const next = { ...cur, layout: { ...cur.layout, x, width: w, height } } as Block;
    const settled = settleTextboxes({ ...doc, blocks: doc.blocks.map((b) => (b.id === id ? next : b)) });
    const now = settled.blocks.find((b) => b.id === id)!;
    doc = shiftBelow(settled, Math.max(0, page), cur.layout.y + before, now.layout.y + measurer(settled)(now) - (cur.layout.y + before), new Set([id]));
  }
  if (doc === sheet) return sheet;
  return settleSheet(settleTextboxes(fixOverflow(doc)));
}

// ---- the look of the answers ----

/** How the written answers look: their size (px) and color (undefined: the usual one) */
export interface AnswerLook {
  size?: number;
  color?: string | undefined;
}

/**
 * The answers of a sheet of the answers (the text blocks made from questions) in a new size and color: the lines wrap again, the rows under make room
 * (onto the next page when they must), and the marks stay level with their answers. A copy of the exam draws its answers from the exam's settings instead.
 */
export function restyleAnswers(exam: ExamDoc, sheet: ExamDoc, look: AnswerLook): ExamDoc {
  if (!sheet.sheet) return sheet;
  const questions = new Set(questionsOf(exam).map((q) => q.id));
  const index = new Map(sheet.pages.map((p, i) => [p.id, i]));
  const ids = sheet.blocks
    .filter((b) => b.type === "text" && b.meta?.source && questions.has(b.meta.source.id))
    .sort((a, z) => (index.get(a.layout.pageId) ?? 0) - (index.get(z.layout.pageId) ?? 0) || a.layout.y - z.layout.y)
    .map((b) => b.id);
  let doc = sheet;
  for (const id of ids) {
    const cur = doc.blocks.find((b) => b.id === id);
    if (!cur || cur.type !== "text") continue;
    const font = { ...cur.font, ...("size" in look && look.size !== undefined ? { size: look.size } : {}) };
    if ("color" in look) {
      if (look.color) font.color = look.color;
      else delete font.color;
    }
    const page = Math.max(0, doc.pages.findIndex((p) => p.id === cur.layout.pageId));
    const before = measurer(doc)(cur);
    const next: Block = { ...cur, font };
    const settled = { ...doc, blocks: doc.blocks.map((b) => (b.id === id ? next : b)) };
    const delta = measurer(settled)(next) - before;
    doc = shiftBelow(settled, page, cur.layout.y + before, delta, new Set([id]));
  }
  if (doc === sheet) return sheet;
  doc = settleTextboxes(fixOverflow(doc));
  doc = alignMarks(exam, doc, questionsOf(exam));
  return settleSheet(doc);
}
