import { describe, expect, it } from "vitest";
import { keyboardTabsOf, KEYBOARD_LAYOUTS } from "../keyboard/layouts";
import { plainFromLatex, type PlainFlavor } from "../keyboard/plainText";

const label = (latex: string, selection = "") => plainFromLatex(latex, "label", selection);
const formula = (latex: string, selection = "") => plainFromLatex(latex, "formula", selection);

describe("plainFromLatex: signs and letters", () => {
  it("turns Greek letters and signs into Unicode", () => {
    expect(label("\\alpha")).toEqual({ text: "α", caret: 1 });
    expect(label("\\Omega")?.text).toBe("Ω");
    expect(label("\\times")?.text).toBe("×");
    expect(label("\\leq")?.text).toBe("≤");
    expect(label("\\rightleftharpoons")?.text).toBe("⇌");
    expect(label("\\infty")?.text).toBe("∞");
    expect(label("\\%")?.text).toBe("%");
  });

  it("keeps plain characters, and ignores the spaces LaTeX ignores", () => {
    expect(label("E_{pp}=mgh")?.text).toBe("E_{pp}=mgh");
    expect(label("f'(x)")?.text).toBe("f'(x)");
    expect(label("\\lim_{x \\to +\\infty}")?.text).toBe("lim_{x→+∞}");
  });

  it("writes a unit after a number with a space, and a degree sign without one", () => {
    expect(label("\\,\\mathrm{m\\cdot s^{-1}}")?.text).toBe(" m·s^{-1}");
    expect(label("\\,^{\\circ}\\mathrm{C}")?.text).toBe(" °C");
    expect(label("^{\\circ}")?.text).toBe("°");
    expect(label("\\times10^{#?}")).toEqual({ text: "×10^{}", caret: 5 });
  });

  it("writes the letters of number sets and the text of \\text as they are", () => {
    expect(label("\\mathbb{R}^{*}")?.text).toBe("ℝ^{*}");
    expect(label("\\text{si }x")?.text).toBe("si x");
    expect(label("\\mathcal{F}")?.text).toBe("F");
  });
});

describe("plainFromLatex: structures", () => {
  it("puts the cursor in the first box", () => {
    expect(label("\\left(#0\\right)")).toEqual({ text: "()", caret: 1 });
    expect(label("\\sqrt{#0}")).toEqual({ text: "√()", caret: 2 });
    expect(label("\\left[#?;#?\\right]")).toEqual({ text: "[;]", caret: 1 });
    expect(label("\\left\\{#?\\right\\}")).toEqual({ text: "{}", caret: 1 });
  });

  it("keeps the selected part where the key says #0", () => {
    expect(label("\\left(#0\\right)", "a+b")).toEqual({ text: "(a+b)", caret: 5 });
    expect(label("\\frac{#0}{#?}", "a+b")).toEqual({ text: "(a+b)/()", caret: 7 });
    expect(label("\\sqrt{#0}", "x")).toEqual({ text: "√(x)", caret: 4 });
  });

  it("writes a fraction with brackets only where they are needed", () => {
    expect(label("\\frac{\\pi}{2}")?.text).toBe("π/2");
    expect(label("\\frac{1}{2}")?.text).toBe("1/2");
    expect(label("x=\\frac{-b\\pm\\sqrt{\\Delta}}{2a}")?.text).toBe("x=(-b±√(Δ))/(2a)");
    expect(label("\\frac{#0}{#?}")).toEqual({ text: "()/()", caret: 1 });
  });

  it("writes accents as the combining sign after the letter", () => {
    expect(label("\\vec{v}")?.text).toBe("v\u20D7");
    expect(label("\\overrightarrow{OM}")?.text).toBe("OM\u20D7");
    expect(label("\\Delta\\vec{v}")?.text).toBe("Δv\u20D7");
    expect(label("\\dot{x}")?.text).toBe("x\u0307");
  });

  it("writes a script as markup in a label and without braces where a formula allows it", () => {
    expect(label("#@^{2}")).toEqual({ text: "^{2}", caret: 4 });
    expect(label("#@_{#?}")).toEqual({ text: "_{}", caret: 2 });
    expect(label("e^{-\\frac{t}{\\tau}}")?.text).toBe("e^{-t/τ}");
    expect(formula("#@^{2}")?.text).toBe("^2");
    expect(formula("e^{-\\frac{t}{\\tau}}")?.text).toBe("e^(-t/τ)");
    expect(formula("#@^{#?}")).toEqual({ text: "^()", caret: 2 });
  });

  it("has no subscripts in a formula, and no text form for what is drawn in two dimensions", () => {
    expect(formula("u_{n}")).toBeNull();
    expect(formula("\\lim_{x\\to+\\infty}")).toBeNull();
    expect(label("\\begin{pmatrix}#?\\\\#?\\end{pmatrix}")).toBeNull();
    expect(label("\\begin{cases}#?\\\\#?\\end{cases}")).toBeNull();
    expect(label("\\sqrt[#?]{#0}")).toBeNull();
    expect(label("\\binom{#?}{#?}")).toBeNull();
    expect(label("\\vec{#?}")).toBeNull(); // no letter to put the arrow on
    expect(label("\\dot{#@}")).toBeNull();
  });

  it("reads what the Graph Studio's formula field reads", () => {
    expect(formula("\\pi")?.text).toBe("π");
    expect(formula("\\sqrt{#0}", "t")?.text).toBe("√(t)");
    expect(formula("\\sin\\left(#0\\right)", "2*pi*t/12")?.text).toBe("sin(2*pi*t/12)");
    expect(formula("\\cdot")?.text).toBe("·");
  });
});

describe("plainFromLatex: the keys of the keyboard", () => {
  const flavors: PlainFlavor[] = ["label", "formula"];
  const keys = KEYBOARD_LAYOUTS.flatMap((layout) => keyboardTabsOf(layout).flatMap((tab) => tab.buttons.map((key) => ({ layout, tab: tab.id, key }))));

  it.each(flavors)("%s: no key throws, and the text of a key is never empty", (flavor) => {
    for (const { layout, tab, key } of keys) {
      const plain = plainFromLatex(key.latex, flavor, "");
      if (!plain) continue;
      expect(plain.text, `${layout}/${tab}: "${key.title}"`).not.toBe("");
      expect(plain.caret).toBeGreaterThanOrEqual(0);
      expect(plain.caret).toBeLessThanOrEqual(plain.text.length);
      expect(plain.text.includes("\u0001"), `${layout}/${tab}: "${key.title}" keeps a box marker`).toBe(false);
      expect(plain.text.includes("\\"), `${layout}/${tab}: "${key.title}" keeps a backslash`).toBe(false);
    }
  });

  it("every Basics, Greek and Units key but the n-th root has a text form in a label", () => {
    for (const { layout, tab, key } of keys) {
      if (!["basic", "greek", "units", "constants"].includes(tab)) continue;
      if (key.title === "n-th root") continue;
      expect(label(key.latex), `${layout}/${tab}: "${key.title}" (${key.latex})`).not.toBeNull();
    }
  });

  it("most keys of every tab work in a label", () => {
    for (const layout of KEYBOARD_LAYOUTS) {
      for (const tab of keyboardTabsOf(layout)) {
        const worked = tab.buttons.filter((key) => label(key.latex)).length;
        expect(worked, `${layout}/${tab.id}`).toBeGreaterThan(0);
      }
    }
  });
});
