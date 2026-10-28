import { getSchema } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { measureText, wrapRich, type TextFont } from "../measure";
import { EFFECT_CSS, applyStyle, decodeStyle, encodeStyle, parseRich, patchStyle, runCss, serializeRich, sameStyle, styleAt } from "../richText";
import { docFromParagraphs, docParagraphs, richFromDoc, styleDoc } from "../textboxDoc";
import { textboxExtensions } from "../textboxEditor";

const base: TextFont = { family: "Segoe UI", size: 14, bold: false, italic: false, underline: false, color: "#111827" };
const stack = (f: string) => f;

describe("underline kinds and text effects in the styled text", () => {
  it("are written u=double and fx=glow, and read back", () => {
    expect(encodeStyle({ u: true, ul: "wavy", fx: "shadow" })).toBe("u=wavy;fx=shadow");
    expect(decodeStyle("u=dotted;fx=outline")).toEqual({ u: true, ul: "dotted", fx: "outline" });
    expect(decodeStyle("u")).toEqual({ u: true });
    // (what a reader does not know is left out: an older one keeps the underline)
    expect(decodeStyle("u=zigzag;fx=sparkle")).toEqual({ u: true });
    expect(parseRich("⁅u=double;b⁆x⁅/⁆")).toEqual([{ text: "x", style: { b: true, u: true, ul: "double" } }]);
    expect(serializeRich(parseRich("⁅c=#dc2626;u=double;fx=glow⁆x⁅/⁆"))).toBe("⁅c=#dc2626;u=double;fx=glow⁆x⁅/⁆");
  });

  it("make a different style from a single underline or no effect", () => {
    expect(sameStyle({ u: true }, { u: true, ul: "double" })).toBe(false);
    expect(sameStyle({ u: true, fx: "glow" }, { u: true })).toBe(false);
    expect(sameStyle({ u: true, ul: "double" }, { u: true, ul: "double" })).toBe(true);
  });

  it("go together: a kind is an underline, and no underline has no kind", () => {
    expect(patchStyle({}, { ul: "double" })).toEqual({ u: true, ul: "double" });
    expect(patchStyle({ u: true, ul: "double" }, { ul: null })).toEqual({ u: true }); // back to a single line
    expect(patchStyle({ u: true, ul: "double" }, { u: null })).toEqual({}); // no underline at all
    expect(patchStyle({ u: true }, { u: true, ul: "wavy" })).toEqual({ u: true, ul: "wavy" });
    expect(applyStyle("abc", 1, 2, { ul: "dotted" })).toBe("a⁅u=dotted⁆b⁅/⁆c");
    expect(styleAt("⁅u=dotted⁆ab⁅/⁆", 0, 2)).toEqual({ u: true, ul: "dotted" });
  });

  it("are drawn in the editors with the CSS of the kind and of the effect", () => {
    expect(runCss({ u: true, ul: "wavy" }, stack).textDecoration).toBe("underline wavy");
    expect(runCss({ u: true, x: true, ul: "double" }, stack).textDecoration).toBe("underline line-through double");
    expect(runCss({ u: true }, stack).textDecoration).toBe("underline");
    expect(runCss({ fx: "shadow" }, stack).textShadow).toBe(EFFECT_CSS.shadow.textShadow);
    expect(runCss({ fx: "glow" }, stack).textShadow).toContain("currentColor");
    expect(runCss({ fx: "outline" }, stack)).toMatchObject({ webkitTextStroke: expect.any(String), webkitTextFillColor: "transparent" });
  });
});

describe("the pieces of a line", () => {
  it("carry the kind of underline and the effect of their words, and words of another kind are not joined", () => {
    const [line] = wrapRich("a ⁅u=double⁆b⁅/⁆⁅u=wavy;fx=glow⁆c⁅/⁆", 400, base, 20);
    const fonts = line.pieces.map((p) => [p.text, p.font.underline, p.font.underlineStyle, p.font.effect]);
    expect(fonts).toEqual([
      ["a ", false, undefined, undefined],
      ["b", true, "double", undefined],
      ["c", true, "wavy", "glow"],
    ]);
  });

  it("do not change what a line measures", () => {
    const plain = wrapRich("hello world", 400, base, 20)[0];
    const fancy = wrapRich("⁅u=wavy;fx=shadow⁆hello world⁅/⁆", 400, base, 20)[0];
    expect(fancy.width).toBeCloseTo(plain.width, 6);
    expect(fancy.width).toBeCloseTo(measureText("hello world", base), 6);
  });
});

describe("the text box document", () => {
  const schema = getSchema(textboxExtensions());

  it("has an underline that can have a kind, and an effect that is one at a time", () => {
    expect(schema.marks.underline.create({ style: "double" }).attrs.style).toBe("double");
    expect(schema.marks.underline.create().attrs.style).toBeNull();
    const d = schema.nodeFromJSON({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "ab" }] }] });
    let s = EditorState.create({ schema, doc: d });
    s = s.apply(s.tr.setSelection(TextSelection.create(d, 1, 3)));
    s = s.apply(s.tr.addMark(1, 3, schema.marks.underline.create({ style: "double" })));
    s = s.apply(s.tr.addMark(1, 3, schema.marks.textEffect.create({ kind: "shadow" })));
    s = s.apply(s.tr.addMark(1, 3, schema.marks.textEffect.create({ kind: "glow" }))); // (replaces the shadow)
    expect(richFromDoc(s.doc.toJSON())).toBe("⁅u=double;fx=glow⁆ab⁅/⁆");
  });

  it("goes from the document to the runs and back without losing either", () => {
    const doc = docFromParagraphs([{ runs: [{ text: "x", style: { u: true, ul: "dashed", fx: "outline", b: true } }, { text: "y", style: { u: true } }], indent: 0, spaceBefore: 0, spaceAfter: 0 }]);
    expect(docParagraphs(doc)[0].runs.map((r) => r.style)).toEqual([{ u: true, ul: "dashed", fx: "outline", b: true }, { u: true }]);
    const text = (doc.content?.[0].content ?? []).map((n) => n.marks?.map((m) => m.type).join("+"));
    expect(text).toEqual(["bold+underline+textEffect", "underline"]);
    // (a plain underline is the same JSON as before: older documents read the same)
    expect((doc.content?.[0].content?.[1].marks ?? [])[0]).toEqual({ type: "underline" });
  });

  it("is changed for every word by styleDoc", () => {
    const doc = docFromParagraphs([{ runs: [{ text: "a", style: {} }], indent: 0, spaceBefore: 0, spaceAfter: 0 }]);
    expect(richFromDoc(styleDoc(doc, { ul: "wavy", fx: "glow" }))).toBe("⁅u=wavy;fx=glow⁆a⁅/⁆");
  });
});
