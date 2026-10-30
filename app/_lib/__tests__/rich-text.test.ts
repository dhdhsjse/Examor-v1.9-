import { describe, expect, it } from "vitest";
import {
  SCRIPT_SCALE,
  applyStyle,
  insertRich,
  joinParagraphs,
  mapChars,
  parseRich,
  plainLength,
  plainText,
  replaceMatches,
  replaceRich,
  runCss,
  serializeRich,
  sliceRich,
  splitParagraphs,
  styleAt,
} from "../richText";
import { applyCase, caseChars, cycleCase } from "../textCase";

const bold = (s: string) => `⁅b⁆${s}⁅/⁆`;

describe("subscripts and superscripts in a styled text", () => {
  it("are written and read back like the other styles", () => {
    const s = `H⁅sub⁆2⁅/⁆O and m/s⁅sup⁆2⁅/⁆`;
    expect(parseRich(s)).toEqual([
      { text: "H", style: {} },
      { text: "2", style: { sub: true } },
      { text: "O and m/s", style: {} },
      { text: "2", style: { sup: true } },
    ]);
    expect(serializeRich(parseRich(s))).toBe(s);
    expect(plainText(s)).toBe("H2O and m/s2");
  });

  it("are never both: the one set last replaces the other", () => {
    expect(parseRich("⁅sub;sup⁆x⁅/⁆")[0].style).toEqual({ sub: true });
    const both = applyStyle("x2", 1, 2, { sub: true });
    expect(styleAt(both, 1, 2)).toEqual({ sub: true });
    const swapped = applyStyle(both, 1, 2, { sup: true });
    expect(styleAt(swapped, 1, 2)).toEqual({ sup: true });
    expect(applyStyle(swapped, 1, 2, { sup: null })).toBe("x2");
  });

  it("keep the other styles of their characters (a bold digit in a formula)", () => {
    const s = applyStyle(applyStyle("CO2", 2, 3, { b: true }), 2, 3, { sub: true });
    expect(styleAt(s, 2, 3)).toEqual({ b: true, sub: true });
    expect(plainText(s)).toBe("CO2");
  });

  it("show in the CSS of the editors: smaller, raised or lowered, without growing the line", () => {
    const sup = runCss({ sup: true }, (f) => f);
    expect(sup.fontSize).toBe(`${SCRIPT_SCALE}em`);
    expect(sup.lineHeight).toBe("0");
    expect(sup.position).toBe("relative");
    expect(Number.parseFloat(String(sup.top))).toBeLessThan(0);
    const sub = runCss({ sub: true, size: 20 }, (f) => f);
    expect(sub.fontSize).toBe(`${20 * SCRIPT_SCALE}px`);
    expect(Number.parseFloat(String(sub.top))).toBeGreaterThan(0);
    expect(runCss({ size: 20 }, (f) => f).position).toBeUndefined();
  });
});

describe("pieces of a styled text", () => {
  const text = `Hello ${bold("big")} world`;

  it("copies a range with its styles", () => {
    expect(sliceRich(text, 3, 11)).toBe(`lo ${bold("big")} w`);
    expect(sliceRich(text, 6, 9)).toBe(bold("big"));
    expect(sliceRich(text, 0, 0)).toBe("");
  });

  it("pastes styled text with its own styles, not its neighbour's", () => {
    expect(insertRich("ab", 1, bold("X"))).toBe(`a${bold("X")}b`);
    expect(insertRich(bold("ab"), 1, "X")).toBe(`${bold("a")}X${bold("b")}`);
    expect(replaceRich("Hello world", 6, 11, bold("you"))).toBe(`Hello ${bold("you")}`);
  });

  it("splits into paragraphs and joins them back, keeping a style that spans a break", () => {
    const s = `one\n${bold("two\nthree")}\n\nfour`;
    const parts = splitParagraphs(s);
    expect(parts).toEqual(["one", bold("two"), bold("three"), "", "four"]);
    // (the line break itself has no style to keep: it is the same text, with the same styled words)
    const joined = joinParagraphs(parts);
    expect(plainText(joined)).toBe(plainText(s));
    expect(splitParagraphs(joined)).toEqual(parts);
    expect(joinParagraphs(["a", "b"])).toBe("a\nb");
    expect(joinParagraphs(["only"])).toBe("only");
    expect(splitParagraphs("")).toEqual([""]);
    expect(splitParagraphs("a\n")).toEqual(["a", ""]);
  });

  it("counts offsets in UTF-16 units, like a selection", () => {
    const s = `a😀${bold("b")}`;
    expect(plainLength(s)).toBe(4);
    expect(sliceRich(s, 1, 3)).toBe("😀");
    expect(sliceRich(s, 3, 4)).toBe(bold("b"));
  });

  it("changes the characters of a range, each keeping its style", () => {
    const s = `ab${bold("cd")}ef`;
    expect(mapChars(s, 1, 5, (cs) => cs.map((c) => c.toUpperCase()))).toBe(`aB${bold("CD")}Ef`);
    // a letter that becomes two carries its style onto both
    expect(mapChars(bold("ß"), 0, 1, (cs) => cs.map((c) => c.toUpperCase()))).toBe(bold("SS"));
  });
});

