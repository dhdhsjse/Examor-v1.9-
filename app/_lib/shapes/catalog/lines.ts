// Lines, arrows and connectors. Each runs from the top-left corner of its box to the bottom-right one; flipping the shape makes
// the other diagonals, so a line is two points and nothing more. Arrow heads are filled with the outline's color.
import { C, H, L, M, V, polygon, type Pt } from "../path";
import type { ShapeDef, ShapePart } from "../types";
import { single, val } from "./adjust";

/** The length of an arrow head for an outline of this width. */
export const headLength = (sw: number) => Math.max(10, sw * 4.5);

// A triangle with its tip at `tip`, pointing along the unit vector `dir`.
function head(tip: Pt, dir: Pt, size: number): string {
  const [dx, dy] = dir;
  const bx = tip[0] - dx * size;
  const by = tip[1] - dy * size;
  const half = size * 0.42;
  return polygon([
    tip,
    [bx - dy * half, by + dx * half],
    [bx + dy * half, by - dx * half],
  ]);
}

const unit = (dx: number, dy: number): Pt => {
  const len = Math.hypot(dx, dy);
  return len < 1e-6 ? [1, 0] : [dx / len, dy / len];
};

type Ends = { start?: boolean; end?: boolean };

function straight(w: number, h: number, sw: number, ends: Ends): ShapePart[] {
  const s = headLength(sw);
  const dir = unit(w, h);
  const len = Math.hypot(w, h);
  // the line stops under the head, so that its end does not show through the tip
  const cut = (on: boolean | undefined) => (on ? Math.min(s * 0.85, len / 2) : 0);
  const a: Pt = [dir[0] * cut(ends.start), dir[1] * cut(ends.start)];
  const b: Pt = [w - dir[0] * cut(ends.end), h - dir[1] * cut(ends.end)];
  const parts: ShapePart[] = [{ d: M(a[0], a[1]) + L(b[0], b[1]), paint: "line" }];
  if (ends.end) parts.push({ d: head([w, h], dir, s), paint: "solid" });
  if (ends.start) parts.push({ d: head([0, 0], [-dir[0], -dir[1]], s), paint: "solid" });
  return parts;
}

// Right angles: along, across, along (the middle part is where the handle sets it).
function elbow(w: number, h: number, a: readonly number[], sw: number, ends: Ends): ShapePart[] {
  const s = headLength(sw);
  const xm = val(a, 0, 0.5, 0, 1) * w;
  const sign = (v: number) => (v < 0 ? -1 : 1);
  const d0 = sign(xm); // the way the first leg goes
  const d1 = sign(w - xm); // the way the last leg goes
  const x0 = ends.start ? d0 * Math.min(s * 0.85, Math.abs(xm) || s) : 0;
  const x1 = w - (ends.end ? d1 * Math.min(s * 0.85, Math.abs(w - xm) || s) : 0);
  const parts: ShapePart[] = [{ d: M(x0, 0) + H(xm) + V(h) + H(x1), paint: "line" }];
  if (ends.end) parts.push({ d: head([w, h], [d1, 0], s), paint: "solid" });
  if (ends.start) parts.push({ d: head([0, 0], [-d0, 0], s), paint: "solid" });
  return parts;
}

// An S: leaves and arrives flat.
function curve(w: number, h: number, sw: number, ends: Ends): ShapePart[] {
  const s = headLength(sw);
  const x0 = ends.start ? Math.min(s * 0.85, w / 2) : 0;
  const x1 = w - (ends.end ? Math.min(s * 0.85, w / 2) : 0);
  const mid = (x0 + x1) / 2;
  const parts: ShapePart[] = [{ d: M(x0, 0) + C(mid, 0, mid, h, x1, h), paint: "line" }];
  if (ends.end) parts.push({ d: head([w, h], [1, 0], s), paint: "solid" });
  if (ends.start) parts.push({ d: head([0, 0], [-1, 0], s), paint: "solid" });
  return parts;
}

const elbowAdjust = single(
  0.5,
  (w, h, v) => [v * w, h / 2],
  (x, _y, w) => (w < 1 ? 0.5 : x / w),
  0,
  1,
);

const BASE = { category: "Lines", line: true } as const;

export const LINES: ShapeDef[] = [
  { ...BASE, id: "line", label: "Line", size: [150, 0], parts: (w, h, _a, sw) => straight(w, h, sw, {}) },
  { ...BASE, id: "arrow", label: "Arrow", size: [150, 0], parts: (w, h, _a, sw) => straight(w, h, sw, { end: true }) },
  { ...BASE, id: "doubleArrow", label: "Double arrow", size: [150, 0], parts: (w, h, _a, sw) => straight(w, h, sw, { start: true, end: true }) },
  { ...BASE, id: "elbow", label: "Elbow connector", size: [120, 60], adjust: elbowAdjust, parts: (w, h, a, sw) => elbow(w, h, a, sw, {}) },
  { ...BASE, id: "elbowArrow", label: "Elbow arrow connector", size: [120, 60], adjust: elbowAdjust, parts: (w, h, a, sw) => elbow(w, h, a, sw, { end: true }) },
  { ...BASE, id: "elbowDoubleArrow", label: "Elbow double-arrow connector", size: [120, 60], adjust: elbowAdjust, parts: (w, h, a, sw) => elbow(w, h, a, sw, { start: true, end: true }) },
  { ...BASE, id: "curve", label: "Curved connector", size: [120, 60], parts: (w, h, _a, sw) => curve(w, h, sw, {}) },
  { ...BASE, id: "curveArrow", label: "Curved arrow connector", size: [120, 60], parts: (w, h, _a, sw) => curve(w, h, sw, { end: true }) },
  { ...BASE, id: "curveDoubleArrow", label: "Curved double-arrow connector", size: [120, 60], parts: (w, h, _a, sw) => curve(w, h, sw, { start: true, end: true }) },
];
