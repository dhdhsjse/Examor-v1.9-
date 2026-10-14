import type Konva from "konva";
import { PAGE_HEIGHT, PAGE_WIDTH } from "./a4";
import { pageTop } from "./pageStack";

// Turn each page of the canvas into a high-resolution image and put them in an A4 PDF.
export async function stageToPdf(stage: Konva.Stage, pageCount: number): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });

  for (let i = 0; i < pageCount; i++) {
    if (i > 0) pdf.addPage();
    const image = stage.toDataURL({
      x: 0,
      y: pageTop(i),
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      pixelRatio: 3, // ~290 DPI: sharp when printed
      mimeType: "image/jpeg",
      quality: 0.92,
    });
    pdf.addImage(image, "JPEG", 0, 0, 210, 297);
  }
  return new Uint8Array(pdf.output("arraybuffer"));
}
