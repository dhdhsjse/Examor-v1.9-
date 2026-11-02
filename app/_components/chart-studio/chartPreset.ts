import { CONTENT_WIDTH } from "@/app/_lib/a4";
import type { BlockPreset } from "@/app/_lib/blocks";
import { renderChartSvg } from "@/app/_lib/chart/render";
import type { ChartConfig } from "@/app/_lib/chart/types";
import { svgUrl } from "@/app/_lib/library";
import type { Lang } from "@/app/_lib/types";
import type { BlockPatch } from "@/app/_lib/useExam";

// The picture of a chart (an image block's `src`), with the shape the page needs: its own size at 100 %, scaled down if it is wider than the page.
// A chart that is blank for the students has the blank picture in `src` and the whole chart in `srcAnswer`, which the correction sheet shows.
export function chartImage(config: ChartConfig, lang: Lang) {
  const whole = renderChartSvg(config, { lang, blank: false });
  const shown = config.blank ? renderChartSvg(config, { lang, blank: true }) : whole;
  const width = Math.min(CONTENT_WIDTH, config.width);
  return {
    src: svgUrl(shown.svg),
    srcAnswer: config.blank ? svgUrl(whole.svg) : undefined,
    ratio: config.width / config.height,
    width,
    height: (width * config.height) / config.width,
  };
}

/** A new image block that carries its chart, so that the Studio can reopen it (double-click) with the same table and settings. */
export function chartPreset(config: ChartConfig, lang: Lang): BlockPreset {
  const { srcAnswer, ...image } = chartImage(config, lang);
  return { ...image, ...(srcAnswer ? { srcAnswer } : {}), chartStudio: config } as BlockPreset;
}

/** What Update puts in the block (a picture with nothing for the correction sheet takes it off) */
export function chartPatch(config: ChartConfig, lang: Lang): BlockPatch {
  const { width, height, ...rest } = chartImage(config, lang);
  return { ...rest, chartStudio: config, drawing: undefined, molecule: undefined, graphStudio: undefined, circuitStudio: undefined, layout: { width, height } } as unknown as BlockPatch;
}
