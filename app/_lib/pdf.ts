import type Konva from "konva";
import { getPageMm } from "./pageFormats";
import { pageBoxes } from "./pageStack";
import type { Page } from "./types";

// Each page of the canvas as an image. pixelRatio 3 ≈ 290 DPI: sharp when printed.
export function stagePageImages(stage: Konva.Stage, pages: Page[], pixelRatio = 3, quality = 0.92): string[] {
  return pageBoxes(pages).map((box) =>
    stage.toDataURL({ x: box.left, y: box.top, width: box.width, height: box.height, pixelRatio, mimeType: "image/jpeg", quality }),
  );
}

// Put page images in a PDF, each PDF page with the size and orientation of its exam page. The text is
// part of the pictures, so the letters (Arabic too) look exactly the same on any computer or printer,
// without needing the fonts.
export async function imagesToPdf(images: string[], pages: Page[]): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const sizes = pages.map((p) => getPageMm(p.format));
  const orientation = (s: { width: number; height: number }) => (s.width > s.height ? "landscape" : "portrait");
  const first = sizes[0] ?? getPageMm();
  const pdf = new jsPDF({ unit: "mm", format: [first.width, first.height], orientation: orientation(first), compress: true });
  images.forEach((image, i) => {
    const size = sizes[i] ?? first;
    if (i > 0) pdf.addPage([size.width, size.height], orientation(size));
    pdf.addImage(image, "JPEG", 0, 0, size.width, size.height);
  });
  return new Uint8Array(pdf.output("arraybuffer"));
}

export const stageToPdf = (stage: Konva.Stage, pages: Page[]) => imagesToPdf(stagePageImages(stage, pages), pages);
