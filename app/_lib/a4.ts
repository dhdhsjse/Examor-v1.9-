import { A4, MM_TO_PX } from "./pageFormats";
import type { PageMargins } from "./types";

// Page sizes live in pageFormats.ts (every page has its own). This file keeps the margin defaults.

// White space kept around the edges of the page.
export const PAGE_MARGIN = 48;

// Width available for content inside the default margins of an A4 page (default block width).
export const CONTENT_WIDTH = A4.width - PAGE_MARGIN * 2;

// Margins of a page that has none of its own.
export const DEFAULT_MARGINS: PageMargins = { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN };

// Range a margin can be set to in Page layout → Margins.
export const MIN_MARGIN_MM = 0;
export const MAX_MARGIN_MM = 100;

export const pxToMm = (px: number) => Math.round(px / MM_TO_PX);
export const mmToPx = (mm: number) => Math.round(mm * MM_TO_PX);
