// Making and changing the shapes of a Studio: pure functions on lists of ShapeItem (the order of the list is the order they are
// stacked in: the last one is on top). Each returns the same list when nothing changes.
import { shapeDef } from "./catalog";
import { MIN_SHAPE_SIZE, isLine } from "./geometry";
import type { Pt } from "./path";
import type { ShapeItem, ShapeStyle } from "./types";

export const newShapeId = () => crypto.randomUUID();

/** The size of a shape put with a click (a drag makes any size). */
export const defaultSize = (shape: string): [number, number] => {
  const [w, h] = shapeDef(shape).size ?? [120, 90];
  return [w, h];
};

export type DrawnBox = { x: number; y: number; w: number; h: number; flipX: boolean; flipY: boolean };

/**
 * The box of a shape drawn by dragging from `from` to `to`. A line goes from the first point to the second (the flips say
 * which way); another shape fills the box between them. With `square` the box is a square (Shift), with `fromCenter` the first
 * point is the centre (Alt). A drag shorter than a few pixels is a click: the shape gets its usual size, centred on the click.
 */
export function boxFromDrag(shape: string, from: Pt, to: Pt, opts: { square?: boolean; fromCenter?: boolean } = {}): DrawnBox {
  const line = !!shapeDef(shape).line;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (Math.hypot(dx, dy) < 4) {
    const [w, h] = defaultSize(shape);
    return { x: from[0] - w / 2, y: from[1] - h / 2, w, h, flipX: false, flipY: false };
  }
  let ex = dx;
  let ey = dy;
  if (opts.square) {
    if (line) {
      // a line snaps to the nearest 45° step
      const len = Math.hypot(dx, dy);
      const step = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      ex = Math.cos(step) * len;
      ey = Math.sin(step) * len;
    } else {
      const side = Math.max(Math.abs(dx), Math.abs(dy));
      ex = Math.sign(dx || 1) * side;
      ey = Math.sign(dy || 1) * side;
    }
  }
  const x0 = opts.fromCenter ? from[0] - ex : from[0];
  const y0 = opts.fromCenter ? from[1] - ey : from[1];
  const x1 = from[0] + ex;
  const y1 = from[1] + ey;
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    w: Math.abs(x1 - x0),
    h: Math.abs(y1 - y0),
    flipX: line && x1 < x0,
    flipY: line && y1 < y0,
  };
}

/**
 * A stroke of the pencil (its points, in the drawing's pixels) as the box of a freehand shape and its `adj` (the points as fractions
 * of the box). A stroke that is a straight line across or down still gets a box a few pixels thick. Null: a click, not a stroke.
 */
export function freehandFrom(points: readonly Pt[]): { box: DrawnBox; adj: number[] } | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  if (Math.hypot(x1 - x0, y1 - y0) < 3) return null;
  const w = Math.max(x1 - x0, MIN_SHAPE_SIZE);
  const h = Math.max(y1 - y0, MIN_SHAPE_SIZE);
  const x = (x0 + x1 - w) / 2;
  const y = (y0 + y1 - h) / 2;
  const frac = (v: number) => Math.round(v * 10000) / 10000;
  return { box: { x, y, w, h, flipX: false, flipY: false }, adj: points.flatMap(([px, py]) => [frac((px - x) / w), frac((py - y) / h)]) };
}

/** A new shape in a box, with the style it is given (the rest is the default). */
export function newShapeItem(shape: string, box: Pick<DrawnBox, "x" | "y" | "w" | "h"> & Partial<Pick<DrawnBox, "flipX" | "flipY">>, style: Partial<ShapeStyle> = {}): ShapeItem {
  const line = !!shapeDef(shape).line;
  const item: ShapeItem = {
    ...style,
    id: newShapeId(),
    shape,
    x: box.x,
    y: box.y,
    w: line ? Math.max(box.w, 0) : Math.max(box.w, MIN_SHAPE_SIZE),
    h: line ? Math.max(box.h, 0) : Math.max(box.h, MIN_SHAPE_SIZE),
  };
  if (box.flipX) item.flipX = true;
  if (box.flipY) item.flipY = true;
  return item;
}

