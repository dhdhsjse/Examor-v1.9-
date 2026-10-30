// Starting points for the graph paper. The sheets a teacher asks for most (a preset) change the limits, the labels and the grid
// steps, and leave the size, the colour, the curves and the other switches as they are. The physics sheets (a template) are whole
// papers: the scales of the axes, the curves and what is drawn on them, modelled on the figures of an exam, to change as needed.
import { evaluateFunction, CURVE_COLORS, DEFAULT_STROKE } from "./mathUtils";
import { fitPaper, MAX_PAPER } from "./grid";
import { DEFAULT_GRAPH_CONFIG, type FunctionType, type GraphAnnotation, type GraphConfig, type GraphFunction } from "./types";

export type GraphPreset = { id: string; name: string; values: Pick<GraphConfig, "xMin" | "xMax" | "yMin" | "yMax" | "xLabel" | "yLabel" | "majorGridStep" | "minorGridStep"> };

// `name` is the English text (the key of the translations in graph/strings.ts).
export const GRAPH_PRESETS: GraphPreset[] = [
  { id: "mm", name: "Millimetre paper", values: { xMin: 0, xMax: 10, yMin: 0, yMax: 10, xLabel: "x", yLabel: "y", majorGridStep: 1, minorGridStep: 0.1 } },
  { id: "position", name: "Position against time", values: { xMin: 0, xMax: 10, yMin: 0, yMax: 10, xLabel: "t(s)", yLabel: "x(m)", majorGridStep: 1, minorGridStep: 0.2 } },
  { id: "speed", name: "Speed against time", values: { xMin: 0, xMax: 10, yMin: -5, yMax: 10, xLabel: "t(s)", yLabel: "v(m/s)", majorGridStep: 1, minorGridStep: 0.2 } },
  { id: "titration", name: "pH against volume", values: { xMin: 0, xMax: 20, yMin: 0, yMax: 14, xLabel: "V(mL)", yLabel: "pH", majorGridStep: 2, minorGridStep: 0.5 } },
  { id: "centred", name: "Axes in the middle", values: { xMin: -5, xMax: 5, yMin: -5, yMax: 5, xLabel: "x", yLabel: "y", majorGridStep: 1, minorGridStep: 0.2 } },
];

/** A preset is for both axes: the steps of one axis a teacher set by hand are given up when it is applied. */
export const PRESET_RESET: Partial<GraphConfig> = { xMajorStep: undefined, yMajorStep: undefined, xMinorStep: undefined, yMinorStep: undefined };

/** What to change in a configuration to apply a preset. */
export const presetChanges = (p: GraphPreset): Partial<GraphConfig> => ({ ...PRESET_RESET, ...p.values });

/** Whether a configuration is this preset (its values, and one step for both axes). */
export const presetApplies = (c: GraphConfig, p: GraphPreset) => (Object.keys(p.values) as (keyof GraphPreset["values"])[]).every((k) => c[k] === p.values[k]) && Object.keys(PRESET_RESET).every((k) => c[k as keyof GraphConfig] === undefined);

// ---- physics sheets ----

/** A curve of a template; the colour defaults to the next of the palette, the points of a series are (x, y) pairs. */
type TemplateCurve = Omit<GraphFunction, "id" | "color" | "strokeWidth" | "points"> & { color?: string; strokeWidth?: number; points?: [number, number][] };
/** An annotation of a template; the curve it is on is given by its order in the list of curves. */
type TemplateNote = Omit<GraphAnnotation, "id" | "curveId"> & { curve?: number };

export type TemplateSheet = {
  /** The settings of the paper: limits, titles, steps, how the numbers are written… (size excepted: it follows the scale) */
  values: Partial<GraphConfig>;
  functions: TemplateCurve[];
  annotations: TemplateNote[];
  /** Side of a main square, in cm, when the sheet is printed (missing = 1) */
  cell?: number;
};

export type TemplateGroup = "Chemistry" | "Electricity" | "Mechanics";
export type GraphTemplate = {
  id: string;
  /** The English name (the key of the translations in graph/strings.ts) */
  name: string;
  group: TemplateGroup;
  build: () => TemplateSheet;
};

