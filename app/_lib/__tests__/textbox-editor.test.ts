import { getSchema, type JSONContent } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { docParagraphs, richFromDoc, type DocParagraph } from "../textboxDoc";
import { changeCaseTr, clearAllTr, paragraphAttrsTr, pasteParagraphsTr, selectionParagraphs, sortParagraphsTr, textboxExtensions } from "../textboxEditor";

const schema = getSchema(textboxExtensions());

const text = (t: string, marks: { type: string; attrs?: Record<string, unknown> }[] = []): JSONContent => ({ type: "text", text: t, ...(marks.length ? { marks } : {}) });
const p = (content: JSONContent[] | string, attrs: Record<string, unknown> = {}): JSONContent => ({ type: "paragraph", attrs, content: typeof content === "string" ? (content ? [text(content)] : []) : content });
const doc = (...paragraphs: JSONContent[]): JSONContent => ({ type: "doc", content: paragraphs });

// A state with the selection between two document positions (a paragraph "ab" is at 1..3 from the start of the document).
function stateOf(json: JSONContent, from?: number, to?: number): EditorState {
  const d = schema.nodeFromJSON(json);
  const base = EditorState.create({ schema, doc: d });
  if (from === undefined) return base;
  return base.apply(base.tr.setSelection(TextSelection.create(d, from, to ?? from)));
}
const apply = (state: EditorState, tr: ReturnType<typeof changeCaseTr>) => (tr ? state.apply(tr) : state);
const json = (s: EditorState) => s.doc.toJSON() as JSONContent;
const rich = (s: EditorState) => richFromDoc(json(s));
const bold = (s: string) => `⁅b⁆${s}⁅/⁆`;

describe("the schema of the text box editor", () => {
  it("has subscript and superscript, and a word is never both", () => {
    expect(schema.marks.subscript).toBeDefined();
    expect(schema.marks.superscript).toBeDefined();
    const s = stateOf(doc(p("x2")), 2, 3);
    const sup = s.apply(s.tr.addMark(2, 3, schema.marks.superscript.create()));
    expect(rich(sup)).toBe("x⁅sup⁆2⁅/⁆");
    const sub = sup.apply(sup.tr.addMark(2, 3, schema.marks.subscript.create()));
    expect(rich(sub)).toBe("x⁅sub⁆2⁅/⁆");
  });

  it("has the paragraph attributes, with defaults that mean nothing is set", () => {
    const attrs = schema.nodes.paragraph.create().attrs;
    expect(attrs).toMatchObject({ list: null, dir: null, lineHeight: null, spaceBefore: null, spaceAfter: null, shading: null, border: null, borderColor: null, indent: 0 });
  });
});

describe("paragraph attributes", () => {
  it("are set on every paragraph the selection touches, and only those", () => {
    const s = stateOf(doc(p("one"), p("two"), p("three")), 2, 7); // from inside the first to inside the second
    const next = apply(s, paragraphAttrsTr(s, { list: "decimal", spaceAfter: 6 }));
    expect(docParagraphs(json(next)).map((q) => [q.list, q.spaceAfter])).toEqual([["decimal", 6], ["decimal", 6], [undefined, 0]]);
  });

  it("act on the paragraph with the cursor when nothing is selected", () => {
    const s = stateOf(doc(p("one"), p("two")), 6);
    const next = apply(s, paragraphAttrsTr(s, { dir: "rtl" }));
    expect(docParagraphs(json(next)).map((q) => q.dir)).toEqual([undefined, "rtl"]);
  });

  it("take a format off with null, undefined or an empty string", () => {
    const s = stateOf(doc(p("a", { list: "bullet", shading: "#fef08a" })), 1);
    const next = apply(s, paragraphAttrsTr(s, { list: null, shading: undefined }));
    expect(docParagraphs(json(next))[0]).toMatchObject({ indent: 0 });
    expect(docParagraphs(json(next))[0].list).toBeUndefined();
    expect(docParagraphs(json(next))[0].shading).toBeUndefined();
  });

  it("are not a change when they already are what is asked", () => {
    const s = stateOf(doc(p("a", { list: "bullet" })), 1);
    expect(paragraphAttrsTr(s, { list: "bullet" })).toBeNull();
    expect(paragraphAttrsTr(s, { dir: null })).toBeNull();
  });
});

