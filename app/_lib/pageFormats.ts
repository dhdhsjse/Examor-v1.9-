import type { Page, PageFormat } from "./types";

// Page pixels in one millimetre (96 DPI).
export const MM_TO_PX = 3.7795275591;

// Paper sizes in millimetres, portrait. `name` is shown as is (not translated).
export const STANDARD_SIZES = {
  A4: { name: "A4", width: 210, height: 297 },
  A3: { name: "A3", width: 297, height: 420 },
  A5: { name: "A5", width: 148, height: 210 },
  Letter: { name: "US Letter", width: 215.9, height: 279.4 },
  Legal: { name: "US Legal", width: 215.9, height: 355.6 },
};
export type StandardSize = keyof typeof STANDARD_SIZES;

export const DEFAULT_FORMAT: PageFormat = { size: "A4", orientation: "portrait" };

// Range of a custom page side, in mm.
export const MIN_PAGE_MM = 50;
export const MAX_PAGE_MM = 1000;

// Size of a page in millimetres, as it lies (landscape = the wide way).
export function getPageMm(format: PageFormat = DEFAULT_FORMAT): { width: number; height: number } {
  const standard = format.size === "custom" ? STANDARD_SIZES.A4 : (STANDARD_SIZES[format.size] ?? STANDARD_SIZES.A4);
  const w = format.size === "custom" ? format.customWidth || 210 : standard.width;
  const h = format.size === "custom" ? format.customHeight || 297 : standard.height;
  return format.orientation === "landscape" ? { width: h, height: w } : { width: w, height: h };
}

// Size of a page in page pixels (what the canvas draws).
export function getPageDimensions(format?: PageFormat): { width: number; height: number } {
  const mm = getPageMm(format);
  return { width: Math.round(mm.width * MM_TO_PX), height: Math.round(mm.height * MM_TO_PX) };
}

export const pageSize = (page: Page | undefined) => getPageDimensions(page?.format);

// The default page: new documents, onboarding previews.
export const A4 = getPageDimensions();