// ---- lists ----

export const addShape = (list: readonly ShapeItem[] | undefined, item: ShapeItem): ShapeItem[] => [...(list ?? []), item];

export function updateShape(list: readonly ShapeItem[] | undefined, id: string, patch: Partial<Omit<ShapeItem, "id">>): ShapeItem[] {
  const items = list ?? [];
  let changed = false;
  const next = items.map((s) => {
    if (s.id !== id) return s;
    const merged: ShapeItem = { ...s, ...patch };
    if (isLine(merged)) delete merged.rotation; // (a line is never turned)
    if (JSON.stringify(merged) === JSON.stringify(s)) return s;
    changed = true;
    return merged;
  });
  return changed ? next : (items as ShapeItem[]);
}

export const removeShape = (list: readonly ShapeItem[] | undefined, id: string): ShapeItem[] => (list ?? []).filter((s) => s.id !== id);

export function moveShape(list: readonly ShapeItem[] | undefined, id: string, dx: number, dy: number): ShapeItem[] {
  return (list ?? []).map((s) => (s.id === id ? { ...s, x: s.x + dx, y: s.y + dy } : s));
}

export type Order = "front" | "back" | "forward" | "backward";

export function reorderShape(list: readonly ShapeItem[] | undefined, id: string, order: Order): ShapeItem[] {
  const items = [...(list ?? [])];
  const from = items.findIndex((s) => s.id === id);
  if (from < 0) return items;
  const to = order === "front" ? items.length - 1 : order === "back" ? 0 : Math.max(0, Math.min(items.length - 1, from + (order === "forward" ? 1 : -1)));
  if (to === from) return items;
  const [item] = items.splice(from, 1);
  items.splice(to, 0, item);
  return items;
}

/** A copy of a shape a little down and to the right of the original, on top of the others. */
export function duplicateShape(list: readonly ShapeItem[] | undefined, id: string, offset = 14): { list: ShapeItem[]; copy: ShapeItem | null } {
  const items = list ?? [];
  const found = items.find((s) => s.id === id);
  if (!found) return { list: [...items], copy: null };
  const copy: ShapeItem = { ...found, id: newShapeId(), x: found.x + offset, y: found.y + offset, adj: found.adj && [...found.adj] };
  return { list: [...items, copy], copy };
}

// ---- lines: two end points ----

/** The two ends of a line in the studio's coordinates: where it starts (the first corner drawn) and where it ends. */
export function lineEnds(item: ShapeItem): { start: Pt; end: Pt } {
  return {
    start: [item.x + (item.flipX ? item.w : 0), item.y + (item.flipY ? item.h : 0)],
    end: [item.x + (item.flipX ? 0 : item.w), item.y + (item.flipY ? 0 : item.h)],
  };
}

/** The line after one of its ends is moved to `p`. */
export function moveLineEnd(item: ShapeItem, which: "start" | "end", p: Pt): ShapeItem {
  const ends = lineEnds(item);
  const start = which === "start" ? p : ends.start;
  const end = which === "end" ? p : ends.end;
  const next: ShapeItem = { ...item, x: Math.min(start[0], end[0]), y: Math.min(start[1], end[1]), w: Math.abs(end[0] - start[0]), h: Math.abs(end[1] - start[1]) };
  // (a line that is exactly level keeps the way it was flipped)
  const fx = end[0] === start[0] ? !!item.flipX : end[0] < start[0];
  const fy = end[1] === start[1] ? !!item.flipY : end[1] < start[1];
  if (fx) next.flipX = true;
  else delete next.flipX;
  if (fy) next.flipY = true;
  else delete next.flipY;
  return next;
}
