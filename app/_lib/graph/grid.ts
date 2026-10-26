// The geometry of the graph paper, in pixels of the paper (0,0 = its top left corner): the grid lines, the axes with their
// arrows, the tick marks and every text. The Konva canvas and the picture for the page both draw the same `GraphScene`,
// so what is on the screen is what goes on the page. Pure functions (no React), unit-tested.
import { resolveAnnotation, type SceneAnnotation } from "./annotations";
import { dataDots, formatNumber, sampleCurve } from "./mathUtils";
export { formatNumber };
import type { GraphConfig } from "./types";

/** Space kept around the paper for the numbers, the labels and the arrow heads. */
export const PAPER_MARGIN = 44;
/** How far the axes go past the paper, to carry their arrow. */
export const AXIS_OVERSHOOT = 14;
export const ARROW_LENGTH = 11;
export const ARROW_HALF_WIDTH = 4.5;
export const TICK_HALF = 3;
/** The most lines a grid is drawn with, per axis: a finer step is left out (and reported). */
export const MAX_LINES_PER_AXIS = 400;
export const MIN_PAPER = 200;
export const MAX_PAPER = 1400;
export const LABEL_SIZE = 15;
export const TICK_SIZE = 11;
const ESTIMATED_CHAR_WIDTH = 0.6; // of the font size

// ---- graph units <-> pixels (the paper's y is down, the graph's y is up) ----

/** A graph x value -> the x pixel on the paper. */
export function graphToPxX(x: number, config: GraphConfig): number {
  return ((x - config.xMin) / (config.xMax - config.xMin)) * config.width;
}

/** A graph y value -> the y pixel on the paper (Konva's y is inverted). */
export function graphToPxY(y: number, config: GraphConfig): number {
  return config.height - ((y - config.yMin) / (config.yMax - config.yMin)) * config.height;
}

export function pxToGraphX(px: number, config: GraphConfig): number {
  return config.xMin + (px / config.width) * (config.xMax - config.xMin);
}

export function pxToGraphY(py: number, config: GraphConfig): number {
  return config.yMin + ((config.height - py) / config.height) * (config.yMax - config.yMin);
}

// ---- steps ----

const clean = (v: number) => {
  const r = Math.round(v * 1e9) / 1e9;
  return r === 0 ? 0 : r; // (no -0)
};

/** How many multiples of `step` lie in [min, max]. */
export function lineCount(min: number, max: number, step: number): number {
  if (!(step > 0) || !(max > min)) return 0;
  return Math.max(0, Math.floor(max / step + 1e-9) - Math.ceil(min / step - 1e-9) + 1);
}

/** The multiples of `step` in [min, max], without the drift of adding a step again and again. [] when there would be too many. */
export function multiples(min: number, max: number, step: number): number[] {
  const n = lineCount(min, max, step);
  if (n === 0 || n > MAX_LINES_PER_AXIS + 1) return [];
  const first = Math.ceil(min / step - 1e-9);
  return Array.from({ length: n }, (_, i) => clean((first + i) * step));
}

const onStep = (v: number, step: number) => Math.abs(v / step - Math.round(v / step)) < 1e-6;

// ---- problems with a configuration ----

export type GraphIssue = "x-range" | "y-range" | "size" | "major-step" | "minor-step" | "dense-major" | "dense-minor" | "minor-larger";
/** The ones that cannot be drawn at all: a change that would make one of them is refused. The others are only reported. */
export const FATAL_ISSUES: readonly GraphIssue[] = ["x-range", "y-range", "size", "major-step", "minor-step"];

