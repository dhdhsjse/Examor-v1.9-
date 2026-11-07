import { describe, expect, it } from "vitest";
import { getPageDimensions } from "../pageFormats";
import { blockHeight } from "../blockLayout";
import { createBlock, questionNumbers, totalPoints } from "../blocks";
import { plainText } from "../richText";
import { answerParts } from "../sheet/answers";
import { frameGeometry } from "../sheet/frame";
import { generateCorrection, questionsAndHeadings, sourcesOf } from "../sheet/generate";
import { addQuestions } from "../sheet/refresh";
import { sheetScores } from "../sheet/marks";
import { defaultSheet } from "../sheet/model";
import { viewOf } from "../sheet/part";
import type { Block, ExamDoc, ExamMeta, MarkBlock, OpenBlock, QuestionBlock, RuleBlock, TextBlock } from "../types";

const A4 = getPageDimensions();
const fr: ExamMeta = { title: "Devoir", lang: "fr", templateId: "t" };
const ar: ExamMeta = { ...fr, lang: "ar" };

// ---- an exam with a bit of everything ----

const put = <T extends Block>(b: T, y: number, pageId = "e1"): T => ({ ...b, layout: { ...b.layout, pageId, y } });
const text = (t: string, style: "title" | "heading" | "body", y: number, pageId = "e1") => put(createBlock("text", "fr", pageId, { text: t, style }) as TextBlock, y, pageId);
const mcq = (y: number, points = 1, correct = 1) => put(createBlock("mcq", "fr", "e1", { text: "Capitale de la France ?", options: ["Lyon", "Paris", "Nice"], correct, points }), y);
const trueFalse = (y: number) => put(createBlock("truefalse", "fr", "e1", { text: "Vrai ou faux", statements: [{ text: "a", answer: true }, { text: "b", answer: false, fix: "b corrigé" }], points: 2 }), y);
const blank = (y: number) => put(createBlock("blank", "fr", "e1", { text: "Complétez", content: "Le [soleil] se lève à l'[est].", points: 2 }), y);
const open = (y: number, extra: Partial<OpenBlock> = {}) => put(createBlock("open", "fr", "e1", { text: "Expliquez", answer: "Parce que A.", points: 3, ...extra }), y) as OpenBlock;
const parts = (y: number) =>
  open(y, {
    answer: "",
    parts: [
      { text: "Premier", lines: 2, answer: "Réponse un", points: 1 },
      { text: "Deuxième", lines: 2, answer: "Réponse deux", points: 1.5 },
    ],
    points: 2.5,
  });
const match = (y: number) => put(createBlock("match", "fr", "e1", { text: "Reliez", pairs: [{ left: "x", right: "1" }, { left: "y", right: "2" }], order: [1, 0], points: 2 }), y);
const order = (y: number) => put(createBlock("order", "fr", "e1", { text: "Ordonnez", items: ["un", "deux", "trois"], order: [2, 0, 1], points: 2 }), y);
const classify = (y: number) => put(createBlock("classify", "fr", "e1", { text: "Classez", groups: [{ name: "Fruits", items: ["pomme", "poire"] }, { name: "Légumes", items: ["chou"] }], points: 2 }), y);

const examOf = (blocks: Block[], meta = fr): ExamDoc => ({ version: 1, meta, pages: [{ id: "e1" }], blocks });
const standard = (meta = fr) => examOf([text("Exercice 1", "heading", 60), mcq(110, 1), trueFalse(230), text("Exercice 2", "heading", 420), blank(470), parts(560), match(760)], meta);

const sheetDoc = (exam: ExamDoc, doc: ReturnType<typeof generateCorrection>): ExamDoc => viewOf({ ...exam, correction: doc }, "sheet");
const marksOf = (d: ExamDoc) => d.blocks.filter((b): b is MarkBlock => b.type === "mark");
const rulesOf = (d: ExamDoc) => d.blocks.filter((b): b is RuleBlock => b.type === "rule");
const by = (d: ExamDoc, id: string) => d.blocks.filter((b) => b.meta?.source?.id === id && b.type !== "mark" && b.type !== "rule");

