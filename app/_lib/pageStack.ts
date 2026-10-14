import { PAGE_HEIGHT } from "./a4";

// How pages are stacked on the shared canvas (in page pixels, before zoom).
export const LABEL_SPACE = 28; // room above each page for "Page 1 of 3"
export const PAGE_GAP = 36; // space between a page and the next label

// Top edge of page `i` on the canvas.
export function pageTop(i: number): number {
  return LABEL_SPACE + i * (LABEL_SPACE + PAGE_HEIGHT + PAGE_GAP);
}

// Total canvas height for `count` pages.
export function stackHeight(count: number): number {
  return pageTop(Math.max(1, count) - 1) + PAGE_HEIGHT;
}

// Index of the page closest to a canvas y position (used while dragging).
export function pageAt(y: number, count: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < count; i++) {
    const top = pageTop(i);
    const dist = y < top ? top - y : y > top + PAGE_HEIGHT ? y - top - PAGE_HEIGHT : 0;
    if (dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  }
  return best;
}
