import type Konva from "konva";
import { getPageMm } from "./pageFormats";
import { pageBoxes } from "./pageStack";
import { SvgContext } from "./svgContext";
import { DEFAULT_PRINT_LAYOUT, sheetsOf, type PrintLayout } from "./printLayout";
import type { Page } from "./types";

// Each page of the canvas as an image. pixelRatio 3 ≈ 290 DPI: sharp when printed.
export function stagePageImages(stage: Konva.Stage, pages: Page[], pixelRatio = 3, quality = 0.92): string[] {
  return pageBoxes(pages).map((box) =>
    stage.toDataURL({ x: box.left, y: box.top, width: box.width, height: box.height, pixelRatio, mimeType: "image/jpeg", quality }),
  );
}

// Each page of the canvas as vector SVG (see svgContext): Konva draws each layer once more, into an SVG recorder instead of its canvas,
// and what lies on the page is kept. Text stays text: in the PDF it can be selected and searched, and it is sharp at any size.
export function stagePageSvgs(stage: Konva.Stage, pages: Page[], gray = false, prefix = ""): string[] {
  return pageBoxes(pages).map((box, i) => {
    const svg = new SvgContext({ area: { x: box.left, y: box.top, width: box.width, height: box.height }, gray, idPrefix: `${prefix}p${i}-` });
    for (const layer of stage.getLayers()) {
      if (!layer.isVisible()) continue;
      const ctx = layer.getCanvas().getContext() as unknown as { _context: unknown };
      const real = ctx._context;
      ctx._context = svg;
      try {
        layer.drawScene();
      } finally {
        ctx._context = real;
      }
    }
    return svg.toSvg();
  });
}

// The page images in black and white (grey shades), still JPEG: what a black-and-white copy prints, and no colour ink spent on it.
export async function grayImages(images: string[]): Promise<string[]> {
  return Promise.all(
    images.map(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return src;
      ctx.filter = "grayscale(1)";
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.92);
    }),
  );
}

// Put page images in a PDF: one PDF page per sheet of paper (see printLayout), each page image in its place on it. One page per sheet:
// each PDF page with the size and orientation of its exam page. The text is part of the pictures, so the letters (Arabic too) look
// exactly the same on any computer or printer, without needing the fonts.
export async function imagesToPdf(images: string[], pages: Page[], layout: PrintLayout = DEFAULT_PRINT_LAYOUT, rtl = false): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const sheets = sheetsOf(pages.map((p) => getPageMm(p.format)), layout, rtl);
  const orientation = (s: { width: number; height: number }) => (s.width > s.height ? "landscape" : "portrait");
  const first = sheets[0] ?? { ...getPageMm(), slots: [] };
  const pdf = new jsPDF({ unit: "mm", format: [first.width, first.height], orientation: orientation(first), compress: true });
  sheets.forEach((sheet, i) => {
    if (i > 0) pdf.addPage([sheet.width, sheet.height], orientation(sheet));
    for (const s of sheet.slots) if (images[s.page]) pdf.addImage(images[s.page], "JPEG", s.x, s.y, s.width, s.height);
  });
  return new Uint8Array(pdf.output("arraybuffer"));
}

export const stageToPdf = (stage: Konva.Stage, pages: Page[]) => imagesToPdf(stagePageImages(stage, pages), pages);
