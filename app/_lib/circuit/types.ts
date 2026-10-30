// The electrical circuit of the Circuit Studio: components on a 20 px grid joined by orthogonal wires.
// Pure data (no React): the canvas, the picture for the page and the tests all start from a CircuitConfig.
import type { ShapeItem } from "@/app/_lib/shapes";

export type ComponentType = "battery" | "resistor" | "capacitor" | "inductor" | "switch" | "lamp" | "diode" | "ammeter" | "voltmeter";

export type CircuitComponent = {
  id: string;
  type: ComponentType;
  /** The middle of the component, on the grid */
  x: number;
  y: number;
  /** 0, 90, 180, 270 (clockwise, as on the screen): at 0 the two terminals are left and right of the middle */
  rotation: number;
  /** Label like "R", "C", "E" */
  label: string;
  /** Value like "10 kΩ", "2 μF" */
  value: string;
  /** A switch: closed (the blade touches the other terminal) or open (the default) */
  closed?: boolean;
  /** Whether the value is written next to the component (the default: yes) */
  showValue?: boolean;
  /** Where the label and the value are written: automatically (above and below a component that lies, to the right of one that stands) or on one side */
  labelSide?: LabelSide;
};

export type LabelSide = "auto" | "top" | "bottom" | "left" | "right";

export type CircuitWire = {
  id: string;
  /** Flat [x, y, x, y, …] of the corners of the wire: every segment is horizontal or vertical. A wire is connected to a terminal when one of its ends is on it. */
  points: number[];
};

export type CircuitConfig = {
  /** The size of the drawing area in pixels */
  width: number;
  height: number;
  components: CircuitComponent[];
  wires: CircuitWire[];
  /** Shapes drawn over the circuit (Shapes in the toolbar); missing in circuits made before they existed */
  shapes?: ShapeItem[];
};

export const DEFAULT_CIRCUIT_CONFIG: CircuitConfig = {
  width: 800,
  height: 600,
  components: [],
  wires: [],
};

export const MIN_AREA = 200;
export const MAX_AREA = 2000;
