import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { blockHeight, blockRtl, layoutText, layoutTextbox, textboxPad } from "../blockLayout";
import { LIST_GAP } from "../lists";
import { measureText, wrapRich, type TextFont } from "../measure";
import { SCRIPT_SCALE } from "../richText";
import { docFromParagraphs, docFromRich, docParagraphs, setParagraphs } from "../textboxDoc";
import { INDENT_PX } from "../tiptap-indent";
import type { ExamMeta, TextBlock, TextboxBlock } from "../types";

const fr: ExamMeta = { title: "t", lang: "fr", templateId: "x" };
const ar: ExamMeta = { ...fr, lang: "ar" };
const layout = { pageId: "p", x: 0, y: 0, width: 300, height: 100 };

const box = (content: JSONContent, extra: Partial<TextboxBlock> = {}): TextboxBlock => ({ id: "b", type: "textbox", text: "", content, layout, ...extra });
const para = (text: string, attrs: Record<string, unknown> = {}): JSONContent => ({ type: "paragraph", attrs, ...(text ? { content: [{ type: "text", text }] } : {}) });
const doc = (...paragraphs: JSONContent[]): JSONContent => ({ type: "doc", content: paragraphs });
const textBlock = (text: string, extra: Partial<TextBlock> = {}): TextBlock => ({ id: "t", type: "text", style: "body", text, layout: { ...layout, width: 400 }, ...extra });

const base: TextFont = { family: "Arial", size: 20, bold: false, italic: false, underline: false, color: "#000" };

describe("wrapping subscripts and superscripts", () => {
  it("makes them smaller (and narrower), lowering or raising from the size of the text around them", () => {
    const [line] = wrapRich("H⁅sub⁆2⁅/⁆O m/s⁅sup⁆2⁅/⁆", 1000, base, 28);
    expect(line.pieces.map((p) => p.text)).toEqual(["H", "2", "O m/s", "2"]);
    const [h, two, rest, sq] = line.pieces;
    expect(h.font.script).toBeUndefined();
    expect(two.font).toMatchObject({ script: "sub", scriptBase: 20, size: 20 * SCRIPT_SCALE });
    expect(rest.font.script).toBeUndefined();
    expect(sq.font).toMatchObject({ script: "sup", scriptBase: 20 });
    expect(two.width).toBeCloseTo(measureText("2", { ...base, size: 20 * SCRIPT_SCALE }), 9);
    expect(two.width).toBeLessThan(measureText("2", base));
    expect(line.size).toBe(20); // (a script does not make the line taller)
    expect(line.height).toBe(28);
  });

  it("takes the size of a script from the size the word has (a big formula)", () => {
    const [line] = wrapRich("⁅s=40;sup⁆2⁅/⁆", 1000, base, 28);
    expect(line.pieces[0].font).toMatchObject({ script: "sup", scriptBase: 40, size: 40 * SCRIPT_SCALE });
  });

  it("is the same as before for a text without them", () => {
    const [line] = wrapRich("plain ⁅b⁆bold⁅/⁆ text", 1000, base, 28);
    expect(line.pieces.map((p) => p.font.script)).toEqual([undefined, undefined, undefined]);
    expect(line.pieces.every((p) => !("scriptBase" in p.font))).toBe(true);
  });

  it("does not merge a script with the text before it", () => {
    const [line] = wrapRich("x⁅sub⁆1⁅/⁆", 1000, base, 28);
    expect(line.pieces).toHaveLength(2);
    expect(wrapRich("x⁅sub⁆1⁅/⁆⁅sub⁆2⁅/⁆", 1000, base, 28)[0].pieces).toHaveLength(2); // (two scripts in a row are one piece)
  });
});

