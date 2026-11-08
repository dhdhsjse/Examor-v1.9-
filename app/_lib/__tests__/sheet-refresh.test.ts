import { describe, expect, it } from "vitest";
import { blockHeight } from "../blockLayout";
import { createBlock } from "../blocks";
import { plainText } from "../richText";
import { contentBounds } from "../sheet/frame";
import { measurer } from "../sheet/flow";
import { generateCorrection, isTitleBox, sourcesOf, titleOfBox } from "../sheet/generate";
import { addMissing, linkReport, packRows, refitAnswers, refreshStale, restyleFull } from "../sheet/links";
import { sheetScores } from "../sheet/marks";
import { defaultHeaderId } from "../onboarding/headerFooterLibrary";
import { syncChrome } from "../pageChrome";
import { mergeView, viewOf, withCorrection, withSheetChrome } from "../sheet/part";
import { staleSources } from "../sheet/refresh";
import type { Block, ExamDoc, ExamMeta, MarkBlock, OpenBlock, RuleBlock, TextBlock } from "../types";

const fr: ExamMeta = { title: "Devoir", lang: "fr", templateId: "t" };
const put = <T extends Block>(b: T, y: number): T => ({ ...b, layout: { ...b.layout, pageId: "e1", y } });
const text = (t: string, style: "heading" | "body", y: number) => put(createBlock("text", "fr", "e1", { text: t, style }) as TextBlock, y);
const mcq = (y: number, points = 1, q = "Capitale de la France ?") => put(createBlock("mcq", "fr", "e1", { text: q, options: ["Lyon", "Paris", "Nice"], correct: 1, points }), y);
const blank = (y: number, points = 2) => put(createBlock("blank", "fr", "e1", { text: "Complétez", content: "Le [soleil] se lève.", points }), y);
const open = (y: number, extra: Partial<OpenBlock> = {}) => put(createBlock("open", "fr", "e1", { text: "Expliquez", answer: "Parce que A.", points: 3, ...extra }), y) as OpenBlock;
const LONG = "Une réponse assez longue pour prendre de la place sur la feuille. ";

const examOf = (blocks: Block[]): ExamDoc => ({ version: 1, meta: fr, pages: [{ id: "e1" }], blocks });
const make = (exam: ExamDoc, template: "answers" | "copy" = "answers") => withCorrection(exam, generateCorrection(exam, { template, paper: "bordered", marks: true }));
const sheetOf = (full: ExamDoc) => viewOf(full, "sheet");
const withExam = (full: ExamDoc, blocks: Block[]): ExamDoc => ({ ...full, blocks });
const change = (full: ExamDoc, id: string, patch: Record<string, unknown>): ExamDoc => withExam(full, full.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
const changeSheet = (full: ExamDoc, id: string, patch: Record<string, unknown>): ExamDoc => ({
  ...full,
  correction: { ...full.correction!, blocks: full.correction!.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)) },
});

const answerOf = (full: ExamDoc, id: string, part?: number) => sheetOf(full).blocks.find((b): b is TextBlock => b.type === "text" && b.meta?.source?.id === id && b.meta.source.part === part)!;
const marksOf = (full: ExamDoc, id: string) => sheetOf(full).blocks.filter((b): b is MarkBlock => b.type === "mark" && b.meta?.source?.id === id);
const ruleOf = (full: ExamDoc, id: string) => sheetOf(full).blocks.find((b): b is RuleBlock => b.type === "rule" && b.meta?.source?.id === id)!;
const pageIndex = (full: ExamDoc, b: Block) => sheetOf(full).pages.findIndex((p) => p.id === b.layout.pageId);
const heightOf = (full: ExamDoc, b: Block) => measurer(sheetOf(full))(b);

// an exam with two exercises
const standard = () => {
  const h1 = text("Exercice 1", "heading", 60);
  const q1 = mcq(110, 1);
  const q2 = blank(200, 2);
  const h2 = text("Exercice 2", "heading", 300);
  const q3 = open(350, { answer: "Parce que A." });
  const q4 = mcq(500, 1, "Autre question ?");
  const q5 = put(createBlock("truefalse", "fr", "e1", { text: "Vrai ou faux", statements: [{ text: "a", answer: true }, { text: "b", answer: false }], points: 2 }), 600);
  return { exam: examOf([h1, q1, q2, h2, q3, q4, q5]), h1, q1, q2, h2, q3, q4, q5 };
};