// What the printed sheets of an exam have in common: millimetre paper (1 mm, 5 mm, 1 cm), the scale written on the first main
// square of each axis, bold italic titles.
const SHEET: Partial<GraphConfig> = { midGrid: true, xNumbers: "scale", yNumbers: "scale", labelBold: true, labelItalic: true, numberBold: true };

/** The limits and steps of a sheet: `x` and `y` are [from, to, one main square]; the fine lines are a tenth of it (1 mm). */
const axes = (x: [number, number, number], y: [number, number, number], xLabel: string, yLabel: string, more: Partial<GraphConfig> = {}): Partial<GraphConfig> => ({
  ...SHEET,
  xMin: x[0],
  xMax: x[1],
  xMajorStep: x[2],
  xMinorStep: x[2] / 10,
  yMin: y[0],
  yMax: y[1],
  yMajorStep: y[2],
  yMinorStep: y[2] / 10,
  xLabel,
  yLabel,
  ...more,
});

const curve = (type: FunctionType, params: Record<string, number>, more: Partial<TemplateCurve> = {}): TemplateCurve => ({ type, params, ...more });
const valueAt = (c: TemplateCurve, x: number) => evaluateFunction({ id: "t", color: "#000000", strokeWidth: DEFAULT_STROKE, type: c.type, params: c.params, expression: c.expression, from: c.from, to: c.to }, x);
const round = (v: number) => Math.round(v * 100) / 100;

// A rise to a plateau or a fall to one: y∞ + (y₀ − y∞)·e^(−x/τ)
const rise = (to: number, tau: number, from = 0): TemplateCurve => curve("exponential", { A: from - to, tau, y0: to });
const fall = (from: number, tau: number, to = 0): TemplateCurve => curve("exponential", { A: from - to, tau, y0: to });

const strongAcid = { pKa: -2, C: 0.07, V0: 20, Ct: 0.07, kind: 0 };
const weakAcid = { pKa: 3.55, C: 0.07, V0: 20, Ct: 0.07, kind: 0 };