describe("the model answer of each question", () => {
  const ans = (q: QuestionBlock, n = 1, lang: "fr" | "ar" = "fr") => answerParts(q, n, lang).map((p) => plainText(p.text));

  it("names the correct option of a multiple choice question, or each of several", () => {
    expect(ans(mcq(0, 1, 1) as QuestionBlock, 3)).toEqual(["3) B : Paris"]);
    const several = { ...(mcq(0) as QuestionBlock), multi: true, corrects: [0, 2] } as QuestionBlock;
    expect(ans(several)).toEqual(["1) A : Lyon ; C : Nice"]);
  });

  it("gives the answer of each statement of a true / false question, and the correction of a false one", () => {
    expect(ans(trueFalse(0) as QuestionBlock)).toEqual(["1) 1 : Vrai ; 2 : Faux (b corrigé)"]);
    expect(answerParts(trueFalse(0) as QuestionBlock, 1, "fr")[0].points).toBe(2);
  });

  it("lists the words that go in the blanks", () => {
    expect(ans(blank(0) as QuestionBlock)).toEqual(["1) 1 : soleil ; 2 : est"]);
    const one = { ...(blank(0) as QuestionBlock), content: "La capitale est [Paris]." } as QuestionBlock;
    expect(ans(one)).toEqual(["1) Paris"]);
  });

  it("gives the model answer of an open question, or one for each sub-question with its own points", () => {
    expect(ans(open(0))).toEqual(["1) Parce que A."]);
    const p = answerParts(parts(0), 2, "fr");
    expect(p.map((x) => plainText(x.text))).toEqual(["2a) Réponse un", "2b) Réponse deux"]);
    expect(p.map((x) => x.points)).toEqual([1, 1.5]);
    expect(p.map((x) => x.part)).toEqual([0, 1]);
  });

  it("keeps an answer typed for the question itself, over its sub-questions, with no points", () => {
    const q = { ...parts(0), answer: "En général." };
    const p = answerParts(q, 1, "fr");
    expect(p).toHaveLength(3);
    expect(plainText(p[0].text)).toBe("1) En général.");
    expect(p[0].points).toBe(0);
    expect(p[0].part).toBeUndefined();
  });

  it("says which letter goes with each number in a matching question (the right items are printed mixed up)", () => {
    // order [1, 0]: row 1 prints the right item of pair 1 (letter a), row 2 that of pair 0 (letter b): pair 0 = b, pair 1 = a
    expect(ans(match(0) as QuestionBlock)).toEqual(["1) 1 = b ; 2 = a"]);
  });

  it("gives the items of an ordering question in the right order, or the sentence", () => {
    expect(ans(order(0) as QuestionBlock)).toEqual(["1) 1. un ; 2. deux ; 3. trois"]);
    expect(ans({ ...(order(0) as QuestionBlock), style: "sentence", items: ["Le", "chat", "dort"] } as QuestionBlock)).toEqual(["1) Le chat dort"]);
  });

  it("gives the words of each category on its own line", () => {
    expect(ans(classify(0) as QuestionBlock)).toEqual(["1) Fruits : pomme, poire\nLégumes : chou"]);
  });

  it("numbers in the style of the language", () => {
    expect(ans(mcq(0) as QuestionBlock, 4, "ar")[0].startsWith("4- ")).toBe(true);
  });
});

