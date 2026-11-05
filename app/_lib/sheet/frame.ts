// Where the frame of a bordered correction sheet is on a page, and the room it leaves for the answers. Pure geometry (page pixels): the canvas draws
// it, and the marks and rules follow it. The columns are written in reading order (answer, marks, total): in a right-to-left sheet they run
// the other way, so the marks are at the left, where an Arabic answer key has them.
import { DEFAULT_MARGINS } from "../a4";
import { blockHeight } from "../blockLayout";
import { pageSize } from "../pageFormats";
import type { ExamDoc, Page, PageMargins } from "../types";
import { MAX_COLUMN, MAX_OFFSET, MIN_ANSWER_WIDTH, MIN_COLUMN, type FrameOffsets, type SheetConfig } from "./model";

export const HEAD_ROW = 26; // height of one row of the column titles
export const CELL_PAD = 10; // room kept between the answers and the lines of the frame

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type ColumnId = "answer" | "marks" | "total";

export interface FrameColumn {
  id: ColumnId;
  x0: number;
  x1: number;
}

export interface FrameTitle {
  text: string;
  rect: Rect;
}

export interface FrameGeometry {
  /** The outer border */
  frame: Rect;
  /** Height of the band of titles at the top of the frame (0: none on this page) */
  head: number;
  /** The columns, from left to right on the page */
  columns: FrameColumn[];
  answer: FrameColumn;
  marks: FrameColumn | null;
  total: FrameColumn | null;
  /** The lines inside the frame (the border is `frame`) */
  lines: Segment[];
  titles: FrameTitle[];
  /** Where the answers go: inside the answer column, under the titles */
  content: Rect;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

export const titlesShown = (sheet: SheetConfig, pageIndex: number) => sheet.headings === "all" || (sheet.headings === "first" && pageIndex === 0);

/** The room the header and the footer of a page leave: where the frame can start (under the header) and end (over the footer) */
export interface ChromeLimits {
  top?: number;
  bottom?: number;
}

const CHROME_GAP = 10; // between a header or a footer and the frame

/** The limits a page's header and footer put on its frame (none when it has neither) */
export function chromeLimits(doc: Pick<ExamDoc, "pages" | "blocks" | "meta">, pageIndex: number): ChromeLimits {
  const id = doc.pages[pageIndex]?.id;
  const out: ChromeLimits = {};
  for (const b of doc.blocks) {
    if (b.layout.pageId !== id || !b.meta?.role) continue;
    if (b.meta.role === "header") out.top = Math.max(out.top ?? 0, b.layout.y + blockHeight(b, 1, doc.meta) + CHROME_GAP);
    else out.bottom = Math.min(out.bottom ?? Infinity, b.layout.y - CHROME_GAP);
  }
  return out;
}

/**
 * The frame of page `pageIndex` (null: a free sheet has none). `rtl`: the sheet reads right to left. `limits`: the frame starts under the header of the
 * page and stops over its footer.
 */
export function frameGeometry(sheet: SheetConfig, page: Page | undefined, pageIndex: number, rtl: boolean, limits: ChromeLimits = {}): FrameGeometry | null {
  if (sheet.paper !== "bordered") return null;
  const size = pageSize(page);
  const m: PageMargins = page?.margins ?? DEFAULT_MARGINS;
  const f = sheet.frame;
  const x0 = clamp(m.left - f.left, 0, size.width);
  const x1 = clamp(size.width - m.right + f.right, x0, size.width);
  const y0 = clamp(Math.max(m.top - f.top + (pageIndex === 0 ? f.firstTop : 0), limits.top ?? 0), 0, size.height);
  const y1 = clamp(Math.min(size.height - m.bottom + f.bottom, limits.bottom ?? size.height), y0, size.height);
  const frame: Rect = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };

  // The widths of the columns at the end of the line: they never leave the answers less than MIN_ANSWER_WIDTH
  let marksW = sheet.marks?.width ?? 0;
  let totalW = sheet.total?.width ?? 0;
  const spare = Math.max(0, frame.width - MIN_ANSWER_WIDTH);
  if (marksW + totalW > spare) {
    const k = spare / (marksW + totalW);
    marksW *= k;
    totalW *= k;
  }
  const answerW = frame.width - marksW - totalW;

  // In reading order the answers come first, then the marks, then the totals; right to left puts them the other way round
  const order: { id: ColumnId; w: number }[] = [{ id: "answer", w: answerW }];
  if (sheet.marks) order.push({ id: "marks", w: marksW });
  if (sheet.total) order.push({ id: "total", w: totalW });
  if (rtl) order.reverse();
  let at = x0;
  const columns: FrameColumn[] = order.map(({ id, w }) => {
    const c = { id, x0: at, x1: at + w };
    at += w;
    return c;
  });
  const find = (id: ColumnId) => columns.find((c) => c.id === id) ?? null;
  const answer = find("answer")!;
  const marks = find("marks");
  const total = find("total");

