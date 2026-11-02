import { CONTENT_WIDTH } from "@/app/_lib/a4";
import type { BlockPreset } from "@/app/_lib/blocks";
import { svgUrl } from "@/app/_lib/library";
import { renderProbaSvg } from "@/app/_lib/proba/svg";
import type { ProbaConfig } from "@/app/_lib/proba/types";

// The picture of a probability drawing (an image block's `src`), with the shape the page needs: its own size at 100 %, scaled
// down if it is wider than the page. Null for an empty drawing.
export function probaImage(config: ProbaConfig) {
  const r = renderProbaSvg(config);
  if (!r) return null;
  const width = Math.min(CONTENT_WIDTH, r.width);
  return { src: svgUrl(r.svg), ratio: r.width / r.height, width, height: (width * r.height) / r.width };
}

// A new image block that carries its drawing, so the Studio can reopen it (double-click) with everything it was made of.
export function probaPreset(config: ProbaConfig): BlockPreset | null {
  const image = probaImage(config);
  return image && { ...image, probaStudio: config };
}