describe("a sheet of the answers", () => {
  const exam = standard();
  const out = generateCorrection(exam, { template: "answers", paper: "bordered", marks: true });
  const doc = sheetDoc(exam, out);
  const ids = Object.fromEntries(exam.blocks.map((b, i) => [i, b.id]));

  it("starts with the title of the sheet, over the frame of the first page", () => {
    const title = doc.blocks.find((b) => b.type === "text" && b.style === "title") as TextBlock;
    expect(title.text).toBe("Corrigé et barème");
    expect(out.sheet.paper).toBe("bordered");
    expect(out.template).toBe("answers");
    const geo = frameGeometry(out.sheet, out.pages[0], 0, false)!;
    expect(out.sheet.frame.firstTop).toBeGreaterThan(blockHeight(title, 1, fr));
    expect(geo.frame.y).toBeGreaterThanOrEqual(title.layout.y + blockHeight(title, 1, fr));
    expect(title.layout.x).toBe(geo.frame.x);
  });

  it("writes the title of the exam under it, when the exam has one", () => {
    const header = createBlock("header", "fr", "e1", {});
    const titled = { ...exam, blocks: [put(header, 20), ...exam.blocks] };
    const d = sheetDoc(titled, generateCorrection(titled, { template: "answers", paper: "bordered", marks: true }));
    const texts = d.blocks.filter((b): b is TextBlock => b.type === "text" && !b.meta?.source).map((b) => b.text);
    expect(texts[0]).toBe("Corrigé et barème");
    expect(texts[1]).toBe(plainText((header as Extract<Block, { type: "header" }>).fields.title));
  });

  it("has an answer for each question, and a copy of each heading, all linked to their source", () => {
    expect(by(doc, ids[0]).map((b) => (b as TextBlock).text)).toEqual(["Exercice 1"]);
    expect(by(doc, ids[2])).toHaveLength(1);
    expect(by(doc, ids[5])).toHaveLength(2); // (the open question with two sub-questions)
    for (const i of [0, 1, 2, 3, 4, 5, 6]) expect(by(doc, ids[i]).length).toBeGreaterThan(0);
  });

  it("centers and underlines the title of an exercise, as the official answer keys do, unless it has a look of its own", () => {
    const heading = by(doc, ids[0])[0] as TextBlock;
    expect(heading.align).toBe("center");
    expect(heading.font?.underline).toBe(true);
    const own = examOf([{ ...text("Exercice 1", "heading", 60), decor: "band" } as TextBlock, mcq(110, 1)]);
    const d = sheetDoc(own, generateCorrection(own, { template: "answers", paper: "bordered", marks: true }));
    const band = by(d, own.blocks[0].id)[0] as TextBlock;
    expect(band.align).toBeUndefined();
    expect(band.decor).toBe("band");
  });

  it("puts everything in the answer column of its page", () => {
    const geo = frameGeometry(out.sheet, out.pages[0], 0, false)!;
    for (const b of doc.blocks.filter((x) => x.meta?.source && x.type === "text")) {
      expect(b.layout.x).toBeGreaterThanOrEqual(geo.content.x - 0.01);
      expect(b.layout.x + b.layout.width).toBeLessThanOrEqual(geo.content.x + geo.content.width + 0.01);
    }
  });

  it("puts the marks of the questions beside the answers: one for a question, one for each sub-question, and a total in each row (the column of the totals)", () => {
    const marks = marksOf(doc);
    const of = (i: number) => marks.filter((m) => m.meta?.source?.id === ids[i]);
    expect(of(1).filter((m) => m.kind === "number").map((m) => m.value)).toEqual([1]);
    expect(of(2).filter((m) => m.kind === "number").map((m) => m.value)).toEqual([2]);
    expect(of(5).filter((m) => m.kind === "number").map((m) => [m.value, m.meta?.source?.part])).toEqual([[1, 0], [1.5, 1]]);
    expect(of(5).filter((m) => m.kind === "total")).toHaveLength(1);
    expect(of(1).filter((m) => m.kind === "total")).toHaveLength(1);
    // (the heading has none)
    expect(of(0)).toHaveLength(0);
  });
  it("keeps a total for the rows of two marks or more on free paper, or when the column of the totals is off", () => {
    const free = sheetDoc(exam, generateCorrection(exam, { template: "answers", paper: "free", marks: true }));
    const off = sheetDoc(exam, generateCorrection(exam, { template: "answers", paper: "bordered", marks: true, keep: { ...out.sheet, total: null } }));
    for (const d of [free, off]) {
      const of = (i: number) => marksOf(d).filter((m) => m.meta?.source?.id === ids[i] && m.kind === "total");
      expect(of(1)).toHaveLength(0);
      expect(of(5)).toHaveLength(1);
    }
  });

  it("keeps each mark level with the first line of its answer, in the column of the marks", () => {
    const geo = frameGeometry(out.sheet, out.pages[0], 0, false)!;
    const q1 = by(doc, ids[1])[0] as TextBlock;
    const mark = marksOf(doc).find((m) => m.meta?.source?.id === ids[1])!;
    expect(mark.layout.x).toBe(geo.marks!.x0);
    expect(mark.layout.width).toBe(geo.marks!.x1 - geo.marks!.x0);
    expect(Math.abs(mark.layout.y + mark.layout.height / 2 - (q1.layout.y + 15))).toBeLessThan(8);
    const two = marksOf(doc).filter((m) => m.meta?.source?.id === ids[5] && m.kind === "number");
    const answers = by(doc, ids[5]).sort((a, b) => (a.meta?.source?.part ?? 0) - (b.meta?.source?.part ?? 0));
    expect(two[0].layout.y).toBeLessThan(two[1].layout.y);
    expect(two[1].layout.y + 12).toBeGreaterThan(answers[1].layout.y);
  });

  it("closes each row with a line under its answers, and the line before a heading is thick", () => {
    const rules = rulesOf(doc);
    expect(rules).toHaveLength(5); // (five questions)
    const after = (i: number) => rules.find((r) => r.meta?.source?.id === ids[i])!;
    expect(after(1).line).toBeUndefined();
    expect(after(2).line).toBe("exercise"); // (the last question of the first exercise)
    expect(after(6).line).toBeUndefined();
    const answer = by(doc, ids[1])[0];
    expect(after(1).layout.y + 5).toBeGreaterThanOrEqual(answer.layout.y + blockHeight(answer, 1, fr));
  });

  it("adds up to the points of the exam, row by row", () => {
    const s = sheetScores(doc);
    expect(s.total).toBe(totalPoints(exam.blocks));
    expect(s.total).toBe(1 + 2 + 2 + 2.5 + 2);
    expect(s.issues).toEqual([]);
    expect(s.rows).toHaveLength(5);
    expect(s.rows.map((r) => r.score)).toEqual([1, 2, 2, 2.5, 2]);
  });

  it("keeps a total with the marks of its row", () => {
    const total = marksOf(doc).find((m) => m.kind === "total")!;
    const numbers = marksOf(doc).filter((m) => m.meta?.source?.id === total.meta?.source?.id && m.kind === "number");
    const lo = Math.min(...numbers.map((m) => m.layout.y));
    const hi = Math.max(...numbers.map((m) => m.layout.y + m.layout.height));
    expect(total.layout.y + total.layout.height / 2).toBeCloseTo((lo + hi) / 2, 0);
  });

  it("can leave the marks out", () => {
    const bare = sheetDoc(exam, generateCorrection(exam, { template: "answers", paper: "bordered", marks: false }));
    expect(marksOf(bare)).toHaveLength(0);
    expect(rulesOf(bare)).toHaveLength(5);
  });

  it("does not make a mark of a question that earns nothing", () => {
    const zero = examOf([mcq(60, 0), mcq(200, 1)]);
    const d = sheetDoc(zero, generateCorrection(zero, { template: "answers", paper: "bordered", marks: true }));
    expect(marksOf(d).filter((m) => m.kind === "number").map((m) => m.value)).toEqual([1]);
  });

  it("is made on the paper chosen: free paper has the room of the frame, the marks in the same places", () => {
    const free = generateCorrection(exam, { template: "answers", paper: "free", marks: true });
    expect(free.sheet.paper).toBe("free");
    const fd = sheetDoc(exam, free);
    const geo = frameGeometry({ ...free.sheet, paper: "bordered" }, free.pages[0], 0, false)!;
    expect(marksOf(fd).every((m) => m.kind === "total" ? m.layout.x === geo.total!.x0 : m.layout.x === geo.marks!.x0)).toBe(true);
    expect(rulesOf(fd)[0].layout.x).toBe(geo.frame.x);
    expect(rulesOf(fd)[0].layout.width).toBe(geo.frame.width);
    expect(sheetScores(fd).total).toBe(sheetScores(doc).total);
  });

  it("keeps the settings it is asked to keep", () => {
    const keep = { ...defaultSheet("fr"), marks: { width: 90, title: "Note" }, headings: "all" as const, pad: true };
    const kept = generateCorrection(exam, { template: "answers", paper: "bordered", marks: true, keep });
    expect(kept.sheet.marks).toEqual({ width: 90, title: "Note" });
    expect(kept.sheet.headings).toBe("all");
    expect(kept.sheet.pad).toBe(true);
    const geo = frameGeometry(kept.sheet, kept.pages[0], 0, false)!;
    expect(marksOf(sheetDoc(exam, kept))[0].layout.width).toBe(geo.marks!.x1 - geo.marks!.x0);
  });

  it("has no header and no footer, and the exam is left as it was", () => {
    expect(out.globalHeader?.enabled).toBe(false);
    expect(out.globalFooter?.enabled).toBe(false);
    expect(exam.blocks).toHaveLength(7);
    expect(exam.correction).toBeUndefined();
  });
});

