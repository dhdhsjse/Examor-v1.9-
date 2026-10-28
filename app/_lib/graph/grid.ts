// The geometry of the graph paper, in pixels of the paper (0,0 = its top left corner): the grid lines, the axes with their
// arrows, the tick marks and every text. The Konva canvas and the picture for the page both draw the same `GraphScene`,
// so what is on the screen is what goes on the page. Pure functions (no React), unit-tested.
import { MM_TO_PX } from "../pageFormats";
import { resolveAnnotation, type SceneAnnotation } from "./annotations";
import { dataDots, formatNumber, sampleCurve } from "./mathUtils";
export { formatNumber };
import { hasScripts, labelWidth, parseLabel, type TextRun } from "./richLabel";
import { PAPER_MARGIN, axisSteps, type AxisNumbers, type DashStyle, type GraphConfig } from "./types";
export { PAPER_MARGIN };

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
/** Page pixels in a centimetre (the pages are 96 DPI). */
export const CM_PX = MM_TO_PX * 10;

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

/**
 * The main line a sheet writes the scale at: the first one away from the origin ("5" for 1 cm ↔ 5 mL), which is the value of one
 * main square. null if the axis has no main line.
 */
export function scaleTick(min: number, max: number, step: number): number | null {
  const lines = multiples(min, max, step);
  const first = lines.find((v) => v > 0);
  if (first !== undefined) return first;
  return [...lines].reverse().find((v) => v < 0) ?? null; // (an axis that is all negative: the line nearest to 0)
}

// ---- problems with a configuration ----

export type GraphIssue = "x-range" | "y-range" | "size" | "major-step" | "minor-step" | "dense-major" | "dense-minor" | "minor-larger";
/** The ones that cannot be drawn at all: a change that would make one of them is refused. The others are only reported. */
export const FATAL_ISSUES: readonly GraphIssue[] = ["x-range", "y-range", "size", "major-step", "minor-step"];

export function configIssues(c: GraphConfig): GraphIssue[] {
  const issues: GraphIssue[] = [];
  if (!Number.isFinite(c.xMin) || !Number.isFinite(c.xMax) || !(c.xMax > c.xMin)) issues.push("x-range");
  if (!Number.isFinite(c.yMin) || !Number.isFinite(c.yMax) || !(c.yMax > c.yMin)) issues.push("y-range");
  if (![c.width, c.height].every((n) => Number.isFinite(n) && n >= MIN_PAPER && n <= MAX_PAPER)) issues.push("size");
  const x = axisSteps(c, "x");
  const y = axisSteps(c, "y");
  if (![x.major, y.major].every((s) => s > 0 && Number.isFinite(s))) issues.push("major-step");
  if (![x.minor, y.minor].every((s) => s > 0 && Number.isFinite(s))) issues.push("minor-step");
  if (issues.length) return issues;
  const tooMany = (key: "major" | "minor") => lineCount(c.xMin, c.xMax, x[key]) > MAX_LINES_PER_AXIS + 1 || lineCount(c.yMin, c.yMax, y[key]) > MAX_LINES_PER_AXIS + 1;
  if (tooMany("major")) issues.push("dense-major");
  if (tooMany("minor")) issues.push("dense-minor");
  if (x.minor > x.major || y.minor > y.major) issues.push("minor-larger");
  return issues;
}

/** The first thing that makes `c` impossible to draw, or null. */
export const fatalIssue = (c: GraphConfig): GraphIssue | null => configIssues(c).find((i) => FATAL_ISSUES.includes(i)) ?? null;

// ---- the size of the paper ----

/**
 * The size of the paper that makes every main square `cellCm` centimetres wide and high, so that the scale printed on a sheet
 * ("1 cm ↔ 5 mL") is the real one when it is printed. A paper beyond the limits (or wider than `maxWidth` px) is scaled down, a
 * smaller one up, keeping its squares square; `cellCm` in the result is the size they ended with. null if the steps or the
 * limits make no sense.
 */