describe("a text box with plain paragraphs", () => {
  it("lays them out one after the other, from the padding, as before", () => {
    const b = box(doc(para("one"), para("two")));
    const L = layoutTextbox(b, fr);
    const pad = textboxPad(b);
    expect(L.paragraphs.map((p) => [p.x, p.width, p.rtl])).toEqual([[pad, 300 - 2 * pad, false], [pad, 300 - 2 * pad, false]]);
    expect(L.paragraphs[0].y).toBe(0);
    expect(L.paragraphs[1].y).toBe(L.paragraphs[0].lines[0].height);
    expect(L.paragraphs.every((p) => !p.marker && !p.box)).toBe(true);
  });

  it("reads an empty box and a box made from a styled text", () => {
    expect(layoutTextbox(box(doc()), fr).paragraphs).toHaveLength(1);
    expect(layoutTextbox(box({ type: "doc", content: [] }), fr).content).toBeGreaterThan(0);
    const older: TextboxBlock = { id: "o", type: "textbox", text: "a\nb", layout };
    expect(layoutTextbox(older, fr).paragraphs).toHaveLength(2);
  });
});

describe("indent, direction and spacing in a text box", () => {
  it("indents from the start side: the left in French, the right in Arabic", () => {
    const b = box(doc(para("x", { indent: 2 })));
    const pad = textboxPad(b);
    const f = layoutTextbox(b, fr).paragraphs[0];
    expect(f.x).toBe(pad + 2 * INDENT_PX);
    expect(f.width).toBe(300 - 2 * pad - 2 * INDENT_PX);
    const a = layoutTextbox(b, ar).paragraphs[0];
    expect(a.x).toBe(pad); // (the text is still against the left edge of its area; it ends 48 px before the right one)
    expect(a.width).toBe(300 - 2 * pad - 2 * INDENT_PX);
    expect(a.rtl).toBe(true);
  });

  it("takes the direction of the paragraph, else of the box, else of the exam", () => {
    const d = doc(para("a"), para("b", { dir: "rtl" }), para("c", { dir: "ltr" }));
    expect(layoutTextbox(box(d), fr).paragraphs.map((p) => p.rtl)).toEqual([false, true, false]);
    expect(layoutTextbox(box(d), ar).paragraphs.map((p) => p.rtl)).toEqual([true, true, false]);
    expect(layoutTextbox(box(d, { dir: "rtl" }), fr).paragraphs.map((p) => p.rtl)).toEqual([true, true, false]);
    expect(blockRtl({}, fr)).toBe(false);
    expect(blockRtl({}, ar)).toBe(true);
    expect(blockRtl({ dir: "ltr" }, ar)).toBe(false);
  });

  it("adds the space before and after a paragraph", () => {
    const plain = layoutTextbox(box(doc(para("a"), para("b"))), fr);
    const spaced = layoutTextbox(box(doc(para("a", { spaceAfter: 6 }), para("b", { spaceBefore: 4 }))), fr);
    expect(spaced.paragraphs[1].y - plain.paragraphs[1].y).toBe(10);
    expect(spaced.content - plain.content).toBe(10);
  });

  it("gives a paragraph a line spacing of its own, in place of the box's", () => {
    const b = box(doc(para("a", { lineHeight: 2 }), para("b")), { font: { lineHeight: 1.5 } });
    const [a, c] = layoutTextbox(b, fr).paragraphs;
    expect(a.lines[0].height).toBe(Math.round(14 * (20 / 14) * 2));
    expect(c.lines[0].height).toBe(Math.round(14 * (20 / 14) * 1.5));
  });
});

