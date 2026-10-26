import { CONTENT_WIDTH } from "@/app/_lib/a4";
import type { BlockPreset } from "@/app/_lib/blocks";
import { renderGraphSvg } from "@/app/_lib/graph/svg";
import type { GraphConfig } from "@/app/_lib/graph/types";
import type { GraphView } from "./useGraphStudio";
import { svgUrl } from "@/app/_lib/library";

// The picture of a graph paper (an image block's `src`), with the shape the page needs: its own size at 100 %, scaled down if
// it is wider than the page. Null if the paper cannot be drawn. The student's view has the masks applied (the picture is the student
// version; the configuration it carries still has everything, so the Studio reopens on all of it).
export function graphImage(config: GraphConfig, view: GraphView = "teacher") {
  const r = renderGraphSvg(config, { student: view === "student" });
  if (!r) return null;
  const width = Math.min(CONTENT_WIDTH, r.width);
  return { src: svgUrl(r.svg), ratio: r.width / r.height, width, height: (width * r.height) / r.width };
}

// A new image block that carries its configuration, so the Studio can reopen it (double-click) with the same paper.
export function graphPreset(config: GraphConfig, view: GraphView = "teacher"): BlockPreset | null {
  const image = graphImage(config, view);
  return image && { ...image, graphStudio: config };
}
