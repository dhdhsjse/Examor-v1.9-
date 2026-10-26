// The geometry of the circuit: the grid, where the terminals of a component are, and orthogonal wires (paths made only of
// horizontal and vertical segments): how a wire is routed between two points, what a wire becomes when one of its ends moves
// (it stays orthogonal), and where wires meet. Pure functions (no React), unit-tested.
import type { CircuitComponent, CircuitConfig, CircuitWire } from "./types";

export const GRID = 20;
/** How far each terminal is from the middle of a component (two grid cells, so a terminal is on the grid when the middle is) */
export const HALF_LENGTH = 40;
export type P = { x: number; y: number };

const clean = (v: number) => (v === 0 ? 0 : v); // (no -0)
export const snap = (v: number, grid = GRID) => clean(Math.round(v / grid) * grid);
const same = (a: P, b: P) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;

/** A rotation turned into 0, 90, 180 or 270. */
export const normRotation = (r: number) => (((Math.round(r / 90) * 90) % 360) + 360) % 360;

/** The direction a component's axis points in (from its first terminal to its second), exactly: no float noise from cos and sin. */
export function axisOf(rotation: number): P {
  switch (normRotation(rotation)) {
    case 90:
      return { x: 0, y: 1 };
    case 180:
      return { x: -1, y: 0 };
    case 270:
      return { x: 0, y: -1 };
    default:
      return { x: 1, y: 0 };
  }
}

/** The two terminals of a component: the first at the "left" (before it is rotated), the second at the "right". */
export function terminalsOf(c: Pick<CircuitComponent, "x" | "y" | "rotation">): [P, P] {
  const a = axisOf(c.rotation);
  return [
    { x: clean(c.x - a.x * HALF_LENGTH), y: clean(c.y - a.y * HALF_LENGTH) },
    { x: clean(c.x + a.x * HALF_LENGTH), y: clean(c.y + a.y * HALF_LENGTH) },
  ];
}

/** The direction a wire leaves a terminal in: away from the component. */
export function outwardOf(c: Pick<CircuitComponent, "rotation">, terminal: 0 | 1): P {
  const a = axisOf(c.rotation);
  return terminal === 0 ? { x: clean(-a.x), y: clean(-a.y) } : a;
}

// ---- paths ----

const pairs = (points: number[]): P[] => Array.from({ length: Math.floor(points.length / 2) }, (_, i) => ({ x: points[2 * i], y: points[2 * i + 1] }));
const flat = (ps: P[]): number[] => ps.flatMap((p) => [p.x, p.y]);

/** A path without repeated points and without a corner that is not one (three points on a line lose the middle one). */
export function simplifyPath(points: number[]): number[] {
  const out: P[] = [];
  for (const p of pairs(points)) {
    if (out.length && same(out[out.length - 1], p)) continue;
    out.push(p);
    while (out.length >= 3) {
      const [a, b, c] = out.slice(-3);
      const straight = (Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5) || (Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5);
      if (!straight) break;
      out.splice(out.length - 2, 1); // (the middle one)
    }
  }
  return flat(out);
}

/** The axis of the last segment of a path ("h" or "v"), or null for a path with no segment. */
export function lastAxis(points: number[]): "h" | "v" | null {
  const ps = pairs(points);
  if (ps.length < 2) return null;
  const [a, b] = ps.slice(-2);
  return Math.abs(a.y - b.y) < 0.5 ? "h" : "v";
}

/** A path from `a` to `b` of at most one corner: along `first` ("h" = horizontal, "v" = vertical) first, then the other way. */
export function orthogonalPath(a: P, b: P, first: "h" | "v" = "h"): number[] {
  const elbow = first === "h" ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
  return simplifyPath(flat([a, elbow, b]));
}

/** `path` carried on to `to` with one more corner at most: `first` is the axis of the new leg that starts at the end of `path`. */
export function extendPath(path: number[], to: P, first: "h" | "v"): number[] {
  const ps = pairs(path);
  if (!ps.length) return flat([to]);
  const last = ps[ps.length - 1];
  const elbow = first === "h" ? { x: to.x, y: last.y } : { x: last.x, y: to.y };
  return simplifyPath([...path, elbow.x, elbow.y, to.x, to.y]);
}

/**
 * The path drawn so far carried on to `to`: the new leg turns away from the last segment (a wire bends rather than doubling its
 * last segment); the first leg of a wire that starts on a terminal leaves it the way the terminal points (`startDir`), else
 * goes horizontally first. `flip` takes the other way round (Shift while drawing).
 */
export function routeNext(path: number[], startDir: P | undefined, to: P, flip = false): number[] {
  const axis = lastAxis(path);
  let first: "h" | "v" = axis ? (axis === "h" ? "v" : "h") : startDir && startDir.x === 0 && startDir.y !== 0 ? "v" : "h";
  if (flip) first = first === "h" ? "v" : "h";
  return extendPath(path, to, first);
}