describe("telling what changed in the exam since the sheet was made", () => {
  it("finds nothing in a sheet that was just made, whatever the template", () => {
    const { exam } = standard();
    expect(staleSources(exam, sheetOf(make(exam)), "answers")).toEqual([]);
    expect(staleSources(exam, sheetOf(make(exam, "copy")), "copy")).toEqual([]);
  });

  it("finds an answer whose words changed in the exam, and only that one", () => {
    const { exam, q3 } = standard();
    const full = change(make(exam), q3.id, { answer: "Tout autre chose." });
    const stale = staleSources(full, sheetOf(full), "answers");
    expect(stale.map((s) => [s.id, s.n, s.edited])).toEqual([[q3.id, 3, false]]);
    expect(linkReport(full)?.stale).toHaveLength(1);
  });

  it("finds a title that was changed", () => {
    const { exam, h2 } = standard();
    const full = change(make(exam), h2.id, { text: "Exercice deux" });
    const stale = staleSources(full, sheetOf(full), "answers");
    expect(stale.map((s) => [s.id, s.n, s.title])).toEqual([[h2.id, null, "Exercice deux"]]);
  });

  it("tells when the answer was also changed on the sheet: refreshing it would replace what was written there", () => {
    const { exam, q3 } = standard();
    let full = change(make(exam), q3.id, { answer: "Tout autre chose." });
    full = changeSheet(full, answerOf(full, q3.id).id, { text: "3) ma propre réponse" });
    expect(staleSources(full, sheetOf(full), "answers")[0]).toMatchObject({ id: q3.id, edited: true });
  });

  it("does not call an answer written by hand on the sheet a change, when the exam did not change", () => {
    const { exam, q3 } = standard();
    const full = changeSheet(make(exam), answerOf(make(exam), q3.id).id, { text: "3) ma propre réponse" });
    expect(staleSources(full, sheetOf(full), "answers")).toEqual([]);
  });

  it("finds every answer after a question that came in before them: their numbers moved", () => {
    const { exam, q1 } = standard();
    const full = withExam(make(exam), [...exam.blocks, mcq(80, 1, "Nouvelle ?")]);
    const stale = staleSources(full, sheetOf(full), "answers");
    expect(stale.map((s) => s.n)).toEqual([2, 3, 4, 5, 6]);
    expect(stale.some((s) => s.id === q1.id)).toBe(true);
  });

  it("finds a question that got a sub-question, and one that lost one", () => {
    const parts = (n: number) => Array.from({ length: n }, (_, i) => ({ text: `p${i}`, lines: 2, answer: `R${i}`, points: 1 }));
    const q = open(100, { answer: "", parts: parts(2), points: 2 });
    const exam = examOf([q]);
    const full = make(exam);
    expect(staleSources(change(full, q.id, { parts: parts(3), points: 3 }), sheetOf(change(full, q.id, { parts: parts(3), points: 3 })), "answers")).toHaveLength(1);
    expect(staleSources(change(full, q.id, { parts: parts(1), points: 1 }), sheetOf(change(full, q.id, { parts: parts(1), points: 1 })), "answers")).toHaveLength(1);
  });

  it("finds a copied question that changed (its points are printed in it), not one that only moved", () => {
    const { exam, q1, q4 } = standard();
    const copy = make(exam, "copy");
    const moved = withExam(copy, copy.blocks.map((b) => (b.id === q1.id ? { ...b, layout: { ...b.layout, y: b.layout.y + 7 } } : b)));
    expect(staleSources(moved, sheetOf(moved), "copy")).toEqual([]);
    const reworded = change(copy, q4.id, { text: "Question reformulée ?" });
    expect(staleSources(reworded, sheetOf(reworded), "copy").map((s) => s.id)).toEqual([q4.id]);
    const points = change(copy, q1.id, { points: 3 });
    expect(staleSources(points, sheetOf(points), "copy").map((s) => s.id)).toEqual([q1.id]);
  });

  it("is in the report only for a sheet made from the exam", () => {
    const { exam } = standard();
    const blankSheet = { ...exam, correction: { sheet: make(exam).correction!.sheet, pages: [{ id: "c1" }], blocks: [], template: "blank" as const } };
    expect(linkReport(blankSheet)?.stale).toEqual([]);
  });
});

