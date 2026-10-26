// The circuit as one thing to draw: every component with its symbol and texts, the wires and the dots where they are connected,
// in pixels of the drawing area. The Konva canvas and the picture for the page both draw this scene, so they cannot differ.
import { junctionPoints, type P } from "./geometry";
import { drawComponent, type DrawnComponent } from "./symbols";
import type { CircuitConfig } from "./types";

export type SceneWire = { id: string; points: number[] };

export type CircuitScene = {
  width: number;
  height: number;
  components: DrawnComponent[];
  wires: SceneWire[];
  /** Where wires are connected to each other: drawn as dots */
  junctions: P[];
};

export const JUNCTION_RADIUS = 3.5;
export const WIRE_STROKE = 2;

export function buildCircuitScene(config: CircuitConfig): CircuitScene {
  return {
    width: config.width,
    height: config.height,
    components: config.components.map(drawComponent),
    wires: config.wires.map((w) => ({ id: w.id, points: w.points })),
    junctions: junctionPoints(config),
  };
}

/** About how wide a text is (the real width is only known once it is drawn). */
const textWidth = (text: string, size: number) => text.length * size * 0.6;

/** The box around everything drawn (null for an empty circuit): the symbols, the wires and the texts. */
export function contentBounds(scene: CircuitScene): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const c of scene.components) {
    xs.push(c.bounds.x, c.bounds.x + c.bounds.width);
    ys.push(c.bounds.y, c.bounds.y + c.bounds.height);
    for (const t of c.texts) {
      const w = textWidth(t.text, t.size);
      const left = t.align === "start" ? t.x : t.align === "middle" ? t.x - w / 2 : t.x - w;
      xs.push(left, left + w);
      ys.push(t.y - t.size / 2, t.y + t.size / 2);
    }
  }
  for (const w of scene.wires) {
    for (let i = 0; i < w.points.length; i += 2) {
      xs.push(w.points[i]);
      ys.push(w.points[i + 1]);
    }
  }
  if (!xs.length) return null;
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}