export function configIssues(c: GraphConfig): GraphIssue[] {
  const issues: GraphIssue[] = [];
  if (!Number.isFinite(c.xMin) || !Number.isFinite(c.xMax) || !(c.xMax > c.xMin)) issues.push("x-range");
  if (!Number.isFinite(c.yMin) || !Number.isFinite(c.yMax) || !(c.yMax > c.yMin)) issues.push("y-range");
  if (![c.width, c.height].every((n) => Number.isFinite(n) && n >= MIN_PAPER && n <= MAX_PAPER)) issues.push("size");
  if (!(c.majorGridStep > 0) || !Number.isFinite(c.majorGridStep)) issues.push("major-step");
  if (!(c.minorGridStep > 0) || !Number.isFinite(c.minorGridStep)) issues.push("minor-step");
  if (issues.length) return issues;
  const tooMany = (step: number) => lineCount(c.xMin, c.xMax, step) > MAX_LINES_PER_AXIS + 1 || lineCount(c.yMin, c.yMax, step) > MAX_LINES_PER_AXIS + 1;
  if (tooMany(c.majorGridStep)) issues.push("dense-major");
  if (tooMany(c.minorGridStep)) issues.push("dense-minor");
  if (c.minorGridStep > c.majorGridStep) issues.push("minor-larger");
  return issues;
}

/** The first thing that makes `c` impossible to draw, or null. */
export const fatalIssue = (c: GraphConfig): GraphIssue | null => configIssues(c).find((i) => FATAL_ISSUES.includes(i)) ?? null;

// ---- the scene ----

export type Segment = { x1: number; y1: number; x2: number; y2: number };
/** A text: (x, y) is the middle of its height, and its start, middle or end along the width. */
export type SceneText = { text: string; x: number; y: number; align: "start" | "middle" | "end"; size: number; kind: "tick" | "label" };

/** A curve ready to draw: polylines (flat x, y lists) in pixels of the paper */
export type SceneCurve = { id: string; color: string; width: number; segments: number[][]; /** the measured points on the paper (a data series that shows them) */ dots: { id: string; x: number; y: number }[]; /** masked, in the teacher's view: drawn faded */ hidden?: boolean };

/** What a scene is for: the student's version leaves out everything that is masked; the teacher's has it, flagged `hidden`, for the screen to fade. */
export type SceneOptions = { student?: boolean };

