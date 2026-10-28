// The graph paper of the Graph Studio: a Cartesian coordinate system with a millimetre-paper grid, labelled axes and curves.
// Pure data (no React): the canvas, the picture for the page and the tests all start from a GraphConfig.
import type { ShapeItem } from "@/app/_lib/shapes";

/** Space kept around the paper (in the picture and on the canvas) for the numbers, the labels and the arrow heads, in px. */
export const PAPER_MARGIN = 44;

export type FunctionType = "linear" | "quadratic" | "exponential" | "logarithmic" | "sigmoid" | "oscillation" | "titration" | "formula" | "data";

/** How a curve is drawn: a continuous line, dashes or dots */
export type DashStyle = "solid" | "dashed" | "dotted";

/** The line through a series of measured points: none (only the points), straight segments, or a smooth curve through them */
export type DataLineStyle = "none" | "straight" | "smooth";

/** A measured point, in graph units */
export type DataPoint = { id: string; x: number; y: number };

/**
 * A curve: a function of x with its parameters (the keys depend on the type, see mathUtils.ts#FUNCTION_SPECS), a formula typed by
 * the teacher, or a series of measured points (`type: "data"`: `points`, drawn as circles and optionally joined).
 */
export type GraphFunction = {
  id: string;
  type: FunctionType;
  color: string;
  strokeWidth: number;
  /**
   * Linear: { a, b } -> y = a·x + b
   * Quadratic: { a, b, c } -> y = a·x² + b·x + c
   * Exponential: { A, tau, y0 } -> y = A·e^(−x/τ) + y₀
   * Logarithmic: { a, b } -> y = a·ln(x) + b
   * Sigmoid: { ymin, ymax, k, x0 } -> y = ymin + (ymax − ymin) / (1 + e^(−k·(x − x₀)))
   * Oscillation: { A, T, tau, phi, y0, x0 } -> y = A·e^(−(x−x₀)/τ)·cos(2π(x−x₀)/T + φ) + y₀ from x₀ on (τ = 0: no damping; φ in degrees)
   * Titration: { pKa, C, V0, Ct, kind } -> the pH after x of a titrant (concentration Ct) is added to V0 of a solution of C; kind 0 = an acid
   *   (pKa of its couple) titrated by a strong base, 1 = a base (pKa of its conjugate acid) titrated by a strong acid
   * Formula: no params, see `expression`
   */
  params: Record<string, number>;
  /** Formula: the text typed by the teacher ("5*exp(-t/40)*cos(2*pi*t/12)"), read by graphMath.ts (x or t is the variable) */
  expression?: string;
  /** Draw the curve only where from <= x <= to (missing = as far as the paper goes): a straight line over the measured range, one piece of a curve */
  from?: number;
  to?: number;
  /** Solid (missing) or dashed or dotted */
  dash?: DashStyle;
  /** Data series: the measured points, whether they are drawn, and how they are joined (in the order of x) */
  points?: DataPoint[];
  showPoints?: boolean;
  lineStyle?: DataLineStyle;
  /** Masked: the student version does not have it (the teacher's shows it faded) */
  hidden?: boolean;
};

export type AnnotationType = "text" | "asymptote" | "tangent" | "triangle" | "marker" | "axisMark" | "curveLabel" | "line";

/** What is drawn behind a text: nothing but a white halo (missing), a white box, or a circle (the ① of a curve's name) */
export type TextFrame = "none" | "box" | "circle";

/**
 * Something written or drawn on the paper to point at a feature. Positions are in graph units, so an annotation stays where it
 * is when the axes change. Which fields count depends on the type (annotations.ts#ANNOTATION_SPECS):
 *   text: (x, y) the start of the text, `text`, `fontSize`, `frame`
 *   asymptote: `value` (y for a horizontal one, x for a vertical one), `orientation`, an optional `text` label
 *   tangent: `curveId` and the x of the point of contact; `side`: the whole line (missing), or only the part to the right or left of it
 *   triangle: from x to x2 on the curve `curveId` (its y values are the curve's), or free: from (x, y) to (x2, y2)
 *   marker: a point at (x, y), or at x on the curve `curveId`; an optional `text` label, `shape`, `guides` to the axes
 *   axisMark: a tick on an axis (`axis`) at `value`, written with `text` (the number itself when empty); `guides` draws a dashed
 *     line from it to the curve `curveId` (or to `guideTo` on the other axis)
 *   curveLabel: the name of the curve `curveId` (1), (2), A… written at (x, y), with `frame`; it goes with its curve
 *   line: from (x, y) to (x2, y2), `extend`ed to the edges of the paper or not, with an `arrow` at the end or not
 */
