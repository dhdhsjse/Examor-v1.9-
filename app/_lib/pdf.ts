import type Konva from "konva";
import { PAGE_HEIGHT, PAGE_WIDTH } from "./a4";
import { pageTop } from "./pageStack";

// Each page of the canvas as an image. pixelRatio 3 ≈ 290 DPI: sharp when printed.
export function stagePageImages(stage: Konva.Stage, pageCount: number, pixelRatio = 3, quality = 0.92): string[] {
  return Array.from({ length: pageCount }, (_, i) =>
    stage.toDataURL({ x: 0, y: pageTop(i), width: PAGE_WIDTH, height: PAGE_HEIGHT, pixelRatio, mimeType: "image/jpeg", quality }),
  );
}

// Put page images in an A4 PDF. The text is part of the pictures, so the letters (Arabic too)
// look exactly the same on any computer or printer, without needing the fonts.
export async function imagesToPdf(images: string[]): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  images.forEach((image, i) => {
    if (i > 0) pdf.addPage();
    pdf.addImage(image, "JPEG", 0, 0, 210, 297);
  });
  return new Uint8Array(pdf.output("arraybuffer"));
}

export const stageToPdf = (stage: Konva.Stage, pageCount: number) => imagesToPdf(stagePageImages(stage, pageCount));
