import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { caseBlock, highlightBlock, scriptBlock, sortBlock, styleBlock, wholeStyle } from "../blockText";
import { docFromParagraphs, docFromRich, docParagraphs, mapDocChars, richFromDoc, styleDoc } from "../textboxDoc";
import type { TextBlock, TextboxBlock } from "../types";

const layout = { x: 0, y: 0, width: 100, height: 20 };
const textBlock = (text: string) => ({ id: "t", type: "text", layout, text, style: "paragraph" }) as unknown as TextBlock;
const boxBlock = (content: JSONContent) => ({ id: "b", type: "textbox", layout, content, text: richFromDoc(content) }) as unknown as TextboxBlock;
const bold = (s: string) => `⁅b⁆${s}⁅/⁆`;
const sub = (s: string) => `⁅sub⁆${s}⁅/⁆`;

// A text box of two paragraphs, the first one a bullet of level 1, with a bold word.
const twoParagraphs = () =>
  docFromParagraphs([
    { runs: [{ text: "le ", style: {} }, { text: "chat", style: { b: true } }], indent: 1, list: "bullet", spaceBefore: 0, spaceAfter: 0 },
    { runs: [{ text: "noir. fin", style: {} }], indent: 0, spaceBefore: 4, spaceAfter: 0 },
  ]);

describe("the style all the words of a block share", () => {
  it("is what every word has, and nothing for a mixed text", () => {
    expect(wholeStyle(textBlock(sub("H2O")))).toEqual({ sub: true });
    expect(wholeStyle(textBlock(`${sub("H")}2O`))).toEqual({});
    expect(wholeStyle(textBlock(""))).toEqual({});
  });
});

describe("a script on the whole block", () => {
  it("puts every word of a text block below the line, and takes it off", () => {
    const b = textBlock(`a ${bold("b")}`);
    const down = scriptBlock(b, "sub").text as string;
    expect(down).toBe(`${sub("a ")}⁅b;sub⁆b⁅/⁆`);
    expect(scriptBlock({ ...b, text: down }, undefined).text).toBe(`a ${bold("b")}`);
  });

  it("changes a subscript into a superscript (a word is never both)", () => {
    const b = textBlock(sub("x2"));
    expect(scriptBlock(b, "sup").text).toBe("⁅sup⁆x2⁅/⁆");
  });

  it("does the same through the document of a text box, and keeps its paragraphs' formatting", () => {
    const b = boxBlock(twoParagraphs());
    const patch = scriptBlock(b, "sup");
    const paragraphs = docParagraphs(patch.content as JSONContent);
    expect(paragraphs.map((p) => p.runs.every((r) => r.style.sup))).toEqual([true, true]);
    expect(paragraphs[0]).toMatchObject({ indent: 1, list: "bullet" });
    expect(paragraphs[1]).toMatchObject({ spaceBefore: 4 });
    expect(patch.text).toBe(richFromDoc(patch.content as JSONContent));
    expect(patch.text).toBe("⁅sup⁆le ⁅/⁆⁅b;sup⁆chat⁅/⁆\n⁅sup⁆noir. fin⁅/⁆");
  });
});

describe("a highlight on the whole block", () => {
  it("highlights every word, then removes the highlight", () => {
    const b = textBlock("one two");
    const on = highlightBlock(b, "#fef08a").text as string;
    expect(on).toBe("⁅h=#fef08a⁆one two⁅/⁆");
    expect(highlightBlock({ ...b, text: on }, undefined).text).toBe("one two");
  });

  it("is the same on a text box", () => {
    const patch = highlightBlock(boxBlock(docFromRich("one\ntwo")), "#bbf7d0");
    expect(patch.text).toBe("⁅h=#bbf7d0⁆one⁅/⁆\n⁅h=#bbf7d0⁆two⁅/⁆");
  });
});

describe("clearing the words of a block", () => {
  it("takes every style off the words, whatever it was", () => {
    expect(styleBlock(textBlock(`a ${bold("b")} ⁅c=#dc2626;u⁆c⁅/⁆`), "clear").text).toBe("a b c");
    const patch = styleBlock(boxBlock(twoParagraphs()), "clear");
    expect(patch.text).toBe("le chat\nnoir. fin");
    expect(docParagraphs(patch.content as JSONContent)[0]).toMatchObject({ list: "bullet", indent: 1 }); // (the paragraph keeps its formatting)
  });
});