describe("bringing an answer up to date where it stands", () => {
  const { exam, q1, q2, q3, q4, q5, h2 } = standard();
  const made = make(exam);
  const longer = change(made, q3.id, { answer: LONG.repeat(8) });
  const done = refreshStale(longer);

  it("puts the new words in the same block, with the same id and look", () => {
    const before = answerOf(changeSheet(made, answerOf(made, q3.id).id, { align: "right" }), q3.id);
    const full = refreshStale(change(changeSheet(made, before.id, {}), q3.id, { answer: "Court." }));
    const after = answerOf(full, q3.id);
    expect(after.id).toBe(before.id);
    expect(plainText(after.text)).toBe("3) Court.");
    const styled = refreshStale(change(changeSheet(made, before.id, { align: "right" }), q3.id, { answer: "Court." }));
    expect(answerOf(styled, q3.id).align).toBe("right");
  });

  it("leaves nothing stale, and does not change the exam", () => {
    expect(linkReport(done)?.stale).toEqual([]);
    expect(done.blocks).toBe(longer.blocks);
  });

  it("moves the rows under a longer answer by what it grew, with their marks and lines", () => {
    const grew = heightOf(done, answerOf(done, q3.id)) - heightOf(made, answerOf(made, q3.id));
    expect(grew).toBeGreaterThan(20);
    for (const id of [q4.id, q5.id]) {
      expect(answerOf(done, id).layout.y - answerOf(made, id).layout.y).toBeCloseTo(grew, 1);
      expect(ruleOf(done, id).layout.y - ruleOf(made, id).layout.y).toBeCloseTo(grew, 1);
      expect(marksOf(done, id)[0].layout.y - marksOf(made, id)[0].layout.y).toBeCloseTo(grew, 1);
    }
    // its own line closes the longer answer
    expect(ruleOf(done, q3.id).layout.y - ruleOf(made, q3.id).layout.y).toBeCloseTo(grew, 1);
  });

  it("leaves what is above it where it was, the very same blocks", () => {
    for (const id of [q1.id, q2.id, h2.id]) {
      expect(sheetOf(done).blocks.filter((b) => b.meta?.source?.id === id)).toEqual(sheetOf(made).blocks.filter((b) => b.meta?.source?.id === id));
    }
  });

  it("keeps the mark level with the first line of the new answer, and the sum of the sheet", () => {
    expect(marksOf(done, q3.id)[0].layout.y).toBe(marksOf(made, q3.id)[0].layout.y);
    expect(sheetScores(sheetOf(done)).total).toBe(sheetScores(sheetOf(made)).total);
  });

  it("closes the rows up when the answer gets shorter", () => {
    const long = refreshStale(change(made, q3.id, { answer: LONG.repeat(8) }));
    const short = refreshStale(change(long, q3.id, { answer: "Court." }));
    expect(answerOf(short, q4.id).layout.y).toBeCloseTo(answerOf(made, q4.id).layout.y, 1);
  });

  it("refreshes only the answers asked for", () => {
    const two = change(change(made, q3.id, { answer: "Un." }), q4.id, { correct: 2 });
    const one = refreshStale(two, [q3.id]);
    expect(linkReport(one)?.stale.map((s) => s.id)).toEqual([q4.id]);
    expect(refreshStale(two, [q1.id])).toBe(two);
  });

  it("changes nothing when nothing changed", () => {
    expect(refreshStale(made)).toBe(made);
  });

  it("gives a question that got a sub-question its block and its mark; takes them away again (the row keeps its total: the sheet has a column of totals)", () => {
    const parts = (n: number) => Array.from({ length: n }, (_, i) => ({ text: `p${i}`, lines: 2, answer: `R${i}`, points: 1 }));
    const q = open(100, { answer: "", parts: parts(2), points: 2 });
    const next = mcq(300, 1);
    const full = make(examOf([q, next]));
    const three = refreshStale(change(full, q.id, { parts: parts(3), points: 3 }));
    expect(sheetOf(three).blocks.filter((b) => b.type === "text" && b.meta?.source?.id === q.id && b.meta.source.part !== undefined)).toHaveLength(3);
    expect(marksOf(three, q.id).filter((m) => m.kind === "number").map((m) => m.value)).toEqual([1, 1, 1]);
    expect(marksOf(three, q.id).filter((m) => m.kind === "total")).toHaveLength(1);
    expect(sheetScores(sheetOf(three)).total).toBe(4);
    expect(linkReport(three)?.diffs).toEqual([]);
    expect(answerOf(three, next.id).layout.y).toBeGreaterThan(answerOf(full, next.id).layout.y);
    const one = refreshStale(change(three, q.id, { parts: parts(1), points: 1 }));
    expect(marksOf(one, q.id).map((m) => m.kind).sort()).toEqual(["number", "total"]);
    expect(sheetScores(sheetOf(one)).total).toBe(2);
  });

  it("keeps a mark the teacher changed, and the total they typed", () => {
    const edited = changeSheet(made, marksOf(made, q3.id)[0].id, { value: 2 });
    const full = refreshStale(change(edited, q3.id, { answer: "Autre." }));
    expect(marksOf(full, q3.id)[0].value).toBe(2);
  });
});

describe("when the rows no longer fit their page", () => {
  const many = examOf(Array.from({ length: 12 }, (_, i) => open(60 + i * 40, { answer: "Une réponse. ".repeat(4), points: 1 })));
  const made = make(many);
  const first = many.blocks[0];
  const HUGE = LONG.repeat(40);

  it("passes the last rows on to the next page, whole: the answer, its mark and its line together", () => {
    const grown = refreshStale(change(made, first.id, { answer: HUGE }));
    expect(sheetOf(grown).pages.length).toBeGreaterThan(sheetOf(made).pages.length);
    for (const q of many.blocks) {
      const page = pageIndex(grown, answerOf(grown, q.id));
      expect(pageIndex(grown, ruleOf(grown, q.id))).toBe(page);
      expect(pageIndex(grown, marksOf(grown, q.id)[0])).toBe(page);
    }
    // nothing goes over the bottom of the frame
    for (const q of many.blocks) {
      const b = answerOf(grown, q.id);
      const room = contentBounds(sheetOf(grown), pageIndex(grown, b));
      expect(b.layout.y + heightOf(grown, b)).toBeLessThanOrEqual(room.bottom + 0.5);
    }
    expect(sheetScores(sheetOf(grown)).total).toBe(12);
    expect(sheetOf(grown).pages.every((p) => sheetOf(grown).blocks.some((b) => b.layout.pageId === p.id))).toBe(true);
  });

  it("keeps the questions in the order of the exam, page after page", () => {
    const grown = refreshStale(change(made, first.id, { answer: HUGE }));
    const at = many.blocks.map((q) => {
      const b = answerOf(grown, q.id);
      return pageIndex(grown, b) * 10000 + b.layout.y;
    });
    expect([...at].sort((a, z) => a - z)).toEqual(at);
  });

  it("does not pull the rows back by itself when an answer gets shorter again, but closing up does, and the empty page goes", () => {
    const grown = refreshStale(change(made, first.id, { answer: HUGE }));
    expect(sheetOf(grown).pages.length).toBeGreaterThan(1);
    const shorter = refreshStale(change(grown, first.id, { answer: "Une réponse. ".repeat(4) }));
    expect(sheetOf(shorter).pages.length).toBe(sheetOf(grown).pages.length);
    const packed = packRows(shorter);
    expect(sheetOf(packed).pages.length).toBe(sheetOf(made).pages.length);
    expect(answerOf(packed, many.blocks[11].id).layout.y).toBeCloseTo(answerOf(made, many.blocks[11].id).layout.y, 0);
    expect(sheetScores(sheetOf(packed)).total).toBe(12);
    expect(sheetOf(packed).pages.every((p) => sheetOf(packed).blocks.some((b) => b.layout.pageId === p.id))).toBe(true);
  });

  it("closing up leaves a sheet that is already close as it is", () => {
    expect(packRows(made)).toBe(made);
  });
});

