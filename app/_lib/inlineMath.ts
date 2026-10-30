// Formulas inside a text (a text box): "the function f(x) = √(x² + 1) is defined on ℝ", with the formula drawn by MathJax like an
// equation block, on the line of the words. In the styled text (richText.ts) a formula is one character, MATH_CHAR, whose style carries
// its LaTeX and its size (`m=`): the text keeps one offset per formula, and the canvas can wrap and measure the line without waiting
// for MathJax. Its drawing (an svg) is made again from the LaTeX when needed, and kept here.
//
// A formula is always written left to right, also in an Arabic text: ∈, ⊂, < … are not turned around there (they would be, as
// plain characters in a right-to-left line).

import { renderEquation, renderInlineEquation } from "./math";

/** The character that stands for a formula in a text (Unicode's "object replacement character"). */
export const MATH_CHAR = "￼";

/** A formula in a text: its LaTeX, and its size in "ex" (MathJax's unit): width, height, and depth under the baseline. */
export interface InlineMath {
  latex: string;
  w: number;
  h: number;
  d: number;
  // Its drawing, kept in the text box's document (like an equation block's), so a page opens without MathJax. Not in the styled
  // string (encodeMath): there it is made again when needed.
  svg?: string;
}

/** One ex is this much of the font size of the text around the formula (MathJax's own ratio). */
export const EX_EM = 0.5;

// The size a formula has before MathJax gave its own: about one letter, sitting on the baseline.
const GUESS = { w: 2, h: 2, d: 0.5 };

const round = (n: number) => Math.round(n * 1000) / 1000;

/** In a style string (⁅…;m=…⁆): the LaTeX encoded, so that ";", "=" and the brackets of the styled text never clash with it. */
export function encodeMath(m: InlineMath): string {
  return [encodeURIComponent(m.latex), round(m.w), round(m.h), round(m.d)].join(",");
}

export function decodeMath(src: string): InlineMath | null {
  const [latex, w, h, d] = src.split(",");
  if (latex === undefined) return null;
  let text: string;
  try {
    text = decodeURIComponent(latex);
  } catch {
    return null;
  }
  const num = (v: string | undefined, guess: number) => (Number.isFinite(Number(v)) && v !== "" && v !== undefined ? Number(v) : guess);
  return { latex: text, w: num(w, GUESS.w), h: num(h, GUESS.h), d: num(d, GUESS.d) };
}

/** A formula with only its LaTeX: the size is guessed until MathJax measures it (`measureInlineMath`). */
export const newInlineMath = (latex: string): InlineMath => ({ latex, ...GUESS });

/** Its size in pixels, for text of `size` px. */
export function mathBox(m: InlineMath, size: number) {
  const ex = size * EX_EM;
  return { width: m.w * ex, height: m.h * ex, depth: m.d * ex };
}

// ---- The drawings (browser only) ----

const drawings = new Map<string, Promise<InlineMath & { svg: string; url: string }>>();
const ready = new Map<string, string>(); // LaTeX → its svg as a data URL, once made

/** A drawing (svg) as an image source. */
export const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** The drawing of a formula, made by MathJax the first time (as in a line of text: smaller fractions, limits on the side). */
export function drawInlineMath(latex: string) {
  let p = drawings.get(latex);
  if (!p) {
    p = (async () => {
      const r = latex.trim() ? await renderInlineEquation(latex) : await renderEquation("");
      const d = Number(/vertical-align:\s*(-?[\d.]+)ex/.exec(r.svg)?.[1] ?? 0);
      const url = svgDataUrl(r.svg);
      ready.set(latex, url);
      return { latex, svg: r.svg, url, w: r.exW, h: r.exH, d: Math.max(0, -d) };
    })();
    drawings.set(latex, p);
  }
  return p;
}

/** A drawing a document keeps for a formula (textboxDoc.ts reads it): known by its LaTeX from then on, wherever the formula is drawn. */
export function keepDrawing(latex: string, svg: string) {
  if (!ready.has(latex)) ready.set(latex, svgDataUrl(svg));
}

/** The drawing to show: the one the formula keeps, or the one already made for its LaTeX (else undefined: `drawInlineMath` makes it). */
export const inlineMathUrl = (m: InlineMath) => (m.svg ? svgDataUrl(m.svg) : ready.get(m.latex));

/** The formula with the size and the drawing MathJax gives it. */
export async function measureInlineMath(latex: string): Promise<InlineMath> {
  const { w, h, d, svg } = await drawInlineMath(latex);
  return { latex, w, h, d, svg };
}
