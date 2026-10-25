// Zoom and pan of the drawing area: pure maths, so that it can be tested without a canvas.
// A view maps studio units to screen pixels: screen = world × scale + (x, y).
import type { graphBounds } from "./bondGeometry";

export type View = { x: number; y: number; scale: number };
export type Size = { w: number; h: number };

/** Spacing of the thin lines of the graph paper, in studio units: new atoms snap to it. */
export const GRID = 20;

export const MIN_SCALE = 0.2;
export const MAX_SCALE = 5;
/** A drawing is never enlarged beyond this by "fit" (a single atom would fill the screen). */
const MAX_FIT_SCALE = 1.5;
/** Room left around the drawing by "fit", in screen pixels. */
const FIT_PADDING = 80;
/** How much one wheel notch (deltaY = 100) zooms: about 1.16×. */
const WHEEL_SPEED = 0.0015;
/** A step of the zoom buttons. */
export const BUTTON_FACTOR = 1.25;

export const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

/** The zoom factor of a wheel event (wheel up = deltaY < 0 = zoom in). */
export const wheelFactor = (deltaY: number) => Math.exp(-deltaY * WHEEL_SPEED);

/** Zooms by `factor` keeping the point under the cursor (px, py in screen pixels) where it is. */
export function zoomAt(view: View, px: number, py: number, factor: number): View {
  const scale = clampScale(view.scale * factor);
  const k = scale / view.scale;
  return { scale, x: px - (px - view.x) * k, y: py - (py - view.y) * k };
}

/** The view that centres a drawing in an area of `size` (the whole drawing visible, never over-enlarged). */
export function fitView(bounds: ReturnType<typeof graphBounds>, size: Size): View {
  if (!bounds || size.w <= 0 || size.h <= 0) return { x: size.w / 2, y: size.h / 2, scale: 1 };
  const w = Math.max(bounds.maxX - bounds.minX, 1);
  const h = Math.max(bounds.maxY - bounds.minY, 1);
  const scale = clampScale(Math.min(MAX_FIT_SCALE, (size.w - 2 * FIT_PADDING) / w, (size.h - 2 * FIT_PADDING) / h));
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return { scale, x: size.w / 2 - cx * scale, y: size.h / 2 - cy * scale };
}

/** A point of the screen area (pixels from its top-left corner) as a point of the drawing (studio units). */
export const toWorld = (view: View, px: number, py: number) => ({ x: (px - view.x) / view.scale, y: (py - view.y) / view.scale });

/** The nearest multiple of `grid` (never -0). */
export const snapToGrid = (v: number, grid: number = GRID) => Math.round(v / grid) * grid || 0;

// ---- scrolling ----

/** Moves the view by (dx, dy) screen pixels: the drawing follows, as when a page is scrolled. */
export const panBy = (view: View, dx: number, dy: number): View => ({ ...view, x: view.x - dx, y: view.y - dy });

/** What a wheel event does: with Ctrl (or Cmd, or a trackpad pinch) it zooms; else it scrolls, and with Shift sideways. */
export function wheelScroll(e: { deltaX: number; deltaY: number; deltaMode: number; shiftKey: boolean }): { dx: number; dy: number } {
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1; // a mouse can report lines or pages
  const dx = e.deltaX * unit;
  const dy = e.deltaY * unit;
  return e.shiftKey && dx === 0 ? { dx: dy, dy: 0 } : { dx, dy };
}

/** Room left to scroll past the drawing, in studio units. */
const SCROLL_MARGIN = 200;
/** A scrollbar thumb is never shorter than this share of its track. */
const MIN_THUMB = 0.06;

/** The part of the world a scrollbar stands for: from `min` to `min + span`, in studio units, for one axis. */
export type ScrollRange = { min: number; span: number };
export type ScrollRanges = { x: ScrollRange; y: ScrollRange };

/** The world the scrollbars cover: the drawing with a margin, and wherever the view is now (so it can always go back). */
export function scrollRanges(view: View, size: Size, bounds: ReturnType<typeof graphBounds>): ScrollRanges {
  const axis = (viewMin: number, viewMax: number, lo: number | undefined, hi: number | undefined): ScrollRange => {
    const min = Math.min(viewMin, lo === undefined ? viewMin : lo - SCROLL_MARGIN);
    const max = Math.max(viewMax, hi === undefined ? viewMax : hi + SCROLL_MARGIN);
    return { min, span: max - min };
  };
  return {
    x: axis(-view.x / view.scale, (size.w - view.x) / view.scale, bounds?.minX, bounds?.maxX),
    y: axis(-view.y / view.scale, (size.h - view.y) / view.scale, bounds?.minY, bounds?.maxY),
  };
}

/** The thumb of a scrollbar as shares of its track (0–1), or null when the whole range is in view. */
export function thumb(range: ScrollRange, viewMin: number, viewSpan: number): { start: number; length: number } | null {
  if (viewSpan >= range.span - 1e-6) return null;
  const length = Math.max(MIN_THUMB, viewSpan / range.span);
  const free = 1 - length; // the thumb travels over what the thumb itself leaves of the track
  const start = ((viewMin - range.min) / (range.span - viewSpan)) * free;
  return { start: Math.min(free, Math.max(0, start)), length };
}

/** The view whose left (top) edge is where a thumb at `start` stands: the inverse of `thumb`, for dragging it. */
export function viewMinFromThumb(range: ScrollRange, viewSpan: number, start: number): number {
  const length = Math.max(MIN_THUMB, viewSpan / range.span);
  const free = 1 - length;
  return range.min + (free > 0 ? start / free : 0) * (range.span - viewSpan);
}
