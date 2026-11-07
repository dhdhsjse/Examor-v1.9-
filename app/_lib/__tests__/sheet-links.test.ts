import { describe, expect, it } from "vitest";
import { createBlock } from "../blocks";
import { generateCorrection, sourcesOf } from "../sheet/generate";
import { addMissing, adoptMarks, linkReport, rebuildSheet, removeOrphans, resetMarks, syncPoints } from "../sheet/links";
import { sheetScores } from "../sheet/marks";
import { viewOf, withCorrection } from "../sheet/part";
import type { Block, ExamDoc, ExamMeta, MarkBlock, OpenBlock, QuestionBlock, TextBlock } from "../types";

const fr: ExamMeta = { title: "Devoir", lang: "fr", templateId: "t" };
const put = <T extends Block>(b: T, y: number): T => ({ ...b, layout: { ...b.layout, pageId: "e1", y } });
const mcq = (y: number, points: number) => put(createBlock("mcq", "fr", "e1", { text: "Q ?", options: ["a", "b", "c"], correct: 1, points }), y);
const blank = (y: number, points: number) => put(createBlock("blank", "fr", "e1", { text: "Complétez", content: "Le [soleil].", points }), y);
const parts = (y: number) =>
  put(
    createBlock("open", "fr", "e1", {
      text: "Expliquez",
      answer: "",
      parts: [{ text: "un", lines: 2, answer: "A", points: 1 }, { text: "deux", lines: 2, answer: "B", points: 1.5 }],
      points: 2.5,
    }),
    y,
  ) as OpenBlock;
const heading = (t: string, y: number) => put(createBlock("text", "fr", "e1", { text: t, style: "heading" }) as TextBlock, y);

const examOf = (blocks: Block[]): ExamDoc => ({ version: 1, meta: fr, pages: [{ id: "e1" }], blocks });
const make = (exam: ExamDoc, template: "answers" | "copy" = "answers") => withCorrection(exam, generateCorrection(exam, { template, paper: "bordered", marks: true }));
const sheetOf = (full: ExamDoc) => viewOf(full, "sheet");
const marks = (full: ExamDoc) => sheetOf(full).blocks.filter((b): b is MarkBlock => b.type === "mark");
const exam3 = () => examOf([heading("Exercice 1", 60), mcq(110, 1), blank(200, 2), parts(300)]);

// the sheet with the mark of the first question changed by hand
const withMarkChanged = (full: ExamDoc, id: string, value: number): ExamDoc => ({
  ...full,
  correction: { ...full.correction!, blocks: full.correction!.blocks.map((b) => (b.type === "mark" && b.meta?.source?.id === id && b.kind === "number" ? { ...b, value } : b)) },
});

describe("a sheet that agrees with its exam", () => {
  it("has nothing to report", () => {
    const full = make(exam3());
    expect(linkReport(full)).toEqual({ template: "answers", linked: true, missing: [], orphans: [], diffs: [], stale: [] });
  });

  it("has no report when there is no sheet, and says a blank sheet is not linked", () => {
    expect(linkReport(exam3())).toBeNull();
    const blankSheet = { ...exam3(), correction: { sheet: make(exam3()).correction!.sheet, pages: [{ id: "c1" }], blocks: [], template: "blank" as const } };
    expect(linkReport(blankSheet)).toEqual({ template: "blank", linked: false, missing: [], orphans: [], diffs: [], stale: [] });
  });

  it("agrees in a copy of the exam too", () => {
    const full = make(exam3(), "copy");
    expect(linkReport(full)?.diffs).toEqual([]);
    expect(linkReport(full)?.template).toBe("copy");
  });
});

