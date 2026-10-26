// The symbols of the components, as school textbooks draw them (the French standard: a resistor is a rectangle), and the drawing
// of a component on the paper: its lines, loops and circles, and its texts, in pixels of the paper. A symbol is described once
// along the component's axis, with the middle at (0, 0) and the terminals at (±40, 0), then turned and moved to where the
// component is. Pure functions (no React), unit-tested.
import { HALF_LENGTH, axisOf, terminalsOf, type P } from "./geometry";
import type { CircuitComponent, ComponentType } from "./types";

export type ComponentSpec = {
  type: ComponentType;
  /** The English name (the key of the translations in circuit/strings.ts) */
  name: string;
  /** The label a new one gets */
  label: string;
};

export const COMPONENT_SPECS: Record<ComponentType, ComponentSpec> = {
  battery: { type: "battery", name: "Battery", label: "E" },
  resistor: { type: "resistor", name: "Resistor", label: "R" },
  capacitor: { type: "capacitor", name: "Capacitor", label: "C" },
  inductor: { type: "inductor", name: "Inductor", label: "L" },
  switch: { type: "switch", name: "Switch", label: "K" },
  lamp: { type: "lamp", name: "Lamp", label: "" },
  diode: { type: "diode", name: "Diode", label: "D" },
  ammeter: { type: "ammeter", name: "Ammeter", label: "" },
  voltmeter: { type: "voltmeter", name: "Voltmeter", label: "" },
};
export const COMPONENT_TYPES = Object.keys(COMPONENT_SPECS) as ComponentType[];

/** What a symbol is drawn with. `line` = an open polyline, `loop` = a closed one (not filled), `poly` = a closed filled one. */
export type SymbolShape = { kind: "line" | "loop" | "poly"; points: number[] } | { kind: "circle"; cx: number; cy: number; r: number; fill?: boolean };
export type SymbolText = { text: string; x: number; y: number; size: number; bold?: boolean; align: "start" | "middle" | "end" };

export type DrawnComponent = {
  id: string;
  type: ComponentType;
  shapes: SymbolShape[];
  texts: SymbolText[];
  /** The box that is clicked and dragged: the symbol and its leads */
  bounds: { x: number; y: number; width: number; height: number };
  terminals: [P, P];
};

export const SYMBOL_STROKE = 2;
export const LABEL_SIZE = 14;
export const VALUE_SIZE = 12;
/** Half the thickness of the box of a component (the symbols are at most 32 thick) */
const HALF_THICK = 22;

type Local = { shapes: SymbolShape[]; texts: SymbolText[] };
const line = (...points: number[]): SymbolShape => ({ kind: "line", points });

// The inductor: four loops, each a half circle bulging to the side the label is not on.
function coil(): number[] {
  const pts: number[] = [];
  for (let k = 0; k < 4; k++) {
    for (let i = 0; i <= 10; i++) {
      const t = (Math.PI * i) / 10;
      pts.push(-20 + 10 * k + 5 * (1 - Math.cos(t)), -5 * Math.sin(t));
    }
  }
  return pts;
}

/** A symbol along its axis (middle at (0, 0), terminals at (±40, 0), v pointing "down" before the turn). */
function symbolOf(c: CircuitComponent): Local {
  const H = HALF_LENGTH;
  switch (c.type) {
    case "resistor":
      return { shapes: [line(-H, 0, -20, 0), line(20, 0, H, 0), { kind: "loop", points: [-20, -8, 20, -8, 20, 8, -20, 8] }], texts: [] };
    case "battery":
      // the long plate is the positive one, on the right
      return { shapes: [line(-H, 0, -4, 0), line(4, 0, H, 0), line(-4, -9, -4, 9), line(4, -16, 4, 16)], texts: [{ text: "+", x: 13, y: -13, size: 13, bold: true, align: "middle" }] };
    case "capacitor":
      return { shapes: [line(-H, 0, -5, 0), line(5, 0, H, 0), line(-5, -14, -5, 14), line(5, -14, 5, 14)], texts: [] };
    case "inductor":
      return { shapes: [line(-H, 0, -20, 0), line(20, 0, H, 0), line(...coil())], texts: [] };
    case "switch":
      return {
        shapes: [line(-H, 0, -16, 0), line(16, 0, H, 0), { kind: "circle", cx: -16, cy: 0, r: 2.5, fill: true }, { kind: "circle", cx: 16, cy: 0, r: 2.5, fill: true }, c.closed ? line(-16, 0, 16, 0) : line(-16, 0, 13, -15)],
        texts: [],
      };
    case "lamp":
      return { shapes: [line(-H, 0, -14, 0), line(14, 0, H, 0), { kind: "circle", cx: 0, cy: 0, r: 14 }, line(-10, -10, 10, 10), line(-10, 10, 10, -10)], texts: [] };
    case "diode":
      // current flows from the triangle's base to its point (to the right)
      return { shapes: [line(-H, 0, -9, 0), line(9, 0, H, 0), { kind: "loop", points: [-9, -12, -9, 12, 9, 0] }, line(9, -12, 9, 12)], texts: [] };
    case "ammeter":
    case "voltmeter":
      return { shapes: [line(-H, 0, -16, 0), line(16, 0, H, 0), { kind: "circle", cx: 0, cy: 0, r: 16 }], texts: [{ text: c.type === "ammeter" ? "A" : "V", x: 0, y: 0, size: 16, bold: true, align: "middle" }] };
  }
}

