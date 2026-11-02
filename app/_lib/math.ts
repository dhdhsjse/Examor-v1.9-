// Turns LaTeX (typed in MathLive) into a self-contained SVG drawing with MathJax,
// so equations can be drawn on the canvas and printed in the PDF.

type Converter = (latex: string, display?: boolean) => string;
let converter: Promise<Converter> | null = null;

// Load MathJax only the first time an equation is used (it is big).
function getConverter(): Promise<Converter> {
  converter ??= (async () => {
    // MathJax reads its version from this global; without it, it calls Node's `require` and fails in the app.
    (globalThis as { PACKAGE_VERSION?: string }).PACKAGE_VERSION ??= "3.2.1";
    const [{ mathjax }, { TeX }, { SVG }, { liteAdaptor }, { RegisterHTMLHandler }, { AllPackages }] = await Promise.all([
      import("mathjax-full/js/mathjax.js"),
      import("mathjax-full/js/input/tex.js"),
      import("mathjax-full/js/output/svg.js"),
      import("mathjax-full/js/adaptors/liteAdaptor.js"),
      import("mathjax-full/js/handlers/html.js"),
      import("mathjax-full/js/input/tex/AllPackages.js"),
    ]);
    const adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    const doc = mathjax.document("", {
      InputJax: new TeX({ packages: AllPackages }),
      OutputJax: new SVG({ fontCache: "none" }), // no shared glyphs: each svg stands alone
    });
    return (latex: string, display = true) => adaptor.innerHTML(doc.convert(latex, { display }));
  })();
  return converter;
}

export interface RenderedEquation {
  svg: string;
  exW: number; // size in "ex" units
  exH: number;
}

// A box of the equation field not filled in yet (MathLive's \placeholder, left by a key like "squared") is not LaTeX MathJax knows:
// its content, or a light square when empty.
const fillPlaceholders = (latex: string) =>
  latex.replace(/\\placeholder(?:\[[^\]]*\])?\{([^{}]*)\}/g, (_, inner: string) => (inner.trim() ? inner : "{\\color{#a1a1aa}{\\square}}"));

export async function renderEquation(latex: string): Promise<RenderedEquation> {
  const convert = await getConverter();
  // An empty equation shows a light hint box, so it can still be seen and clicked on the page.
  return sized(convert(fillPlaceholders(latex).trim() || "\\color{#a1a1aa}{\\boxed{\\text{ Équation }}}"));
}

// A formula in a line of text (inlineMath.ts): drawn the way it is in a sentence (fractions and limits kept small).
export async function renderInlineEquation(latex: string): Promise<RenderedEquation> {
  const convert = await getConverter();
  return sized(convert(fillPlaceholders(latex), false));
}

function sized(drawn: string): RenderedEquation {
  let svg = drawn;
  if (!svg.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  const exW = Number(/width="([\d.]+)ex"/.exec(svg)?.[1] ?? 10);
  const exH = Number(/height="([\d.]+)ex"/.exec(svg)?.[1] ?? 3);
  return { svg, exW, exH };
}

// Default drawing size: pixels per "ex".
export const EX_PX = 9;
