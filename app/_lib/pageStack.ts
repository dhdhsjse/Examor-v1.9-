import { pageSize } from "./pageFormats";
import type { Page } from "./types";

// How pages are stacked on the shared canvas (in page pixels, before zoom).
export const LABEL_SPACE = 28; // room above each page for "Page 1 of 3"
export const PAGE_GAP = 36; // space between a page and the next label

// Room around the page stack on screen (screen pixels: the same at every zoom).
export const LABEL_HEIGHT = 26; // the "Page 1 of 3" label: 12px text, padding and a 4px gap
export const CANVAS_TOP_GAP = 12; // above the first label
export const CANVAS_BOTTOM_SPACE = 72; // under the last item: the floating tools / zoom bar (38px, 16px off the bottom) + margin
export const CORRECTION_BAR_SPACE = 56; // correction sheet: the "Answers" bar floating at the top right

// Space above the stack so the first label is never cut off (the label space shrinks with the zoom,
// the label does not). On the correction sheet the first page also starts below the "Answers" bar.
export function canvasTopPadding(zoom: number, keyMode: boolean): number {
  const label = CANVAS_TOP_GAP + LABEL_HEIGHT - LABEL_SPACE * zoom;
  return Math.ceil(Math.max(CANVAS_TOP_GAP, label, keyMode ? CORRECTION_BAR_SPACE - LABEL_SPACE * zoom : 0));
}

// Where a page sits on the canvas, and its size. Blocks are placed relative to `left` / `top`.
export interface PageBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

// Every page of the stack: one under the other, each centered on the widest page (pages can differ
// in size and orientation).
export function pageBoxes(pages: Page[]): PageBox[] {
  const sizes = pages.map(pageSize);
  const width = Math.max(0, ...sizes.map((s) => s.width));
  let top = LABEL_SPACE;
  return sizes.map((s) => {
    const box = { top, left: Math.round((width - s.width) / 2), ...s };
    top += s.height + PAGE_GAP + LABEL_SPACE;
    return box;
  });
}

// Size of the whole canvas.
export function stackSize(boxes: PageBox[]): { width: number; height: number } {
  const last = boxes[boxes.length - 1];
  return { width: Math.max(0, ...boxes.map((b) => b.width)), height: last ? last.top + last.height : 0 };
}

// Index of the page closest to a canvas y position (used while dragging).
export function pageAt(y: number, boxes: PageBox[]): number {
  let best = 0;
  let bestDist = Infinity;
  boxes.forEach(({ top, height }, i) => {
    const dist = y < top ? top - y : y > top + height ? y - top - height : 0;
    if (dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  });
  return best;
}
