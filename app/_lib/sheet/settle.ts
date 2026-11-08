// What follows the frame of a correction sheet: the mark stickers sit in their column, the row lines run across the frame, a total is in the
// middle (or the top, or the bottom) of its row, and a text box put in the column of the marks or of the totals takes that column's width. Run after every change of the sheet; it returns the same document when nothing has to move.
import type { Block, ExamDoc, MarkBlock } from "../types";
import { contentBounds, frameOf, type FrameGeometry } from "./frame";
import { RULE_HEIGHT, isMark, isRule, markHeight, rowGroups } from "./marks";

const GAP = 4; // between a total at the top or bottom of its row and the line
const INSET = 2; // between a text box held by a mark column and the column's lines
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Where a sticker or a line is held across the page by the frame (its x and width); null: it can be put anywhere */
export function columnOf(b: Block, geo: FrameGeometry | null): { x: number; width: number } | null {
  if (!geo) return null;
  if (isRule(b)) return { x: geo.frame.x, width: geo.frame.width };
  // a text box whose middle is in the column of the marks or of the totals (not one placed in another text box's text)
  if (b.type === "textbox" && !b.meta?.slot) {
    const mid = b.layout.x + b.layout.width / 2;
    const col = [geo.marks, geo.total].find((c) => c && mid >= c.x0 && mid <= c.x1);
    return col ? { x: col.x0 + INSET, width: Math.max(8, col.x1 - col.x0 - INSET * 2) } : null;
  }
  if (!isMark(b)) return null;
  const col = b.kind === "total" ? geo.total : b.kind === "number" || b.kind === "op" ? geo.marks : null;
  return col ? { x: col.x0, width: col.x1 - col.x0 } : null;
}

/** The part of a page where rows are: under the titles of its frame, else between its margins */
function rowBounds(doc: ExamDoc, geo: FrameGeometry | null, pageIndex: number): { top: number; bottom: number } {
  if (geo) return { top: geo.frame.y + geo.head, bottom: geo.frame.y + geo.frame.height };
  const b = contentBounds(doc, pageIndex);
  return { top: b.top, bottom: b.bottom };
}

/**
 * The y of a total in its row on this page: against the marks of the row that are on this page (the middle of them, the top of the first, the bottom
 * of the last), so it stays with them whatever lines are put in or moved; a row with no marks on this page: between the lines above and below the
 * total's middle, which are the limits of the row.
 */
function totalY(b: MarkBlock, h: number, lines: number[], bounds: { top: number; bottom: number }, marks: MarkBlock[], examSize?: number): number {
  const place = b.place ?? "center";
  let top: number;
  let bottom: number;
  let gap = 0;
  if (marks.length) {
    top = Math.min(...marks.map((m) => m.layout.y));
    bottom = Math.max(...marks.map((m) => m.layout.y + markHeight(m, examSize)));
  } else {
    const middle = b.layout.y + h / 2;
    top = Math.max(bounds.top, ...lines.filter((y) => y <= middle));
    bottom = Math.min(bounds.bottom, ...lines.filter((y) => y > middle));
    gap = GAP;
  }
  const y = place === "top" ? top + gap : place === "bottom" ? bottom - h - gap : (top + bottom) / 2 - h / 2;
  return round2(Math.max(0, y));
}

export function settleSheet(doc: ExamDoc): ExamDoc {
  const sheet = doc.sheet;
  if (!sheet) return doc;
  const index = new Map(doc.pages.map((p, i) => [p.id, i]));
  const geos = doc.pages.map((_, i) => frameOf(doc, i));
  // the lines of each page (the y of the line itself, in the middle of its block)
  const lines = doc.pages.map(() => [] as number[]);
  for (const b of doc.blocks) if (isRule(b)) lines[index.get(b.layout.pageId) ?? 0]?.push(b.layout.y + RULE_HEIGHT / 2);
  // the marks of the row of each total (a row is what is between two lines, even over a page break)
  const rowMarks = new Map<string, MarkBlock[]>();
  for (const g of rowGroups(doc)) for (const t of g.totals) rowMarks.set(t.id, g.marks);

  let changed = false;
  const blocks = doc.blocks.map((b): Block => {
    const box = b.type === "textbox";
    if (!isMark(b) && !isRule(b) && !box) return b;
    const i = index.get(b.layout.pageId);
    if (i === undefined) return b;
    const geo = geos[i];
    if (box && !columnOf(b, geo)) return b;
    const height = isMark(b) ? markHeight(b, doc.meta.fontSize) : box ? b.layout.height : RULE_HEIGHT;
    let { x, y, width } = b.layout;
    const col = columnOf(b, geo);
    if (col) {
      x = col.x;
      width = col.width;
    }
    if (isMark(b) && b.kind === "total" && (b.place ?? "center") !== "free") {
      const here = (rowMarks.get(b.id) ?? []).filter((m) => m.layout.pageId === b.layout.pageId);
      y = totalY(b, height, lines[i], rowBounds(doc, geo, i), here, doc.meta.fontSize);
    }
    const same = Math.abs(x - b.layout.x) < 0.01 && Math.abs(y - b.layout.y) < 0.01 && Math.abs(width - b.layout.width) < 0.01 && Math.abs(height - b.layout.height) < 0.01;
    if (same) return b;
    changed = true;
    return { ...b, layout: { ...b.layout, x, y, width, height } };
  });
  return changed ? { ...doc, blocks } : doc;
}