export const GRAPH_TEMPLATES: GraphTemplate[] = [
  {
    id: "titration-weak",
    name: "Weak acid titration",
    group: "Chemistry",
    build: () => ({
      cell: 1.5,
      values: axes([0, 40, 5], [0, 14, 2], "V_b(mL)", "pH"),
      functions: [curve("titration", { pKa: 3.75, C: 0.05, V0: 20, Ct: 0.05, kind: 0 })],
      annotations: [{ type: "axisMark", axis: "x", value: 20, text: "V_E", guides: true, curve: 0 }],
    }),
  },
  {
    id: "titration-two",
    name: "Strong and weak acid titrations",
    group: "Chemistry",
    build: () => {
      const strong = curve("titration", strongAcid);
      const weak = curve("titration", weakAcid);
      return {
        cell: 1.5,
        values: axes([0, 40, 5], [0, 14, 2], "V_b(mL)", "pH"),
        functions: [strong, weak],
        annotations: [
          { type: "curveLabel", curve: 0, x: 9, y: Math.max(0.8, round(valueAt(strong, 9) - 0.9)), text: "1", frame: "circle", fontSize: 14 },
          { type: "curveLabel", curve: 1, x: 5, y: round(valueAt(weak, 5) + 0.9), text: "2", frame: "circle", fontSize: 14 },
        ],
      };
    },
  },
  {
    id: "titration-henderson",
    name: "pH − pKa against volume",
    group: "Chemistry",
    build: () => ({
      cell: 1.2,
      values: axes([0, 24, 2], [-3, 3, 1], "V_b(mL)", "pH − pK_a", { yNumbers: "none" }),
      functions: [curve("formula", {}, { expression: "log(x/(20-x))", from: 0, to: 20 })],
      annotations: [
        { type: "asymptote", orientation: "vertical", value: 20, text: "V_E", dashed: true },
        { type: "axisMark", axis: "x", value: 10, text: "V_E/2" },
      ],
    }),
  },
  {
    id: "kinetics-decay",
    name: "Amount of reactant against time",
    group: "Chemistry",
    build: () => ({
      cell: 1.5,
      values: axes([0, 64, 8], [0, 6, 1], "t(mn)", "n(H_2O_2)(×10^-4 mol)"),
      functions: [curve("exponential", { A: 3.3, tau: 10, y0: 1.7 })],
      annotations: [{ type: "tangent", curve: 0, x: 0, side: "right", dashed: true }],
    }),
  },
  {
    id: "kinetics-two",
    name: "Two experiments with measured points",
    group: "Chemistry",
    build: () => ({
      cell: 1.8,
      values: axes([0, 70, 10], [0, 100, 20], "t(min)", "[H_2O_2](mmol/L)"),
      functions: [
        curve("data", {}, { points: [[0, 90], [10, 45], [20, 26], [30, 15], [45, 7], [60, 4.4]], showPoints: true, lineStyle: "smooth" }),
        curve("exponential", { A: 88, tau: 7, y0: 1.5 }),
      ],
      annotations: [
        { type: "curveLabel", curve: 0, x: 17, y: 50, text: "(1)", fontSize: 15 },
        { type: "curveLabel", curve: 1, x: 5, y: 14, text: "(2)", fontSize: 15 },
      ],
    }),
  },
  {
    id: "kinetics-progress",
    name: "Reaction progress",
    group: "Chemistry",
    build: () => ({
      cell: 1.5,
      values: axes([0, 90, 10], [0, 12, 2], "t(min)", "x(mmol)"),
      functions: [rise(10, 13)],
      annotations: [
        { type: "asymptote", orientation: "horizontal", value: 10, text: "x_max", dashed: true },
        { type: "tangent", curve: 0, x: 0, side: "right", dashed: true },
      ],
    }),
  },
  {
    id: "logarithm-time",
    name: "Logarithm against time",
    group: "Chemistry",
    build: () => ({
      cell: 1.2,
      values: axes([0, 120, 20], [-3, 6, 1], "t(s)", "−ln(A)", { xNumbers: "none", yNumbers: "none" }),
      functions: [curve("linear", { a: 0.05, b: -2.4 }, { from: 0, to: 120 })],
      annotations: [
        { type: "axisMark", axis: "x", value: 80, text: "t_1", guides: true, curve: 0 },
        { type: "axisMark", axis: "y", value: 1.6, text: "y_1", guides: true, curve: 0 },
      ],
    }),
  },
  {
    id: "rc-charge",
    name: "RC circuit: charge",
    group: "Electricity",
    build: () => ({
      cell: 1.2,
      values: axes([0, 33, 3], [0, 7, 1], "t(ms)", "u(V)"),
      functions: [rise(6, 6), fall(6, 6)],
      annotations: [
        { type: "tangent", curve: 0, x: 0, side: "right", dashed: true },
        { type: "asymptote", orientation: "horizontal", value: 6, text: "E", dashed: true },
        { type: "curveLabel", curve: 0, x: 14, y: 4.7, text: "A", fontSize: 15 },
        { type: "curveLabel", curve: 1, x: 8, y: 2.3, text: "B", fontSize: 15 },
      ],
    }),
  },
  {
    id: "rl-currents",
    name: "RL circuit: three resistances",
    group: "Electricity",
    build: () => ({
      cell: 1.5,
      values: axes([0, 0.4, 0.05], [0, 0.35, 0.05], "t(s)", "i(A)"),
      functions: [rise(0.1, 0.0083), rise(0.2, 0.0167), rise(0.3, 0.025)],
      annotations: [
        { type: "tangent", curve: 2, x: 0, side: "right", dashed: true },
        { type: "curveLabel", curve: 0, x: 0.35, y: 0.12, text: "(1)", fontSize: 15 },
        { type: "curveLabel", curve: 1, x: 0.35, y: 0.22, text: "(2)", fontSize: 15 },
        { type: "curveLabel", curve: 2, x: 0.35, y: 0.32, text: "(3)", fontSize: 15 },
      ],
    }),
  },
  {
    id: "rlc-damped",
    name: "RLC circuit: damped oscillations",
    group: "Electricity",
    build: () => ({
      cell: 1.2,
      values: axes([0, 40, 4], [-8, 8, 2], "t(ms)", "u_C(V)", { xNumbers: "none" }),
      functions: [curve("oscillation", { A: 6, T: 8, tau: 14, phi: 0, y0: 0, x0: 0 })],
      annotations: [],
    }),
  },
  {
    id: "lc-undamped",
    name: "LC circuit: undamped oscillations",
    group: "Electricity",
    build: () => ({
      cell: 1.8,
      values: axes([0, 7, 1], [-60, 60, 20], "t(ms)", "q(μC)"),
      functions: [curve("oscillation", { A: 40, T: 2, tau: 0, phi: 0, y0: 0, x0: 0 })],
      annotations: [],
    }),
  },
  {
    id: "rc-rlc",
    name: "RC charge, then RLC discharge",
    group: "Electricity",
    build: () => ({
      cell: 1.8,
      values: axes([0, 300, 50], [-9, 12, 3], "t(ms)", "u_C(V)"),
      functions: [curve("formula", {}, { expression: "9*(1-exp(-(x-50)/30))", from: 50, to: 170, color: "#000000" }), curve("oscillation", { A: 9, T: 24, tau: 40, phi: 0, y0: 0, x0: 170 }, { color: "#000000" })],
      annotations: [
        { type: "tangent", curve: 0, x: 50, side: "right", dashed: true },
        { type: "axisMark", axis: "y", value: 9, text: "E", guideTo: 170 },
        { type: "axisMark", axis: "x", value: 80, text: "a", guides: true, curve: 0 },
        { type: "axisMark", axis: "x", value: 170, text: "b", guides: true, curve: 0 },
      ],
    }),
  },
  {
    id: "speed-limit",
    name: "Speed with a limit",
    group: "Mechanics",
    build: () => ({
      cell: 1.5,
      values: axes([0, 6, 1], [0, 10.5, 1.5], "t(s)", "v(m/s)"),
      functions: [rise(9, 1, 1)],
      annotations: [
        { type: "asymptote", orientation: "horizontal", value: 9, text: "v_lim", dashed: true },
        { type: "tangent", curve: 0, x: 0, side: "right", dashed: true },
      ],
    }),
  },
  {
    id: "projectile",
    name: "Projectile: vertical speed",
    group: "Mechanics",
    build: () => ({
      cell: 1,
      values: axes([0, 2.5, 0.25], [-14, 10, 2], "t(s)", "v_y(m/s)", { decimalComma: true }),
      functions: [curve("linear", { a: -9.8, b: 9.5 }, { from: 0, to: 2.2 })],
      annotations: [{ type: "axisMark", axis: "y", value: -12.06, guides: true, curve: 0 }],
    }),
  },
  {
    id: "proportional",
    name: "Straight line through the origin",
    group: "Mechanics",
    build: () => ({
      cell: 2,
      values: axes([0, 10, 2], [0, 25, 5], "1/r(m^-1)", "v^2(m^2.s^-2)"),
      functions: [curve("linear", { a: 2.5, b: 0 }, { from: 1, to: 9 })],
      annotations: [{ type: "triangle", curve: 0, x: 3, x2: 7, showValues: true }],
    }),
  },
];

