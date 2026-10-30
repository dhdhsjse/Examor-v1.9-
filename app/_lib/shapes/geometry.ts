// What a shape looks like, worked out from its style and its box: the painted parts, the colors, the dashes, the room for text, the
// handles, and how far it reaches. The canvases (Konva) and the pictures (SVG) both read these, so they cannot differ.
import { shapeDef } from "./catalog";
import { rad, type Pt } from "./path";
import type { Paint, ShapeDef, ShapeItem, ShapePart, ShapeStyle } from "./types";

export const SHAPE_FONT = "Arial, Helvetica, sans-serif";
export const DEFAULT_STROKE = "#111827";
export const DEFAULT_STROKE_WIDTH = 2;
export const DEFAULT_FONT_SIZE = 16;
export const DEFAULT_TEXT_COLOR = "#111827";
/** Room between a shape's outline and its text */
export const TEXT_PADDING = 4;
export const MIN_SHAPE_SIZE = 6;

export const isLine = (style: ShapeStyle) => !!shapeDef(style.shape).line;

export type ResolvedStyle = {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
};

/** The colors and width a shape is drawn with: what is missing is the default (no fill, a dark outline 2 px wide); a line always has its outline. */
export function resolveStyle(style: ShapeStyle): ResolvedStyle {
  const line = isLine(style);
  const stroke = style.stroke === undefined ? DEFAULT_STROKE : style.stroke;
  return {
    fill: line ? null : (style.fill ?? null),
    stroke: line ? (stroke ?? DEFAULT_STROKE) : stroke,
    strokeWidth: Math.max(0.25, style.strokeWidth ?? DEFAULT_STROKE_WIDTH),
  };
}

/** The values of the shape's handles: the ones changed, else the defaults. */
export function adjustOf(def: ShapeDef, style: ShapeStyle): number[] {
  if (def.freehand) return (style.adj ?? []).filter((v) => typeof v === "number" && Number.isFinite(v)); // (its points)
  const defaults = def.adjust?.defaults ?? [];
  return defaults.map((d, i) => {
    const v = style.adj?.[i];
    return typeof v === "number" && Number.isFinite(v) ? v : d;
  });
}

/** The drawing of a shape in a box of w×h (before it is flipped or turned). */
export function shapeParts(style: ShapeStyle, w: number, h: number): ShapePart[] {
  const def = shapeDef(style.shape);
  return def.parts(Math.max(w, 0), Math.max(h, 0), adjustOf(def, style), resolveStyle(style).strokeWidth).filter((p) => p.d);
}

// ---- colors ----

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const toRgb = (hex: string): [number, number, number] | null => {
  if (!HEX.test(hex)) return null;
  const h = hex.length === 4 ? [...hex.slice(1)].map((c) => c + c).join("") : hex.slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4), 16)];
};

/** A color mixed with white (amount > 0) or black (amount < 0), as #rrggbb; a color that is not a hex code is returned as it is. */
export function shade(color: string, amount: number): string {
  const rgb = toRgb(color);
  if (!rgb) return color;
  const target = amount >= 0 ? 255 : 0;
  const k = Math.min(Math.abs(amount), 1);
  return "#" + rgb.map((c) => Math.round(c + (target - c) * k).toString(16).padStart(2, "0")).join("");
}

/** The color a part is filled with (null = not filled). */
export function paintFill(paint: Paint, style: ShapeStyle): string | null {
  const { fill, stroke } = resolveStyle(style);
  switch (paint) {
    case "fill":
      return fill;
    case "light":
      return fill ? shade(fill, 0.4) : null;
    case "dark":
      return fill ? shade(fill, -0.22) : null;
    case "solid":
      return stroke;
    case "line":
      return null;
  }
}

/** The dash pattern of the outline (undefined = solid). */
export function dashArray(style: ShapeStyle): number[] | undefined {
  const sw = resolveStyle(style).strokeWidth;
  if (style.dash === "dashed") return [Math.max(sw * 4, 6), Math.max(sw * 2.5, 4)];
  if (style.dash === "dotted") return [Math.max(sw, 1.5), Math.max(sw * 2, 3)];
  return undefined;
}

// ---- text ----

/** The box the text of a shape goes in, inside its box. */
export function textRect(style: ShapeStyle, w: number, h: number): { x: number; y: number; w: number; h: number } {
  const [l, t, r, b] = shapeDef(style.shape).textInset ?? [0, 0, 0, 0];
  const x = w * l + TEXT_PADDING;
  const y = h * t + TEXT_PADDING;
  return { x, y, w: Math.max(w * (1 - l - r) - 2 * TEXT_PADDING, 0), h: Math.max(h * (1 - t - b) - 2 * TEXT_PADDING, 0) };
}

// ---- turning and flipping ----

const turn = (x: number, y: number, deg: number): Pt => {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [x * c - y * s, x * s + y * c];
};

