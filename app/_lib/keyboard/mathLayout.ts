// The math keyboard, chosen for writing exam questions. Used for every subject except Physics.
//
// Only building blocks: no ready-made formulas or identities (the Clipboard tab keeps the teacher's own equations instead), and no
// key that is just another key plus a power or an index (sin², u_{n+1}, ℝ*, π/3…): those are typed with Squared / Power / Index.

import { k, type KeyboardTab } from "./keys";
import { basicTab, greekTab } from "./sharedTabs";

const functionsTab: KeyboardTab = {
  id: "functions",
  label: "Functions",
  buttons: [
    k("f(x)=", "f(x) ="),
    k("\\sin\\left(#0\\right)", "Sine"),
    k("\\cos\\left(#0\\right)", "Cosine"),
    k("\\tan\\left(#0\\right)", "Tangent"),
    k("\\arcsin\\left(#0\\right)", "Arcsine"),
    k("\\arccos\\left(#0\\right)", "Arccosine"),
    k("\\arctan\\left(#0\\right)", "Arctangent"),
    k("\\ln\\left(#0\\right)", "Natural log"),
    k("\\log_{#?}\\left(#0\\right)", "Log base a"),
    k("e^{#?}", "Exponential"),
    k("f'(x)", "Derivative"),
    k("\\frac{\\mathrm{d}#?}{\\mathrm{d}x}", "d/dx"),
    k("\\lim_{x\\to #?}", "Limit when x → a"),
    k("\\lim_{x\\to+\\infty}", "Limit at +∞"),
    k("\\to", "Tends to"),
    k("\\int_{#?}^{#?}#?\\,\\mathrm{d}x", "Integral"),
    k("\\left[#?\\right]_{#?}^{#?}", "Bracket [F(x)] from a to b"),
    k("\\sum_{k=#?}^{#?}#?", "Sum"),
    k("u_{n}", "Sequence uₙ"),
    k("#@!", "Factorial"),
    k("\\binom{#?}{#?}", "Binomial"),
  ],
};

const setsTab: KeyboardTab = {
  id: "sets",
  label: "Sets & logic",
  buttons: [
    k("\\in", "Belongs to"),
    k("\\notin", "Does not belong to"),
    k("\\subset", "Subset"),
    k("\\cup", "Union"),
    k("\\cap", "Intersection"),
    k("\\emptyset", "Empty set"),
    k("\\mathbb{N}", "Natural numbers"),
    k("\\mathbb{Z}", "Integers"),
    k("\\mathbb{Q}", "Rationals"),
    k("\\mathbb{R}", "Real numbers"),
    k("\\left[#?;#?\\right]", "Closed interval"),
    k("\\left]#?;#?\\right[", "Open interval"),
    k("\\left\\{#?\\right\\}", "Set { }"),
    k("\\Rightarrow", "Implies"),
    k("\\Leftrightarrow", "Equivalent"),
    k("\\forall", "For all"),
    k("\\exists", "There exists"),
    k("\\begin{cases}#?\\\\#?\\end{cases}", "System of equations"),
  ],
};

const geometryTab: KeyboardTab = {
  id: "geometry",
  label: "Geometry",
  buttons: [
    k("\\overrightarrow{#?}", "Vector AB"),
    k("\\vec{#?}", "Vector u"),
    k("\\left\\Vert#?\\right\\Vert", "Norm"),
    k("\\widehat{#?}", "Angle"),
    k("\\overline{#?}", "Bar"),
    k("\\parallel", "Parallel"),
    k("\\perp", "Perpendicular"),
    k("\\triangle", "Triangle"),
    k("\\left(#?;#?\\right)", "Coordinates (x ; y)"),
    k("\\begin{pmatrix}#?\\\\#?\\end{pmatrix}", "Column vector"),
  ],
};

export const mathTabs: KeyboardTab[] = [basicTab, functionsTab, setsTab, geometryTab, greekTab];