describe("a sheet that takes more than a page", () => {
  const many = examOf(Array.from({ length: 24 }, (_, i) => open(60 + i * 40, { answer: "Une réponse assez longue pour prendre plusieurs lignes dans la colonne des réponses. ".repeat(3), points: 1 })));
  const out = generateCorrection(many, { template: "answers", paper: "bordered", marks: true });
  const doc = sheetDoc(many, out);

  it("goes on on more pages, with the same frame", () => {
    expect(out.pages.length).toBeGreaterThan(1);
    expect(new Set(out.pages.map((p) => p.id)).size).toBe(out.pages.length);
    expect(doc.blocks.every((b) => out.pages.some((p) => p.id === b.layout.pageId))).toBe(true);
  });

  it("never puts an answer over the bottom of its frame, nor lets a row go over two pages", () => {
    out.pages.forEach((p, i) => {
      const geo = frameGeometry(out.sheet, p, i, false)!;
      for (const b of doc.blocks.filter((x) => x.layout.pageId === p.id && x.type === "text" && x.meta?.source)) {
        expect(b.layout.y + blockHeight(b, 1, fr)).toBeLessThanOrEqual(geo.frame.y + geo.frame.height + 0.01);
      }
    });
    // (each question has its answer, its mark and its line on one page)
    for (const q of many.blocks) {
      const pagesOf = new Set(doc.blocks.filter((b) => b.meta?.source?.id === q.id).map((b) => b.layout.pageId));
      expect(pagesOf.size).toBe(1);
    }
  });

  it("starts the questions in reading order: the page, then the height", () => {
    const answers = many.blocks.map((q) => by(doc, q.id)[0] as TextBlock);
    const key = (b: TextBlock) => out.pages.findIndex((p) => p.id === b.layout.pageId) * 10000 + b.layout.y;
    for (let i = 1; i < answers.length; i++) expect(key(answers[i])).toBeGreaterThan(key(answers[i - 1]));
  });

  it("adds up to the points of the exam", () => {
    expect(sheetScores(doc).total).toBe(24);
  });

  it("never starts a page with a line right under the frame, and keeps a heading with the question after it", () => {
    const withHeadings = examOf(Array.from({ length: 12 }, (_, i) => [text(`Exercice ${i + 1}`, "heading", 60 + i * 80), open(100 + i * 80, { answer: "Une réponse. ".repeat(40), points: 1 })]).flat());
    const o = generateCorrection(withHeadings, { template: "answers", paper: "bordered", marks: true });
    const d = sheetDoc(withHeadings, o);
    const heads = withHeadings.blocks.filter((b) => b.type === "text");
    for (const h of heads) {
      const hb = by(d, h.id)[0];
      const q = withHeadings.blocks[withHeadings.blocks.indexOf(h) + 1];
      expect(by(d, q.id)[0].layout.pageId).toBe(hb.layout.pageId);
    }
  });
});