export function fitPaper(c: GraphConfig, cellCm = 1, maxWidth = MAX_PAPER): { width: number; height: number; cellCm: number } | null {
  const x = axisSteps(c, "x");
  const y = axisSteps(c, "y");
  const cellsX = (c.xMax - c.xMin) / x.major;
  const cellsY = (c.yMax - c.yMin) / y.major;
  if (!(cellsX > 0) || !(cellsY > 0) || !Number.isFinite(cellsX + cellsY) || !(cellCm > 0)) return null;
  let cell = cellCm * CM_PX;
  cell = Math.min(cell, Math.min(MAX_PAPER, maxWidth) / cellsX, MAX_PAPER / cellsY); // (not larger than the paper may be)
  cell = Math.max(cell, MIN_PAPER / cellsX, MIN_PAPER / cellsY); // (nor smaller)
  const clampPaper = (v: number) => Math.min(MAX_PAPER, Math.max(MIN_PAPER, Math.round(v)));
  return { width: clampPaper(cellsX * cell), height: clampPaper(cellsY * cell), cellCm: cell / CM_PX };
}

// ---- the scene ----

export type Segment = { x1: number; y1: number; x2: number; y2: number };
/**
 * A text: (x, y) is the middle of its height, and its start, middle or end along the width. `runs` are there when it has sub- or
 * superscripts (`text` stays what was typed).
 */
export type SceneText = { text: string; x: number; y: number; align: "start" | "middle" | "end"; size: number; kind: "tick" | "label"; bold?: boolean; italic?: boolean; runs?: TextRun[] };

/** A curve ready to draw: polylines (flat x, y lists) in pixels of the paper */
export type SceneCurve = {
  id: string;
  color: string;
  width: number;
  segments: number[][];
  /** the measured points on the paper (a data series that shows them) */
  dots: { id: string; x: number; y: number }[];
  /** masked, in the teacher's view: drawn faded */
  hidden?: boolean;
  /** the dash pattern of a dashed or dotted curve (missing = solid) */
  dash?: number[];
};

/** What a scene is for: the student's version leaves out everything that is masked; the teacher's has it, flagged `hidden`, for the screen to fade. */
export type SceneOptions = { student?: boolean };

