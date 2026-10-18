import type { PageMargins } from "./types";

// A4 page size in pixels at 96 DPI (210mm x 297mm).
export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;

// White space kept around the edges of the page.
export const PAGE_MARGIN = 48;

// Width available for content inside the margins.
export const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

// Page pixels in one millimetre (96 DPI).
export const MM_TO_PX = 3.7795275591;

// Margins of a page that has none of its own.
export const DEFAULT_MARGINS: PageMargins = { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN };

// Range a margin can be set to in Page layout → Margins.
export const MIN_MARGIN_MM = 0;
export const MAX_MARGIN_MM = 100;

export const pxToMm = (px: number) => Math.round(px / MM_TO_PX);
export const mmToPx = (mm: number) => Math.round(mm * MM_TO_PX);