describe("the header of a sheet on the pages it gains and loses", () => {
  const t = (k: string) => k;
  const many = examOf(Array.from({ length: 8 }, (_, i) => open(60 + i * 40, { answer: "Une réponse. ".repeat(4), points: 1 })));
  const base = make(many);
  const first = many.blocks[0];
  const header = { enabled: true, templateId: defaultHeaderId, data: {} };
  // a sheet that has a header on its page: the header is put in as the editor does it, and the body goes down under it
  const before = viewOf(base, "sheet");
  const withHeader = mergeView({ ...base, correction: { ...base.correction!, globalHeader: header } }, syncChrome(before, { ...before, globalHeader: header }, t), "sheet");
  const pagesWithHeader = (full: ExamDoc) => new Set(sheetOf(full).blocks.filter((b) => b.meta?.role === "header").map((b) => b.layout.pageId));

  it("get it when a refreshed answer pushes rows onto them, and lose it with the page", () => {
    expect(pagesWithHeader(withHeader).size).toBe(1);
    const changed = change(withHeader, first.id, { answer: LONG.repeat(28) });
    const grown = withSheetChrome(changed, refreshStale(changed), t);
    expect(sheetOf(grown).pages.length).toBeGreaterThan(1);
    expect(pagesWithHeader(grown).size).toBe(sheetOf(grown).pages.length);
    // (the rows of the new page start under its header)
    const header2 = sheetOf(grown).blocks.filter((b) => b.meta?.role === "header" && pageIndex(grown, b) === 1);
    const under = Math.max(...header2.map((b) => b.layout.y + heightOf(grown, b)));
    for (const b of sheetOf(grown).blocks.filter((x) => !x.meta?.role && pageIndex(grown, x) === 1)) expect(b.layout.y).toBeGreaterThanOrEqual(under - 0.5);
    const shorter = change(grown, first.id, { answer: "Une réponse. ".repeat(4) });
    const packed = withSheetChrome(shorter, packRows(refreshStale(shorter)), t);
    expect(sheetOf(packed).pages.length).toBe(1);
    expect(pagesWithHeader(packed).size).toBe(1);
    expect(sheetOf(packed).blocks.every((b) => sheetOf(packed).pages.some((p) => p.id === b.layout.pageId))).toBe(true);
  });

  it("is left alone when the number of pages did not change", () => {
    const changed = change(withHeader, first.id, { answer: "Court." });
    const next = refreshStale(changed);
    expect(withSheetChrome(changed, next, t)).toBe(next);
    expect(withSheetChrome(changed, next, undefined)).toBe(next);
  });
});

