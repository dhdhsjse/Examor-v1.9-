import { describe, expect, it } from "vitest";
import { BULLET_KINDS, LIST_GAP, NUMBER_KINDS, isBulletKind, isListKind, listMarkers, markerText, roman, toggledList, type ListItem, type ListKind } from "../lists";
import { LINE_STEPS, cleanColor, cleanLineHeight, cleanSides, clampSpace, isFormattedParagraph, paragraphAttrs, paragraphFormat } from "../paragraphFormat";

const items = (kind: ListKind | null, levels: number[]): ListItem[] => levels.map((level) => ({ list: kind, level }));

describe("list markers", () => {
  it("counts a numbered list from 1", () => {
    expect(listMarkers(items("decimal", [0, 0, 0]))).toEqual(["1.", "2.", "3."]);
    expect(listMarkers(items("decimal-paren", [0, 0]))).toEqual(["1)", "2)"]);
    expect(listMarkers(items("lower-alpha", [0, 0, 0]))).toEqual(["a.", "b.", "c."]);
    expect(listMarkers(items("upper-roman", [0, 0, 0, 0]))).toEqual(["I.", "II.", "III.", "IV."]);
  });

  it("follows the level of a bullet, like Word's default list", () => {
    expect(listMarkers(items("bullet", [0, 1, 2, 3, 0]))).toEqual(["•", "○", "▪", "•", "•"]);
    expect(listMarkers(items("check", [0, 1]))).toEqual(["✓", "✓"]);
    expect(markerText("dash", 7)).toBe("–");
  });

  it("restarts after a paragraph that is not an item", () => {
    const list: ListItem[] = [{ list: "decimal", level: 0 }, { list: "decimal", level: 0 }, { level: 0 }, { list: "decimal", level: 0 }];
    expect(listMarkers(list)).toEqual(["1.", "2.", null, "1."]);
    expect(listMarkers([{ list: null, level: 0 }])).toEqual([null]);
  });

  it("counts a level of its own: deeper items start again and the upper level goes on where it was", () => {
    const m = listMarkers(items("multi", [0, 1, 1, 2, 1, 0, 1]));
    expect(m).toEqual(["1.", "a.", "b.", "i.", "c.", "2.", "a."]);
  });

  it("restarts a level when the kind changes there", () => {
    const list: ListItem[] = [
      { list: "decimal", level: 0 },
      { list: "decimal", level: 0 },
      { list: "lower-alpha", level: 0 },
      { list: "lower-alpha", level: 0 },
    ];
    expect(listMarkers(list)).toEqual(["1.", "2.", "a.", "b."]);
  });

  it("goes on after z the way Word does: aa, bb…", () => {
    expect(markerText("lower-alpha", 26)).toBe("z.");
    expect(markerText("lower-alpha", 27)).toBe("aa.");
    expect(markerText("upper-alpha", 54)).toBe("BBB.");
  });

  it("numbers with the Arabic letters of school exercises (أ، ب، ج، د…), alone or in a multilevel list", () => {
    expect(listMarkers(items("arabic-alpha", [0, 0, 0, 0, 0]))).toEqual(["أ-", "ب-", "ج-", "د-", "هـ-"]);
    expect(markerText("multi", 2, 1, true)).toBe("ب-");
    expect(markerText("multi", 2, 1, false)).toBe("b.");
    expect(markerText("arabic-alpha", 29)).toBe("أأ-");
  });

  it("writes roman numerals", () => {
    expect([1, 4, 9, 14, 40, 90, 400, 1994, 3999].map(roman)).toEqual(["i", "iv", "ix", "xiv", "xl", "xc", "cd", "mcmxciv", "mmmcmxcix"]);
    expect(roman(0)).toBe("0");
    expect(roman(4000)).toBe("4000");
  });

  it("knows its kinds, and toggles like the buttons of Word", () => {
    for (const k of [...BULLET_KINDS, ...NUMBER_KINDS, "multi"]) expect(isListKind(k)).toBe(true);
    expect(isListKind("fancy")).toBe(false);
    expect(isListKind(null)).toBe(false);
    expect(isBulletKind("circle")).toBe(true);
    expect(isBulletKind("decimal")).toBe(false);
    expect(toggledList(undefined, "bullet")).toBe("bullet");
    expect(toggledList("bullet", "bullet")).toBeNull();
    expect(toggledList("bullet", "decimal")).toBe("decimal");
    expect(LIST_GAP).toBeGreaterThan(14);
  });
});

describe("the formatting of a paragraph", () => {
  it("is read from the attributes of a node, cleaned", () => {
    const f = paragraphFormat(
      { textAlign: "center", indent: 2.4, list: "decimal", dir: "rtl", lineHeight: "1.5", spaceBefore: 6.4, spaceAfter: 200, shading: "#fef08a", border: "rbxt", borderColor: "#ff0000" },
      10,
    );
    expect(f).toEqual({ align: "center", indent: 2, list: "decimal", dir: "rtl", lineHeight: 1.5, spaceBefore: 6, spaceAfter: 96, shading: "#fef08a", border: "tbr", borderColor: "#ff0000" });
  });

  it("drops what is missing, unknown or invalid (a paragraph saved before all of this)", () => {
    expect(paragraphFormat(undefined, 10)).toEqual({ indent: 0, spaceBefore: 0, spaceAfter: 0 });
    expect(paragraphFormat({ textAlign: "diagonal", indent: -3, list: "fancy", dir: "up", lineHeight: 0, spaceBefore: "x", shading: "red", border: "", borderColor: "#fff" }, 10)).toEqual({
      indent: 0,
      spaceBefore: 0,
      spaceAfter: 0,
    });
    expect(paragraphFormat({ indent: 99 }, 10).indent).toBe(10);
  });

  it("makes attributes back, with null for what is not set (so the editor keeps its defaults)", () => {
    expect(paragraphAttrs({ indent: 1, list: "bullet" })).toEqual({
      textAlign: null,
      indent: 1,
      list: "bullet",
      dir: null,
      lineHeight: null,
      spaceBefore: null,
      spaceAfter: null,
      shading: null,
      border: null,
      borderColor: null,
    });
    // a border color without sides means nothing
    expect(paragraphAttrs({ borderColor: "#000000" }).borderColor).toBeNull();
    expect(paragraphAttrs({ border: "tb", borderColor: "#000000" })).toMatchObject({ border: "tb", borderColor: "#000000" });
  });

  it("cleans its values", () => {
    expect([clampSpace(-5), clampSpace(12.6), clampSpace(500), clampSpace("x")]).toEqual([0, 13, 96, 0]);
    expect([cleanLineHeight(1.234), cleanLineHeight(0.1), cleanLineHeight(9), cleanLineHeight(0), cleanLineHeight("a")]).toEqual([1.23, 0.8, 5, undefined, undefined]);
    expect(cleanSides("rlbtt")).toBe("tblr");
    expect(cleanSides(5)).toBe("");
    expect([cleanColor("#abc"), cleanColor("#AABBCC"), cleanColor("blue"), cleanColor(3)]).toEqual(["#abc", "#AABBCC", undefined, undefined]);
    expect(LINE_STEPS).toContain(1.15);
  });

  it("says whether a paragraph has any formatting of its own", () => {
    expect(isFormattedParagraph(paragraphFormat({}, 10))).toBe(false);
    expect(isFormattedParagraph(paragraphFormat({ list: "bullet" }, 10))).toBe(true);
    expect(isFormattedParagraph(paragraphFormat({ spaceAfter: 4 }, 10))).toBe(true);
  });
});