describe("a sheet in Arabic", () => {
  const exam = standard(ar);
  const out = generateCorrection(exam, { template: "answers", paper: "bordered", marks: true });
  const doc = sheetDoc(exam, out);

  it("is titled and set up in Arabic, with the marks at the left", () => {
    expect((doc.blocks.find((b) => b.type === "text" && b.style === "title") as TextBlock).text).toBe("الإجابة النموذجية وسلم التنقيط");
    const geo = frameGeometry(out.sheet, out.pages[0], 0, true)!;
    const mark = marksOf(doc).find((m) => m.kind === "number")!;
    expect(mark.layout.x).toBe(geo.marks!.x0);
    expect(geo.marks!.x0).toBeLessThan(geo.answer.x0);
  });

  it("adds up the same", () => {
    expect(sheetScores(doc).total).toBe(1 + 2 + 2 + 2.5 + 2);
  });
});

describe("a sheet that is a copy of the exam", () => {
  const exam = examOf([
    text("Exercice 1", "heading", 60),
    put(createBlock("text", "fr", "e1", { text: "Lisez le texte suivant.", style: "body" }), 100),
    mcq(150, 1),
    parts(260),
    put(createBlock("image", "fr", "e1", { src: "data:image/png;base64,AAAA", ratio: 2, width: 600, height: 300 }), 450),
    put(createBlock("table", "fr", "e1", { cells: [["a", "b"], ["c", "d"]], header: true }), 780),
    put(createBlock("divider", "fr", "e1", {}), 900),
    put(createBlock("shape", "fr", "e1", { shape: "rect" }), 950),
  ]);
  const out = generateCorrection(exam, { template: "copy", paper: "bordered", marks: true });
  const doc = sheetDoc(exam, out);
  const geo = frameGeometry(out.sheet, out.pages[0], 0, false)!;

  it("keeps the exam's own look for a heading", () => {
    const heading = by(doc, exam.blocks[0].id)[0] as TextBlock;
    expect(heading.align).toBeUndefined();
    expect(heading.font?.underline).toBeUndefined();
  });

  it("copies the blocks of the exam in reading order, narrowed to the answer column, and leaves out what cannot be copied", () => {
    const types = doc.blocks.filter((b) => b.meta?.source && b.type !== "mark" && b.type !== "rule").map((b) => b.type);
    expect(types).toEqual(["text", "text", "mcq", "open", "image", "table"]);
    // (no divider: the lines of the sheet are its own; no shape: it cannot follow its blocks)
    for (const b of doc.blocks.filter((x) => x.type === "text" || x.type === "mcq" || x.type === "open")) {
      if (!b.meta?.source) continue;
      expect(b.layout.x).toBe(geo.content.x);
      expect(b.layout.width).toBe(geo.content.width);
    }
  });

  it("gives the copies new ids, linked to the blocks they come from, and leaves the exam alone", () => {
    const copies = doc.blocks.filter((b) => b.meta?.source && b.type !== "mark" && b.type !== "rule");
    expect(copies.every((c) => exam.blocks.some((o) => o.id === c.meta!.source!.id) && !exam.blocks.some((o) => o.id === c.id))).toBe(true);
    expect(exam.blocks.find((b) => b.type === "mcq")!.layout.width).toBeGreaterThan(geo.content.width);
  });

  it("narrows a picture in proportion, and centers it", () => {
    const image = doc.blocks.find((b) => b.type === "image")!;
    expect(image.layout.width).toBe(Math.min(600, geo.content.width));
    expect(image.layout.height).toBeCloseTo(image.layout.width / 2, 5);
    expect(image.layout.x).toBeCloseTo(geo.content.x + (geo.content.width - image.layout.width) / 2, 5);
  });

  it("puts a mark level with the question, one for each sub-question of an open question", () => {
    const marks = marksOf(doc);
    const q = doc.blocks.find((b) => b.type === "mcq")!;
    const m = marks.find((x) => x.meta?.source?.id === exam.blocks[2].id)!;
    expect(m.layout.y + m.layout.height / 2).toBeGreaterThan(q.layout.y);
    expect(m.layout.y + m.layout.height / 2).toBeLessThan(q.layout.y + 40);
    const open = marks.filter((x) => x.meta?.source?.id === exam.blocks[3].id && x.kind === "number");
    expect(open.map((x) => [x.value, x.meta?.source?.part])).toEqual([[1, 0], [1.5, 1]]);
    expect(open[1].layout.y).toBeGreaterThan(open[0].layout.y);
  });

  it("numbers the copied questions as the exam does, so a question keeps its number", () => {
    const n = questionNumbers(doc.blocks, doc.pages);
    const numbers = questionNumbers(exam.blocks, exam.pages);
    for (const q of exam.blocks.filter((b) => b.type === "mcq" || b.type === "open")) {
      const copy = doc.blocks.find((b) => b.meta?.source?.id === q.id && b.type === q.type)!;
      expect(n.get(copy.id)).toBe(numbers.get(q.id));
    }
  });

  it("closes the row of each question with a line, and adds up to the points", () => {
    expect(rulesOf(doc)).toHaveLength(2);
    expect(sheetScores(doc).total).toBe(1 + 2.5);
  });
});

