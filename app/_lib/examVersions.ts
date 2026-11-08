import { blockHeights, createBlock, isQuestion } from "./blocks";
import { isFloating } from "./blockOrder";
import { pageSize } from "./pageFormats";
import { mixedOrder, seededRandom } from "./shuffle";
import type { Block, ExamDoc, Lang } from "./types";

// Versions of one exam for neighbours who must not copy (A, B, C, D): the same questions, mixed — the questions of each exercise in
// another order, and the answers to choose from in another order. Always the same mix for the same version (drawn from the version and
// each block's id). Version A is the exam as it is. Each version's correction is that version drawn with its answers.

export interface VersionPlan {
  count: number; // 1 = no versions
  questions: boolean; // mix the questions of each exercise
  choices: boolean; // mix the answers to choose from (multiple choice, true/false, matching, put in order)
}
export const NO_VERSIONS: VersionPlan = { count: 1, questions: true, choices: true };
export const MAX_VERSIONS = 4;

const LETTERS: Record<Lang, string[]> = { fr: ["A", "B", "C", "D"], ar: ["أ", "ب", "ج", "د"] };
const WORD: Record<Lang, string> = { fr: "Sujet", ar: "الموضوع" };
export const versionName = (lang: Lang, i: number) => `${WORD[lang] ?? WORD.fr} ${(LETTERS[lang] ?? LETTERS.fr)[i] ?? i + 1}`;

const permute = <T>(list: T[], order: number[]) => order.map((i) => list[i]);

// The answers to choose from of one question, in this version's order (the right answers follow them)
export function mixChoices(b: Block, seed: string): Block {
  const random = seededRandom(seed);
  switch (b.type) {
    case "mcq": {
      if (b.options.length < 2) return b;
      const order = mixedOrder(b.options.length, random);
      return { ...b, options: permute(b.options, order), correct: order.indexOf(b.correct), ...(b.corrects ? { corrects: b.corrects.map((c) => order.indexOf(c)) } : {}) };
    }
    case "truefalse":
      return b.statements.length < 2 ? b : { ...b, statements: permute(b.statements, mixedOrder(b.statements.length, random)) };
    case "match": {
      if (b.pairs.length < 2) return b;
      return { ...b, pairs: permute(b.pairs, mixedOrder(b.pairs.length, random)), order: mixedOrder(b.pairs.length, random) };
    }
    case "order":
      return b.items.length < 2 ? b : { ...b, order: mixedOrder(b.items.length, random) };
    default:
      return b;
  }
}

// The questions of each exercise in another order, on their page: an exercise is a run of questions one under the other, with nothing
// else between them (a title, a text… ends it). They take the same room as before, in the new order, the same gaps between them; what
// lies beside a question (a figure, a picture) moves with it. A run whose questions are not in one column is left as it is.
export function mixQuestions(doc: ExamDoc, seed: string): ExamDoc {
  const heights = blockHeights(doc);
  const h = (b: Block) => heights.get(b.id) ?? b.layout.height;
  const moves = new Map<string, number>(); // block id → how far down it goes
  for (const page of doc.pages) {
    const here = doc.blocks.filter((b) => b.layout.pageId === page.id);
    const flow = here.filter((b) => !isFloating(b)).sort((a, b) => a.layout.y - b.layout.y);
    const runs: Block[][] = [];
    let run: Block[] = [];
    for (const b of flow) {
      if (isQuestion(b)) run.push(b);
      else {
        runs.push(run);
        run = [];
      }
    }
    runs.push(run);
    for (const qs of runs) {
      if (qs.length < 2) continue;
      if (qs.some((q) => Math.abs(q.layout.x - qs[0].layout.x) > 2 || Math.abs(q.layout.width - qs[0].layout.width) > 2)) continue;
      const order = mixedOrder(qs.length, seededRandom(`${seed}:${qs[0].id}`));
      const gaps = qs.slice(1).map((q, i) => q.layout.y - (qs[i].layout.y + h(qs[i])));
      let y = qs[0].layout.y;
      order.forEach((k, i) => {
        const q = qs[k];
        moves.set(q.id, y - q.layout.y);
        y += h(q) + (gaps[i] ?? 0);
      });
    }
    // (a floating block inside one question's band goes with that question)
    for (const f of here.filter(isFloating)) {
      const host = flow.find((q) => isQuestion(q) && moves.has(q.id) && f.layout.y >= q.layout.y - 2 && f.layout.y + h(f) <= q.layout.y + h(q) + 2);
      if (host) moves.set(f.id, moves.get(host.id)!);
    }
  }
  if (!moves.size) return doc;
  const moved = doc.blocks.map((b) => (moves.get(b.id) ? { ...b, layout: { ...b.layout, y: b.layout.y + moves.get(b.id)! } } : b));
  // (the moved questions drawn top to bottom in the places they had among the blocks: the PDF's text reads in their new order)
  const slots = moved.flatMap((b, i) => (isQuestion(b) && moves.has(b.id) ? [i] : []));
  const byPlace = slots.map((i) => moved[i]).sort((a, b) => doc.pages.findIndex((p) => p.id === a.layout.pageId) - doc.pages.findIndex((p) => p.id === b.layout.pageId) || a.layout.y - b.layout.y);
  slots.forEach((slot, k) => (moved[slot] = byPlace[k]));
  return { ...doc, blocks: moved };
}

// Version `i` of the exam (0 = A: as it is), with its name in a small box at the top corner of its first page.
export function examVersion(doc: ExamDoc, i: number, plan: VersionPlan): ExamDoc {
  const seed = `version-${i}`;
  let out = doc;
  if (i > 0 && plan.choices) out = { ...out, blocks: out.blocks.map((b) => (isQuestion(b) ? mixChoices(b, `${seed}:${b.id}`) : b)) };
  if (i > 0 && plan.questions) out = mixQuestions(out, seed);
  const first = out.pages[0];
  if (!first) return out;
  const lang = out.meta.lang;
  const width = 96;
  const tag = createBlock("textbox", lang, first.id, { text: versionName(lang, i), width, height: 22, align: "center", border: "#111827", radius: 4, padding: 3 });
  const rtl = lang === "ar";
  tag.layout = { ...tag.layout, x: rtl ? 12 : pageSize(first).width - width - 12, y: 8 };
  return { ...out, blocks: [...out.blocks, tag] };
}