describe("changing the case of a whole block", () => {
  it("changes every letter and keeps the styles", () => {
    const b = textBlock(`le ${bold("chat")} noir`);
    expect(caseBlock(b, "upper")?.text).toBe(`LE ${bold("CHAT")} NOIR`);
    expect(caseBlock(b, "title")?.text).toBe(`Le ${bold("Chat")} Noir`);
  });

  it("is nothing when the text already is in that case", () => {
    expect(caseBlock(textBlock("ABC"), "upper")).toBeNull();
    expect(caseBlock(boxBlock(docFromRich("ABC")), "upper")).toBeNull();
  });

  it("goes to the next case with Shift+F3 (lowercase → Title → UPPERCASE)", () => {
    const next = (s: string) => caseBlock(textBlock(s), "cycle")?.text;
    expect(next("le chat")).toBe("Le Chat");
    expect(next("Le Chat")).toBe("LE CHAT");
    expect(next("LE CHAT")).toBe("le chat");
  });

  it("starts every sentence of a text box with a capital, across paragraphs, keeping words' styles and paragraphs' formatting", () => {
    const patch = caseBlock(boxBlock(twoParagraphs()), "sentence");
    expect(patch?.text).toBe(`Le ${bold("chat")}\nNoir. Fin`);
    const paragraphs = docParagraphs(patch?.content as JSONContent);
    expect(paragraphs[0]).toMatchObject({ list: "bullet", indent: 1 });
    expect(paragraphs[1]).toMatchObject({ spaceBefore: 4 });
  });

  it("goes through the line breaks inside a paragraph", () => {
    const doc = mapDocChars({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "ab" }, { type: "hardBreak" }, { type: "text", text: "cd" }] }] }, (chars) => chars.map((c) => c.toUpperCase()));
    expect(richFromDoc(doc)).toBe("AB\nCD");
  });

  it("keeps a letter that becomes two (ß → SS) with the style of the first", () => {
    expect(caseBlock(textBlock(bold("groß")), "upper")?.text).toBe(bold("GROSS"));
  });
});

describe("sorting a whole block", () => {
  it("sorts the lines of a text block, numbers as numbers", () => {
    const b = textBlock("10\nb\n9\nA");
    expect(sortBlock(b, "asc", "fr")?.text).toBe("9\n10\nA\nb");
    expect(sortBlock(b, "desc", "fr")?.text).toBe("b\nA\n10\n9");
  });

  it("keeps the styles of a line with it", () => {
    expect(sortBlock(textBlock(`${bold("b")}\na`), "asc", "fr")?.text).toBe(`a\n${bold("b")}`);
  });

  it("sorts the paragraphs of a text box, each keeping its own formatting", () => {
    const box = boxBlock(
      docFromParagraphs([
        { runs: [{ text: "zebra", style: { b: true } }], indent: 1, list: "bullet", spaceBefore: 0, spaceAfter: 0 },
        { runs: [{ text: "apple", style: {} }], indent: 0, spaceBefore: 4, spaceAfter: 0 },
      ]),
    );
    const patch = sortBlock(box, "asc", "fr");
    const paragraphs = docParagraphs(patch?.content as JSONContent);
    expect(paragraphs.map((p) => p.runs.map((r) => r.text).join(""))).toEqual(["apple", "zebra"]);
    expect(paragraphs[0]).toMatchObject({ spaceBefore: 4, indent: 0 });
    expect(paragraphs[1]).toMatchObject({ list: "bullet", indent: 1 });
    expect(paragraphs[1].runs[0].style).toEqual({ b: true });
    expect(patch?.text).toBe(`apple\n${bold("zebra")}`);
  });

  it("does nothing for one line, or for what is in order", () => {
    expect(sortBlock(textBlock("only"), "asc", "fr")).toBeNull();
    expect(sortBlock(textBlock("a\nb"), "asc", "fr")).toBeNull();
    expect(sortBlock(boxBlock(twoParagraphs()), "asc", "fr")).toBeNull();
  });

  it("sorts Arabic with the Arabic collation", () => {
    expect(sortBlock(textBlock("ج\nأ\nب"), "asc", "ar")?.text).toBe("أ\nب\nج");
  });
});

describe("styleDoc", () => {
  it("is lossless for a document with line breaks and formatted paragraphs", () => {
    const doc = twoParagraphs();
    expect(styleDoc(doc, {})).toEqual(doc);
  });
});