describe("changing case in a text box", () => {
  it("changes the selected letters and keeps the marks of each", () => {
    const s = stateOf(doc(p([text("ab "), text("cd", [{ type: "bold" }]), text(" ef")])), 2, 8); // "b cd e"
    const next = apply(s, changeCaseTr(s, "upper"));
    expect(rich(next)).toBe(`aB ${bold("CD")} Ef`);
  });

  it("keeps the selection on the same text, also when a letter becomes two", () => {
    const s = stateOf(doc(p("aßb")), 1, 4);
    const next = apply(s, changeCaseTr(s, "upper"));
    expect(rich(next)).toBe("ASSB");
    expect(next.selection.from).toBe(1);
    expect(next.selection.to).toBe(5);
  });

  it("changes the word around the cursor when nothing is selected", () => {
    const s = stateOf(doc(p("le chat noir")), 6); // inside "chat"
    expect(rich(apply(s, changeCaseTr(s, "upper")))).toBe("le CHAT noir");
    expect(rich(apply(s, changeCaseTr(s, "title")))).toBe("le Chat noir");
    const between = stateOf(doc(p("a  b")), 3); // between two spaces: no word
    expect(changeCaseTr(between, "upper")).toBeNull();
  });

  it("starts every sentence with a capital across the paragraphs and styles it spans", () => {
    const s = stateOf(doc(p([text("THE SPEED. "), text("IT IS", [{ type: "italic" }]), text(" FAST")]), p("NEW PARAGRAPH")), 1, 37);
    const next = apply(s, changeCaseTr(s, "sentence"));
    expect(rich(next)).toBe(`The speed. ⁅i⁆It is⁅/⁆ fast\nNew paragraph`);
  });

  it("is nothing when the text already is in that case", () => {
    const s = stateOf(doc(p("ABC")), 1, 4);
    expect(changeCaseTr(s, "upper")).toBeNull();
  });

  it("goes through line breaks inside a paragraph", () => {
    const d = doc({ type: "paragraph", content: [text("ab"), { type: "hardBreak" }, text("cd")] });
    const s = stateOf(d, 1, 6);
    expect(rich(apply(s, changeCaseTr(s, "upper")))).toBe("AB\nCD");
  });
});

describe("clearing all formatting", () => {
  it("takes the marks off the selected words, and the formatting off their paragraphs", () => {
    const s = stateOf(doc(p([text("ab", [{ type: "bold" }, { type: "subscript" }])], { list: "bullet", indent: 2, textAlign: "center", dir: "rtl", spaceAfter: 6 }), p("keep", { list: "bullet" })), 1, 3);
    const next = s.apply(clearAllTr(s));
    const [first, second] = docParagraphs(json(next));
    expect(first.runs.map((r) => r.style)).toEqual([{}]);
    expect(first).toMatchObject({ indent: 0, spaceAfter: 0 });
    expect(first.list).toBeUndefined();
    expect(first.align).toBeUndefined();
    expect(first.dir).toBeUndefined();
    expect(second.list).toBe("bullet"); // (the other paragraph is not touched)
  });

  it("only clears the paragraph when there is a cursor, and what is typed next", () => {
    const s = stateOf(doc(p([text("ab", [{ type: "bold" }])], { list: "decimal" })), 2);
    const next = s.apply(clearAllTr(s));
    expect(docParagraphs(json(next))[0].list).toBeUndefined();
    expect(rich(next)).toBe(bold("ab")); // (the words are untouched: nothing was selected)
    expect(next.storedMarks).toEqual([]);
  });
});

