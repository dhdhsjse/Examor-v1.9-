// The edits of a circuit, as pure functions from one CircuitConfig to the next. A wire is connected to a component when one of its
// ends is on one of its terminals: moving or turning the component carries those ends along (the wire stays orthogonal), and
// nothing needs to be stored to remember the connection. Unit-tested.
import { GRID, HALF_LENGTH, endsOf, moveEndpoint, normRotation, simplifyPath, snap, terminalsOf, translatePath, type P } from "./geometry";
import { COMPONENT_SPECS } from "./symbols";
import type { CircuitComponent, CircuitConfig, ComponentType } from "./types";

const near = (a: P, b: P) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The middle of a component put at (x, y): on the grid, and far enough inside the paper for its terminals to be on it. */
export function placeAt(config: Pick<CircuitConfig, "width" | "height">, rotation: number, x: number, y: number): P {
  const flatAxis = normRotation(rotation) % 180 === 0;
  const reachX = flatAxis ? HALF_LENGTH : 0;
  const reachY = flatAxis ? 0 : HALF_LENGTH;
  return { x: snap(clamp(x, reachX, config.width - reachX)), y: snap(clamp(y, reachY, config.height - reachY)) };
}

export function newComponent(config: CircuitConfig, type: ComponentType, x: number, y: number, rotation = 0, id: string = crypto.randomUUID()): CircuitComponent {
  const r = normRotation(rotation);
  const at = placeAt(config, r, x, y);
  return { id, type, x: at.x, y: at.y, rotation: r, label: COMPONENT_SPECS[type].label, value: "" };
}

export const addComponent = (config: CircuitConfig, component: CircuitComponent): CircuitConfig => ({ ...config, components: [...config.components, component] });

// The wires that end on a terminal of `before` follow it to the matching terminal of `after`.
function carryWires(config: CircuitConfig, before: CircuitComponent, after: CircuitComponent): CircuitConfig {
  const from = terminalsOf(before);
  const to = terminalsOf(after);
  const wires = config.wires.map((w) => {
    let points = w.points;
    const [first, last] = endsOf(w);
    // (a wire from one terminal of the component to the other moves at both ends)
    from.forEach((t, i) => {
      if (near(first, t) && !near(to[i], t)) points = moveEndpoint(points, 0, to[i]);
    });
    from.forEach((t, i) => {
      if (near(last, t) && !near(to[i], t)) points = moveEndpoint(points, 1, to[i]);
    });
    return points === w.points ? w : { ...w, points };
  });
  return { ...config, wires };
}

/** Moves a component (its middle goes to the nearest grid point inside the paper); the wires on its terminals go with it. */
export function moveComponent(config: CircuitConfig, id: string, x: number, y: number): CircuitConfig {
  const before = config.components.find((c) => c.id === id);
  if (!before) return config;
  const at = placeAt(config, before.rotation, x, y);
  if (at.x === before.x && at.y === before.y) return config;
  const after = { ...before, ...at };
  return carryWires({ ...config, components: config.components.map((c) => (c.id === id ? after : c)) }, before, after);
}

/** Turns a component by `by` degrees (90 = a quarter turn clockwise) about its middle; the wires on its terminals follow. */
export function rotateComponent(config: CircuitConfig, id: string, by = 90): CircuitConfig {
  const before = config.components.find((c) => c.id === id);
  if (!before) return config;
  const rotation = normRotation(before.rotation + by);
  const at = placeAt(config, rotation, before.x, before.y); // (turned near an edge, it is pushed back inside)
  const after = { ...before, rotation, ...at };
  return carryWires({ ...config, components: config.components.map((c) => (c.id === id ? after : c)) }, before, after);
}

export function updateComponent(config: CircuitConfig, id: string, patch: Partial<Pick<CircuitComponent, "label" | "value" | "closed" | "showValue" | "labelSide">>): CircuitConfig {
  return { ...config, components: config.components.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
}

/**
 * Numbers the labels: the components that still have the letter a new one gets (R, C, E…) or that letter with a number get R1, R2,
 * R3… in the order they were put (a kind of which there is only one keeps its plain letter). A label the teacher wrote is left alone.
 */
export function numberLabels(config: CircuitConfig): CircuitConfig {
  const next = new Map<string, string>();
  for (const type of Object.keys(COMPONENT_SPECS) as ComponentType[]) {
    const letter = COMPONENT_SPECS[type].label;
    if (!letter) continue;
    const mine = config.components.filter((c) => c.type === type && new RegExp(`^${letter}\\d*$`).test(c.label));
    mine.forEach((c, i) => next.set(c.id, mine.length > 1 ? `${letter}${i + 1}` : letter));
  }
  const components = config.components.map((c) => (next.has(c.id) && next.get(c.id) !== c.label ? { ...c, label: next.get(c.id)! } : c));
  return components.every((c, i) => c === config.components[i]) ? config : { ...config, components };
}

/** Takes a component away. Its wires stay (their ends are left where they were). */
export const removeComponent = (config: CircuitConfig, id: string): CircuitConfig => ({ ...config, components: config.components.filter((c) => c.id !== id) });

/** A new wire along `points` (kept orthogonal: corners that are not corners go). null when it is not a wire (a single point). */
export function newWire(points: number[], id: string = crypto.randomUUID()) {
  const path = simplifyPath(points);
  return path.length >= 4 ? { id, points: path } : null;
}

export function addWire(config: CircuitConfig, points: number[], id?: string): CircuitConfig {
  const wire = newWire(points, id);
  return wire ? { ...config, wires: [...config.wires, wire] } : config;
}

export const removeWire = (config: CircuitConfig, id: string): CircuitConfig => ({ ...config, wires: config.wires.filter((w) => w.id !== id) });

/** Moves a whole wire by (dx, dy), rounded to the grid. It is then connected to whatever its ends are on now. */
export function moveWire(config: CircuitConfig, id: string, dx: number, dy: number): CircuitConfig {
  const ddx = snap(dx);
  const ddy = snap(dy);
  if (!ddx && !ddy) return config;
  return { ...config, wires: config.wires.map((w) => (w.id === id ? { ...w, points: translatePath(w.points, ddx, ddy) } : w)) };
}

/** A new size of the drawing area. */
export function resizeArea(config: CircuitConfig, width: number, height: number): CircuitConfig {
  return width === config.width && height === config.height ? config : { ...config, width: Math.round(width / GRID) * GRID || GRID, height: Math.round(height / GRID) * GRID || GRID };
}
