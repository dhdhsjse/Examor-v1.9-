// Starting points for the graph paper: the sheets a teacher asks for most. A preset changes the limits, the labels and the grid
// steps, and leaves the size, the colour and the other switches as they are.
import type { GraphConfig } from "./types";

export type GraphPreset = { id: string; name: string; values: Pick<GraphConfig, "xMin" | "xMax" | "yMin" | "yMax" | "xLabel" | "yLabel" | "majorGridStep" | "minorGridStep"> };

// `name` is the English text (the key of the translations in graph/strings.ts).
export const GRAPH_PRESETS: GraphPreset[] = [
  { id: "mm", name: "Millimetre paper", values: { xMin: 0, xMax: 10, yMin: 0, yMax: 10, xLabel: "x", yLabel: "y", majorGridStep: 1, minorGridStep: 0.1 } },
  { id: "position", name: "Position against time", values: { xMin: 0, xMax: 10, yMin: 0, yMax: 10, xLabel: "t(s)", yLabel: "x(m)", majorGridStep: 1, minorGridStep: 0.2 } },
  { id: "speed", name: "Speed against time", values: { xMin: 0, xMax: 10, yMin: -5, yMax: 10, xLabel: "t(s)", yLabel: "v(m/s)", majorGridStep: 1, minorGridStep: 0.2 } },
  { id: "titration", name: "pH against volume", values: { xMin: 0, xMax: 20, yMin: 0, yMax: 14, xLabel: "V(mL)", yLabel: "pH", majorGridStep: 2, minorGridStep: 0.5 } },
  { id: "centred", name: "Axes in the middle", values: { xMin: -5, xMax: 5, yMin: -5, yMax: 5, xLabel: "x", yLabel: "y", majorGridStep: 1, minorGridStep: 0.2 } },
];
