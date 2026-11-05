import { describe, expect, it } from "vitest";
import { createBlock } from "../blocks";
import { createCorrection, dropCorrection, hasSheet, mergeView, partChanged, readCorrection, viewOf } from "../sheet/part";
import { defaultSheet } from "../sheet/model";
import type { Block, ExamDoc } from "../types";

const text = (id: string, pageId: string): Block => ({ ...createBlock("text", "fr", pageId, { text: id, style: "body" }), id });

const exam = (): ExamDoc => ({
  version: 1,
  meta: { title: "Devoir", lang: "fr", templateId: "t", fontSize: 14 },
  pages: [{ id: "e1", margins: { top: 40, right: 40, bottom: 40, left: 40 }, format: { size: "A5", orientation: "landscape" } }, { id: "e2" }],
  blocks: [text("q1", "e1"), text("q2", "e2")],
});

describe("the exam and its correction sheet, in one file", () => {
  it("starts with an empty sheet of one page like the first page of the exam, on the paper chosen, with no header and no footer", () => {
    const d = createCorrection(exam(), "bordered");
    expect(hasSheet(d)).toBe(true);
    const c = d.correction!;
    expect(c.pages).toHaveLength(1);
    expect(c.pages[0].id).not.toBe("e1");
    expect(c.pages[0].margins).toEqual({ top: 40, right: 40, bottom: 40, left: 40 });
    expect(c.pages[0].format).toEqual({ size: "A5", orientation: "landscape" });
    expect(c.blocks).toEqual([]);
    expect(c.sheet).toEqual(defaultSheet("fr", "bordered"));
    expect(c.globalHeader?.enabled).toBe(false);
    expect(c.globalFooter?.enabled).toBe(false);
    expect(createCorrection(exam(), "free").correction!.sheet.paper).toBe("free");
    // (the exam itself is untouched)
    expect(d.pages).toEqual(exam().pages);
    expect(d.blocks).toEqual(exam().blocks);
  });

  it("is written in the language of the exam", () => {
    const ar = createCorrection({ ...exam(), meta: { ...exam().meta, lang: "ar" } }, "bordered");
    expect(ar.correction!.sheet.answerTitle).toBe("عناصر الإجابة");
  });

  it("shows the exam as it is, or the sheet as a document of its own with the exam's settings", () => {
    const d = createCorrection(exam(), "bordered");
    expect(viewOf(d, "exam")).toBe(d);
    const view = viewOf(d, "sheet");
    expect(view.pages).toBe(d.correction!.pages);
    expect(view.blocks).toBe(d.correction!.blocks);
    expect(view.meta).toBe(d.meta);
    expect(view.sheet).toBe(d.correction!.sheet);
    expect(view.correction).toBeUndefined();
    // (no sheet yet: the exam, whatever is asked)
    const plain = exam();
    expect(viewOf(plain, "sheet")).toBe(plain);
  });

  it("puts back what was changed in the sheet, and leaves the exam alone", () => {
    const d = createCorrection(exam(), "bordered");
    const view = viewOf(d, "sheet");
    const added = text("note", view.pages[0].id);
    const next = mergeView(d, { ...view, blocks: [added] }, "sheet");
    expect(next.correction!.blocks).toEqual([added]);
    expect(next.blocks).toBe(d.blocks);
    expect(next.pages).toBe(d.pages);
    expect(next.correction!.sheet).toBe(d.correction!.sheet);
    // a change of the paper
    const wide = { ...view.sheet!, pad: true };
    expect(mergeView(d, { ...view, sheet: wide }, "sheet").correction!.sheet.pad).toBe(true);
    // a change of the settings they share goes to the exam
    const bold = mergeView(d, { ...view, meta: { ...view.meta, fontSize: 20 } }, "sheet");
    expect(bold.meta.fontSize).toBe(20);
    expect(bold.correction!.blocks).toBe(d.correction!.blocks);
  });

  it("returns the very same file when nothing changed in the view", () => {
    const d = createCorrection(exam(), "bordered");
    expect(mergeView(d, viewOf(d, "sheet"), "sheet")).toBe(d);
  });

  it("takes a changed exam as it is", () => {
    const d = createCorrection(exam(), "bordered");
    const changed = { ...d, blocks: [] };
    expect(mergeView(d, changed, "exam")).toBe(changed);
    expect(changed.correction).toBe(d.correction);
  });

  it("says which part a step of the undo touched", () => {
    const d = createCorrection(exam(), "bordered");
    const sheetChanged = mergeView(d, { ...viewOf(d, "sheet"), blocks: [text("x", d.correction!.pages[0].id)] }, "sheet");
    expect(partChanged(d, sheetChanged)).toBe("sheet");
    expect(partChanged(sheetChanged, d)).toBe("sheet");
    expect(partChanged(d, { ...d, blocks: [] })).toBe("exam");
    expect(partChanged(d, { ...d, pages: [...d.pages, { id: "e3" }] })).toBe("exam");
    // both, or only what they share: it stays where it is
    expect(partChanged(d, { ...sheetChanged, blocks: [] })).toBeNull();
    expect(partChanged(d, { ...d, meta: { ...d.meta, title: "Autre" } })).toBeNull();
    expect(partChanged(d, d)).toBeNull();
    // making the sheet is a change of the sheet
    const base = exam();
    expect(partChanged(base, createCorrection(base, "bordered"))).toBe("sheet");
  });

  it("throws the sheet away", () => {
    const d = createCorrection(exam(), "bordered");
    const back = dropCorrection(d);
    expect(back.correction).toBeUndefined();
    expect("correction" in back).toBe(false);
    expect(back.blocks).toBe(d.blocks);
    const plain = exam();
    expect(dropCorrection(plain)).toBe(plain);
  });

  it("is read from a file: a sheet that lacks settings gets them, and one that is not a sheet is left out", () => {
    const old = { ...exam(), correction: { pages: [{ id: "c1" }], blocks: [], sheet: { paper: "free", pad: true } } } as unknown as ExamDoc;
    const read = readCorrection(old);
    expect(read.correction!.sheet.paper).toBe("free");
    expect(read.correction!.sheet.pad).toBe(true);
    expect(read.correction!.sheet.marks).toEqual(defaultSheet("fr").marks);
    const broken = { ...exam(), correction: { pages: "no", blocks: null } } as unknown as ExamDoc;
    expect(readCorrection(broken).correction).toBeUndefined();
    const plain = exam();
    expect(readCorrection(plain)).toEqual(plain);
  });

  it("goes through a file as it is (JSON)", () => {
    const d = createCorrection(exam(), "bordered");
    const view = viewOf(d, "sheet");
    const full = mergeView(d, { ...view, blocks: [createBlock("mark", "fr", view.pages[0].id, { kind: "number", value: 0.5 })] }, "sheet");
    const back = readCorrection(JSON.parse(JSON.stringify(full)) as ExamDoc);
    expect(back).toEqual(full);
  });
});