describe("lists in a text box", () => {
  const items = doc(para("one", { list: "decimal" }), para("two", { list: "decimal" }), para("plain"), para("three", { list: "decimal" }));

  it("puts a marker in front of each item, and a gap before its text", () => {
    const L = layoutTextbox(box(items), fr);
    const pad = textboxPad(box(items));
    expect(L.paragraphs.map((p) => p.marker?.line.pieces[0].text)).toEqual(["1.", "2.", undefined, "1."]);
    const first = L.paragraphs[0];
    expect(first.marker?.x).toBe(pad);
    expect(first.x).toBeGreaterThanOrEqual(pad + LIST_GAP);
    expect(first.x - pad).toBe(L.paragraphs[1].x - pad); // (the texts line up)
    expect(L.paragraphs[2].x).toBe(pad); // (the paragraph that is not an item is not pushed)
    expect(first.marker?.y).toBe(first.y);
  });

  it("puts the marker on the right in Arabic, with the text ending before it", () => {
    const b = box(doc(para("أ", { list: "bullet" })));
    const pad = textboxPad(b);
    const p = layoutTextbox(b, ar).paragraphs[0];
    const m = p.marker!;
    expect(m.x + m.width).toBeCloseTo(300 - pad, 9);
    expect(p.x).toBe(pad);
    expect(p.x + p.width).toBeLessThanOrEqual(m.x);
  });

  it("indents a deeper item and gives it another marker", () => {
    const b = box(doc(para("a", { list: "multi" }), para("b", { list: "multi", indent: 1 }), para("c", { list: "multi", indent: 1 })));
    const L = layoutTextbox(b, fr);
    expect(L.paragraphs.map((p) => p.marker?.line.pieces[0].text)).toEqual(["1.", "a.", "b."]);
    expect(L.paragraphs[1].marker!.x).toBe(textboxPad(b) + INDENT_PX);
    expect(L.paragraphs[1].x).toBeGreaterThan(L.paragraphs[0].x);
  });

  it("makes its own room for a long marker", () => {
    const many = doc(...Array.from({ length: 12 }, (_, i) => para(`item ${i}`, { list: "lower-roman" })));
    const L = layoutTextbox(box(many), fr);
    const pad = textboxPad(box(many));
    expect(L.paragraphs[7].marker?.line.pieces[0].text).toBe("viii.");
    expect(L.paragraphs[7].x - pad).toBeGreaterThanOrEqual(L.paragraphs[7].marker!.width);
  });

  it("writes the marker in the font its item starts with (a big first word, a colored one)", () => {
    const b = box({ type: "doc", content: [{ type: "paragraph", attrs: { list: "bullet" }, content: [{ type: "text", text: "Big", marks: [{ type: "textStyle", attrs: { fontSize: "30px", color: "#dc2626" } }] }] }] });
    const m = layoutTextbox(b, fr).paragraphs[0].marker!;
    expect(m.line.pieces[0].font).toMatchObject({ size: 30, color: "#dc2626", underline: false });
  });
});

describe("shading and borders in a text box", () => {
  it("draws a box behind a shaded or bordered paragraph, around the text", () => {
    const b = box(doc(para("a", { shading: "#fef08a" }), para("b", { border: "tb", borderColor: "#111827" }), para("c")));
    const [a, c, d] = layoutTextbox(b, fr).paragraphs;
    expect(a.box).toMatchObject({ shading: "#fef08a" });
    expect(a.box?.border).toBeUndefined();
    expect(c.box).toMatchObject({ border: "tb", borderColor: "#111827" });
    expect(d.box).toBeUndefined();
    expect(a.box!.y).toBeLessThan(a.y);
    expect(a.box!.height).toBeGreaterThan(a.lines[0].height);
    expect(a.box!.x).toBeLessThanOrEqual(textboxPad(b));
  });
});

