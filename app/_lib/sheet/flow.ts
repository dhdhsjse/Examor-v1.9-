// The rows of a correction sheet as a column. The sheet is read as bands (the blocks between two row lines, page by page), and the column can be changed
// in three ways: items are put in at a place (the bands under it make room, and pass to the next page when they must), what is under a block that became
// taller or shorter moves with it, and a page that overflows passes its last bands on to the next page. Pure: the editor commits what comes back.
import { blockHeight } from "../blockLayout";
import { questionNumbers } from "../blocks";
import { newId } from "../id";
import type { Block, ExamDoc, ExamMeta, Page } from "../types";
import { contentBounds } from "./frame";
import { isMark, isRule } from "./marks";
import type { SheetConfig } from "./model";

/** One thing laid out for the sheet: its blocks at their place from its own top (y = 0), the room it needs and the room it leaves under it */
export interface Item {
  blocks: Block[];
  height: number;
  /** The room left under it */
  gap: number;
  /** It stays on the page of the one after it (a heading is never the last thing of a page) */
  keepWithNext?: boolean;
}

/** The pages of a sheet while things are laid on them (new pages are added to it as they are needed) */
export interface Pager {
  pages: Page[];
  /** The settings of the sheet: the room is that of its frame, whatever the paper (a free sheet is laid out as a bordered one) */
  sheet: SheetConfig;
  meta: ExamMeta;
  /** Headers and footers of the pages: the frame stops under and over them */
  chrome: Block[];
}

/** The room between two bands that are not on the same page: what a row leaves under its line (the row gap, less the line's own room) */
const BAND_GAP = 4;
const round2 = (v: number) => Math.round(v * 100) / 100;

/** A new page like the first one of the sheet */
export const newPageLike = (pages: Page[]): Page => {
  const first = pages[0];
  return { id: newId(), ...(first?.margins ? { margins: { ...first.margins } } : {}), ...(first?.format ? { format: { ...first.format } } : {}) };
};

export const pagerOf = (doc: Pick<ExamDoc, "pages" | "blocks" | "meta" | "sheet">): Pager => ({
  pages: [...doc.pages],
  sheet: doc.sheet!,
  meta: doc.meta,
  chrome: doc.blocks.filter((b) => b.meta?.role),
});

/** Where the answers go on page `i`: inside the answer column of the frame (the page is added when there are not so many yet) */
export function boundsOf(pager: Pager, i: number) {
  while (pager.pages.length <= i) pager.pages.push(newPageLike(pager.pages));
  return contentBounds({ pages: pager.pages, blocks: pager.chrome, sheet: { ...pager.sheet, paper: "bordered" }, meta: pager.meta }, i);
}

/** The items one under the other from (`page`, `y`), on as many pages as it takes; the blocks of each with their place on their page */
export function place(pager: Pager, items: Item[], page: number, y: number): Block[] {
  const out: Block[] = [];
  let at = page;
  let top = y;
  items.forEach((item, k) => {
    const next = items[k + 1];
    const room = boundsOf(pager, at);
    // (a heading stays with what follows it, as long as both fit a page at all)
    const together = item.keepWithNext && next ? item.height + item.gap + next.height : item.height;
    const need = together > room.bottom - room.top ? item.height : together;
    if (need > room.bottom - top && top > room.top + 1) {
      at++;
      top = boundsOf(pager, at).top;
    }
    for (const b of item.blocks) out.push({ ...b, layout: { ...b.layout, pageId: pager.pages[at].id, y: round2(top + b.layout.y) } } as Block);
    top += item.height + item.gap;
  });
  return out;
}

/** The height of any block of the document */
export function measurer(doc: Pick<ExamDoc, "blocks" | "pages" | "meta">): (b: Block) => number {
  const numbers = questionNumbers(doc.blocks, doc.pages);
  return (b) => blockHeight(b, numbers.get(b.id) ?? 1, doc.meta);
}

/** A block that takes part in the flow: not a header or a footer, and not a block in the text of a text box (it moves with its box) */
export const flows = (b: Block) => !b.meta?.role && !b.meta?.slot;

