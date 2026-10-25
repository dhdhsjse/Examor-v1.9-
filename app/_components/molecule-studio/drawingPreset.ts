import { CONTENT_WIDTH } from "@/app/_lib/a4";
import type { BlockPreset } from "@/app/_lib/blocks";
import type { StudioView } from "@/app/_lib/chemistry/masking";
import { renderDrawingSvg } from "@/app/_lib/chemistry/svg";
import type { MoleculeGraph } from "@/app/_lib/chemistry/types";
import { svgUrl } from "@/app/_lib/library";

// The picture of a drawing (an image block's `src`), with the shape the page needs: its own size at 100 %,
// scaled down if it is wider than the page. Null for an empty drawing. The student's view has the masks applied
// (the picture is the student version; the graph it carries still has everything, so the Studio reopens on all of it).
export function drawingImage(graph: MoleculeGraph, view: StudioView = "teacher") {
  const r = renderDrawingSvg(graph, { student: view === "student" });
  if (!r) return null;
  const width = Math.min(CONTENT_WIDTH, Math.max(60, r.width));
  return { src: svgUrl(r.svg), ratio: r.width / r.height, width, height: (width * r.height) / r.width };
}

// A new image block that carries its drawing, so the Studio can reopen it (double-click) with everything it was made of.
export function drawingPreset(graph: MoleculeGraph, view: StudioView = "teacher"): BlockPreset | null {
  const image = drawingImage(graph, view);
  return image && { ...image, drawing: graph };
}