describe("sorting paragraphs", () => {
  const names = doc(p("Zoé"), p("élève"), p("Abdel", { list: "bullet" }), p("10"), p("9"));

  it("puts all the paragraphs in order when nothing (or one paragraph) is selected, numbers as numbers", () => {
    const s = stateOf(names, 2);
    const next = apply(s, sortParagraphsTr(s, "asc", "fr"));
    expect(docParagraphs(json(next)).map((q) => q.runs.map((r) => r.text).join(""))).toEqual(["9", "10", "Abdel", "élève", "Zoé"]);
    // the formatting stays with its paragraph
    expect(docParagraphs(json(next))[2].list).toBe("bullet");
  });

  it("goes the other way", () => {
    const s = stateOf(names, 2);
    const next = apply(s, sortParagraphsTr(s, "desc", "fr"));
    expect(docParagraphs(json(next)).map((q) => q.runs.map((r) => r.text).join(""))).toEqual(["Zoé", "élève", "Abdel", "10", "9"].sort((a, b) => b.localeCompare(a, "fr", { numeric: true, sensitivity: "base" })));
  });

  it("only sorts the selected paragraphs when it spans several", () => {
    // b, c, a, z, y: from inside c to inside z
    const letters = doc(p("b"), p("c"), p("a"), p("z"), p("y"));
    const s = stateOf(letters, 4, 10);
    const next = apply(s, sortParagraphsTr(s, "asc", "fr"));
    expect(docParagraphs(json(next)).map((q) => q.runs[0].text)).toEqual(["b", "a", "c", "z", "y"]);
  });

  it("does nothing for one paragraph, or for what is already in order", () => {
    expect(sortParagraphsTr(stateOf(doc(p("a")), 1), "asc", "fr")).toBeNull();
    expect(sortParagraphsTr(stateOf(doc(p("a"), p("b")), 1), "asc", "fr")).toBeNull();
  });

  it("sorts Arabic words with the Arabic collation", () => {
    const s = stateOf(doc(p("ج"), p("أ"), p("ب")), 1);
    const next = apply(s, sortParagraphsTr(s, "asc", "ar"));
    expect(docParagraphs(json(next)).map((q) => q.runs[0].text)).toEqual(["أ", "ب", "ج"]);
  });
});

describe("copying and pasting paragraphs", () => {
  const para = (t: string, extra: Partial<DocParagraph> = {}, style = {}): DocParagraph => ({ runs: [{ text: t, style }], indent: 0, spaceBefore: 0, spaceAfter: 0, ...extra });

  it("copies the selected words with their marks and paragraphs with their formatting (the ends may be partial)", () => {
    // "ab cd" (cd bold, a bullet) then "efg": from before the b to after the f
    const s = stateOf(doc(p([text("ab "), text("cd", [{ type: "bold" }])], { list: "bullet" }), p("efg")), 2, 10);
    const [first, second] = selectionParagraphs(s);
    expect(first.runs.map((r) => [r.text, r.style])).toEqual([["b ", {}], ["cd", { b: true }]]);
    expect(first.list).toBe("bullet");
    expect(second.runs.map((r) => r.text)).toEqual(["ef"]);
    expect(selectionParagraphs(stateOf(doc(p("abc")), 2))).toEqual([]); // (a cursor copies nothing)
  });

  it("pastes words into the text around the cursor", () => {
    const s = stateOf(doc(p("ab")), 2);
    const next = apply(s, pasteParagraphsTr(s, [para("XY", {}, { b: true })]));
    expect(rich(next)).toBe(`a${bold("XY")}b`);
  });

  it("pastes several paragraphs: the first joins the text before, the last the text after, the others come whole", () => {
    const s = stateOf(doc(p("ab")), 2);
    const next = apply(s, pasteParagraphsTr(s, [para("1"), para("mid", { list: "bullet" }), para("2")]));
    expect(docParagraphs(json(next)).map((q) => q.runs.map((r) => r.text).join(""))).toEqual(["a1", "mid", "2b"]);
    expect(docParagraphs(json(next))[1].list).toBe("bullet");
  });

  it("replaces the selection", () => {
    const s = stateOf(doc(p("abcd")), 2, 4);
    expect(rich(apply(s, pasteParagraphsTr(s, [para("X")])))).toBe("aXd");
  });

  it("keeps the formatting of the first paragraph when it lands on an empty one", () => {
    const s = stateOf(doc(p("")), 1);
    const next = apply(s, pasteParagraphsTr(s, [para("one", { list: "decimal", indent: 1 }), para("two")]));
    const [a, b] = docParagraphs(json(next));
    expect(a).toMatchObject({ list: "decimal", indent: 1 });
    expect(a.runs[0].text).toBe("one");
    expect(b.list).toBeUndefined();
  });

  it("is nothing for nothing", () => {
    const s = stateOf(doc(p("ab")), 2);
    expect(pasteParagraphsTr(s, [])).toBeNull();
    expect(pasteParagraphsTr(s, [{ runs: [], indent: 0, spaceBefore: 0, spaceAfter: 0 }])).toBeNull();
  });
});