const sameSpot = (a: Block["layout"], b: Block["layout"]) =>
  a.pageId === b.pageId && Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01 && Math.abs(a.width - b.width) < 0.01 && Math.abs(a.height - b.height) < 0.01;

/** The document with the blocks `placed` in place of the blocks of the same id (new ones come last) and the pages the pager has; the same document when nothing moved */
function withPlaced(doc: ExamDoc, pager: Pager, placed: Block[]): ExamDoc {
  const byId = new Map(placed.map((b) => [b.id, b]));
  const known = new Map(doc.blocks.map((b) => [b.id, b]));
  if (pager.pages.length === doc.pages.length && placed.every((p) => known.has(p.id) && sameSpot(known.get(p.id)!.layout, p.layout))) return doc;
  return { ...doc, pages: pager.pages, blocks: [...doc.blocks.map((b) => byId.get(b.id) ?? b), ...placed.filter((b) => !known.has(b.id))] };
}

/** The document without the pages that were emptied from the end (a shorter sheet takes back its last pages, with their header and footer) */
function dropEmptied(next: ExamDoc, before: ExamDoc): ExamDoc {
  const used = new Set(next.blocks.filter((b) => !b.meta?.role).map((b) => b.layout.pageId));
  const had = new Set(before.blocks.filter((b) => !b.meta?.role).map((b) => b.layout.pageId));
  let pages = next.pages;
  while (pages.length > 1 && !used.has(pages[pages.length - 1].id) && had.has(pages[pages.length - 1].id)) pages = pages.slice(0, -1);
  if (pages === next.pages) return next;
  const kept = new Set(pages.map((p) => p.id));
  return { ...next, pages, blocks: next.blocks.filter((b) => kept.has(b.layout.pageId)) };
}

// ---- the bands under a place ----

/** A place in the column: a page (its index) and a height on it */
export interface Cut {
  page: number;
  y: number;
}

interface Member {
  b: Block;
  page: number;
  h: number;
  /** The middle of the block: what says whether it is under a place */
  c: number;
}

/** Everything from `cut` on, as bands one under the other, and where the first of them is now */
interface Tail {
  items: Item[];
  first: { page: number; top: number } | null;
}

function tailAt(doc: ExamDoc, pager: Pager, cut: Cut): Tail {
  const index = new Map(doc.pages.map((p, i) => [p.id, i]));
  const height = measurer(doc);
  const titles = boundsOf(pager, 0).top; // (what is over the frame of the first page — the titles of the sheet — stays where it is)
  const members: Member[] = [];
  for (const b of doc.blocks) {
    const page = index.get(b.layout.pageId);
    if (page === undefined || !flows(b)) continue;
    const h = height(b);
    const c = b.layout.y + h / 2;
    if (page === 0 && c < titles) continue;
    if (page < cut.page || (page === cut.page && c < cut.y - 0.5)) continue;
    members.push({ b, page, h, c });
  }
  members.sort((a, z) => a.page - z.page || a.c - z.c || a.b.layout.x - z.b.layout.x);

  const bands: { item: Item; page: number; top: number; bottom: number }[] = [];
  let cur: Member[] = [];
  const close = () => {
    if (!cur.length) return;
    // (a band begins where its text begins: the stickers beside it may start a little higher, and the line that closes it ends a little lower)
    const flowing = cur.filter((m) => !isMark(m.b) && !isRule(m.b));
    const top = Math.min(...(flowing.length ? flowing : cur).map((m) => m.b.layout.y));
    const bottom = Math.max(...cur.map((m) => m.b.layout.y + m.h));
    const last = flowing[flowing.length - 1];
    const open = !isRule(cur[cur.length - 1].b);
    const item: Item = {
      blocks: cur.map((m) => ({ ...m.b, layout: { ...m.b.layout, y: round2(m.b.layout.y - top) } }) as Block),
      height: bottom - top,
      gap: BAND_GAP,
      ...(open && last && last.b.type === "text" && last.b.style !== "body" ? { keepWithNext: true } : {}),
    };
    bands.push({ item, page: cur[0].page, top, bottom });
    cur = [];
  };
  for (const m of members) {
    if (cur.length && cur[0].page !== m.page) close();
    cur.push(m);
    if (isRule(m.b)) close();
  }
  close();

  // The room between two bands stays what it was, as long as they are on the same page
  bands.forEach((band, k) => {
    const next = bands[k + 1];
    if (next && next.page === band.page) band.item.gap = Math.max(0, round2(next.top - band.bottom));
  });
  return { items: bands.map((b) => b.item), first: bands.length ? { page: bands[0].page, top: bands[0].top } : null };
}

