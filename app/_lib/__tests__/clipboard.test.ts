import { describe, expect, it } from "vitest";
import { cssColor, cssLength, decodeEntities, htmlToParagraphs, paragraphsToHtml, paragraphsToText } from "../clipboardHtml";
import { applyPasteMode, clipFromParagraphs, paragraphsFromRich, readClip, richFromParagraphs, textToParagraphs } from "../richClipboard";
import type { DocParagraph } from "../textboxDoc";

const text = (ps: DocParagraph[]) => ps.map((p) => p.runs.map((r) => r.text).join(""));
const styles = (p: DocParagraph) => p.runs.map((r) => [r.text, r.style] as const);

describe("CSS values", () => {
  it("reads colors in the usual forms, and nothing for no color", () => {
    expect(cssColor("#F00")).toBe("#ff0000");
    expect(cssColor("#dc2626")).toBe("#dc2626");
    expect(cssColor("rgb(220, 38, 38)")).toBe("#dc2626");
    expect(cssColor("rgba(0,0,255,0.5)")).toBe("#0000ff");
    expect(cssColor("rgba(0,0,255,0)")).toBeUndefined();
    expect(cssColor("Yellow")).toBe("#ffff00");
    expect(cssColor("transparent")).toBeUndefined();
    expect(cssColor("windowtext")).toBeUndefined();
  });

  it("converts lengths to px", () => {
    expect(cssLength("12pt")).toBe(16);
    expect(cssLength("24px")).toBe(24);
    expect(cssLength("1in")).toBe(96);
    expect(cssLength("2em")).toBe(32);
    expect(cssLength("auto")).toBeUndefined();
  });

  it("decodes entities, named and numeric", () => {
    expect(decodeEntities("a&amp;b &lt;c&gt; &#8212; &#x3b1; &deg;C&nbsp;x &unknown;")).toBe("a&b <c> — α °C x &unknown;");
  });
});