/** A point of the shape's own box (the unflipped drawing) to the page/studio: flipped, turned round the centre, moved. */
export function localToWorld(item: ShapeItem, lx: number, ly: number): Pt {
  const fx = item.flipX ? item.w - lx : lx;
  const fy = item.flipY ? item.h - ly : ly;
  const [rx, ry] = turn(fx - item.w / 2, fy - item.h / 2, item.rotation ?? 0);
  return [item.x + item.w / 2 + rx, item.y + item.h / 2 + ry];
}

/** The other way: a point of the studio to the shape's own box. */
export function worldToLocal(item: ShapeItem, x: number, y: number): Pt {
  const [rx, ry] = turn(x - (item.x + item.w / 2), y - (item.y + item.h / 2), -(item.rotation ?? 0));
  const fx = rx + item.w / 2;
  const fy = ry + item.h / 2;
  return [item.flipX ? item.w - fx : fx, item.flipY ? item.h - fy : fy];
}

// ---- handles ----

/** Where the yellow handles are, in the shape's own box. */
export function handlePoints(style: ShapeStyle, w: number, h: number): Pt[] {
  const def = shapeDef(style.shape);
  return def.adjust ? def.adjust.handles(w, h, adjustOf(def, style)) : [];
}

/** The `adj` the shape has after handle `i` is dragged to (x, y) of its own box. */
export function dragHandle(style: ShapeStyle, i: number, x: number, y: number, w: number, h: number): number[] {
  const def = shapeDef(style.shape);
  return def.adjust ? def.adjust.drag(i, x, y, w, h, adjustOf(def, style)) : (style.adj ?? []);
}

// ---- how far a shape reaches ----

// The coordinates a path goes through (end points and control points; for an arc only the end point: it stays inside the box).
export function pathPoints(d: string): Pt[] {
  const pts: Pt[] = [];
  const re = /([MLHVCQAZ])([^MLHVCQAZ]*)/g;
  let cx = 0;
  let cy = 0;
  for (let m = re.exec(d); m; m = re.exec(d)) {
    const n = m[2].trim() ? m[2].trim().split(/[\s,]+/).map(Number) : [];
    switch (m[1]) {
      case "M":
      case "L":
        for (let i = 0; i + 1 < n.length; i += 2) pts.push([(cx = n[i]), (cy = n[i + 1])]);
        break;
      case "H":
        cx = n[0];
        pts.push([cx, cy]);
        break;
      case "V":
        cy = n[0];
        pts.push([cx, cy]);
        break;
      case "C":
        for (let i = 0; i + 5 < n.length; i += 6) {
          pts.push([n[i], n[i + 1]], [n[i + 2], n[i + 3]], [(cx = n[i + 4]), (cy = n[i + 5])]);
        }
        break;
      case "Q":
        for (let i = 0; i + 3 < n.length; i += 4) pts.push([n[i], n[i + 1]], [(cx = n[i + 2]), (cy = n[i + 3])]);
        break;
      case "A":
        for (let i = 0; i + 6 < n.length; i += 7) pts.push([(cx = n[i + 5]), (cy = n[i + 6])]);
        break;
    }
  }
  return pts;
}

export type Box = { minX: number; minY: number; maxX: number; maxY: number };

/** The box a shape's drawing reaches in its own coordinates: its box, and further where a pointer or a line goes out of it. */
export function localExtent(style: ShapeStyle, w: number, h: number): Box {
  const box: Box = { minX: 0, minY: 0, maxX: w, maxY: h };
  for (const part of shapeParts(style, w, h)) {
    for (const [x, y] of pathPoints(part.d)) {
      box.minX = Math.min(box.minX, x);
      box.minY = Math.min(box.minY, y);
      box.maxX = Math.max(box.maxX, x);
      box.maxY = Math.max(box.maxY, y);
    }
  }
  return box;
}

/** The box that holds the shape, turned and flipped, with its outline: for cropping a picture and for selecting. */
export function shapeBounds(item: ShapeItem): Box {
  const e = localExtent(item, item.w, item.h);
  const half = resolveStyle(item).strokeWidth / 2 + 1;
  const corners: Pt[] = [
    [e.minX, e.minY],
    [e.maxX, e.minY],
    [e.maxX, e.maxY],
    [e.minX, e.maxY],
  ].map(([x, y]) => localToWorld(item, x, y));
  return {
    minX: Math.min(...corners.map((c) => c[0])) - half,
    minY: Math.min(...corners.map((c) => c[1])) - half,
    maxX: Math.max(...corners.map((c) => c[0])) + half,
    maxY: Math.max(...corners.map((c) => c[1])) + half,
  };
}

/** The box that holds every shape of a list (null for none). */
export function shapesBounds(items: readonly ShapeItem[] | undefined): Box | null {
  if (!items?.length) return null;
  const boxes = items.map(shapeBounds);
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  };
}
