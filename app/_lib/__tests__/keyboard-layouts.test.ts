import { convertLatexToMarkup } from "mathlive/ssr";
import { describe, expect, it } from "vitest";
import { keyLabel, type KeyboardTab } from "../keyboard/keys";
import { keyboardTabsFor } from "../keyboard/layouts";
import { mathTabs } from "../keyboard/mathLayout";
import { physicsTabs } from "../keyboard/physicsLayout";
import { renderEquation } from "../math";
import { SUBJECTS } from "../subjects";

const layouts: [string, KeyboardTab[]][] = [
  ["math", mathTabs],
  ["physics", physicsTabs],
];
const allKeys = (tabs: KeyboardTab[]) => tabs.flatMap((tab) => tab.buttons.map((key) => ({ tab: tab.id, key })));

describe("keyboard layouts", () => {
  it.each(layouts)("%s: tab ids are unique and every tab has keys", (_name, tabs) => {
    const ids = tabs.map((tab) => tab.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tab of tabs) {
      expect(tab.label.trim()).not.toBe("");
      expect(tab.buttons.length).toBeGreaterThan(0);
    }
  });

  it.each(layouts)("%s: every key has LaTeX and a tooltip, and none is repeated in its tab", (_name, tabs) => {
    for (const tab of tabs) {
      const seen = new Set<string>();
      for (const key of tab.buttons) {
        expect(key.latex.trim(), `${tab.id}: empty latex`).not.toBe("");
        expect(key.title.trim(), `${tab.id}: ${key.latex} has no tooltip`).not.toBe("");
        const id = key.latex + "|" + key.title;
        expect(seen.has(id), `${tab.id}: "${key.title}" is twice`).toBe(false);
        seen.add(id);
      }
    }
  });

  it("the math keyboard has the Basics and Trigonometry tabs", () => {
    const ids = mathTabs.map((tab) => tab.id);
    expect(ids).toContain("basic");
    expect(ids).toContain("trig");
  });

  it("the physics keyboard has vectors, Greek letters, units and constants", () => {
    const ids = physicsTabs.map((tab) => tab.id);
    for (const id of ["vectors", "greek", "units", "constants"]) expect(ids).toContain(id);
  });

  it("a physics paper still has the everyday symbols (fraction, power, root)", () => {
    const latex = physicsTabs.find((tab) => tab.id === "basic")?.buttons.map((key) => key.latex) ?? [];
    expect(latex).toContain("\\frac{#0}{#?}");
    expect(latex).toContain("\\sqrt{#0}");
  });

  it("Physics gets the physics tabs and every other subject the math tabs", () => {
    for (const subject of SUBJECTS) {
      expect(keyboardTabsFor(subject), subject).toBe(subject === "Physics" ? physicsTabs : mathTabs);
    }
  });

  it("the two keyboards really differ", () => {
    expect(physicsTabs.map((tab) => tab.id)).not.toEqual(mathTabs.map((tab) => tab.id));
  });

  // The keys insert LaTeX through MathLive (#@ and #0 are filled in by `insert`; #? is its box to fill).
  it.each(layouts)("%s: every key is LaTeX MathLive understands", (_name, tabs) => {
    for (const { tab, key } of allKeys(tabs)) {
      const markup = convertLatexToMarkup(key.latex.replace(/#@|#0/g, "x"));
      expect(markup.includes("ML__error"), `${tab}: "${key.title}" (${key.latex}) is not valid in MathLive`).toBe(false);
    }
  });

  // The faces are drawn by MathJax, which shows an unknown command in red instead of failing.
  it.each(layouts)(
    "%s: every key face is drawn by MathJax without an unknown command",
    async (_name, tabs) => {
      for (const { tab, key } of allKeys(tabs)) {
        const { svg } = await renderEquation(keyLabel(key));
        expect(/fill="red"|stroke="red"/.test(svg), `${tab}: "${key.title}" (${keyLabel(key)}) is not valid in MathJax`).toBe(false);
      }
    },
    30_000,
  );
});
