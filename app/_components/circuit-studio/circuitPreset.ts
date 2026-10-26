import { CONTENT_WIDTH } from "@/app/_lib/a4";
import type { BlockPreset } from "@/app/_lib/blocks";
import { renderCircuitSvg } from "@/app/_lib/circuit/svg";
import type { CircuitConfig } from "@/app/_lib/circuit/types";
import { svgUrl } from "@/app/_lib/library";

// The picture of a circuit (an image block's `src`), with the shape the page needs: its own size at 100 %, scaled down if it is
// wider than the page. Null for an empty circuit.
export function circuitImage(config: CircuitConfig) {
  const r = renderCircuitSvg(config);
  if (!r) return null;
  const width = Math.min(CONTENT_WIDTH, r.width);
  return { src: svgUrl(r.svg), ratio: r.width / r.height, width, height: (width * r.height) / r.width };
}

// A new image block that carries its circuit, so the Studio can reopen it (double-click) with everything it was made of.
export function circuitPreset(config: CircuitConfig): BlockPreset | null {
  const image = circuitImage(config);
  return image && { ...image, circuitStudio: config };
}