describe("HTML from a web page or another editor", () => {
  it("keeps the emphasis, with one space between words", () => {
    const ps = htmlToParagraphs("<p>Hello <strong>big\n   world</strong> and <em>more</em>, <u>this</u> <s>that</s></p>");
    expect(text(ps)).toEqual(["Hello big world and more, this that"]);
    expect(styles(ps[0])).toEqual([
      ["Hello ", {}],
      ["big world", { b: true }],
      [" and ", {}],
      ["more", { i: true }],
      [", ", {}],
      ["this", { u: true }],
      [" ", {}],
      ["that", { x: true }],
    ]);
  });

  it("makes a paragraph of each block, and a line break of <br>", () => {
    const ps = htmlToParagraphs("<div>one</div><div>two<br>three</div><h2>Title</h2>");
    expect(text(ps)).toEqual(["one", "two\nthree", "Title"]);
    expect(ps[2].runs[0].style).toEqual({ b: true });
  });

  it("reads sub and superscripts from tags and from styles", () => {
    const ps = htmlToParagraphs('<p>H<sub>2</sub>O, m/s<span style="vertical-align:super">2</span>, x<span style="vertical-align:sub">i</span></p>');
    expect(styles(ps[0])).toEqual([["H", {}], ["2", { sub: true }], ["O, m/s", {}], ["2", { sup: true }], [", x", {}], ["i", { sub: true }]]);
  });

  it("reads color, highlight, font and size", () => {
    const ps = htmlToParagraphs('<p><span style="color:#dc2626;background-color:#fef08a;font-family:Georgia, serif;font-size:18pt">red</span></p>');
    expect(ps[0].runs[0].style).toMatchObject({ color: "#dc2626", hl: "#fef08a", size: 24 });
    // (Georgia is one of the fonts of the app; a font it does not have is left out)
    expect(ps[0].runs[0].style.font).toBe("Georgia");
    expect(htmlToParagraphs('<p><span style="font-family:\'Papyrus Foo\'">x</span></p>')[0].runs[0].style.font).toBeUndefined();
  });

  it("reads the kind of an underline", () => {
    const ps = htmlToParagraphs('<p><span style="text-decoration:underline wavy">a</span> <span style="text-decoration:underline;text-decoration-style:double">b</span> <u>c</u> <span style="text-decoration:line-through">d</span></p>');
    expect(styles(ps[0]).map(([t, s]) => [t, s.u, s.ul, s.x])).toEqual([["a", true, "wavy", undefined], [" ", undefined, undefined, undefined], ["b", true, "double", undefined], [" ", undefined, undefined, undefined], ["c", true, undefined, undefined], [" ", undefined, undefined, undefined], ["d", undefined, undefined, true]]);
  });

  it("reads the formatting of a paragraph", () => {
    const [p] = htmlToParagraphs('<p dir="rtl" style="text-align:center;margin-left:48px;line-height:1.5;margin-top:6px;margin-bottom:12px;background-color:#fef08a;border-bottom:1px solid #111827">x</p>');
    expect(p).toMatchObject({ align: "center", dir: "rtl", lineHeight: 1.5, spaceBefore: 6, spaceAfter: 12, shading: "#fef08a", border: "b", borderColor: "#111827" });
    expect(htmlToParagraphs('<p style="margin-left:48px">x</p>')[0].indent).toBe(2);
  });

  it("makes lists, nested ones too, with the kind of each", () => {
    const ps = htmlToParagraphs("<ul><li>one</li><li>two<ul><li>nested</li></ul></li></ul><ol type='a'><li>first</li></ol><p>after</p>");
    expect(ps.map((p) => [p.runs.map((r) => r.text).join(""), p.list, p.indent])).toEqual([
      ["one", "bullet", 0],
      ["two", "bullet", 0],
      ["nested", "bullet", 1],
      ["first", "lower-alpha", 0],
      ["after", undefined, 0],
    ]);
  });

  it("skips what is not text: head, styles, scripts, comments, hidden parts", () => {
    const ps = htmlToParagraphs('<html><head><title>t</title><style>p{color:red}</style></head><body><!--StartFragment--><p>seen<script>alert(1)</script></p><p style="display:none">hidden</p><!--EndFragment--></body></html>');
    expect(text(ps)).toEqual(["seen"]);
  });

  it("keeps a table's rows as lines, its cells apart", () => {
    const ps = htmlToParagraphs("<table><tr><td>a</td><td>b</td></tr><tr><th>c</th><td>d</td></tr></table>");
    expect(text(ps)).toEqual(["a b", "c d"]);
  });

  it("keeps the line breaks of preformatted text", () => {
    expect(text(htmlToParagraphs("<pre>a\n  b</pre>"))).toEqual(["a\n  b"]);
  });

  it("keeps a blank line (an empty paragraph) in the middle but not at the ends", () => {
    const ps = htmlToParagraphs("<p>&nbsp;</p><p>a</p><p>&nbsp;</p><p>b</p><p>&nbsp;</p>");
    expect(text(ps)).toEqual(["a", "", "b"]);
  });

  it("survives broken HTML", () => {
    expect(text(htmlToParagraphs("<p>one<b>bold<p>two</p></i>text &amp"))).toEqual(["onebold", "two", "text &amp"]);
    expect(htmlToParagraphs("")).toEqual([]);
    expect(text(htmlToParagraphs("just text"))).toEqual(["just text"]);
  });
});