describe("marks that are not the points of the exam", () => {
  const exam = exam3();
  const [, q1, q2, q3] = exam.blocks;
  const full = withMarkChanged(make(exam), q1.id, 0.5);

  it("tells which question, what the exam says and what the sheet adds up to", () => {
    const report = linkReport(full)!;
    expect(report.diffs).toHaveLength(1);
    expect(report.diffs[0]).toMatchObject({ exam: 1, sheet: 0.5, adoptable: true });
    expect(report.diffs[0].questions).toEqual([{ id: q1.id, n: 1, points: 1 }]);
    expect(sheetScores(sheetOf(full)).total).toBe(0.5 + 2 + 2.5);
  });

  it("can be fixed by making the marks again from the points of the exam", () => {
    const fixed = resetMarks(full, [q1.id]);
    expect(linkReport(fixed)?.diffs).toEqual([]);
    expect(marks(fixed).filter((m) => m.meta?.source?.id === q1.id && m.kind === "number").map((m) => m.value)).toEqual([1]);
    // (the marks of the other questions are the same blocks)
    const before = marks(full).filter((m) => m.meta?.source?.id === q2.id);
    const after = marks(fixed).filter((m) => m.meta?.source?.id === q2.id);
    expect(after.map((m) => m.id).sort()).toEqual(before.map((m) => m.id).sort());
    expect(sheetScores(sheetOf(fixed)).total).toBe(5.5);
  });

  it("can be fixed by taking the marks of the sheet as the points of the exam", () => {
    const fixed = adoptMarks(full, [q1.id]);
    expect((fixed.blocks.find((b) => b.id === q1.id) as QuestionBlock).points).toBe(0.5);
    expect(linkReport(fixed)?.diffs).toEqual([]);
    // (the sheet is as it was)
    expect(fixed.correction).toBe(full.correction);
  });

  it("makes the marks of a question with sub-questions again, one for each, and its total", () => {
    const broken = withMarkChanged(make(exam), q3.id, 4);
    const diff = linkReport(broken)!.diffs[0];
    expect(diff.exam).toBe(2.5);
    expect(diff.sheet).toBe(8); // (both of its marks were made 4)
    const fixed = resetMarks(broken, [q3.id]);
    expect(linkReport(fixed)?.diffs).toEqual([]);
    const own = marks(fixed).filter((m) => m.meta?.source?.id === q3.id);
    expect(own.filter((m) => m.kind === "number").map((m) => [m.value, m.meta?.source?.part])).toEqual([[1, 0], [1.5, 1]]);
    expect(own.filter((m) => m.kind === "total")).toHaveLength(1);
  });

  it("takes the marks of each sub-question as the points of the sub-questions", () => {
    const base = make(exam);
    const edited = {
      ...base,
      correction: { ...base.correction!, blocks: base.correction!.blocks.map((b) => (b.type === "mark" && b.meta?.source?.id === q3.id && b.meta.source.part === 0 && b.kind === "number" ? { ...b, value: 2 } : b)) },
    };
    const report = linkReport(edited)!;
    expect(report.diffs[0]).toMatchObject({ exam: 2.5, sheet: 3.5, adoptable: true });
    const fixed = adoptMarks(edited, [q3.id]);
    const open = fixed.blocks.find((b) => b.id === q3.id) as OpenBlock;
    expect(open.parts!.map((p) => p.points)).toEqual([2, 1.5]);
    expect(open.points).toBe(3.5);
  });

  it("gives a sub-question that has no mark on the sheet no points", () => {
    const base = make(exam);
    const edited = { ...base, correction: { ...base.correction!, blocks: base.correction!.blocks.filter((b) => !(b.type === "mark" && b.meta?.source?.id === q3.id && b.meta.source.part === 1)) } };
    const diff = linkReport(edited)!.diffs[0];
    expect(diff).toMatchObject({ exam: 2.5, sheet: 1, adoptable: true });
    const open = adoptMarks(edited, [q3.id]).blocks.find((b) => b.id === q3.id) as OpenBlock;
    expect(open.parts!.map((p) => p.points)).toEqual([1, 0]);
    expect(open.points).toBe(1);
  });

  it("shares a typed total out among the sub-questions as their points were", () => {
    const base = make(exam);
    const edited = { ...base, correction: { ...base.correction!, blocks: base.correction!.blocks.map((b) => (b.type === "mark" && b.meta?.source?.id === q3.id && b.kind === "total" ? { ...b, manual: true, value: 5 } : b)) } };
    expect(linkReport(edited)!.diffs[0]).toMatchObject({ exam: 2.5, sheet: 5, adoptable: true });
    const fixed = adoptMarks(edited, [q3.id]);
    const open = fixed.blocks.find((b) => b.id === q3.id) as OpenBlock;
    expect(open.parts!.map((p) => p.points)).toEqual([2, 3]);
    expect(open.points).toBe(5);
  });

  it("tells a question that has its answer but no mark at all", () => {
    const base = make(exam);
    const edited = { ...base, correction: { ...base.correction!, blocks: base.correction!.blocks.filter((b) => !(b.type === "mark" && b.meta?.source?.id === q2.id)) } };
    const report = linkReport(edited)!;
    expect(report.diffs.map((d) => [d.questions[0].n, d.exam, d.sheet])).toEqual([[2, 2, 0]]);
    expect(report.diffs[0].adoptable).toBe(false);
    // making them again from the points gives them back
    expect(linkReport(resetMarks(edited, [q2.id]))?.diffs).toEqual([]);
  });

  it("follows a change of points in the exam", () => {
    const changed = { ...make(exam), blocks: exam.blocks.map((b) => (b.id === q2.id ? ({ ...b, points: 3 } as Block) : b)) };
    expect(linkReport(changed)!.diffs.map((d) => [d.exam, d.sheet])).toEqual([[3, 2]]);
    expect(linkReport(resetMarks(changed, [q2.id]))?.diffs).toEqual([]);
    expect(sheetScores(sheetOf(resetMarks(changed, [q2.id]))).total).toBe(1 + 3 + 2.5);
  });

  it("compares the marks of two questions together when the line between them is gone", () => {
    const base = make(exam);
    const first = base.correction!.blocks.find((b) => b.type === "rule" && b.meta?.source?.id === q1.id)!;
    const merged = { ...base, correction: { ...base.correction!, blocks: base.correction!.blocks.filter((b) => b !== first) } };
    const edited = withMarkChanged(merged, q1.id, 0.5);
    const diff = linkReport(edited)!.diffs[0];
    expect(diff.questions.map((q) => q.n)).toEqual([1, 2]);
    expect(diff.exam).toBe(3);
    expect(diff.sheet).toBe(2.5);
    expect(diff.adoptable).toBe(true);
    // (they share the marks of the row as their points were: 1 and 2 of 3)
    const fixed = adoptMarks(edited, [q1.id]);
    expect([q1.id, q2.id].map((id) => (fixed.blocks.find((b) => b.id === id) as QuestionBlock).points)).toEqual([0.833, 1.667]);
    expect(linkReport(fixed)?.diffs).toEqual([]);
  });

  it("works on a copy of the exam: the marks are beside the questions", () => {
    const copy = make(exam, "copy");
    const edited = withMarkChanged(copy, q1.id, 0.5);
    expect(linkReport(edited)!.diffs).toHaveLength(1);
    const fixed = resetMarks(edited, [q1.id]);
    expect(linkReport(fixed)?.diffs).toEqual([]);
    const mark = marks(fixed).find((m) => m.meta?.source?.id === q1.id)!;
    const question = sheetOf(fixed).blocks.find((b) => b.type === "mcq")!;
    expect(mark.layout.y + 12).toBeGreaterThan(question.layout.y);
    expect(mark.layout.y + 12).toBeLessThan(question.layout.y + 40);
  });
});

