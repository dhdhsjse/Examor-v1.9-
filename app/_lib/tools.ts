import { CONTENT_WIDTH } from "./a4";
import type { BlockPreset } from "./blocks";
import { renderFigure } from "./figures";
import { svgSize, svgUrl, type Asset } from "./library";
import type { BlockType, Lang } from "./types";

// What a toolbox tile (or a dragged item) does.
export type ToolAction =
  | { kind: "block"; type: BlockType; preset?: BlockPreset }
  | { kind: "asset"; assetId: string }
  | { kind: "importImage" }
  | { kind: "library" };

// Data type used for HTML drag & drop onto the page.
export const DRAG_MIME = "application/x-exam-builder";

// An image block showing an svg, at its natural width (within the page).
function svgImage(svg: string, extra: BlockPreset = {}): { type: BlockType; preset: BlockPreset } {
  const { w, h } = svgSize(svg);
  const width = Math.min(CONTENT_WIDTH, Math.max(120, w));
  return { type: "image", preset: { src: svgUrl(svg), ratio: w / h, width, height: (width * h) / w, ...extra } };
}

// Turn a library item into the block it creates. Figures are drawn in the exam's language.
export function assetToBlock(a: Asset, lang: Lang): { type: BlockType; preset: BlockPreset } {
  if (a.block) return { type: a.block.type, preset: structuredClone(a.block.preset) };
  if (a.kind === "table") {
    return { type: "table", preset: { cells: (a.cells ?? [[""]]).map((r) => [...r]), header: true } };
  }
  if (a.figure) {
    const spec = renderFigure(a.figure.id, a.figure.params, lang);
    if (spec) return svgImage(spec.svg, { figure: { id: a.figure.id, params: spec.params } });
  }
  if (a.svg) return svgImage(a.svg);
  const ratio = a.ratio ?? 1;
  const width = Math.min(CONTENT_WIDTH, 280);
  return { type: "image", preset: { src: a.src ?? "", ratio, width, height: width / ratio } };
}