describe("HTML from Word", () => {
  const word = `<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><o:OfficeDocumentSettings/></xml><![endif]--><style><!-- p.MsoNormal {margin:0} --></style></head><body>
<!--StartFragment-->
<p class=MsoNormal style='margin-bottom:0cm'><b>Exercise 1</b><o:p>&nbsp;</o:p></p>
<p class=MsoListParagraphCxSpFirst style='text-indent:-18.0pt;mso-list:l0 level1 lfo1'><![if !supportLists]><span style='font-family:Symbol;mso-fareast-font-family:Symbol;mso-bidi-font-family:Symbol'><span style='mso-list:Ignore'>·<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span></span></span><![endif]>Compute the <i>speed</i><o:p></o:p></p>
<p class=MsoListParagraphCxSpLast style='text-indent:-18.0pt;mso-list:l0 level2 lfo1'><![if !supportLists]><span style='mso-list:Ignore'>o<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;</span></span><![endif]>in m/s<sup>2</sup><o:p></o:p></p>
<p class=MsoListParagraph style='mso-list:l1 level1 lfo2'><![if !supportLists]><span style='mso-list:Ignore'>1.<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;</span></span><![endif]>first<o:p></o:p></p>
<!--EndFragment--></body></html>`;

  it("reads a Word list: the kind from its marker, the level, and not the marker as text", () => {
    const ps = htmlToParagraphs(word);
    expect(ps.map((p) => [p.runs.map((r) => r.text).join(""), p.list, p.indent])).toEqual([
      ["Exercise 1", undefined, 0],
      ["Compute the speed", "bullet", 0],
      ["in m/s2", "bullet", 1],
      ["first", "decimal", 0],
    ]);
    expect(ps[0].runs[0].style).toEqual({ b: true });
    expect(ps[1].runs[1].style).toEqual({ i: true });
    expect(ps[2].runs[1].style).toEqual({ sup: true });
  });
});

describe("HTML from Google Docs", () => {
  it("is not bold as a whole (the wrapper says font-weight:normal), only the words that are", () => {
    const html = `<meta charset='utf-8'><meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1"><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:11pt;font-family:Arial,sans-serif;color:#000000;background-color:transparent;font-weight:400;font-style:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;">plain </span><span style="font-size:11pt;font-weight:700;vertical-align:baseline;white-space:pre-wrap;">bold</span></p></b>`;
    const [p] = htmlToParagraphs(html);
    expect(p).toMatchObject({ dir: "ltr", lineHeight: 1.38 });
    expect(styles(p).map(([t, s]) => [t, !!s.b])).toEqual([["plain ", false], ["bold", true]]);
    expect(p.runs[0].style.color).toBeUndefined(); // (black is the default)
  });
});

describe("what the app copies", () => {
  const paragraphs: DocParagraph[] = [
    { runs: [{ text: "le ", style: {} }, { text: "chat", style: { b: true, color: "#dc2626", size: 18 } }], indent: 1, list: "bullet", spaceBefore: 0, spaceAfter: 0, align: "center" },
    { runs: [{ text: "H", style: {} }, { text: "2", style: { sub: true, hl: "#fef08a" } }, { text: "O", style: { u: true, i: true } }], indent: 0, spaceBefore: 6, spaceAfter: 12, dir: "rtl", shading: "#e5e7eb", border: "tb", borderColor: "#111827", lineHeight: 1.5 },
  ];

  it("comes back exactly when pasted in the app", () => {
    const clip = clipFromParagraphs(paragraphs);
    expect(readClip(clip)).toEqual(paragraphs);
  });

  it("is HTML other programs can read, and text with the markers written out", () => {
    const clip = clipFromParagraphs(paragraphs);
    expect(clip.text).toBe("○ le chat\nH2O"); // (a bullet one level in)
    expect(clip.html).toContain("<strong>");
    expect(clip.html).toContain("<sub>");
    // (without the payload, the HTML alone gives back the formatting it can express)
    const back = htmlToParagraphs(paragraphsToHtml(paragraphs));
    expect(back[0]).toMatchObject({ list: "bullet", align: "center" });
    expect(back[0].runs[1].style).toMatchObject({ b: true, color: "#dc2626", size: 18 });
    expect(back[1]).toMatchObject({ dir: "rtl", shading: "#e5e7eb", border: "tb", lineHeight: 1.5, spaceBefore: 6, spaceAfter: 12 });
    expect(paragraphsToText(paragraphs)).toBe("○ le chat\nH2O");
  });

  it("keeps the kind of underline and the shadow of the words in the HTML for other programs", () => {
    const html = paragraphsToHtml([{ runs: [{ text: "x", style: { u: true, ul: "dotted", fx: "shadow" } }, { text: "y", style: { fx: "outline" } }], indent: 0, spaceBefore: 0, spaceAfter: 0 }]);
    expect(html).toContain("text-decoration:underline dotted");
    expect(html).toContain("text-shadow:");
    const [p] = htmlToParagraphs(html);
    expect(p.runs[0].style).toMatchObject({ u: true, ul: "dotted" });
  });

  it("ignores a payload that is damaged", () => {
    expect(readClip({ html: '<div data-examor-clip="%7Bnot json"><p>kept</p></div>', text: "t" })?.[0].runs[0].text).toBe("kept");
  });
});

