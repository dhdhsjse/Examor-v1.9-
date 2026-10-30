import { describe, expect, it } from "vitest";
import { EX_EM, MATH_CHAR, decodeMath, encodeMath, mathBox, type InlineMath } from "../inlineMath";
import { pieceWidth, rtlPlacement, wrapRich } from "../measure";
import { insertText, parseRich, plainText, serializeRich } from "../richText";
import { docFromRich, docParagraphs, INLINE_MATH, richFromDoc } from "../textboxDoc";

const math: InlineMath = { latex: "\\frac{1}{x};a=b ⁅⁆", w: 3.2, h: 3.4, d: 1.1 };
const base = { family: "Arial", size: 20, bold: false, italic: false, underline: false, color: "#000" };

describe("formulas inside a text", () => {
  it("keeps the LaTeX whatever it holds (;, =, the brackets of the styled text)", () => {
    expect(decodeMath(encodeMath(math))).toEqual(math);
  });

  it("is one character of the styled text, with its formula, between the words", () => {
    const rich = serializeRich([
      { text: "on ", style: {} },
      { text: MATH_CHAR, style: { math } },
      { text: " ok", style: { b: true } },
    ]);
    const runs = parseRich(rich);
    expect(runs.map((r) => r.text)).toEqual(["on ", MATH_CHAR, " ok"]);
    expect(runs[1].style.math).toEqual(math);
    expect(plainText(rich)).toBe(`on ${MATH_CHAR} ok`);
  });

  it("goes to the text box document as a formula node and back", () => {
    const rich = serializeRich([
      { text: "x ", style: {} },
      { text: MATH_CHAR + MATH_CHAR, style: { math } },
    ]);
    const doc = docFromRich(rich);
    const nodes = doc.content?.[0].content ?? [];
    expect(nodes.map((n) => n.type)).toEqual(["text", INLINE_MATH, INLINE_MATH]);
    expect(nodes[1].attrs).toMatchObject({ latex: math.latex, w: math.w });
    expect(richFromDoc(doc)).toBe(rich);
    expect(docParagraphs(doc)[0].runs[1].style.math).toEqual(math);
  });

  it("a formula node without its size yet gets a guessed one", () => {
    const [p] = docParagraphs({ type: "doc", content: [{ type: "paragraph", content: [{ type: INLINE_MATH, attrs: { latex: "x^2" } }] }] });
    expect(p.runs[0].style.math?.latex).toBe("x^2");
    expect(p.runs[0].style.math?.w).toBeGreaterThan(0);
  });

  it("typing next to a formula does not make the letters a formula", () => {
    const rich = serializeRich([{ text: MATH_CHAR, style: { math } }]);
    const runs = parseRich(insertText(rich, 1, "ab"));
    expect(runs.find((r) => r.text === "ab")?.style.math).toBeUndefined();
  });

  it("is measured from its size, and a tall one makes its line taller", () => {
    const font = { ...base, math };
    expect(pieceWidth(MATH_CHAR + MATH_CHAR, font)).toBeCloseTo(2 * math.w * EX_EM * 20);
    const flat = wrapRich("a b", 500, base, 24);
    const rich = serializeRich([
      { text: "a ", style: {} },
      { text: MATH_CHAR, style: { math: { ...math, h: 8, d: 3 } } },
    ]);
    const [line] = wrapRich(rich, 500, base, 24);
    expect(line.pieces.map((p) => p.text)).toEqual(["a ", MATH_CHAR]);
    expect(line.pieces[1].width).toBeCloseTo(mathBox(math, 20).width);
    expect(line.height).toBeGreaterThan(flat[0].height);
  });

  it("in a right-to-left line, French words and a formula between them keep their order", () => {
    const font = { ...base };
    const pieces = [
      { text: "حيث ", width: 30, font },
      { text: "a ", width: 10, font },
      { text: MATH_CHAR, width: 20, font: { ...base, math } },
      { text: " donc", width: 25, font },
      { text: " لدينا", width: 35, font },
    ];
    const { x, ltr } = rtlPlacement(pieces);
    expect(ltr).toEqual([false, true, true, true, false]);
    // From the right: the Arabic word, then "a ⅟ donc" left to right, then the last Arabic word on the left.
    expect(x).toEqual([90, 35, 45, 65, 0]);
    // A formula among Arabic words follows them, from the right.
    const arabic = rtlPlacement([pieces[0], pieces[2], pieces[4]]);
    expect(arabic).toEqual({ x: [55, 35, 0], ltr: [false, false, false] });
  });

  it("two formulas side by side stay two pieces, and wrap like words", () => {
    const rich = serializeRich([{ text: `${MATH_CHAR}${MATH_CHAR}`, style: { math } }]);
    const [line] = wrapRich(rich, 500, base, 24);
    expect(line.pieces).toHaveLength(2);
    const narrow = wrapRich(serializeRich([{ text: "word ", style: {} }, { text: MATH_CHAR, style: { math } }]), 60, base, 24);
    expect(narrow).toHaveLength(2);
  });
});