describe("questions in a text box", () => {
  const box = put(createBlock("textbox", "fr", "e1", { text: "", width: 500, height: 80 }), 100);
  const inner = { ...mcq(0, 1), meta: { slot: box.id } } as Block;
  const withSlot = {
    ...box,
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Voici :" }] }, { type: "blockSlot", attrs: { blockId: inner.id, h: 80 } }, { type: "paragraph" }] },
    text: "Voici :",
  } as Block;
  const exam = examOf([withSlot, inner]);

  it("lists such a question like any other in a sheet of the answers", () => {
    const d = sheetDoc(exam, generateCorrection(exam, { template: "answers", paper: "bordered", marks: true }));
    expect(by(d, inner.id)).toHaveLength(1);
    expect(marksOf(d).filter((m) => m.kind === "number").map((m) => m.value)).toEqual([1]);
  });

  it("copies the box with copies of the questions in it, and puts the marks beside them", () => {
    const out = generateCorrection(exam, { template: "copy", paper: "bordered", marks: true });
    const d = sheetDoc(exam, out);
    const boxCopy = d.blocks.find((b) => b.type === "textbox")!;
    const innerCopy = d.blocks.find((b) => b.type === "mcq")!;
    expect(innerCopy.meta?.slot).toBe(boxCopy.id);
    expect(innerCopy.id).not.toBe(inner.id);
    expect(innerCopy.layout.y).toBeGreaterThan(boxCopy.layout.y);
    const m = marksOf(d)[0];
    expect(m.layout.y + 12).toBeGreaterThan(innerCopy.layout.y);
    expect(m.layout.y + 12).toBeLessThan(innerCopy.layout.y + 40);
    expect(sheetScores(d).total).toBe(1);
    // the exam's own question stays in the exam's own box
    expect(exam.blocks.filter((b) => b.meta?.slot === box.id)).toHaveLength(1);
  });
});