describe("pasting", () => {
  const external = '<p style="font-family:Georgia;font-size:20px;color:#dc2626;text-align:center">a <b>bold</b> <span style="background-color:#fef08a">word</span></p><ul><li>item</li></ul>';

  it("takes the exam's look for what comes from another program: emphasis and lists stay", () => {
    const ps = readClip({ html: external, text: "a bold word\nitem" });
    expect(styles(ps![0])).toEqual([["a ", {}], ["bold", { b: true }], [" word", {}]]);
    expect(ps![0].align).toBeUndefined();
    expect(ps![1]).toMatchObject({ list: "bullet" });
  });

  it("keeps all of it with Keep source formatting", () => {
    const ps = readClip({ html: external, text: "" }, "source");
    expect(ps![0]).toMatchObject({ align: "center" });
    expect(ps![0].runs[0].style).toMatchObject({ color: "#dc2626", size: 20, font: "Georgia" });
  });

  it("keeps only the emphasis and the lists with Merge formatting", () => {
    const ps = readClip({ html: external, text: "" }, "merge");
    expect(ps![0].runs.map((r) => r.style)).toEqual([{}, { b: true }, {}]);
    expect(ps![1].list).toBe("bullet");
  });

  it("keeps only the text with Keep text only, from the plain text when there is one", () => {
    expect(text(readClip({ html: external, text: "a bold word\nitem" }, "text")!)).toEqual(["a bold word", "item"]);
    const noPlain = readClip({ html: external }, "text")!;
    expect(text(noPlain)).toEqual(["a bold word", "item"]);
    expect(noPlain.every((p) => !p.list && !p.runs.some((r) => Object.keys(r.style).length))).toBe(true);
  });

  it("pastes plain text line by line, and nothing for an empty clipboard", () => {
    expect(text(readClip({ text: "one\r\ntwo\n\nthree" })!)).toEqual(["one", "two", "", "three"]);
    expect(readClip({})).toBeNull();
    expect(readClip({ html: "<!--x-->", text: "" })).toBeNull();
  });

  it("can turn a paragraph into plain ones for a mode", () => {
    const ps = applyPasteMode(textToParagraphs("a"), "merge");
    expect(ps).toEqual([{ runs: [{ text: "a", style: {} }], indent: 0, spaceBefore: 0, spaceAfter: 0 }]);
  });
});

describe("the plain-text editor", () => {
  it("makes a styled string of paragraphs, a line each, with the markers of lists written out", () => {
    const ps: DocParagraph[] = [
      { runs: [{ text: "one", style: { b: true } }], indent: 0, list: "decimal", spaceBefore: 0, spaceAfter: 0 },
      { runs: [{ text: "two", style: {} }], indent: 0, list: "decimal", spaceBefore: 0, spaceAfter: 0 },
      { runs: [{ text: "free", style: {} }], indent: 0, spaceBefore: 0, spaceAfter: 0 },
    ];
    expect(richFromParagraphs(ps, true)).toBe("1. ⁅b⁆one⁅/⁆\n2. two\nfree");
    expect(richFromParagraphs(ps, false)).toBe("1. ⁅b⁆one⁅/⁆ 2. two free");
  });

  it("reads a styled string as paragraphs", () => {
    const ps = paragraphsFromRich("⁅b⁆one⁅/⁆ and\ntwo");
    expect(text(ps)).toEqual(["one and", "two"]);
    expect(ps[0].runs[0].style).toEqual({ b: true });
    expect(richFromParagraphs(ps, true)).toBe("⁅b⁆one⁅/⁆ and\ntwo");
  });
});
