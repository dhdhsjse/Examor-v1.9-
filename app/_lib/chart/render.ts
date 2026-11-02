// The picture of a chart (an image block's `src`): the SVG, drawn from its configuration alone. The Studio shows the same picture it puts on the
// page. Pure function (no React, no DOM beyond the text measuring of measure.ts), unit-tested.
import { readModel, WORDS_AR, WORDS_FR } from "./data";
import { renderCategory } from "./svg/category";
import { renderBox, renderFunnel } from "./svg/funnelBox";
import { finish, frame, makeCtx } from "./svg/kit";
import { renderHistogram, renderScatter } from "./svg/numeric";
import { renderPie, renderRadar } from "./svg/round";
import type { ChartConfig } from "./types";
import type { Lang } from "@/app/_lib/types";

export interface ChartImage {
  svg: string;
  width: number;
  height: number;
}

export interface RenderOptions {
  /** A thumbnail for the gallery: no text, thicker lines */
  mini?: boolean;
  /** The picture for the students: the frame, the scale and the names, without the data */
  blank?: boolean;
  /** The language of the words a chart writes itself (the legend of a waterfall, the names of trendlines, "Series 1") */
  lang?: Lang;
}

/** The SVG of a chart. `blank` is also taken from the configuration (the picture for the students). */
export function renderChartSvg(config: ChartConfig, options: RenderOptions = {}): ChartImage {
  const words = options.lang === "ar" ? WORDS_AR : WORDS_FR;
  const model = readModel(config, words);
  const ctx = makeCtx(config, model, words, { mini: options.mini, blank: options.blank ?? config.blank });
  switch (config.family) {
    case "column":
    case "bar":
    case "line":
    case "area":
    case "combo":
    case "waterfall":
      if (model.empty) frame(ctx, []);
      else renderCategory(ctx);
      break;
    case "scatter":
      if (model.empty) frame(ctx, []);
      else renderScatter(ctx);
      break;
    case "histogram":
      renderHistogram(ctx);
      break;
    case "box":
      renderBox(ctx);
      break;
    case "pie":
      renderPie(ctx);
      break;
    case "radar":
      if (model.empty) frame(ctx, []);
      else renderRadar(ctx);
      break;
    case "funnel":
      renderFunnel(ctx);
      break;
  }
  return { svg: finish(ctx), width: config.width, height: config.height };
}