describe("putting more questions in a sheet", () => {
  const exam = standard();
  const out = generateCorrection(exam, { template: "answers", paper: "bordered", marks: true });
  const sheet = sheetDoc(exam, out);

  it("adds the questions that are not in the sheet, after what it has, with their marks and their line", () => {
    const fresh = trueFalse(900);
    const grown = { ...exam, blocks: [...exam.blocks, fresh] };
    const next = addQuestions(grown, sheet, "answers", [fresh.id], true);
    expect(by(next, fresh.id).filter((b) => b.type === "text")).toHaveLength(1);
    expect(marksOf(next).filter((m) => m.meta?.source?.id === fresh.id && m.kind === "number").map((m) => m.value)).toEqual([2]);
    expect(rulesOf(next).filter((r) => r.meta?.source?.id === fresh.id)).toHaveLength(1);
    const added = by(next, fresh.id)[0];
    const lowestBefore = Math.max(...sheet.blocks.filter((b) => b.layout.pageId === added.layout.pageId).map((b) => b.layout.y + blockHeight(b, 1, fr)));
    expect(added.layout.y).toBeGreaterThanOrEqual(lowestBefore - 0.01);
    // (what was there is untouched)
    for (const b of sheet.blocks.filter((x) => x.type === "text")) expect(next.blocks.find((x) => x.id === b.id)).toEqual(b);
    expect(sheetScores(next).total).toBe(sheetScores(sheet).total + 2);
  });

  it("brings the heading of an exercise the sheet does not have yet", () => {
    const heading = text("Exercice 3", "heading", 1000);
    const fresh = mcq(1040, 1);
    const grown = { ...exam, blocks: [...exam.blocks, heading, fresh] };
    const next = addQuestions(grown, sheet, "answers", [fresh.id], true);
    expect(by(next, heading.id)).toHaveLength(1);
    expect(by(next, fresh.id).length).toBeGreaterThan(0);
  });

  it("goes on a new page when the last one is full", () => {
    const many = examOf(Array.from({ length: 24 }, (_, i) => open(60 + i * 40, { answer: "Une réponse assez longue. ".repeat(6), points: 1 })));
    const o = generateCorrection(many, { template: "answers", paper: "bordered", marks: true });
    const d = sheetDoc(many, o);
    const fresh = open(2000, { answer: "Encore. ".repeat(100), points: 1 });
    const next = addQuestions({ ...many, blocks: [...many.blocks, fresh] }, d, "answers", [fresh.id], true);
    expect(next.pages.length).toBeGreaterThanOrEqual(d.pages.length);
    expect(by(next, fresh.id).length).toBeGreaterThan(0);
  });

  it("changes nothing when there is nothing to add", () => {
    expect(addQuestions(exam, sheet, "answers", [], true)).toBe(sheet);
  });

  it("knows what the sheet was made from: the questions and headings of the exam in reading order", () => {
    expect(questionsAndHeadings(exam).map((b) => b.id)).toEqual(exam.blocks.map((b) => b.id));
    const by2 = sourcesOf(sheet.blocks);
    expect([...by2.keys()].sort()).toEqual(exam.blocks.map((b) => b.id).sort());
  });
});

describe("nothing breaks on an exam with nothing in it", () => {
  it("makes a sheet with its title", () => {
    const empty = examOf([]);
    for (const template of ["answers", "copy"] as const) {
      const out = generateCorrection(empty, { template, paper: "bordered", marks: true });
      expect(out.pages).toHaveLength(1);
      expect(out.blocks.filter((b) => b.type === "text")).toHaveLength(1);
      expect(out.blocks.some((b) => b.type === "mark" || b.type === "rule")).toBe(false);
    }
  });

  it("gives every block a place on the paper", () => {
    const exam = standard();
    for (const template of ["answers", "copy"] as const) {
      const out = generateCorrection(exam, { template, paper: "bordered", marks: true });
      for (const b of out.blocks) {
        expect(Number.isFinite(b.layout.x) && Number.isFinite(b.layout.y) && Number.isFinite(b.layout.width)).toBe(true);
        expect(b.layout.y).toBeGreaterThanOrEqual(0);
        expect(b.layout.y).toBeLessThan(A4.height);
      }
    }
  });
});