describe("a text block", () => {
  it("is laid out as before when it has none of the new formatting", () => {
    const L = layoutText(textBlock("one two three"), fr);
    expect(L.markers).toEqual([]);
    expect(L.box).toBeNull();
    expect(L.rtl).toBe(false);
    expect(L.x).toBe(10);
    expect(L.width).toBe(400 - 20);
  });

  it("indents from the start side", () => {
    const f = layoutText(textBlock("x", { indent: 2 }), fr);
    expect([f.x, f.width]).toEqual([10 + 2 * INDENT_PX, 380 - 2 * INDENT_PX]);
    const a = layoutText(textBlock("x", { indent: 2 }), ar);
    expect([a.x, a.width]).toEqual([10, 380 - 2 * INDENT_PX]);
  });

  it("turns each line into an item of its list", () => {
    const b = textBlock("one\ntwo\nthree", { list: "decimal" });
    const L = layoutText(b, fr);
    expect(L.markers.map((m) => m.line.pieces[0].text)).toEqual(["1.", "2.", "3."]);
    expect(L.text.lines).toHaveLength(3);
    expect(L.x).toBeGreaterThanOrEqual(10 + LIST_GAP);
    expect(L.markers.map((m) => m.y)).toEqual([L.text.y, L.text.y + 20, L.text.y + 40]);
    expect(L.markers[0].x).toBe(10);
    // the height is that of the lines, as for a text without a list
    expect(blockHeight(b, 1, fr)).toBe(blockHeight(textBlock("one\ntwo\nthree"), 1, fr));
  });

  it("wraps the items on their own, with the markers at the top of each", () => {
    const long = "word ".repeat(60).trim();
    const L = layoutText(textBlock(`${long}\nshort`, { list: "bullet" }), fr);
    expect(L.text.lines.length).toBeGreaterThan(2);
    const firstItemHeight = L.markers[1].y - L.markers[0].y;
    expect(firstItemHeight).toBeGreaterThan(40);
    expect(L.markers[0].line.pieces[0].text).toBe("•");
  });

  it("puts the markers on the right in Arabic, and takes its own direction", () => {
    const b = textBlock("a\nb", { list: "decimal", dir: "rtl" });
    const L = layoutText(b, fr);
    expect(L.rtl).toBe(true);
    expect(L.markers[0].x + L.markers[0].width).toBeCloseTo(400 - 10, 9);
    expect(L.x).toBe(10);
    expect(layoutText(textBlock("a", { dir: "ltr" }), ar).rtl).toBe(false);
  });

  it("has a box for its shading and border (but not under a decoration of its own)", () => {
    const L = layoutText(textBlock("x", { shading: "#bbf7d0", border: "tblr", borderColor: "#15803d" }), fr);
    expect(L.box).toMatchObject({ shading: "#bbf7d0", border: "tblr", borderColor: "#15803d" });
    expect(L.box!.y).toBeLessThan(L.text.y);
    expect(layoutText(textBlock("x", { shading: "#bbf7d0", decor: "band" }), fr).box).toBeNull();
  });
});

describe("the document of a text box and its paragraphs", () => {
  it("keeps the formatting of each paragraph through a round trip", () => {
    const original = doc(
      para("a", { list: "bullet", indent: 1, dir: "rtl", textAlign: "center", lineHeight: 1.5, spaceBefore: 4, spaceAfter: 8, shading: "#fef08a", border: "tb", borderColor: "#000000" }),
      para("b"),
    );
    const ps = docParagraphs(original);
    expect(ps[0]).toMatchObject({ list: "bullet", indent: 1, dir: "rtl", align: "center", lineHeight: 1.5, spaceBefore: 4, spaceAfter: 8, shading: "#fef08a", border: "tb", borderColor: "#000000" });
    const again = docParagraphs(docFromParagraphs(ps));
    expect(again).toEqual(ps);
  });

  it("keeps the scripts of the words", () => {
    const d = docFromRich("CO⁅sub⁆2⁅/⁆ and m/s⁅sup⁆2⁅/⁆");
    const runs = docParagraphs(d)[0].runs;
    expect(runs.map((r) => [r.text, r.style.sub, r.style.sup])).toEqual([
      ["CO", undefined, undefined],
      ["2", true, undefined],
      [" and m/s", undefined, undefined],
      ["2", undefined, true],
    ]);
  });

  it("sets or clears the formatting of every paragraph", () => {
    const d = doc(para("a"), para("b", { list: "bullet" }));
    const listed = setParagraphs(d, { list: "decimal", spaceAfter: 6 });
    expect(docParagraphs(listed).map((p) => [p.list, p.spaceAfter])).toEqual([["decimal", 6], ["decimal", 6]]);
    const cleared = setParagraphs(listed, { list: undefined, spaceAfter: "" });
    expect(docParagraphs(cleared).map((p) => [p.list, p.spaceAfter])).toEqual([[undefined, 0], [undefined, 0]]);
    const each = setParagraphs(d, (p, i) => ({ indent: i + p.indent + 1 }));
    expect(docParagraphs(each).map((p) => p.indent)).toEqual([1, 2]);
  });
});