describe("putting a question in its place among the rows", () => {
  const { exam, q1, q2, h2, q3, q4 } = standard();
  const made = make(exam);

  it("puts a question that came in the middle of the exam in the middle of the sheet, and the rows under it make room", () => {
    const fresh = mcq(250, 1.5, "Une question de plus ?");
    const grown = withExam(made, [...exam.blocks, fresh]);
    expect(linkReport(grown)?.missing.map((m) => m.id)).toEqual([fresh.id]);
    const next = addMissing(grown);
    expect(linkReport(next)?.missing).toEqual([]);
    const y = (full: ExamDoc, id: string) => pageIndex(full, answerOf(full, id)) * 10000 + answerOf(full, id).layout.y;
    expect(y(next, q2.id)).toBeLessThan(y(next, fresh.id));
    expect(y(next, fresh.id)).toBeLessThan(y(next, h2.id));
    const room = y(next, h2.id) - y(made, h2.id);
    expect(room).toBeGreaterThan(20);
    // everything under it moved together
    for (const id of [q3.id, q4.id]) expect(y(next, id) - y(made, id)).toBeCloseTo(room, 1);
    expect(ruleOf(next, q3.id).layout.y - ruleOf(made, q3.id).layout.y).toBeCloseTo(room, 1);
    expect(marksOf(next, q4.id)[0].layout.y - marksOf(made, q4.id)[0].layout.y).toBeCloseTo(room, 1);
    // what is above did not move
    expect(sheetOf(next).blocks.filter((b) => b.meta?.source?.id === q1.id)).toEqual(sheetOf(made).blocks.filter((b) => b.meta?.source?.id === q1.id));
    // its own mark and line, and the sheet adds up
    expect(marksOf(next, fresh.id).filter((m) => m.kind === "number").map((m) => m.value)).toEqual([1.5]);
    expect(ruleOf(next, fresh.id)).toBeTruthy();
    expect(sheetScores(sheetOf(next)).total).toBe(sheetScores(sheetOf(made)).total + 1.5);
  });

  it("keeps the thick line for the end of an exercise: thin under what comes before the new question, thick under the new one", () => {
    const next = addMissing(withExam(made, [...exam.blocks, mcq(250, 1, "Du meme exercice ?")]));
    const fresh = next.blocks.find((b) => b.id !== q1.id && b.type === "mcq" && b.text === "Du meme exercice ?")!;
    expect(ruleOf(made, q2.id).line).toBe("exercise");
    expect(ruleOf(next, q2.id).line).toBe("row");
    expect(ruleOf(next, fresh.id).line).toBe("exercise");
  });

  it("keeps it thick under what comes before a new exercise", () => {
    const head = text("Exercice 1 bis", "heading", 235);
    const next = addMissing(withExam(made, [...exam.blocks, head, mcq(260, 1, "Sous le titre ?")]));
    expect(ruleOf(next, q2.id).line).toBe("exercise");
  });

  it("takes the numbers the exam gave: what came after it is renumbered by refreshing", () => {
    const fresh = mcq(250, 1, "Insérée ?");
    const next = addMissing(withExam(made, [...exam.blocks, fresh]));
    expect(plainText(answerOf(next, fresh.id).text).startsWith("3)")).toBe(true);
    expect(linkReport(next)?.stale.map((s) => s.n)).toEqual([4, 5, 6]);
    const renumbered = refreshStale(next);
    expect(plainText(answerOf(renumbered, q3.id).text).startsWith("4)")).toBe(true);
    expect(linkReport(renumbered)?.stale).toEqual([]);
    expect(linkReport(renumbered)?.diffs).toEqual([]);
  });

  it("puts a question at the very beginning under the titles of the sheet", () => {
    const fresh = mcq(30, 1, "Avant tout ?");
    const next = addMissing(withExam(made, [...exam.blocks, fresh]));
    const title = sheetOf(next).blocks.find((b) => b.type === "text" && b.style === "title")!;
    expect(answerOf(next, fresh.id).layout.y).toBeGreaterThan(title.layout.y + heightOf(next, title));
    expect(answerOf(next, fresh.id).layout.y).toBeLessThan(answerOf(next, exam.blocks[0].id).layout.y);
    expect(answerOf(next, exam.blocks[0].id).layout.y).toBeGreaterThan(answerOf(made, exam.blocks[0].id).layout.y);
  });

  it("brings the title of the exercise the question opens, and puts it before the question", () => {
    const head = text("Exercice 1 bis", "heading", 235);
    const fresh = mcq(260, 1, "Sous le titre ?");
    const next = addMissing(withExam(made, [...exam.blocks, head, fresh]));
    const heading = sheetOf(next).blocks.find((b) => b.meta?.source?.id === head.id)!;
    expect(heading.layout.y).toBeLessThan(answerOf(next, fresh.id).layout.y);
    expect(heading.layout.y).toBeGreaterThan(answerOf(next, q2.id).layout.y);
    expect(answerOf(next, fresh.id).layout.y).toBeLessThan(answerOf(next, q3.id).layout.y);
  });

  it("passes the rows under it to the next page when they no longer fit", () => {
    const many = examOf(Array.from({ length: 11 }, (_, i) => open(60 + i * 40, { answer: "Une réponse. ".repeat(4), points: 1 })));
    const m = make(many);
    const fresh = open(100, { answer: LONG.repeat(40), points: 1 });
    const next = addMissing(withExam(m, [...many.blocks, fresh]));
    expect(sheetOf(next).pages.length).toBeGreaterThan(sheetOf(m).pages.length);
    for (const q of [...many.blocks, fresh]) {
      const page = pageIndex(next, answerOf(next, q.id));
      expect(pageIndex(next, ruleOf(next, q.id))).toBe(page);
      expect(pageIndex(next, marksOf(next, q.id)[0])).toBe(page);
    }
    expect(sheetScores(sheetOf(next)).total).toBe(12);
  });

  it("puts several in at once, each in its own place", () => {
    const a = mcq(150, 1, "Entre un et deux ?");
    const b = mcq(450, 1, "Entre trois et quatre ?");
    const next = addMissing(withExam(made, [...exam.blocks, a, b]));
    const y = (id: string) => pageIndex(next, answerOf(next, id)) * 10000 + answerOf(next, id).layout.y;
    expect(y(q1.id)).toBeLessThan(y(a.id));
    expect(y(a.id)).toBeLessThan(y(q2.id));
    expect(y(q3.id)).toBeLessThan(y(b.id));
    expect(y(b.id)).toBeLessThan(y(q4.id));
    expect(sheetScores(sheetOf(next)).total).toBe(sheetScores(sheetOf(made)).total + 2);
  });

  it("puts a copied question between the copies of its neighbours in a copy of the exam", () => {
    const copy = make(exam, "copy");
    const fresh = mcq(250, 1, "Copiée ?");
    const next = addMissing(withExam(copy, [...exam.blocks, fresh]));
    const at = (id: string) => sheetOf(next).blocks.find((b) => b.meta?.source?.id === id && b.type !== "mark" && b.type !== "rule")!;
    expect(at(q2.id).layout.y).toBeLessThan(at(fresh.id).layout.y);
    expect(at(fresh.id).layout.y).toBeLessThan(at(h2.id).layout.y);
    expect(linkReport(next)?.diffs).toEqual([]);
  });
});

describe("the look of the answers", () => {
  const { exam, q1, q3, q4 } = standard();
  const made = make(exam);

  it("changes the size of every answer, and the rows under them make room", () => {
    const big = restyleFull(made, { size: 24 });
    for (const q of [q1, q3, q4]) expect(answerOf(big, q.id).font?.size).toBe(24);
    expect(answerOf(big, q4.id).layout.y).toBeGreaterThan(answerOf(made, q4.id).layout.y);
    expect(sheetOf(big).blocks.filter((b) => b.type === "text" && b.style === "heading").every((b) => b.font?.size === undefined)).toBe(true);
    const m = marksOf(big, q4.id)[0];
    expect(m.layout.y + m.layout.height / 2).toBeGreaterThan(answerOf(big, q4.id).layout.y);
    expect(sheetScores(sheetOf(big)).total).toBe(sheetScores(sheetOf(made)).total);
  });

  it("changes the color, and puts the usual one back", () => {
    const red = restyleFull(made, { color: "#dc2626" });
    expect(answerOf(red, q1.id).font?.color).toBe("#dc2626");
    expect(answerOf(restyleFull(red, { color: undefined }), q1.id).font?.color).toBeUndefined();
  });

  it("keeps the total of a row of one mark on a sheet with a column of totals", () => {
    const totals = (full: ExamDoc, id: string) => marksOf(full, id).filter((m) => m.kind === "total").length;
    expect(totals(made, q1.id)).toBe(1);
    for (const next of [restyleFull(made, { size: 24 }), restyleFull(made, { color: "#dc2626" }), refitAnswers(made)]) {
      for (const q of [q1, q4]) expect(totals(next, q.id)).toBe(1);
    }
  });
});

