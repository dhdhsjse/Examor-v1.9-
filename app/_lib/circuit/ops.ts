// The edits of a circuit, as pure functions from one CircuitConfig to the next. A wire is connected to a component when one of its
// ends is on one of its terminals: moving or turning the component carries those ends along (the wire stays orthogonal), and
// nothing needs to be stored to remember the connection. Unit-tested.
import { GRID, HALF_LENGTH, axisOf, distanceAlong, endsOf, moveEndpoint, normRotation, onPath, pathLength, simplifyPath, snap, subPath, terminalsOf, translatePath, type P, type Section } from "./geometry";
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

/** The wire a component lies along: both its terminals and its middle on it, with straight wire between the terminals. */
function wireUnder(config: CircuitConfig, c: CircuitComponent): { id: string; section: Section } | null {
  const [t0, t1] = terminalsOf(c);
  for (const w of config.wires) {
    if (!onPath(w.points, t0) || !onPath(w.points, t1) || !onPath(w.points, { x: c.x, y: c.y })) continue;
    const a = distanceAlong(w.points, t0);
    const b = distanceAlong(w.points, t1);
    // (the wire must run straight between the terminals, not leave and come back)
    if (Math.abs(Math.abs(b - a) - 2 * HALF_LENGTH) <= 0.5) return { id: w.id, section: { a, b } };
  }
  return null;
}

/**
 * The segment of a wire the middle of a component is inside of (not at a corner or an end), when that segment runs along the
 * component's axis: the wire is then too short (a corner or an end under the symbol) to hold it straight, but it still goes through it.
 */
function segmentUnder(config: CircuitConfig, c: CircuitComponent) {
  const horizontal = axisOf(c.rotation).y === 0;
  for (const w of config.wires) {
    let walked = 0;
    for (let i = 2; i < w.points.length; i += 2) {
      const a = { x: w.points[i - 2], y: w.points[i - 1] };
      const b = { x: w.points[i], y: w.points[i + 1] };
      const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
      const from = walked;
      walked += len;
      const lineOk = horizontal ? Math.abs(a.y - b.y) < 0.5 && Math.abs(c.y - a.y) < 0.5 : Math.abs(a.x - b.x) < 0.5 && Math.abs(c.x - a.x) < 0.5;
      if (!lineOk) continue;
      const at = horizontal ? c.x : c.y;
      const lo = horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y);
      const hi = horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
      if (at > lo + 0.5 && at < hi - 0.5) return { wire: w, a, b, from, to: walked, middle: from + Math.abs(horizontal ? c.x - a.x : c.y - a.y) };
    }
  }
  return null;
}

/**
 * A component about to be put at (x, y): when it would lie on a wire only if it were turned a quarter (a vertical wire, for a
 * component that is flat), it is turned to follow the wire; otherwise it keeps `rotation`.
 */
export function newComponentOnWire(config: CircuitConfig, type: ComponentType, x: number, y: number, rotation = 0, id?: string): CircuitComponent {
  const asked = newComponent(config, type, x, y, rotation, id);
  const turned = newComponent(config, type, x, y, rotation + 90, asked.id);
  if (wireUnder(config, asked)) return asked;
  if (wireUnder(config, turned)) return turned;
  if (segmentUnder(config, asked)) return asked;
  return segmentUnder(config, turned) ? turned : asked;
}

/**
 * Adds a component. One put on a wire is put *into* it: the stretch of wire under the component is taken away, so the wire ends on
 * the two terminals instead of running through the symbol. Where the wire is too short to hold it (a corner under the symbol), the
 * two ends left are carried to the terminals, the wire bending to follow.
 */
export function addComponent(config: CircuitConfig, component: CircuitComponent): CircuitConfig {
  const next: CircuitConfig = { ...config, components: [...config.components, component] };
  const under = wireUnder(config, component);
  if (under) return removeWireSection(next, under.id, under.section);
  const seg = segmentUnder(config, component);
  if (!seg) return next;
  const [t0, t1] = terminalsOf(component);
  const axis = axisOf(component.rotation);
  const aligned = (seg.b.x - seg.a.x) * axis.x + (seg.b.y - seg.a.y) * axis.y > 0; // (the wire runs from the first terminal to the second)
  const length = pathLength(seg.wire.points);
  const a = Math.max(seg.from, seg.middle - HALF_LENGTH);
  const b = Math.min(seg.to, seg.middle + HALF_LENGTH);
  const toBefore = aligned ? t0 : t1;
  const toAfter = aligned ? t1 : t0;
  const join = (points: number[], end: 0 | 1, to: P) => {
    const ps = end === 0 ? [points[0], points[1]] : [points[points.length - 2], points[points.length - 1]];
    return near({ x: ps[0], y: ps[1] }, to) ? points : moveEndpoint(points, end, to);
  };
  const before = a > 0.5 ? newWire(join(subPath(seg.wire.points, 0, a), 1, toBefore), seg.wire.id) : null;
  const after = length - b > 0.5 ? newWire(join(subPath(seg.wire.points, b, length), 0, toAfter), before ? crypto.randomUUID() : seg.wire.id) : null;
  const left = [before, after].filter((w): w is NonNullable<typeof w> => !!w);
  return { ...next, wires: next.wires.flatMap((w) => (w.id === seg.wire.id ? left : [w])) };
}

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

/** The labels numbered by numberLabels (R1, R2…) back to their plain letter (R, R…). A label the teacher wrote is left alone. */
export function unnumberLabels(config: CircuitConfig): CircuitConfig {
  const components = config.components.map((c) => {
    const letter = COMPONENT_SPECS[c.type].label;
    return letter && c.label !== letter && new RegExp(`^${letter}\\d+$`).test(c.label) ? { ...c, label: letter } : c;
  });
  return components.every((c, i) => c === config.components[i]) ? config : { ...config, components };
}

/** Whether the labels are numbered (numberLabels has nothing left to do and a label has its number): the button then takes the numbers off. */
export const labelsNumbered = (config: CircuitConfig): boolean => numberLabels(config) === config && unnumberLabels(config) !== config;

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

/**
 * Takes a section of a wire away (from `section.a` to `section.b` pixels along it): what is left before it keeps the wire's id,
 * what is left after it is a new wire. A wire with nothing left goes.
 */
export function removeWireSection(config: CircuitConfig, id: string, section: Section, newId: string = crypto.randomUUID()): CircuitConfig {
  const wire = config.wires.find((w) => w.id === id);
  if (!wire) return config;
  const length = pathLength(wire.points);
  const a = Math.max(0, Math.min(section.a, section.b));
  const b = Math.min(length, Math.max(section.a, section.b));
  if (b - a < 0.5) return config;
  const before = a > 0.5 ? newWire(subPath(wire.points, 0, a), wire.id) : null;
  const after = length - b > 0.5 ? newWire(subPath(wire.points, b, length), before ? newId : wire.id) : null;
  const left = [before, after].filter((w): w is NonNullable<typeof w> => !!w);
  return { ...config, wires: config.wires.flatMap((w) => (w.id === id ? left : [w])) };
}

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
