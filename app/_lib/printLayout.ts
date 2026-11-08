import { STANDARD_SIZES } from "./pageFormats";

// How the pages go on the sheets of paper: one page per sheet (the sheet is the page), or two pages side by side on one sheet (a booklet
// of A5 pages on A4, or full-size A4 pages on A3). All in mm.
export type PerSheet = 1 | 2;
export type Paper = "A4" | "A3";
export interface PrintLayout {
  perSheet: PerSheet;
  paper: Paper; // (only for 2 per sheet)
  color: boolean; // false: black and white (the pages turned grey before they go out)
}
export const DEFAULT_PRINT_LAYOUT: PrintLayout = { perSheet: 1, paper: "A4", color: true };

export interface Slot {
  page: number; // index in the list of pages
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Sheet {
  width: number;
  height: number;
  slots: Slot[];
}

type Size = { width: number; height: number };

// Two pages on a sheet of `paper`: side by side on it the wide way, or one above the other on it standing, whichever shows them bigger;
// each page as big as its half allows, centred in it. `rtl`: side by side, the first page is on the right (Arabic reading order).
function pair(a: Size, b: Size | null, paper: Size, rtl: boolean): Sheet {
  const long = Math.max(paper.width, paper.height);
  const short = Math.min(paper.width, paper.height);
  const fit = (p: Size, w: number, h: number) => Math.min(w / p.width, h / p.height);
  const pages = b ? [a, b] : [a];
  const wide = Math.min(...pages.map((p) => fit(p, long / 2, short)));
  const tall = Math.min(...pages.map((p) => fit(p, short, long / 2)));
  const across = wide >= tall;
  const sheet = across ? { width: long, height: short } : { width: short, height: long };
  const scale = across ? wide : tall;
  const slots = pages.map((p, i) => {
    const w = p.width * scale;
    const h = p.height * scale;
    const half = across ? (rtl ? 1 - i : i) : i;
    const cellX = across ? half * (long / 2) : 0;
    const cellY = across ? 0 : half * (long / 2);
    const cellW = across ? long / 2 : short;
    const cellH = across ? short : long / 2;
    return { page: i, x: cellX + (cellW - w) / 2, y: cellY + (cellH - h) / 2, width: w, height: h };
  });
  return { ...sheet, slots };
}

// The sheets that print `pages` (their sizes in mm, in order).
export function sheetsOf(pages: Size[], layout: Pick<PrintLayout, "perSheet" | "paper">, rtl = false): Sheet[] {
  if (layout.perSheet === 1) return pages.map((p, i) => ({ width: p.width, height: p.height, slots: [{ page: i, x: 0, y: 0, width: p.width, height: p.height }] }));
  const paper = STANDARD_SIZES[layout.paper];
  const out: Sheet[] = [];
  for (let i = 0; i < pages.length; i += 2) {
    const sheet = pair(pages[i], pages[i + 1] ?? null, paper, rtl);
    out.push({ ...sheet, slots: sheet.slots.map((s) => ({ ...s, page: s.page + i })) });
  }
  return out;
}