describe("fitting the answers to the frame again", () => {
  const { exam, q3, q4 } = standard();
  const wide = { ...exam, blocks: exam.blocks.map((b) => (b.id === q3.id ? ({ ...b, answer: LONG.repeat(3) } as Block) : b)) };
  const made = make(wide);
  // the column of the marks made much wider: the answers have less room
  const squeezed: ExamDoc = { ...made, correction: { ...made.correction!, sheet: { ...made.correction!.sheet, marks: { width: 200, title: "Partielle" } } } };

  it("narrows the answers to the room they have, and the rows under make room for the lines that wrapped", () => {
    const fitted = refitAnswers(squeezed);
    const room = contentBounds(sheetOf(squeezed), 0);
    const b = answerOf(fitted, q3.id);
    expect(b.layout.x).toBeCloseTo(room.left, 1);
    expect(b.layout.width).toBeCloseTo(room.right - room.left, 1);
    expect(b.layout.width).toBeLessThan(answerOf(made, q3.id).layout.width);
    expect(heightOf(fitted, b)).toBeGreaterThan(heightOf(made, answerOf(made, q3.id)));
    expect(answerOf(fitted, q4.id).layout.y).toBeGreaterThan(answerOf(made, q4.id).layout.y);
    // nothing lies over the answer before it
    const blocks = sheetOf(fitted).blocks.filter((x) => x.type === "text" && x.meta?.source && x.layout.pageId === fitted.correction!.pages[0].id).sort((a, z) => a.layout.y - z.layout.y);
    for (let i = 1; i < blocks.length; i++) expect(blocks[i].layout.y).toBeGreaterThanOrEqual(blocks[i - 1].layout.y + heightOf(fitted, blocks[i - 1]) - 0.5);
  });

  it("keeps each mark level with its answer", () => {
    const fitted = refitAnswers(squeezed);
    const b = answerOf(fitted, q4.id);
    const m = marksOf(fitted, q4.id)[0];
    expect(m.layout.y + m.layout.height / 2).toBeGreaterThan(b.layout.y);
    expect(m.layout.y + m.layout.height / 2).toBeLessThan(b.layout.y + 30);
  });

  it("changes nothing when the answers already fit", () => {
    expect(refitAnswers(made)).toBe(made);
  });
  it("fits what the teacher wrote or put on a blank sheet too, and leaves what already fits", () => {
    const sheet = make(exam).correction!.sheet;
    const blank: ExamDoc = { ...exam, correction: { sheet, pages: [{ id: "c1" }], blocks: [], template: "blank" } };
    const room = contentBounds(sheetOf(blank), 0);
    const on = <T extends Block>(b: T, x: number, y: number, width: number, height = b.layout.height): T => ({ ...b, layout: { ...b.layout, pageId: "c1", x, y: room.top + y, width, height } });
    const text = on(createBlock("text", "fr", "c1", { text: "Une réponse tapée à la main" }), room.left - 30, 10, 900);
    const pic = on(createBlock("image", "fr", "c1", { src: "data:,", ratio: 2, width: 900, height: 450 }), room.left, 80, 900, 450);
    const ok = on(createBlock("image", "fr", "c1", { src: "data:,", ratio: 2, width: 100, height: 50 }), room.left + 10, 600, 100, 50);
    const full: ExamDoc = { ...blank, correction: { ...blank.correction!, blocks: [text, pic, ok] } };
    const fitted = sheetOf(refitAnswers(full)).blocks;
    const get = (id: string) => fitted.find((b) => b.id === id)!;
    expect(get(text.id).layout.x).toBeCloseTo(room.left, 1);
    expect(get(text.id).layout.width).toBeCloseTo(room.right - room.left, 1);
    expect(get(pic.id).layout.width).toBeCloseTo(room.right - room.left, 1);
    expect(get(pic.id).layout.height).toBeCloseTo((room.right - room.left) / 2, 1);
    expect(get(ok.id).layout.width).toBe(100);
    expect(get(ok.id).layout.x).toBe(room.left + 10);
  });
});

describe("the title of an exercise typed in a text box", () => {
  const box = (t: string, y: number) => put(createBlock("textbox", "fr", "e1", { text: t, width: 500, height: 40 }), y);

  it("is told from other text boxes by its first words", () => {
    expect(titleOfBox(box("Exercice 2", 0))).toBe("Exercice 2");
    expect(titleOfBox(box("Exercise 3 : Lire le texte", 0))).toBe("Exercise 3 : Lire le texte");
    expect(titleOfBox(box("التمرين الثاني", 0))).toBe("التمرين الثاني");
    expect(titleOfBox(box("Lisez le texte avec attention.", 0))).toBeNull();
    expect(titleOfBox(box("Exercice 1\nLisez le texte.", 0))).toBeNull();
    expect(titleOfBox(box("Exercices de grammaire pour la classe entière, à faire à la maison avant lundi prochain sans faute", 0))).toBeNull();
    expect(isTitleBox(mcq(0))).toBe(false);
  });

  it("becomes a heading of a sheet of the answers, linked to the box", () => {
    const b = box("Exercice 2", 300);
    const exam = examOf([text("Exercice 1", "heading", 60), mcq(110, 1), b, mcq(360, 1)]);
    const full = make(exam);
    const heading = sheetOf(full).blocks.find((x) => x.meta?.source?.id === b.id) as TextBlock;
    expect(heading.type).toBe("text");
    expect(plainText(heading.text)).toBe("Exercice 2");
    expect(heading.align).toBe("center");
    expect(heading.font?.underline).toBe(true);
    // the line before it is the thick one of an exercise
    expect(ruleOf(full, exam.blocks[1].id).line).toBe("exercise");
    expect(linkReport(full)?.stale).toEqual([]);
    expect(staleSources(change(full, b.id, { text: "Exercice 3" }), sheetOf(change(full, b.id, { text: "Exercice 3" })), "answers")).toHaveLength(1);
  });

  it("is copied as it is on a copy of the exam", () => {
    const b = box("Exercice 2", 300);
    const full = make(examOf([mcq(110, 1), b]), "copy");
    expect(sheetOf(full).blocks.some((x) => x.type === "textbox" && x.meta?.source?.id === b.id)).toBe(true);
  });
});