describe("a mark changed on the sheet", () => {
  const exam = exam3();
  const [, q1, q2] = exam.blocks;
  const points = (full: ExamDoc, id: string) => (full.blocks.find((b) => b.id === id) as QuestionBlock).points;

  it("sets the points of its question in the exam: nothing is left to check", () => {
    const base = make(exam);
    const synced = syncPoints(base, withMarkChanged(base, q1.id, 0.5));
    expect(points(synced, q1.id)).toBe(0.5);
    expect(linkReport(synced)?.diffs).toEqual([]);
  });

  it("leaves alone a row that disagreed the same way before (the points were changed in the exam)", () => {
    const changed = { ...make(exam), blocks: exam.blocks.map((b) => (b.id === q2.id ? ({ ...b, points: 3 } as Block) : b)) };
    const after = withMarkChanged(changed, q1.id, 0.5);
    const synced = syncPoints(changed, after);
    expect(points(synced, q1.id)).toBe(0.5);
    expect(points(synced, q2.id)).toBe(3);
    expect(linkReport(synced)!.diffs.map((d) => [d.exam, d.sheet])).toEqual([[3, 2]]);
  });

  it("does not take a question whose marks were all deleted to 0", () => {
    const base = make(exam);
    const after = { ...base, correction: { ...base.correction!, blocks: base.correction!.blocks.filter((b) => !(b.type === "mark" && b.meta?.source?.id === q2.id)) } };
    expect(syncPoints(base, after)).toBe(after);
  });

  it("brings the copy of the question up to date on a copy of the exam", () => {
    const base = make(exam, "copy");
    const synced = syncPoints(base, withMarkChanged(base, q1.id, 0.5));
    expect(points(synced, q1.id)).toBe(0.5);
    const report = linkReport(synced)!;
    expect(report.diffs).toEqual([]);
    expect(report.stale).toEqual([]);
    expect((sheetOf(synced).blocks.find((b) => b.type === "mcq") as QuestionBlock).points).toBe(0.5);
  });
});

