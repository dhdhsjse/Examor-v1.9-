// Turns LaTeX (typed in MathLive) into a self-contained SVG drawing with MathJax,
// so equations can be drawn on the canvas and printed in the PDF.

type Converter = (latex: string) => string;
let converter: Promise<Converter> | null = null;

// Load MathJax only the first time an equation is used (it is big).
function getConverter(): Promise<Converter> {
  converter ??= (async () => {
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
    return (latex: string) => adaptor.innerHTML(doc.convert(latex, { display: true }));
  })();
  return converter;
}

export interface RenderedEquation {
  svg: string;
  exW: number; // size in "ex" units
  exH: number;
}

export async function renderEquation(latex: string): Promise<RenderedEquation> {
  const convert = await getConverter();
  let svg = convert(latex.trim() || "\\square");
  if (!svg.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  const exW = Number(/width="([\d.]+)ex"/.exec(svg)?.[1] ?? 10);
  const exH = Number(/height="([\d.]+)ex"/.exec(svg)?.[1] ?? 3);
  return { svg, exW, exH };
}

// Default drawing size: pixels per "ex".
export const EX_PX = 9;