/**
 * Items put in at `cut`: they go first, from `startTop` (or where the band under `cut` starts now, if that is lower), and the bands that were under `cut`
 * follow them, onto the next page when they no longer fit. The new items' blocks come last in the document.
 */
export function insertAt(doc: ExamDoc, cut: Cut, run: Item[], startTop: number): ExamDoc {
  if (!doc.sheet || !run.length) return doc;
  const pager = pagerOf(doc);
  const tail = tailAt(doc, pager, cut);
  const top = tail.first && tail.first.page === cut.page ? Math.max(tail.first.top, startTop) : startTop;
  return dropEmptied(withPlaced(doc, pager, place(pager, [...run, ...tail.items], cut.page, top)), doc);
}

/** Everything of page `page` under `from` moves down by `delta` (up when it is negative): what is under a block that became taller or shorter */
export function shiftBelow(doc: ExamDoc, page: number, from: number, delta: number, except: ReadonlySet<string> = new Set()): ExamDoc {
  const id = doc.pages[page]?.id;
  if (!doc.sheet || !id || Math.abs(delta) < 0.01) return doc;
  const height = measurer(doc);
  let changed = false;
  const blocks = doc.blocks.map((b) => {
    if (b.layout.pageId !== id || !flows(b) || except.has(b.id) || b.layout.y + height(b) / 2 < from - 0.5) return b;
    changed = true;
    return { ...b, layout: { ...b.layout, y: Math.max(0, round2(b.layout.y + delta)) } } as Block;
  });
  return changed ? { ...doc, blocks } : doc;
}

/** The pages that overflow pass their last bands on to the next page (a band that is the whole page stays: it cannot be cut) */
export function fixOverflow(doc: ExamDoc): ExamDoc {
  if (!doc.sheet) return doc;
  let cur = doc;
  for (let i = 0; i < cur.pages.length && i < 80; i++) {
    const pager = pagerOf(cur);
    const room = boundsOf(pager, i);
    const height = measurer(cur);
    const onPage = cur.blocks.filter((b) => flows(b) && b.layout.pageId === cur.pages[i].id);
    const over = onPage
      .filter((b) => !isMark(b) && !isRule(b) && b.layout.y + height(b) > room.bottom + 0.5)
      .sort((a, z) => a.layout.y - z.layout.y)[0];
    if (!over) continue;
    // (its band begins under the last line over it)
    const above = Math.max(room.top - 1, ...onPage.filter(isRule).map((r) => r.layout.y + height(r) / 2).filter((y) => y <= over.layout.y + height(over) / 2));
    const tail = tailAt(cur, pager, { page: i, y: above + 1 });
    if (!tail.first || (tail.first.page === i && tail.first.top <= room.top + 1)) continue;
    cur = withPlaced(cur, pager, place(pager, tail.items, tail.first.page, tail.first.top));
  }
  return cur;
}

/** Every band laid out again from the top of the first page: the pages are filled as they were made, and the ones left empty go */
export function reflowAll(doc: ExamDoc): ExamDoc {
  if (!doc.sheet) return doc;
  const pager = pagerOf(doc);
  const tail = tailAt(doc, pager, { page: 0, y: -Infinity });
  if (!tail.first) return doc;
  return dropEmptied(withPlaced(doc, pager, place(pager, tail.items, 0, boundsOf(pager, 0).top)), doc);
}
