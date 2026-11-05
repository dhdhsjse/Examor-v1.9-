// The marks of a correction sheet: how a mark is written, how the stickers of a row are calculated (0.5 × 2 + 0.5 = 1.5) and what the sheet adds up
// to. Pure functions: the canvas, the status bar and the export all read the same numbers from here.
import type { Block, ExamDoc, MarkBlock, MarkOp, RuleBlock } from "../types";

export const MARK_STEP = 0.125; // the smallest mark
export const MARK_MAX = 100;
export const RULE_HEIGHT = 10; // a row line: its thin line is in the middle of this height (that is where it can be taken)
export const MARK_DEFAULT_SIZE = 14;

export const isMark = (b: Block): b is MarkBlock => b.type === "mark";
export const isRule = (b: Block): b is RuleBlock => b.type === "rule";

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** A mark brought to a multiple of 0.125, between 0 and 100 */
export function snapMark(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(MARK_MAX, Math.round(v / MARK_STEP) * MARK_STEP));
}

/** A mark as it is written: "0.5", "1.125", "2"; with `pad` a whole mark under ten gets a zero first: "01" */
export function formatMark(v: number, pad = false): string {
  const r = Math.round(v * 1000) / 1000;
  const abs = Math.abs(r);
  const text = pad && Number.isInteger(abs) && abs < 10 ? `0${abs}` : String(abs);
  return r < 0 ? `−${text}` : text;
}

/** What a sticker writes: its mark, its sign, the total it is given, or its words */
export function markText(b: MarkBlock, shown: number | undefined, pad: boolean): string {
  switch (b.kind) {
    case "number":
      return formatMark(b.value ?? 0, pad);
    case "op":
      return b.op ?? "+";
    case "total":
      return formatMark(shown ?? b.value ?? 0, pad);
    case "text":
      return b.text ?? "";
  }
}

/** Height of a sticker: its text size and a little room */
export const markHeight = (b: Pick<MarkBlock, "size">, examSize?: number) => Math.ceil((b.size ?? examSize ?? MARK_DEFAULT_SIZE) * 1.7);

export type Item = { op: MarkOp } | { n: number };

/**
 * The calculation of a row, in the order the stickers are read: `×` binds before `+` and `−`; two marks with no sign between them are added
 * (01, 01 → 2); a sign that stands alone at either end, or follows another sign, is ignored (the last one of two signs counts).
 */
export function evaluate(items: readonly Item[]): number {
  let sum = 0;
  let term: number | null = null; // the product being built
  let sign = 1;
  let pending: MarkOp | null = null; // the sign waiting for the next mark
  for (const it of items) {
    if ("op" in it) {
      pending = it.op;
      continue;
    }
    if (term === null) {
      sign = pending === "−" ? -1 : 1;
      term = it.n;
    } else if (pending === "×") {
      term *= it.n;
    } else {
      sum += sign * term;
      sign = pending === "−" ? -1 : 1;
      term = it.n;
    }
    pending = null;
  }
  if (term !== null) sum += sign * term;
  return round6(sum);
}

export interface SheetRow {
  /** The number of lines above it (the rows are numbered in reading order, those with nothing in them are left out) */
  index: number;
  /** The mark and sign stickers, in reading order */
  marks: MarkBlock[];
  totals: MarkBlock[];
  /** The calculation of its marks */
  auto: number;
  /** What it counts for in the sheet: the total sticker's mark, else the calculation */
  score: number;
}

export type SheetIssue = { kind: "two-totals"; row: number } | { kind: "typed-differs"; row: number; typed: number; auto: number };

export interface SheetScores {
  rows: SheetRow[];
  /** What each total sticker shows (by id) */
  shown: Map<string, number>;
  /** All the rows together */
  total: number;
  issues: SheetIssue[];
}

type Counted = Pick<ExamDoc, "pages" | "blocks" | "meta">;

/** Reading order of the stickers and lines: page by page, top to bottom, along the line in the way the sheet reads */
function reading(doc: Counted) {
  const pageIndex = new Map(doc.pages.map((p, i) => [p.id, i]));
  const rtl = doc.meta.lang === "ar";
  const at = (b: Block) => {
    const h = b.type === "rule" ? RULE_HEIGHT : b.type === "mark" ? markHeight(b, doc.meta.fontSize) : 0;
    return { page: pageIndex.get(b.layout.pageId) ?? 0, y: b.layout.y + h / 2, x: b.layout.x };
  };
  return doc.blocks
    .filter((b) => isMark(b) || isRule(b))
    .map((b) => ({ b, ...at(b) }))
    .sort((a, c) => a.page - c.page || a.y - c.y || (rtl ? c.x - a.x : a.x - c.x))
    .map((e) => e.b);
}

/** The stickers between two lines: the marks and signs, and the totals */
export interface RowGroup {
  /** The number of lines above it */
  index: number;
  marks: MarkBlock[];
  totals: MarkBlock[];
}

/** The rows that have something in them, in reading order: the stickers between two lines (a row goes on over a page break) */
export function rowGroups(doc: Counted): RowGroup[] {
  const groups: RowGroup[] = [];
  let index = 0;
  let cur: RowGroup | null = null;
  for (const b of reading(doc)) {
    if (isRule(b)) {
      index++;
      cur = null;
      continue;
    }
    if (!isMark(b) || b.kind === "text") continue;
    if (!cur) {
      cur = { index, marks: [], totals: [] };
      groups.push(cur);
    }
    (b.kind === "total" ? cur.totals : cur.marks).push(b);
  }
  return groups;
}

/** The rows of a sheet (the stickers between two lines), the total each sticker shows, and what it all adds up to */
export function sheetScores(doc: Counted): SheetScores {
  const groups = rowGroups(doc);
  const shown = new Map<string, number>();
  const issues: SheetIssue[] = [];
  const rows = groups.map((g): SheetRow => {
    const auto = evaluate(g.marks.map((m): Item => (m.kind === "op" ? { op: m.op ?? "+" } : { n: m.value ?? 0 })));
    const hasNumbers = g.marks.some((m) => m.kind === "number");
    for (const t of g.totals) shown.set(t.id, t.manual ? snapMark(t.value ?? 0) : auto);
    if (g.totals.length > 1) issues.push({ kind: "two-totals", row: g.index });
    const first = g.totals[0];
    if (first?.manual && hasNumbers && Math.abs((shown.get(first.id) ?? 0) - auto) > 1e-9) issues.push({ kind: "typed-differs", row: g.index, typed: shown.get(first.id) ?? 0, auto });
    return { index: g.index, marks: g.marks, totals: g.totals, auto, score: first ? (shown.get(first.id) ?? 0) : auto };
  });
  return { rows, shown, total: round6(rows.reduce((s, r) => s + r.score, 0)), issues };
}