describe("shapes drawn on a picture in the exam", () => {
  const image = put(createBlock("image", "fr", "e1", { src: "data:image/png;base64,AAAA", ratio: 2, width: 600, height: 300 }), 100);
  const arrow = put(createBlock("shape", "fr", "e1", { shape: "rect" }), 160);
  const onImage: Block = { ...arrow, layout: { ...arrow.layout, x: image.layout.x + 120, y: image.layout.y + 60, width: 90, height: 40 } };
  const lost: Block = { ...arrow, id: "lost", layout: { ...arrow.layout, x: image.layout.x, y: 700, width: 90, height: 40 } };
  const exam = examOf([image, onImage, lost, mcq(500, 1)]);
  const full = make(exam, "copy");

  it("follow it to the copy, in proportion to it, above it; the others are left out", () => {
    const copy = sheetOf(full).blocks.find((b) => b.type === "image")!;
    const shape = sheetOf(full).blocks.find((b) => b.type === "shape")!;
    expect(sheetOf(full).blocks.filter((b) => b.type === "shape")).toHaveLength(1);
    expect(shape.meta?.source).toMatchObject({ id: onImage.id, host: image.id });
    const k = copy.layout.width / image.layout.width;
    expect(k).toBeLessThan(1);
    expect(shape.layout.x - copy.layout.x).toBeCloseTo(120 * k, 1);
    expect(shape.layout.y - copy.layout.y).toBeCloseTo(60 * k, 1);
    expect(shape.layout.width).toBeCloseTo(90 * k, 1);
    expect(sheetOf(full).blocks.indexOf(shape)).toBeGreaterThan(sheetOf(full).blocks.indexOf(copy));
    expect(linkReport(full)?.stale).toEqual([]);
    expect(linkReport(full)?.orphans).toEqual([]);
  });

  it("make the picture stale when one of them moves in the exam, and are drawn again by refreshing it", () => {
    const moved = withExam(full, full.blocks.map((b) => (b.id === onImage.id ? { ...b, layout: { ...b.layout, x: b.layout.x + 100 } } : b)));
    expect(linkReport(moved)?.stale.map((s) => s.id)).toEqual([image.id]);
    const fresh = refreshStale(moved);
    const copy = sheetOf(fresh).blocks.find((b) => b.type === "image")!;
    const shape = sheetOf(fresh).blocks.filter((b) => b.type === "shape");
    expect(shape).toHaveLength(1);
    expect(shape[0].layout.x - copy.layout.x).toBeCloseTo(220 * (copy.layout.width / image.layout.width), 1);
    expect(linkReport(fresh)?.stale).toEqual([]);
  });

  it("go when the shape is taken out of the exam", () => {
    const gone = withExam(full, full.blocks.filter((b) => b.id !== onImage.id));
    expect(linkReport(gone)?.orphans).toEqual([onImage.id]);
    expect(linkReport(gone)?.stale.map((s) => s.id)).toEqual([image.id]);
    expect(sheetOf(refreshStale(gone)).blocks.some((b) => b.type === "shape")).toBe(false);
  });

  it("follow a picture that is refitted to a narrower column", () => {
    const squeezed: ExamDoc = { ...full, correction: { ...full.correction!, sheet: { ...full.correction!.sheet, marks: { width: 200, title: "x" } } } };
    const fitted = refitAnswers(squeezed);
    const copy = sheetOf(fitted).blocks.find((b) => b.type === "image")!;
    const shape = sheetOf(fitted).blocks.find((b) => b.type === "shape")!;
    expect(copy.layout.width).toBeLessThan(sheetOf(full).blocks.find((b) => b.type === "image")!.layout.width);
    expect(shape.layout.x - copy.layout.x).toBeCloseTo(120 * (copy.layout.width / image.layout.width), 1);
  });
});