describe("questions the sheet does not have", () => {
  const exam = exam3();
  const full = make(exam);
  const fresh = blank(400, 2);
  const grown = { ...full, blocks: [...full.blocks, fresh] };

  it("are listed with their numbers", () => {
    expect(linkReport(grown)?.missing).toEqual([{ id: fresh.id, n: 4 }]);
  });

  it("can be put in: with their answer, their marks and their line, after what the sheet has", () => {
    const next = addMissing(grown);
    expect(linkReport(next)?.missing).toEqual([]);
    expect(linkReport(next)?.diffs).toEqual([]);
    expect(sourcesOf(sheetOf(next).blocks).get(fresh.id)).toHaveLength(1);
    expect(marks(next).filter((m) => m.meta?.source?.id === fresh.id && m.kind === "number").map((m) => m.value)).toEqual([2]);
    expect(sheetScores(sheetOf(next)).total).toBe(1 + 2 + 2.5 + 2);
    // (the exam is left alone)
    expect(next.blocks).toBe(grown.blocks);
  });

  it("can be put in one by one", () => {
    const another = mcq(500, 1);
    const two = { ...grown, blocks: [...grown.blocks, another] };
    const next = addMissing(two, [another.id]);
    expect(linkReport(next)?.missing.map((m) => m.id)).toEqual([fresh.id]);
  });

  it("are not put in twice", () => {
    const once = addMissing(grown);
    expect(addMissing(once)).toBe(once);
    expect(sheetOf(once).blocks.filter((b) => b.meta?.source?.id === fresh.id && b.type === "text")).toHaveLength(1);
  });

  it("are put in a copy of the exam as copies", () => {
    const copy = make(exam, "copy");
    const next = addMissing({ ...copy, blocks: [...copy.blocks, fresh] });
    expect(sheetOf(next).blocks.filter((b) => b.type === "blank")).toHaveLength(2);
    expect(linkReport(next)?.diffs).toEqual([]);
  });

  it("are not put in a blank sheet", () => {
    const blankSheet = { ...grown, correction: { ...grown.correction!, blocks: [], template: "blank" as const } };
    expect(addMissing(blankSheet)).toBe(blankSheet);
  });
});

describe("what the sheet has of questions that are gone", () => {
  const exam = exam3();
  const full = make(exam);
  const gone = { ...full, blocks: full.blocks.filter((b) => b.id !== exam.blocks[2].id) };

  it("is listed, and can be taken out with its marks and its line", () => {
    expect(linkReport(gone)?.orphans).toEqual([exam.blocks[2].id]);
    const next = removeOrphans(gone);
    expect(linkReport(next)?.orphans).toEqual([]);
    expect(sheetOf(next).blocks.some((b) => b.meta?.source?.id === exam.blocks[2].id)).toBe(false);
    expect(sheetScores(sheetOf(next)).total).toBe(1 + 2.5);
    expect(linkReport(next)?.diffs).toEqual([]);
  });

  it("leaves a sheet that has none as it is", () => {
    expect(removeOrphans(full)).toBe(full);
  });
});

describe("making the sheet again", () => {
  it("replaces the sheet with a new one, keeping its settings, whatever the template", () => {
    const exam = exam3();
    const full = make(exam);
    const custom = { ...full, correction: { ...full.correction!, sheet: { ...full.correction!.sheet, pad: true, marks: { width: 90, title: "Note" } } } };
    const next = rebuildSheet(custom, { template: "copy", paper: "bordered", marks: true });
    expect(next.correction!.template).toBe("copy");
    expect(next.correction!.sheet.pad).toBe(true);
    expect(next.correction!.sheet.marks).toEqual({ width: 90, title: "Note" });
    expect(next.correction!.blocks.some((b) => b.type === "mcq")).toBe(true);
    expect(next.blocks).toBe(custom.blocks);
    expect(linkReport(next)?.diffs).toEqual([]);
  });
});
