import { convertLatexToMarkup } from "mathlive/ssr";
import { describe, expect, it } from "vitest";
import { keyLabel, type KeyboardTab } from "../keyboard/keys";
import { keyboardTabsFor, keyboardTabsOf, KEYBOARD_LAYOUTS, layoutFor } from "../keyboard/layouts";
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

  // One key, one place: the same key in two tabs is clutter (π lives in Basics, θ in Greek letters, sin in Functions…).
  it.each(layouts)("%s: no key is in two tabs", (_name, tabs) => {
    const home = new Map<string, string>();
    for (const { tab, key } of allKeys(tabs)) {
      expect(home.get(key.latex), `"${key.title}" (${key.latex}) is in ${home.get(key.latex)} and ${tab}`).toBeUndefined();
      home.set(key.latex, tab);
    }
  });

  it("the math keyboard has the Basics and Functions tabs", () => {
    const ids = mathTabs.map((tab) => tab.id);
    expect(ids).toContain("basic");
    expect(ids).toContain("functions");
  });

  it("the physics keyboard has vectors, Greek letters, and units & constants", () => {
    const ids = physicsTabs.map((tab) => tab.id);
    for (const id of ["vectors", "greek", "units"]) expect(ids).toContain(id);
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

  // The teacher can pick Math or Physics by hand: either layout is available whatever the subject, and the subject only sets the start.
  it("each layout can be picked by hand, whatever the subject", () => {
    expect(keyboardTabsOf("math")).toBe(mathTabs);
    expect(keyboardTabsOf("physics")).toBe(physicsTabs);
    expect(KEYBOARD_LAYOUTS).toEqual(["math", "physics"]);
  });

  it("the subject picks the layout a keyboard starts with", () => {
    for (const subject of SUBJECTS) expect(layoutFor(subject), subject).toBe(subject === "Physics" ? "physics" : "math");
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

  // A key like "squared" pressed in an empty equation leaves MathLive's \placeholder{} in it: the page still draws it.
  it("an equation with a box not filled in is drawn without an unknown command", async () => {
    for (const latex of ["\\placeholder{}^{2}", "\\frac{\\placeholder{}}{\\placeholder[b]{3}}"]) {
      const { svg } = await renderEquation(latex);
      expect(/fill="red"|stroke="red"/.test(svg), latex).toBe(false);
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