export const GRAPH_TEMPLATE_GROUPS: TemplateGroup[] = ["Chemistry", "Electricity", "Mechanics"];

/**
 * The paper of a template, to put in the Studio in place of the one on the screen (the colour of the grid is kept). Its size
 * follows its scale: every main square is as many cm as the sheet says, scaled down only to fit `maxWidth` px.
 */
export function instantiateTemplate(t: GraphTemplate, current: Pick<GraphConfig, "gridColor"> = DEFAULT_GRAPH_CONFIG, maxWidth = MAX_PAPER): GraphConfig {
  const sheet = t.build();
  const functions: GraphFunction[] = sheet.functions.map((f, i) => {
    const { color, strokeWidth, points, ...rest } = f;
    return {
      ...rest,
      id: crypto.randomUUID(),
      color: color ?? CURVE_COLORS[i % CURVE_COLORS.length],
      strokeWidth: strokeWidth ?? DEFAULT_STROKE,
      ...(points ? { points: points.map(([x, y]) => ({ id: crypto.randomUUID(), x, y })) } : {}),
    };
  });
  const annotations: GraphAnnotation[] = sheet.annotations.map((n) => {
    const { curve: index, ...rest } = n;
    return { ...rest, id: crypto.randomUUID(), ...(index !== undefined ? { curveId: functions[index].id } : {}) };
  });
  const config: GraphConfig = { ...DEFAULT_GRAPH_CONFIG, gridColor: current.gridColor, ...sheet.values, functions, annotations };
  const paper = fitPaper(config, sheet.cell ?? 1, maxWidth);
  return paper ? { ...config, width: paper.width, height: paper.height } : config;
}
