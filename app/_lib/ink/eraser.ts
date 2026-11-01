// The eraser of the floating tool bars (the page's and the Table Studio's). Two ways to rub:
// - "partial", a real eraser: it rubs out the parts of the drawings (the strokes of the brush, pencil and highlighter) it goes
//   over; what is left of a stroke cut in two is two strokes. Shapes (a rectangle, an arrow…) are not cut: the stroke eraser takes them.
// - "stroke": every drawing or shape it touches goes, whole.
// Its size is the width of its tip on the screen.
import { FREEHAND_ID, type ShapeItem } from "@/app/_lib/shapes";
import { inkToShape, resample, shapeToInk, type InkPoint } from "./engine";

export type EraserMode = "partial" | "stroke";
export type EraserSettings = { mode: EraserMode; size: number };

export const ERASER_MODES: readonly EraserMode[] = ["partial", "stroke"];
/** The width of the tip, screen px */
export const ERASER_SIZES = [4, 80] as const;
export const ERASER_DEFAULTS: EraserSettings = { mode: "partial", size: 20 };

type Pt = { x: number; y: number };

/** The mouse pointer while the eraser is in hand: a circle as wide as its tip (the browsers show cursors up to 128 px) */
export function eraserCursor(size: number): string {
  const d = Math.round(Math.min(120, Math.max(6, size)));
  const c = d / 2 + 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${d + 4}" height="${d + 4}"><circle cx="${c}" cy="${c}" r="${d / 2}" fill="rgba(255,255,255,0.55)" stroke="#111827" stroke-width="1.25"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${c} ${c}, crosshair`;
}

/**
 * The points the stroke eraser tries on its way from one position of the pointer to the next (a fast hand would jump over a thin
 * stroke otherwise): steps along the way, and around each the centre and four points at `radius`.
 */
export function eraserPoints(from: Pt, to: Pt, radius: number): Pt[] {
  const r = Math.max(1, radius);
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / r));
  const out: Pt[] = [];
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    out.push({ x, y }, { x: x + r, y }, { x: x - r, y }, { x, y: y + r }, { x, y: y - r });
  }
  return out;
}

// How far a point is from the way the eraser went (a polyline; one point = a dab).
function distToPath(p: Pt, path: readonly Pt[]): number {
  if (path.length === 1) return Math.hypot(p.x - path[0].x, p.y - path[0].y);
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)));
  }
  return best;
}

/** A stroke of a drawing where it is: its box (turned and flipped like a shape), its points as fractions of the box, its width. */
export type Stroke = Pick<ShapeItem, "x" | "y" | "w" | "h" | "rotation" | "flipX" | "flipY" | "adj" | "pressure" | "strokeWidth">;
/** What is left of a stroke: a box (not turned, not flipped) and its points in it */
export type StrokePiece = { x: number; y: number; w: number; h: number; adj: number[]; pressure: number[] };

/** Whether a shape is a stroke of a drawing (the pencil of the Studios or the brush, pencil and highlighter of the page) */
export const isStroke = (s: { shape: string }) => s.shape === FREEHAND_ID;

/**
 * The real eraser going along `path` (`radius` around it), over one stroke: null if it does not touch it, else what is left of it
 * (nothing when all of it is rubbed out, two pieces when it is cut in the middle). Everything in the same pixels as the stroke's box.
 */
export function cutStroke(s: Stroke, path: readonly Pt[], radius: number): StrokePiece[] | null {
  if (!path.length) return null;
  const width = s.strokeWidth ?? 3;
  const reach = radius + width / 2; // (the eraser takes the ink as soon as it touches its edge)
  // (far from it: not even looked at)
  const xs = path.map((p) => p.x);
  const ys = path.map((p) => p.y);
  const big = Math.hypot(s.w, s.h) / 2;
  const cx = s.x + s.w / 2;
  const cy = s.y + s.h / 2;
  if (Math.min(...xs) - reach > cx + big || Math.max(...xs) + reach < cx - big || Math.min(...ys) - reach > cy + big || Math.max(...ys) + reach < cy - big) return null;

  const turn = ((s.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const world = shapeToInk(s.adj, s.pressure, s.w, s.h).map((q): InkPoint => {
    const fx = (s.flipX ? s.w - q.x : q.x) - s.w / 2;
    const fy = (s.flipY ? s.h - q.y : q.y) - s.h / 2;
    return { x: cx + fx * cos - fy * sin, y: cy + fx * sin + fy * cos, p: q.p };
  });
  if (!world.length) return null;

  // Close points along the stroke, so the cut is where the eraser went, not at the stroke's next point.
  const dense = world.length > 1 ? resample(world, Math.max(0.5, Math.min(2, radius / 3))) : world;
  const gone = dense.map((q) => distToPath(q, path) <= reach);
  if (!gone.some(Boolean)) return null;

  const runs: InkPoint[][] = [];
  let run: InkPoint[] = [];
  dense.forEach((q, i) => {
    if (gone[i]) {
      if (run.length) runs.push(run);
      run = [];
    } else run.push(q);
  });
  if (run.length) runs.push(run);
  return runs
    .filter((r) => r.length >= 2) // (a crumb of one point is rubbed out too)
    .map((r) => inkToShape(r, width))
    .filter((p): p is StrokePiece => !!p);
}

/**
 * The real eraser over the shapes of a Studio: the strokes it touches are cut (a piece keeps the stroke's id, the others get new
 * ones), the rest stays. null when nothing changed.
 */
export function eraseStrokes(items: readonly ShapeItem[], path: readonly Pt[], radius: number, newId: () => string): ShapeItem[] | null {
  let changed = false;
  const out = items.flatMap((s) => {
    if (!isStroke(s)) return [s];
    const pieces = cutStroke(s, path, radius);
    if (!pieces) return [s];
    changed = true;
    return pieces.map((p, i): ShapeItem => ({ ...s, id: i === 0 ? s.id : newId(), x: p.x, y: p.y, w: p.w, h: p.h, adj: p.adj, pressure: p.pressure, rotation: undefined, flipX: undefined, flipY: undefined }));
  });
  return changed ? out : null;
}