/**
 * The path when its first (`end` = 0) or last (`end` = 1) point is moved to `to`: the segment that leaves it keeps its direction,
 * so the neighbouring corner slides along the next segment and the wire stays orthogonal. A wire of a single segment that
 * is no longer straight gets a corner.
 */
export function moveEndpoint(points: number[], end: 0 | 1, to: P): number[] {
  const ps = pairs(points);
  const n = ps.length;
  if (n < 2) return points;
  const i = end === 0 ? 0 : n - 1;
  const j = end === 0 ? 1 : n - 2;
  const horizontal = Math.abs(ps[i].y - ps[j].y) < 0.5; // (the segment that leaves the moved point)
  ps[i] = to;
  // (one segment: the leg that arrives at the moved end keeps its direction)
  if (n === 2) return orthogonalPath(ps[0], ps[1], (end === 0) === horizontal ? "h" : "v");
  if (horizontal) ps[j] = { x: ps[j].x, y: to.y };
  else ps[j] = { x: to.x, y: ps[j].y };
  return simplifyPath(flat(ps));
}

export const translatePath = (points: number[], dx: number, dy: number): number[] => points.map((v, i) => clean(v + (i % 2 === 0 ? dx : dy)));

/** The two ends of a wire. */
export const endsOf = (w: Pick<CircuitWire, "points">): [P, P] => {
  const ps = pairs(w.points);
  return [ps[0], ps[ps.length - 1]];
};

/** Whether `p` is on the path (on one of its segments, ends included). */
export function onPath(points: number[], p: P): boolean {
  const ps = pairs(points);
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1];
    const b = ps[i];
    const inX = p.x >= Math.min(a.x, b.x) - 0.5 && p.x <= Math.max(a.x, b.x) + 0.5;
    const inY = p.y >= Math.min(a.y, b.y) - 0.5 && p.y <= Math.max(a.y, b.y) + 0.5;
    if (inX && inY && (Math.abs(a.x - b.x) < 0.5 ? Math.abs(p.x - a.x) < 0.5 : Math.abs(p.y - a.y) < 0.5)) return true;
  }
  return false;
}

/** Whether `p` is on the path but not at one of its two ends (a wire that ends there is joined to it, not continued by it). */
function inInterior(points: number[], p: P): boolean {
  const ps = pairs(points);
  return onPath(points, p) && !same(ps[0], p) && !same(ps[ps.length - 1], p);
}

/**
 * Where the wires are connected to each other, to be marked with a dot: the end of a wire that lies on another wire (not at its end: two wires end to end are one longer wire), and any point
 * where three or more ends meet (a terminal counts as one: two wires on a terminal is a connection to it, three is a node).
 */
export function junctionPoints(config: Pick<CircuitConfig, "components" | "wires">): P[] {
  const found: P[] = [];
  const add = (p: P) => {
    if (!found.some((q) => same(p, q))) found.push(p);
  };
  const ends = config.wires.flatMap((w) => endsOf(w));
  const terminals = config.components.flatMap((c) => terminalsOf(c));
  config.wires.forEach((w) => {
    for (const e of endsOf(w)) if (config.wires.some((o) => o !== w && inInterior(o.points, e))) add(e);
  });
  for (const e of ends) {
    const meeting = ends.filter((o) => same(o, e)).length + terminals.filter((t) => same(t, e)).length;
    if (meeting >= 3) add(e);
  }
  return found;
}

// ---- snapping ----

export type SnapTarget = {
  point: P;
  /** The wire ends here: it is on a terminal or on another wire */
  connects: boolean;
  /** On a terminal: the direction a wire leaves it in */
  outward?: P;
};

/** How close (pixels) the mouse must be to a terminal or a wire to be drawn to it, instead of to the grid. */
export const TERMINAL_REACH = 15;
export const WIRE_REACH = 8;

/** Where a wire point put at `raw` lands: on a terminal close to it, else on another wire close to it, else on the grid. */
export function snapTarget(config: Pick<CircuitConfig, "components" | "wires">, raw: P, ignoreWire?: string): SnapTarget {
  let best: { point: P; outward: P; d: number } | undefined;
  for (const c of config.components) {
    const ts = terminalsOf(c);
    for (const i of [0, 1] as const) {
      const d = Math.hypot(ts[i].x - raw.x, ts[i].y - raw.y);
      if (d <= TERMINAL_REACH && (!best || d < best.d)) best = { point: ts[i], outward: outwardOf(c, i), d };
    }
  }
  if (best) return { point: best.point, connects: true, outward: best.outward };
  const grid = { x: snap(raw.x), y: snap(raw.y) };
  const wire = config.wires.find((w) => w.id !== ignoreWire && onPath(w.points, grid) && Math.hypot(grid.x - raw.x, grid.y - raw.y) <= WIRE_REACH + GRID / 2);
  return { point: grid, connects: !!wire };
}
