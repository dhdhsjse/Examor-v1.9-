import { CONTENT_WIDTH } from "./a4";
import type { BlockPreset } from "./blocks";
import { svgSize, svgUrl, type Asset } from "./library";
import type { BlockType } from "./types";

// What a toolbox tile (or a dragged item) does.
export type ToolAction =
  | { kind: "block"; type: BlockType; preset?: BlockPreset }
  | { kind: "asset"; assetId: string }
  | { kind: "importImage" }
  | { kind: "library" };

// Data type used for HTML drag & drop onto the page.
export const DRAG_MIME = "application/x-exam-builder";

// Turn a library item into the block it creates.
export function assetToBlock(a: Asset): { type: BlockType; preset: BlockPreset } {
  if (a.kind === "table") {
    return { type: "table", preset: { cells: (a.cells ?? [[""]]).map((r) => [...r]), header: true } };
  }
  const src = a.svg ? svgUrl(a.svg) : (a.src ?? "");
  const ratio = a.svg ? svgSize(a.svg).w / svgSize(a.svg).h : (a.ratio ?? 1);
  const natural = a.svg ? svgSize(a.svg).w : 280;
  const width = Math.min(CONTENT_WIDTH, Math.max(120, natural));
  return { type: "image", preset: { src, ratio, width, height: width / ratio } };
}