  const both = !!marks && !!total;
  const rows = titlesShown(sheet, pageIndex) ? (both ? 2 : 1) : 0;
  const head = rows * HEAD_ROW;
  const lines: Segment[] = [];
  // between the columns, the whole height; the line between the two mark columns starts under the title that is over both of them
  const split = marks && total ? Math.max(marks.x0, total.x0) : null;
  for (const c of columns.slice(1)) {
    const underTitle = rows === 2 && split !== null && Math.abs(c.x0 - split) < 0.01;
    lines.push({ x1: c.x0, y1: underTitle ? y0 + HEAD_ROW : y0, x2: c.x0, y2: y1 });
  }
  if (head) lines.push({ x1: x0, y1: y0 + head, x2: x1, y2: y0 + head });
  if (rows === 2 && marks && total) {
    const from = Math.min(marks.x0, total.x0);
    const to = Math.max(marks.x1, total.x1);
    lines.push({ x1: from, y1: y0 + HEAD_ROW, x2: to, y2: y0 + HEAD_ROW });
  }

  const titles: FrameTitle[] = [];
  if (head) {
    const at2 = (c: FrameColumn, y: number, h: number, text: string) => {
      if (text) titles.push({ text, rect: { x: c.x0, y, width: c.x1 - c.x0, height: h } });
    };
    at2(answer, y0, head, sheet.answerTitle);
    if (rows === 2 && marks && total) {
      const from = Math.min(marks.x0, total.x0);
      const to = Math.max(marks.x1, total.x1);
      if (sheet.markTitle) titles.push({ text: sheet.markTitle, rect: { x: from, y: y0, width: to - from, height: HEAD_ROW } });
      at2(marks, y0 + HEAD_ROW, HEAD_ROW, sheet.marks?.title ?? "");
      at2(total, y0 + HEAD_ROW, HEAD_ROW, sheet.total?.title ?? "");
    } else if (marks) at2(marks, y0, head, sheet.marks?.title ?? "");
    else if (total) at2(total, y0, head, sheet.total?.title ?? "");
  }

  const content: Rect = {
    x: answer.x0 + CELL_PAD,
    y: y0 + head + CELL_PAD,
    width: Math.max(40, answer.x1 - answer.x0 - CELL_PAD * 2),
    height: Math.max(40, y1 - y0 - head - CELL_PAD * 2),
  };
  return { frame, head, columns, answer, marks, total, lines, titles, content };
}

/**
 * The widths of the mark columns after a boundary was dragged to `d` px from the end edge of the frame (the right one, or the left one in a
 * right-to-left sheet). "outer": the boundary next to the answers; "inner": the one between the marks and the totals (the outer one stays).
 */
export function columnsAfterDrag(sheet: SheetConfig, which: "outer" | "inner", d: number): Pick<SheetConfig, "marks" | "total"> {
  const { marks, total } = sheet;
  const limit = (w: number) => Math.max(MIN_COLUMN, Math.min(MAX_COLUMN, Math.round(w)));
  if (marks && total) {
    if (which === "outer") return { marks: { ...marks, width: limit(d - total.width) }, total };
    const both = marks.width + total.width;
    const wt = limit(Math.min(d, both - MIN_COLUMN));
    return { marks: { ...marks, width: limit(both - wt) }, total: { ...total, width: wt } };
  }
  const only = marks ?? total;
  if (!only) return { marks, total };
  const next = { ...only, width: limit(d) };
  return marks ? { marks: next, total } : { marks, total: next };
}

/** The frame offsets after one of its edges was dragged to `at` (page px); `first`: the top edge of the first page, which can also start lower */
export function offsetsAfterDrag(sheet: SheetConfig, page: Page | undefined, edge: "top" | "right" | "bottom" | "left", at: number, first: boolean): FrameOffsets {
  const size = pageSize(page);
  const m: PageMargins = page?.margins ?? DEFAULT_MARGINS;
  const f = sheet.frame;
  const lim = (v: number) => Math.round(Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, v)));
  switch (edge) {
    case "left":
      return { ...f, left: lim(m.left - at) };
    case "right":
      return { ...f, right: lim(at - (size.width - m.right)) };
    case "bottom":
      return { ...f, bottom: lim(at - (size.height - m.bottom)) };
    case "top": {
      if (!first) return { ...f, top: lim(m.top - at) };
      // the first page: lower than the others' top is `firstTop`; higher than the margin moves the top of them all
      const base = m.top - f.top;
      return at >= base ? { ...f, firstTop: Math.round(Math.min(600, at - base)) } : { ...f, top: lim(m.top - at), firstTop: 0 };
    }
  }
}

/** The frame of page `pageIndex` of a document that is a correction sheet (null: on any other, and on free paper) */
export const frameOf = (doc: Pick<ExamDoc, "pages" | "blocks" | "sheet" | "meta">, pageIndex: number): FrameGeometry | null =>
  doc.sheet ? frameGeometry(doc.sheet, doc.pages[pageIndex], pageIndex, doc.meta.lang === "ar", chromeLimits(doc, pageIndex)) : null;

/** The room a page leaves for text: the answer column of its frame, else between its margins */
export function contentBounds(doc: Pick<ExamDoc, "pages" | "blocks" | "sheet" | "meta">, pageIndex: number): { left: number; right: number; top: number; bottom: number } {
  const page = doc.pages[pageIndex];
  const size = pageSize(page);
  const m = page?.margins ?? DEFAULT_MARGINS;
  const geo = frameOf(doc, pageIndex);
  if (geo) return { left: geo.content.x, right: geo.content.x + geo.content.width, top: geo.content.y, bottom: geo.content.y + geo.content.height };
  return { left: m.left, right: size.width - m.right, top: m.top, bottom: size.height - m.bottom };
}
