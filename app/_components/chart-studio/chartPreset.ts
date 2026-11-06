import { CONTENT_WIDTH } from "@/app/_lib/a4";
import type { BlockPreset } from "@/app/_lib/blocks";
import { renderChartSvg } from "@/app/_lib/chart/render";
import type { ChartConfig } from "@/app/_lib/chart/types";
import { svgUrl } from "@/app/_lib/library";
import type { BlockPatch } from "@/app/_lib/useExam";

// The picture of a chart (an image block's `src`): its own size at 100 %, scaled down if it is wider than the page. (The numbers have the decimal
// comma of French and Arabic, the languages of an exam.)
export function chartImage(config: ChartConfig) {
  const width = Math.min(CONTENT_WIDTH, config.width);
  return {
    src: svgUrl(renderChartSvg(config)),
    ratio: config.width / config.height,
    width,
    height: (width * config.height) / config.width,
  };
}

/** A new image block that carries its chart, so that the Studio can reopen it (double-click) with the same values and settings. */
export function chartPreset(config: ChartConfig): BlockPreset {
  return { ...chartImage(config), chartStudio: config } as BlockPreset;
}

/** What Update puts in the block */
export function chartPatch(config: ChartConfig): BlockPatch {
  const { width, height, ...rest } = chartImage(config);
  return { ...rest, chartStudio: config, srcAnswer: undefined, drawing: undefined, molecule: undefined, graphStudio: undefined, circuitStudio: undefined, probaStudio: undefined, layout: { width, height } } as unknown as BlockPatch;
}
