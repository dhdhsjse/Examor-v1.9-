import { describe, expect, it } from "vitest";
import { buildPattern, findAll, replaceAll, replaceInBlock, replaceOne, textFields } from "../findReplace";
import { fieldValue } from "../editRegions";
import { docFromParagraphs, docParagraphs, richFromDoc } from "../textboxDoc";
import type { Block } from "../types";

const layout = { pageId: "p1", x: 0, y: 0, width: 400, height: 100 };
const bold = (s: string) => `⁅b⁆${s}⁅/⁆`;

const mcq = { id: "q1", type: "mcq", layout, text: "What is the speed of light?", options: ["The speed is c", `Speed of ${bold("sound")}`, "none"], answer: [0], points: 1 } as unknown as Block;
const para = { id: "t1", type: "text", layout, text: `The speedy ${bold("Speed")} test`, style: "body" } as unknown as Block;
const doc = docFromParagraphs([
  { runs: [{ text: "a speed ", style: {} }, { text: "limit", style: { b: true } }], indent: 1, list: "bullet", spaceBefore: 0, spaceAfter: 0 },
  { runs: [{ text: "no match", style: {} }], indent: 0, spaceBefore: 0, spaceAfter: 0 },
  { runs: [{ text: "SPEED again", style: {} }], indent: 0, spaceBefore: 0, spaceAfter: 0, align: "center" },
]);
const box = { id: "b1", type: "textbox", layout, content: doc, text: richFromDoc(doc) } as unknown as Block;
const table = { id: "tb1", type: "table", layout, cells: [["speed", "x"], ["y", "top speed"]] } as unknown as Block;
const tf = { id: "f1", type: "truefalse", layout, text: "", statements: [{ text: "The speed is constant", answer: true, fix: "" }, { text: "speed", answer: false, fix: "The speed changes" }] } as unknown as Block;
const pageNumber = { id: "h1", type: "text", layout, text: "speed", style: "body", meta: { role: "footer" } } as unknown as Block;
const image = { id: "i1", type: "image", layout } as unknown as Block;
const all = [mcq, para, box, table, tf, pageNumber, image];

const OFF = { matchCase: false, wholeWord: false };

describe("the texts of a block", () => {
  it("lists every field that holds words, without any layout", () => {
    expect(textFields(mcq).map((f) => f.kind)).toEqual(["text", "option", "option", "option"]);
    expect(textFields(tf).map((f) => f.kind)).toEqual(["text", "statement", "statement", "fix", "fix"]);
    expect(textFields(table)).toHaveLength(4);
    expect(textFields(box)).toEqual([{ kind: "text" }]);
  });

  it("has none for a generated text, an image or anything with no words", () => {
    expect(textFields(pageNumber)).toEqual([]);
    expect(textFields(image)).toEqual([]);
  });
});

describe("the pattern", () => {
  it("is plain text: nothing typed is a pattern", () => {
    expect("1+1=2 (a.b)".match(buildPattern("1+1=2 (a.b)", OFF)!)).toHaveLength(1);
    expect("a1b".match(buildPattern("a.b", OFF)!)).toBeNull();
    expect(buildPattern("", OFF)).toBeNull();
  });

  it("ignores the case unless asked, and takes whole words only when asked (letters of every language)", () => {
    expect("Speed speed".match(buildPattern("speed", OFF)!)).toHaveLength(2);
    expect("Speed speed".match(buildPattern("speed", { matchCase: true, wholeWord: false })!)).toHaveLength(1);
    expect("speedy speed".match(buildPattern("speed", { matchCase: false, wholeWord: true })!)).toHaveLength(1);
    expect("été, étés".match(buildPattern("été", { matchCase: false, wholeWord: true })!)).toHaveLength(1);
    expect("كتاب الكتاب".match(buildPattern("كتاب", { matchCase: false, wholeWord: true })!)).toHaveLength(1);
  });
});

describe("finding", () => {
  it("finds every match in page order, in the texts of all the blocks (paragraphs of a text box one by one)", () => {
    const found = findAll(all, "speed", OFF);
    expect(found.map((m) => `${m.blockId}:${m.field.kind}:${m.paragraph}:${m.index}`)).toEqual([
      "q1:text:0:12",
      "q1:option:0:4",
      "q1:option:0:0", // (the second option: a field of its own)
      "t1:text:0:4", // speedy
      "t1:text:0:11", // Speed
      "b1:text:0:2",
      "b1:text:2:0",
      "tb1:cell:0:0",
      "tb1:cell:0:4", // (the cell at row 1, column 1: "top speed")
      "f1:statement:0:4",
      "f1:statement:0:0",
      "f1:fix:0:4",
    ]);
    // (a generated text and an image are not searched)
    expect(found.some((m) => m.blockId === "h1" || m.blockId === "i1")).toBe(false);
  });

  it("gives a few words around each match for the list", () => {
    const [m] = findAll([mcq], "light", OFF);
    expect(m).toMatchObject({ before: "What is the speed of ", hit: "light", after: "?" });
    const long = { ...para, text: `${"word ".repeat(20)}needle${" word".repeat(20)}` } as Block;
    const [n] = findAll([long], "needle", OFF);
    expect(n.before.startsWith("…")).toBe(true);
    expect(n.after.endsWith("…")).toBe(true);
  });

  it("stops at the limit", () => {
    expect(findAll(all, "e", OFF, 3)).toHaveLength(3);
  });
});

