import type { BlockPreset } from "@/app/_lib/blocks";
import type { GraphData } from "@/app/_lib/mathGraph";
import type { GraphBlock } from "@/app/_lib/types";
import type { BlockPatch } from "@/app/_lib/useExam";

/** What the Function Studio holds: the graph (its functions and what they show, the lines, the window, the grid) and its size on the page */
export type StudioGraph = GraphData & { width: number; height: number };

export const MIN_SIZE = 160;
export const MAX_SIZE = 794;

/** A new graph: one function, the usual window */
export const blankStudioGraph = (): StudioGraph => ({ functions: ["x^2 - 2"], xMin: -5, xMax: 5, yMin: -4, yMax: 6, grid: true, width: 440, height: 330 });

/** The graph of a block, for the Studio to work on (a copy: the block is changed only by Update) */
export function studioGraphOf(b: GraphBlock): StudioGraph {
  const g: StudioGraph = { functions: [...b.functions], xMin: b.xMin, xMax: b.xMax, yMin: b.yMin, yMax: b.yMax, grid: b.grid, width: b.layout.width, height: b.layout.height };
  if (b.curves) g.curves = structuredClone(b.curves);
  if (b.lines) g.lines = structuredClone(b.lines);
  return g;
}

/** A new graph block from the Studio's graph */
export function graphPreset(g: StudioGraph): BlockPreset {
  const { width, height, curves, lines, ...rest } = g;
  return { ...rest, ...(curves ? { curves } : {}), ...(lines ? { lines } : {}), width, height } as BlockPreset;
}

/** What Update puts in the block: every field of the graph, and a list it has no more is taken off (undefined) */
export function graphPatch(g: StudioGraph): BlockPatch {
  const { width, height, ...rest } = g;
  return { ...rest, curves: g.curves, lines: g.lines, layout: { width, height } } as unknown as BlockPatch;
}