describe("replacing text", () => {
  it("replaces every match, keeping the style of the first letter of each", () => {
    const r = replaceMatches(`a cat ${bold("cat")} cat`, /cat/g, "dog");
    expect(r.count).toBe(3);
    expect(r.value).toBe(`a dog ${bold("dog")} dog`);
  });

  it("does nothing, and says so, when nothing matches", () => {
    const s = `a ${bold("b")}`;
    expect(replaceMatches(s, /zzz/g, "x")).toEqual({ value: s, count: 0 });
  });

  it("can use what matched, spans styles, and handles emoji and accents", () => {
    expect(replaceMatches("2 + 3", /(\d)/g, (m) => String(Number(m) * 2)).value).toBe("4 + 6");
    const spans = `He${bold("llo")} there`;
    expect(replaceMatches(spans, /llo t/g, "y, T").value).toBe(`He${bold("y, T")}here`);
    expect(replaceMatches("l'école 😀 École", /é/giu, "e").value).toBe("l'ecole 😀 ecole");
  });

  it("ignores an empty match", () => {
    expect(replaceMatches("abc", /x*/g, "-")).toEqual({ value: "abc", count: 0 });
  });
});

describe("changing case", () => {
  it("lowercases, uppercases and toggles", () => {
    expect(applyCase("Bonjour à Tous", "lower")).toBe("bonjour à tous");
    expect(applyCase("Bonjour à Tous", "upper")).toBe("BONJOUR À TOUS");
    expect(applyCase("Bonjour À Tous", "toggle")).toBe("bONJOUR à tOUS");
    expect(applyCase("œuf ß", "upper")).toBe("ŒUF SS");
  });

  it("capitalizes each word, keeping the rest (like Word) and counting l'école as one word", () => {
    expect(applyCase("le chat noir", "title")).toBe("Le Chat Noir");
    expect(applyCase("l'école d'abord", "title")).toBe("L'école D'abord");
    expect(applyCase("peut-être 2nd", "title")).toBe("Peut-Être 2nd");
    expect(applyCase("keep NaCl", "title")).toBe("Keep NaCl");
  });

  it("starts each sentence with a capital and lowercases the rest", () => {
    expect(applyCase("THE SPEED IS 5 M/S. IT IS FAST! REALLY? yes", "sentence")).toBe("The speed is 5 m/s. It is fast! Really? Yes");
    expect(applyCase("3.5 m of rope. next line\nnew paragraph", "sentence")).toBe("3.5 m of rope. Next line\nNew paragraph");
    expect(applyCase("1. the first", "sentence")).toBe("1. The first");
    expect(applyCase("«  bonjour » dit-il", "sentence")).toBe("«  Bonjour » dit-il");
  });

  it("leaves Arabic and symbols as they are", () => {
    const ar = "أجب عن الأسئلة التالية؟ نعم";
    for (const mode of ["sentence", "lower", "upper", "title", "toggle"] as const) expect(applyCase(ar, mode)).toBe(ar);
    expect(applyCase("5 m/s² ≥ 3 Ω", "upper")).toBe("5 M/S² ≥ 3 Ω");
  });

  it("gives one entry per character, so styles can follow", () => {
    expect(caseChars([..."aß"], "upper")).toEqual(["A", "SS"]);
    expect(caseChars([], "title")).toEqual([]);
  });

  it("cycles like Shift+F3: lowercase → Capitalize Each Word → UPPERCASE → lowercase", () => {
    expect(cycleCase("hello world")).toBe("title");
    expect(cycleCase("Hello World")).toBe("upper");
    expect(cycleCase("HELLO WORLD")).toBe("lower");
    expect(cycleCase("Hello world")).toBe("upper");
  });
});
