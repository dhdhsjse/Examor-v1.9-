import { PAGE_HEIGHT } from "./a4";

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
