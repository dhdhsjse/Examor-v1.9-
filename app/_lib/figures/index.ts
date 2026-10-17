// Library figures drawn from settings (app/_lib/figures/*). An image block made from one keeps
// `figure: { id, params }`, so Properties can change the settings and redraw it.
import type { FigureValue, Lang } from "../types";
import { angleFigure } from "./angle";
import { axesFigure } from "./axes";
import { cellFigure } from "./cell";
import { circleFigure } from "./circle";
import { circuitFigure } from "./circuit";
import { foodChainFigure } from "./foodChain";
import { fractionFigure } from "./fraction";
import { gridFigure } from "./grid";
import { inclineFigure } from "./incline";
import { lensFigure } from "./lens";
import { numberLineFigure } from "./numberLine";
import { quadrilateralFigure } from "./quadrilateral";
import { solidFigure } from "./solid";
import { thermometerFigure } from "./thermometer";
import { triangleFigure } from "./triangle";
import type { FigureDef, FigureParam, Params } from "./types";
import { waterCycleFigure } from "./waterCycle";

export type { FigureDef, FigureParam, Params } from "./types";

export const FIGURES: FigureDef[] = [
  triangleFigure,
  quadrilateralFigure,
  circleFigure,
  angleFigure,
  axesFigure,
  numberLineFigure,
  solidFigure,
  fractionFigure,
  gridFigure,
  circuitFigure,
  inclineFigure,
  lensFigure,
  thermometerFigure,
  cellFigure,
  foodChainFigure,
  waterCycleFigure,
];

// Every figure can change the color of its lines.
const INK: FigureParam = { key: "ink", label: "Line color", kind: "color" };

export const figureDef = (id: string) => FIGURES.find((f) => f.id === id);
export const figureParams = (def: FigureDef): FigureParam[] => [...def.params, INK];

// The full settings (defaults filled in) and the drawing.
export function renderFigure(id: string, params: Partial<Params> | undefined, lang: Lang): { svg: string; params: Params } | null {
  const def = figureDef(id);
  if (!def) return null;
  const full: Params = { ink: "#111111", ...def.defaults(lang) };
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined) full[k] = v;
  return { svg: def.build(full, lang), params: full };
}

// New settings after one of them changed (the figure fixes the ones that depend on it).
export function changeFigure(def: FigureDef, params: Params, key: string, value: FigureValue): Params {
  const next = { ...params, [key]: value };
  return def.normalize ? def.normalize(next, key) : next;
}