export type GraphAnnotation = {
  id: string;
  type: AnnotationType;
  x?: number;
  y?: number;
  x2?: number;
  y2?: number;
  value?: number;
  orientation?: "horizontal" | "vertical";
  /** axisMark: the axis the tick is on */
  axis?: "x" | "y";
  /** axisMark: where the dashed guide ends, on the other axis, when the mark is not on a curve */
  guideTo?: number;
  /** The curve a tangent, a triangle, a marker, an axis mark or a name is on (a tangent and a name need one) */
  curveId?: string;
  text?: string;
  shape?: "cross" | "plus" | "dot";
  frame?: TextFrame;
  /** Line: carried on to the edges of the paper, and with an arrowhead at its end */
  extend?: boolean;
  arrow?: boolean;
  /** Tangent: which part of the line is drawn (missing = both sides of the point of contact, across the paper) */
  side?: "both" | "right" | "left";
  /** Triangle: write the values of Δx and Δy, not only the letters. Marker and axis mark: dashed lines (to the axes, to the curve). */
  showValues?: boolean;
  guides?: boolean;
  color?: string;
  dashed?: boolean;
  fontSize?: number;
  /** Masked: the student version does not have it (the teacher's shows it faded) */
  hidden?: boolean;
};

/** Which numbers are written along an axis: every main line, only the first one (the scale printed on exam sheets: "1 cm ↔ 5 mL"), or none */
export type AxisNumbers = "all" | "scale" | "none";

export type GraphConfig = {
  /** Bounds of the visible grid in graph units (e.g. x from 0 to 10, y from -2 to 5) */
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;

  /** The size of the paper in pixels (page pixels at 100 %) */
  width: number;
  height: number;

  /** Labels of the axes, e.g. "t(s)", "pH", "u_C(V)" (_ and ^ make sub- and superscripts, see richLabel.ts) */
  xLabel: string;
  yLabel: string;

  /** Major grid spacing (the thicker lines) in graph units, on both axes unless xMajorStep / yMajorStep say otherwise */
  majorGridStep: number;
  /** Minor grid spacing (the fine lines) in graph units, on both axes unless xMinorStep / yMinorStep say otherwise */
  minorGridStep: number;

  /** Whether the grid is drawn, and its colour */
  showGrid: boolean;
  gridColor: string;

  /** Whether the values of the major steps are written along the axes (off = no number at all) */
  showNumbers: boolean;

  /** Shapes drawn over the paper, in pixels of the paper (Shapes in the toolbar); missing in papers made before they existed */
  shapes?: ShapeItem[];

  /** The curves, drawn in this order (the last one on top) */
  functions: GraphFunction[];

  /** The tangents, asymptotes, triangles, markers and texts, drawn over the curves */
  annotations: GraphAnnotation[];

  // ---- what a physics sheet needs; all optional, so a paper saved before them is read as it was ----

  /** A sheet has its own scale on each axis ("1 cm ↔ 5 mL" along, "1 cm ↔ 2 pH" up): these are the spacings of one axis (missing = the shared one above) */
  xMajorStep?: number;
  yMajorStep?: number;
  xMinorStep?: number;
  yMinorStep?: number;
  /** A medium line halfway between the main lines (the 5 mm line of millimetre paper) */
  midGrid?: boolean;
  /** Which numbers are written along each axis (missing = all of them, as long as `showNumbers` is on) */
  xNumbers?: AxisNumbers;
  yNumbers?: AxisNumbers;
  /** Numbers written 1,96 instead of 1.96 */
  decimalComma?: boolean;
  /** The titles of the axes: size in px (missing = 15), bold, italic; the numbers along them: size in px (missing = 11), bold */
  labelSize?: number;
  labelBold?: boolean;
  labelItalic?: boolean;
  numberSize?: number;
  numberBold?: boolean;
};

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  xMin: 0,
  xMax: 10,
  yMin: 0,
  yMax: 10,
  width: 600,
  height: 600,
  xLabel: "t(s)",
  yLabel: "x(m)",
  majorGridStep: 1,
  minorGridStep: 0.2,
  showGrid: true,
  gridColor: "#000000",
  showNumbers: true,
  functions: [],
  annotations: [],
};

/** A configuration read from a block saved by an earlier version (no curves, no annotations, no per-axis steps yet): what is missing gets its default. */
export function normalizeGraphConfig(raw: Partial<GraphConfig>): GraphConfig {
  return { ...DEFAULT_GRAPH_CONFIG, ...raw, functions: Array.isArray(raw.functions) ? raw.functions : [], annotations: Array.isArray(raw.annotations) ? raw.annotations : [] };
}

/** The spacings of one axis: its own when it has them, else the ones shared by both. */
export function axisSteps(c: GraphConfig, axis: "x" | "y"): { major: number; minor: number } {
  return axis === "x" ? { major: c.xMajorStep ?? c.majorGridStep, minor: c.xMinorStep ?? c.minorGridStep } : { major: c.yMajorStep ?? c.majorGridStep, minor: c.yMinorStep ?? c.minorGridStep };
}
