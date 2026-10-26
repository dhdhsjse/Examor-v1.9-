// The graph paper of the Graph Studio: a Cartesian coordinate system with a millimetre-paper grid, labelled axes and curves.
// Pure data (no React): the canvas, the picture for the page and the tests all start from a GraphConfig.

export type FunctionType = "linear" | "quadratic" | "exponential" | "logarithmic" | "sigmoid" | "data";

/** A measured point, in graph units */
export type DataPoint = { id: string; x: number; y: number };

/**
 * A curve: a function of x with its parameters (the keys depend on the type, see mathUtils.ts#FUNCTION_SPECS), or a series of
 * measured points (`type: "data"`: `points`, drawn as circles and optionally joined by straight lines).
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
   */
  params: Record<string, number>;
  /** Data series: the measured points, whether they are drawn, and whether they are joined (in the order of x) */
  points?: DataPoint[];
  showPoints?: boolean;
  lineStyle?: "none" | "straight";
  /** Masked: the student version does not have it (the teacher's shows it faded) */
  hidden?: boolean;
};

export type AnnotationType = "text" | "asymptote" | "tangent" | "triangle" | "marker";

/**
 * Something written or drawn on the paper to point at a feature. Positions are in graph units, so an annotation stays where it
 * is when the axes change. Which fields count depends on the type (annotations.ts#ANNOTATION_SPECS):
 *   text: (x, y) the start of the text, `text`, `fontSize`
 *   asymptote: `value` (y for a horizontal one, x for a vertical one), `orientation`, an optional `text` label
 *   tangent: `curveId` and the x of the point of contact
 *   triangle: from x to x2 on the curve `curveId` (its y values are the curve's), or free: from (x, y) to (x2, y2)
 *   marker: a point at (x, y), or at x on the curve `curveId`; an optional `text` label, `shape`, `guides` to the axes
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
  /** The curve a tangent, a triangle or a marker is on (a tangent needs one) */
  curveId?: string;
  text?: string;
  shape?: "cross" | "plus" | "dot";
  /** Triangle: write the values of Δx and Δy, not only the letters. Marker: dashed lines from the point to the axes. */
  showValues?: boolean;
  guides?: boolean;
  color?: string;
  dashed?: boolean;
  fontSize?: number;
  /** Masked: the student version does not have it (the teacher's shows it faded) */
  hidden?: boolean;
};

export type GraphConfig = {
  /** Bounds of the visible grid in graph units (e.g. x from 0 to 10, y from -2 to 5) */
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;

  /** The size of the paper in pixels (page pixels at 100 %) */
  width: number;
  height: number;

  /** Labels of the axes, e.g. "t(s)", "pH" */
  xLabel: string;
  yLabel: string;

  /** Major grid spacing (the thicker lines) in graph units */
  majorGridStep: number;
  /** Minor grid spacing (the fine lines) in graph units */
  minorGridStep: number;

  /** Whether the grid is drawn, and its colour */
  showGrid: boolean;
  gridColor: string;

  /** Whether the values of the major steps are written along the axes */
  showNumbers: boolean;

  /** The curves, drawn in this order (the last one on top) */
  functions: GraphFunction[];

  /** The tangents, asymptotes, triangles, markers and texts, drawn over the curves */
  annotations: GraphAnnotation[];
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

/** A configuration read from a block saved by an earlier version (no curves or annotations yet): what is missing gets its default. */
export function normalizeGraphConfig(raw: Partial<GraphConfig>): GraphConfig {
  return { ...DEFAULT_GRAPH_CONFIG, ...raw, functions: Array.isArray(raw.functions) ? raw.functions : [], annotations: Array.isArray(raw.annotations) ? raw.annotations : [] };
}