export type GraphScene = {
  width: number;
  height: number;
  minor: Segment[];
  major: Segment[];
  /** The axes, from the paper's edge to their arrow, and the polygons of the arrow heads */
  axes: Segment[];
  arrows: number[][];
  ticks: Segment[];
  texts: SceneText[];
  curves: SceneCurve[];
  /** The annotations, resolved into lines, dots and texts, drawn over the curves */
  annotations: SceneAnnotation[];
  /** Where the axes cross, on the paper */
  origin: { x: number; y: number };
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const textWidth = (text: string, size: number) => text.length * size * ESTIMATED_CHAR_WIDTH;

/** Everything to draw for a configuration (an empty scene if it cannot be drawn). */
export function buildScene(c: GraphConfig, options: SceneOptions = {}): GraphScene {
  const empty: GraphScene = { width: c.width, height: c.height, minor: [], major: [], axes: [], arrows: [], ticks: [], texts: [], curves: [], annotations: [], origin: { x: 0, y: c.height } };
  if (fatalIssue(c)) return empty;
  const { width, height } = c;
  const vertical = (px: number): Segment => ({ x1: px, y1: 0, x2: px, y2: height });
  const horizontal = (py: number): Segment => ({ x1: 0, y1: py, x2: width, y2: py });

  const majorXs = multiples(c.xMin, c.xMax, c.majorGridStep);
  const majorYs = multiples(c.yMin, c.yMax, c.majorGridStep);
  const minor: Segment[] = [];
  const major: Segment[] = [];
  if (c.showGrid) {
    for (const x of multiples(c.xMin, c.xMax, c.minorGridStep)) if (!onStep(x, c.majorGridStep)) minor.push(vertical(graphToPxX(x, c)));
    for (const y of multiples(c.yMin, c.yMax, c.minorGridStep)) if (!onStep(y, c.majorGridStep)) minor.push(horizontal(graphToPxY(y, c)));
    major.push(...majorXs.map((x) => vertical(graphToPxX(x, c))), ...majorYs.map((y) => horizontal(graphToPxY(y, c))));
  }

  // The axes cross at (0, 0); when 0 is off the paper they stay on its nearest edge.
  const zeroInX = c.xMin <= 0 && 0 <= c.xMax;
  const zeroInY = c.yMin <= 0 && 0 <= c.yMax;
  const ox = graphToPxX(clamp(0, c.xMin, c.xMax), c);
  const oy = graphToPxY(clamp(0, c.yMin, c.yMax), c);
  const xTip = width + AXIS_OVERSHOOT;
  const yTip = -AXIS_OVERSHOOT;
  const axes: Segment[] = [
    { x1: 0, y1: oy, x2: xTip - ARROW_LENGTH + 1, y2: oy },
    { x1: ox, y1: height, x2: ox, y2: yTip + ARROW_LENGTH - 1 },
  ];
  const arrows = [
    [xTip, oy, xTip - ARROW_LENGTH, oy - ARROW_HALF_WIDTH, xTip - ARROW_LENGTH, oy + ARROW_HALF_WIDTH],
    [ox, yTip, ox - ARROW_HALF_WIDTH, yTip + ARROW_LENGTH, ox + ARROW_HALF_WIDTH, yTip + ARROW_LENGTH],
  ];

  const ticks: Segment[] = [];
  const texts: SceneText[] = [];
  for (const x of majorXs) {
    const px = graphToPxX(x, c);
    ticks.push({ x1: px, y1: oy - TICK_HALF, x2: px, y2: oy + TICK_HALF });
    if (!c.showNumbers) continue;
    // (a 0 on the x axis goes left of the y axis, which passes through it)
    if (x === 0) texts.push({ text: "0", x: px - 6, y: oy + 12, align: "end", size: TICK_SIZE, kind: "tick" });
    else texts.push({ text: formatNumber(x), x: px, y: oy + 12, align: "middle", size: TICK_SIZE, kind: "tick" });
  }
  for (const y of majorYs) {
    const py = graphToPxY(y, c);
    ticks.push({ x1: ox - TICK_HALF, y1: py, x2: ox + TICK_HALF, y2: py });
    if (!c.showNumbers) continue;
    if (y === 0 && zeroInX && zeroInY) continue; // (the 0 of the x axis is the origin's)
    texts.push({ text: formatNumber(y), x: ox - 7, y: py, align: "end", size: TICK_SIZE, kind: "tick" });
  }

  const xLabel = c.xLabel.trim();
  if (xLabel) texts.push({ text: xLabel, x: width - 4, y: oy - 14 < 10 ? oy + 28 : oy - 14, align: "end", size: LABEL_SIZE, kind: "label" });
  const yLabel = c.yLabel.trim();
  if (yLabel) {
    const fits = ox + 10 + textWidth(yLabel, LABEL_SIZE) <= width;
    texts.push({ text: yLabel, x: fits ? ox + 10 : ox - 10, y: 10, align: fits ? "start" : "end", size: LABEL_SIZE, kind: "label" });
  }

  const shown = <T extends { hidden?: boolean }>(item: T) => !(options.student && item.hidden);
  const curves: SceneCurve[] = c.functions.filter(shown).map((fn) => ({ id: fn.id, color: fn.color, width: fn.strokeWidth, segments: sampleCurve(fn, c).segments, dots: fn.type === "data" && fn.showPoints !== false ? dataDots(fn, c) : [], hidden: fn.hidden && !options.student ? true : undefined }));

  const annotations = c.annotations.filter(shown).map((a) => ({ ...resolveAnnotation(a, c, { x: ox, y: oy }), hidden: a.hidden && !options.student ? true : undefined }));

  return { width, height, minor, major, axes, arrows, ticks, texts, curves, annotations, origin: { x: ox, y: oy } };
}