describe("questions in a text box of a copy of the exam", () => {
  const box = put(createBlock("textbox", "fr", "e1", { text: "", width: 500, height: 80 }), 100);
  const inner = (q: string, y: number): Block => ({ ...mcq(y, 1, q), meta: { slot: box.id } }) as Block;
  const one = inner("Dans la boite ?", 0);
  const slot = (b: Block) => ({ type: "blockSlot", attrs: { blockId: b.id, h: 80 } });
  const boxWith = (...inside: Block[]): Block =>
    ({ ...box, content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Voici :" }] }, ...inside.map(slot), { type: "paragraph" }] }, text: "Voici :" }) as Block;
  const exam = examOf([boxWith(one), one]);
  const made = make(exam, "copy");
  const clones = (full: ExamDoc) => sheetOf(full).blocks.filter((b) => b.type === "mcq");

  it("is found stale like any other question, and made again with its box", () => {
    const changed = change(made, one.id, { text: "Autre texte ?" });
    expect(linkReport(changed)?.stale.map((x) => [x.id, x.n])).toEqual([[one.id, 1]]);
    const fresh = refreshStale(changed);
    expect(linkReport(fresh)?.stale).toEqual([]);
    expect(clones(fresh)).toHaveLength(1);
    expect((clones(fresh)[0] as { text: string }).text).toBe("Autre texte ?");
    const boxCopy = sheetOf(fresh).blocks.find((b) => b.type === "textbox")!;
    expect(clones(fresh)[0].meta?.slot).toBe(boxCopy.id);
    // its mark is still level with it, and the sheet still adds up
    const m = marksOf(fresh, one.id)[0];
    expect(m.layout.y + m.layout.height / 2).toBeGreaterThan(clones(fresh)[0].layout.y);
    expect(m.layout.y + m.layout.height / 2).toBeLessThan(clones(fresh)[0].layout.y + 40);
    expect(sheetScores(sheetOf(fresh)).total).toBe(1);
  });

  it("puts a question that came into the box into the copy of the box, with its mark and its line", () => {
    const two = inner("Une deuxieme ?", 0);
    const grown = withExam(made, [boxWith(one, two), one, two]);
    expect(linkReport(grown)?.missing.map((m) => m.id)).toEqual([two.id]);
    const next = addMissing(grown);
    expect(linkReport(next)?.missing).toEqual([]);
    expect(clones(next)).toHaveLength(2);
    const boxCopy = sheetOf(next).blocks.find((b) => b.type === "textbox")!;
    expect(clones(next).every((b) => b.meta?.slot === boxCopy.id)).toBe(true);
    expect(marksOf(next, two.id).filter((m) => m.kind === "number").map((m) => m.value)).toEqual([1]);
    expect(ruleOf(next, two.id)).toBeTruthy();
    expect(sheetScores(sheetOf(next)).total).toBe(2);
  });

  it("puts a box with a question in it, whole, when the sheet has neither", () => {
    const empty = make(examOf([mcq(50, 1)]), "copy");
    const grown = withExam(empty, [mcq(50, 1), boxWith(one), one].map((b, i) => (i === 0 ? empty.blocks[0] : put(b, 300 + i * 10))));
    const next = addMissing(grown);
    expect(sheetOf(next).blocks.filter((b) => b.type === "textbox")).toHaveLength(1);
    expect(clones(next)).toHaveLength(2);
    expect(linkReport(next)?.missing).toEqual([]);
  });
});

describe("refreshing a title, and a sheet in Arabic", () => {
  it("brings a changed title up to date, still centered and underlined, rows left where they were", () => {
    const { exam, h2, q3 } = standard();
    const made = make(exam);
    const full = refreshStale(change(made, h2.id, { text: "Exercice deux" }));
    const heading = sheetOf(full).blocks.find((b) => b.meta?.source?.id === h2.id) as TextBlock;
    expect(plainText(heading.text)).toBe("Exercice deux");
    expect(heading.align).toBe("center");
    expect(heading.font?.underline).toBe(true);
    expect(heading.id).toBe(sheetOf(made).blocks.find((b) => b.meta?.source?.id === h2.id)!.id);
    expect(answerOf(full, q3.id).layout.y).toBeCloseTo(answerOf(made, q3.id).layout.y, 1);
  });

  it("puts a question in its place in a sheet in Arabic, the marks at the left, the rows in order", () => {
    const ar: ExamMeta = { ...fr, lang: "ar" };
    const q = (y: number, text: string) => put(createBlock("mcq", "ar", "e1", { text, options: ["أ", "ب"], correct: 0, points: 1 }), y);
    const [a, c] = [q(100, "السؤال الأول ؟"), q(300, "السؤال الثالث ؟")];
    const exam: ExamDoc = { version: 1, meta: ar, pages: [{ id: "e1" }], blocks: [a, c] };
    const made = make(exam);
    const b = q(200, "السؤال الثاني ؟");
    const next = addMissing(withExam(made, [a, c, b]));
    const y = (id: string) => pageIndex(next, answerOf(next, id)) * 10000 + answerOf(next, id).layout.y;
    expect(y(a.id)).toBeLessThan(y(b.id));
    expect(y(b.id)).toBeLessThan(y(c.id));
    const mark = marksOf(next, b.id)[0];
    expect(mark.layout.x).toBeLessThan(answerOf(next, b.id).layout.x);
    expect(linkReport(next)?.missing).toEqual([]);
    expect(sheetScores(sheetOf(next)).total).toBe(3);
  });
});

describe("the sheet keeps what it made", () => {
  it("has a fingerprint on every answer and copy it made, and none on marks and lines", () => {
    const { exam } = standard();
    for (const template of ["answers", "copy"] as const) {
      const sheet = sheetOf(make(exam, template));
      for (const b of sheet.blocks.filter((x) => x.meta?.source)) {
        if (b.type === "mark" || b.type === "rule") expect(b.meta?.source?.sig).toBeUndefined();
        else expect(typeof b.meta?.source?.sig).toBe("string");
      }
      expect(sourcesOf(sheet.blocks).size).toBeGreaterThan(0);
    }
  });

  it("measures a block as the editor does", () => {
    const { exam, q1 } = standard();
    const full = make(exam, "copy");
    const copy = sheetOf(full).blocks.find((b) => b.meta?.source?.id === q1.id && b.type === "mcq")!;
    expect(heightOf(full, copy)).toBe(blockHeight(copy, 1, fr));
  });
});