export type GraphScene = {
  width: number;
  height: number;
  minor: Segment[];
  /** the medium lines halfway between the main ones (millimetre paper), when asked for */
  mid: Segment[];
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

/** The dash pattern of a curve of this width (round caps make the dotted ones round). */
export function dashPattern(style: DashStyle | undefined, width: number): number[] | undefined {
  if (style === "dashed") return [width * 4, width * 2.5];
  if (style === "dotted") return [0.1, width * 2.5];
  return undefined;
}

/** Everything to draw for a configuration (an empty scene if it cannot be drawn). */
export function buildScene(c: GraphConfig, options: SceneOptions = {}): GraphScene {
  const empty: GraphScene = { width: c.width, height: c.height, minor: [], mid: [], major: [], axes: [], arrows: [], ticks: [], texts: [], curves: [], annotations: [], origin: { x: 0, y: c.height } };
  if (fatalIssue(c)) return empty;
  const { width, height } = c;
  const vertical = (px: number): Segment => ({ x1: px, y1: 0, x2: px, y2: height });
  const horizontal = (py: number): Segment => ({ x1: 0, y1: py, x2: width, y2: py });

  const sx = axisSteps(c, "x");
  const sy = axisSteps(c, "y");
  const majorXs = multiples(c.xMin, c.xMax, sx.major);
  const majorYs = multiples(c.yMin, c.yMax, sy.major);
  const minor: Segment[] = [];
  const mid: Segment[] = [];
  const major: Segment[] = [];
  if (c.showGrid) {
    // (a medium line takes the place of the fine line that would be under it)
    const fine = (v: number, step: { major: number }) => !onStep(v, step.major) && !(c.midGrid && onStep(v, step.major / 2));
    for (const x of multiples(c.xMin, c.xMax, sx.minor)) if (fine(x, sx)) minor.push(vertical(graphToPxX(x, c)));
    for (const y of multiples(c.yMin, c.yMax, sy.minor)) if (fine(y, sy)) minor.push(horizontal(graphToPxY(y, c)));
    if (c.midGrid) {
      for (const x of multiples(c.xMin, c.xMax, sx.major / 2)) if (!onStep(x, sx.major)) mid.push(vertical(graphToPxX(x, c)));
      for (const y of multiples(c.yMin, c.yMax, sy.major / 2)) if (!onStep(y, sy.major)) mid.push(horizontal(graphToPxY(y, c)));
    }
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

  // Which main lines get a number: all of them, only the first (the scale) and the origin, or none.
  const numbers = (axis: "x" | "y"): AxisNumbers => (c.showNumbers ? ((axis === "x" ? c.xNumbers : c.yNumbers) ?? "all") : "none");
  const scaleX = numbers("x") === "scale" ? scaleTick(c.xMin, c.xMax, sx.major) : null;
  const scaleY = numbers("y") === "scale" ? scaleTick(c.yMin, c.yMax, sy.major) : null;
  const numbered = (axis: "x" | "y", v: number) => numbers(axis) === "all" || (numbers(axis) === "scale" && (v === 0 || v === (axis === "x" ? scaleX : scaleY)));

  const tickSize = c.numberSize ?? TICK_SIZE;
  const tickFlags = c.numberBold ? { bold: true } : {};
  const ticks: Segment[] = [];
  const texts: SceneText[] = [];
  for (const x of majorXs) {
    const px = graphToPxX(x, c);
    ticks.push({ x1: px, y1: oy - TICK_HALF, x2: px, y2: oy + TICK_HALF });
    if (!numbered("x", x)) continue;
    // (a 0 on the x axis goes left of the y axis, which passes through it)
    if (x === 0) texts.push({ text: "0", x: px - 6, y: oy + 1 + tickSize, align: "end", size: tickSize, kind: "tick", ...tickFlags });
    else texts.push({ text: formatNumber(x, c.decimalComma), x: px, y: oy + 1 + tickSize, align: "middle", size: tickSize, kind: "tick", ...tickFlags });
  }
  for (const y of majorYs) {
    const py = graphToPxY(y, c);
    ticks.push({ x1: ox - TICK_HALF, y1: py, x2: ox + TICK_HALF, y2: py });
    if (!numbered("y", y)) continue;
    if (y === 0 && zeroInX && zeroInY && numbered("x", 0)) continue; // (the 0 of the x axis is the origin's)
    texts.push({ text: formatNumber(y, c.decimalComma), x: ox - 7, y: py, align: "end", size: tickSize, kind: "tick", ...tickFlags });
  }

  // The titles of the axes, with their sub- and superscripts when they have some.
  const labelSize = c.labelSize ?? LABEL_SIZE;
  const labelFlags = { ...(c.labelBold ? { bold: true } : {}), ...(c.labelItalic ? { italic: true } : {}) };
  const labelText = (src: string): Pick<SceneText, "text" | "runs"> => (hasScripts(src) ? { text: src, runs: parseLabel(src) } : { text: src });
  const xLabel = c.xLabel.trim();
  if (xLabel) texts.push({ ...labelText(xLabel), x: width - 4, y: oy - (labelSize - 1) < 10 ? oy + 13 + labelSize : oy - (labelSize - 1), align: "end", size: labelSize, kind: "label", ...labelFlags });
  const yLabel = c.yLabel.trim();
  if (yLabel) {
    const fits = ox + 10 + labelWidth(parseLabel(yLabel), labelSize) <= width;
    texts.push({ ...labelText(yLabel), x: fits ? ox + 10 : ox - 10, y: 10, align: fits ? "start" : "end", size: labelSize, kind: "label", ...labelFlags });
  }

  const shown = <T extends { hidden?: boolean }>(item: T) => !(options.student && item.hidden);
  const curves: SceneCurve[] = c.functions.filter(shown).map((fn) => {
    const dash = dashPattern(fn.dash, fn.strokeWidth);
    return {
      id: fn.id,
      color: fn.color,
      width: fn.strokeWidth,
      segments: sampleCurve(fn, c).segments,
      dots: fn.type === "data" && fn.showPoints !== false ? dataDots(fn, c) : [],
      hidden: fn.hidden && !options.student ? true : undefined,
      ...(dash ? { dash } : {}),
    };
  });

  // (the name of a curve the student does not see is not shown to the student either)
  const curveMasked = (id?: string) => !!id && c.functions.some((f) => f.id === id && f.hidden);
  const annotations = c.annotations
    .filter(shown)
    .filter((a) => !(options.student && a.type === "curveLabel" && curveMasked(a.curveId)))
    .map((a) => ({ ...resolveAnnotation(a, c, { x: ox, y: oy }), hidden: a.hidden && !options.student ? true : undefined }));

  return { width, height, minor, mid, major, axes, arrows, ticks, texts, curves, annotations, origin: { x: ox, y: oy } };
}
