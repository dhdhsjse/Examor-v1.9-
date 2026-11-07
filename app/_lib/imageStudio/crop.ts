// The crop frame of the Image Studio: dragging its sides, its corners or itself, with or without a fixed shape. Pure functions, in px of
// the sheet, unit-tested.
import type { CropRect } from "./types";

/** The smallest part of a picture that can be kept, px of the sheet */
export const MIN_CROP = 8;

/** What is dragged: the frame itself, a side or a corner */
export type CropHandle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The whole picture */
export const fullCrop = (width: number, height: number): CropRect => ({ x: 0, y: 0, w: width, h: height });

/** Whether `c` keeps the whole picture (or near enough: under half a px off) */
export const isFullCrop = (c: CropRect, width: number, height: number) => c.x < 0.5 && c.y < 0.5 && c.x + c.w > width - 0.5 && c.y + c.h > height - 0.5;

/** The frame after a drag of (dx, dy) on `handle` from `c`, kept on the picture. `ratio` (width / height) keeps its shape, from the corners. */
export function dragCrop(c: CropRect, handle: CropHandle, dx: number, dy: number, width: number, height: number, ratio: number | null): CropRect {
  if (handle === "move") return { ...c, x: clamp(c.x + dx, 0, width - c.w), y: clamp(c.y + dy, 0, height - c.h) };
  const west = handle.includes("w");
  const east = handle.includes("e");
  const north = handle.includes("n");
  const south = handle.includes("s");

  if (ratio && (west || east) && (north || south)) {
    // a corner of a frame of a fixed shape: the opposite corner stays, the frame follows the pointer as far as the picture goes
    const ax = west ? c.x + c.w : c.x;
    const ay = north ? c.y + c.h : c.y;
    const maxW = west ? ax : width - ax;
    const maxH = north ? ay : height - ay;
    const pw = Math.abs(c.w + (west ? -dx : dx));
    const ph = Math.abs(c.h + (north ? -dy : dy));
    let w = Math.max(pw, ph * ratio, MIN_CROP);
    let h = w / ratio;
    if (w > maxW) [w, h] = [maxW, maxW / ratio];
    if (h > maxH) [w, h] = [maxH * ratio, maxH];
    return { x: west ? ax - w : ax, y: north ? ay - h : ay, w, h };
  }

  let left = c.x;
  let right = c.x + c.w;
  let top = c.y;
  let bottom = c.y + c.h;
  if (west) left = clamp(left + dx, 0, right - MIN_CROP);
  if (east) right = clamp(right + dx, left + MIN_CROP, width);
  if (north) top = clamp(top + dy, 0, bottom - MIN_CROP);
  if (south) bottom = clamp(bottom + dy, top + MIN_CROP, height);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** The biggest frame of the shape `ratio` that fits on the picture, round the middle of `c` (as far as the picture lets it) */
export function fitRatio(c: CropRect, ratio: number, width: number, height: number): CropRect {
  const w = Math.min(width, height * ratio);
  const h = w / ratio;
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  return { x: clamp(cx - w / 2, 0, width - w), y: clamp(cy - h / 2, 0, height - h), w, h };
}

/** The frame in whole px (what is kept) */
export const roundCrop = (c: CropRect): CropRect => ({ x: Math.round(c.x), y: Math.round(c.y), w: Math.max(1, Math.round(c.w)), h: Math.max(1, Math.round(c.h)) });