describe("replacing one match", () => {
  it("replaces it in its field and keeps the style of the first letter", () => {
    const m = findAll([mcq], "sound", OFF)[0];
    const patch = replaceOne(mcq, m, "light") as { options: string[] };
    expect(patch.options).toEqual(["The speed is c", `Speed of ${bold("light")}`, "none"]);
  });

  it("replaces in the paragraph of a text box, keeping its formatting and the styles of the words", () => {
    const m = findAll([box], "speed", OFF)[0];
    const patch = replaceOne(box, m, "velocity") as { content: typeof doc; text: string };
    const ps = docParagraphs(patch.content);
    expect(ps[0].runs.map((r) => [r.text, r.style])).toEqual([["a velocity ", {}], ["limit", { b: true }]]);
    expect(ps[0]).toMatchObject({ list: "bullet", indent: 1 });
    expect(ps[2].runs[0].text).toBe("SPEED again"); // (the other match is left alone)
    expect(patch.text).toBe(richFromDoc(patch.content));
  });

  it("is nothing when the text changed since it was found", () => {
    const m = findAll([mcq], "speed", OFF)[0];
    expect(replaceOne({ ...mcq, text: "other" } as Block, m, "x")).toBeNull();
  });
});

describe("replacing everything", () => {
  it("changes every match of every block, once per block, and counts them", () => {
    const { patches, count } = replaceAll(all, "speed", OFF, "velocity");
    expect(count).toBe(12);
    expect(patches.map((p) => p.id)).toEqual(["q1", "t1", "b1", "tb1", "f1"]);
    const q = patches[0].patch as { text: string; options: string[] };
    expect(q.text).toBe("What is the velocity of light?");
    expect(q.options).toEqual(["The velocity is c", `velocity of ${bold("sound")}`, "none"]); // (a bold word stays bold)
    // two fields of one block in one patch
    const f = patches[4].patch as { statements: { text: string; fix: string }[] };
    expect(f.statements.map((s) => [s.text, s.fix])).toEqual([["The velocity is constant", ""], ["velocity", "The velocity changes"]]);
  });

  it("keeps the style of the first letter of what it replaces", () => {
    const { patches } = replaceAll([para], "speed", { matchCase: true, wholeWord: false }, "x");
    expect((patches[0].patch as { text: string }).text).toBe(`The xy ${bold("Speed")} test`);
    const { patches: second } = replaceAll([para], "Speed", { matchCase: true, wholeWord: false }, "Pace");
    expect((second[0].patch as { text: string }).text).toBe(`The speedy ${bold("Pace")} test`);
  });

  it("takes the replacement as it is typed (no $ codes), and can delete", () => {
    expect((replaceAll([mcq], "light", OFF, "$& $1").patches[0].patch as { text: string }).text).toBe("What is the speed of $& $1?");
    expect((replaceAll([mcq], " of light", OFF, "").patches[0].patch as { text: string }).text).toBe("What is the speed?");
  });

  it("changes the paragraphs of a text box one by one with their formatting", () => {
    const re = buildPattern("speed", OFF)!;
    const r = replaceInBlock(box, re, "pace")!;
    expect(r.count).toBe(2);
    const ps = docParagraphs((r.patch as { content: typeof doc }).content);
    expect(ps.map((p) => p.runs.map((x) => x.text).join(""))).toEqual(["a pace limit", "no match", "pace again"]);
    expect(ps[2].align).toBe("center");
  });

  it("is nothing where there is nothing", () => {
    expect(replaceAll(all, "zzz", OFF, "x")).toEqual({ patches: [], count: 0 });
    expect(replaceAll(all, "", OFF, "x")).toEqual({ patches: [], count: 0 });
    expect(replaceInBlock(image, buildPattern("a", OFF)!, "b")).toBeNull();
  });

  it("agrees with the field values after applying the patches", () => {
    const { patches } = replaceAll([mcq], "speed", OFF, "pace");
    const next = { ...mcq, ...patches[0].patch } as Block;
    expect(fieldValue(next, { kind: "text" })).toBe("What is the pace of light?");
  });
});