/** The units a value of each component is usually in (a keyboard has no Ω or μ: they are put by a button). */
export const UNITS: Record<ComponentType, string[]> = {
  battery: ["V"],
  resistor: ["Ω", "kΩ", "MΩ"],
  capacitor: ["pF", "nF", "μF", "mF"],
  inductor: ["μH", "mH", "H"],
  switch: [],
  lamp: ["W", "V"],
  diode: [],
  ammeter: ["mA", "A"],
  voltmeter: ["mV", "V"],
};

/** A value with its unit changed: the number is kept ("10" and "kΩ" give "10 kΩ"; "4.7 Ω" and "μF" give "4.7 μF"). */
export function withUnit(value: string, unit: string): string {
  const m = value.trim().match(/^([-+]?[\d.,]*)\s*(.*)$/);
  return `${m ? m[1] : ""} ${unit}`.trim();
}

const LINE_GAP = 16;

/**
 * The label and the value, outside the symbol. Automatically: above and below a component that lies, to the right of one that
 * stands. Or both on the side chosen (the label first, the value nearest the symbol on the top, nearest on the bottom too).
 * The value is left out when the teacher turned it off.
 */
function labelsOf(c: CircuitComponent): SymbolText[] {
  const items: { text: string; size: number; bold: boolean }[] = [];
  const hasValue = !!c.value && c.showValue !== false;
  if (c.label) items.push({ text: c.label, size: LABEL_SIZE, bold: true });
  if (hasValue) items.push({ text: c.value, size: VALUE_SIZE, bold: false });
  if (!items.length) return [];
  const flat = normalFlat(c.rotation);
  const side = c.labelSide ?? "auto";
  const out: SymbolText[] = [];
  if (side === "auto") {
    if (flat) {
      if (c.label) out.push({ text: c.label, x: c.x, y: c.y - 28, size: LABEL_SIZE, bold: true, align: "middle" });
      if (hasValue) out.push({ text: c.value, x: c.x, y: c.y + 28, size: VALUE_SIZE, align: "middle" });
    } else {
      if (c.label) out.push({ text: c.label, x: c.x + 24, y: c.y - (hasValue ? 8 : 0), size: LABEL_SIZE, bold: true, align: "start" });
      if (hasValue) out.push({ text: c.value, x: c.x + 24, y: c.y + (c.label ? 9 : 0), size: VALUE_SIZE, align: "start" });
    }
    return out;
  }
  const n = items.length;
  const across = flat ? 28 : HALF_LENGTH + 14; // (how far the first line is from the middle, above or below)
  const beside = flat ? HALF_LENGTH + 8 : 24; // (and to the left or right)
  items.forEach((item, i) => {
    if (side === "top") out.push({ ...item, x: c.x, y: c.y - across - (n - 1 - i) * LINE_GAP, align: "middle" });
    else if (side === "bottom") out.push({ ...item, x: c.x, y: c.y + across + i * LINE_GAP, align: "middle" });
    else out.push({ ...item, x: c.x + (side === "left" ? -beside : beside), y: c.y + (i - (n - 1) / 2) * LINE_GAP, align: side === "left" ? "end" : "start" });
  });
  return out;
}
const normalFlat = (rotation: number) => axisOf(rotation).y === 0;

/** The component drawn where it is, turned as it is. The texts of the symbol and its label stay upright. */
export function drawComponent(c: CircuitComponent): DrawnComponent {
  const a = axisOf(c.rotation);
  const perp = { x: -a.y, y: a.x }; // (the axis turned a quarter clockwise)
  const toWorld = (u: number, v: number): P => ({ x: c.x + u * a.x + v * perp.x, y: c.y + u * a.y + v * perp.y });
  const flatPoints = (pts: number[]) => pts.flatMap((_, i) => (i % 2 === 0 ? [toWorld(pts[i], pts[i + 1]).x, toWorld(pts[i], pts[i + 1]).y] : []));
  const local = symbolOf(c);
  const shapes = local.shapes.map((s): SymbolShape => {
    if (s.kind === "circle") {
      const m = toWorld(s.cx, s.cy);
      return { ...s, cx: m.x, cy: m.y };
    }
    return { ...s, points: flatPoints(s.points) };
  });
  const texts = [...local.texts.map((t) => ({ ...t, ...toWorld(t.x, t.y) })), ...labelsOf(c)];
  const flat = normalFlat(c.rotation);
  const width = flat ? 2 * HALF_LENGTH : 2 * HALF_THICK;
  const height = flat ? 2 * HALF_THICK : 2 * HALF_LENGTH;
  return { id: c.id, type: c.type, shapes, texts, bounds: { x: c.x - width / 2, y: c.y - height / 2, width, height }, terminals: terminalsOf(c) };
}
