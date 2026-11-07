// The total of a row: on a bordered sheet with its column of totals every row has one (the sheet is made so); elsewhere a row with several marks
// needs one to show what they add up to. One deleted, or forgotten when the marks are stamped one by one: these find the rows that lack one and put
// it in the column of the totals, in the middle of the marks.
import { createBlock } from "../blocks";
import type { ExamDoc, MarkBlock } from "../types";
import { rowGroups, type RowGroup } from "./marks";
import { settleSheet } from "./settle";

/** The fewest marks a row needs to ask for a total: one in the column of the totals of a bordered sheet, two on free paper */
export const marksForTotal = (sheet: { paper: string } | undefined) => (sheet?.paper === "bordered" ? 1 : 2);

/** The rows with marks and no total (a sheet without a column of totals has none to ask for) */
export function rowsWithoutTotal(doc: Pick<ExamDoc, "pages" | "blocks" | "meta" | "sheet">): RowGroup[] {
  if (!doc.sheet?.total) return [];
  const least = marksForTotal(doc.sheet);
  return rowGroups(doc).filter((g) => g.totals.length === 0 && g.marks.filter((m) => m.kind === "number").length >= least);
}

/** The sheet with the totals those rows lack (`only`: just the row of that mark): each in the middle of its marks, on the page of the first of them */
export function addTotals(doc: ExamDoc, only?: string): ExamDoc {
  const rows = rowsWithoutTotal(doc).filter((g) => !only || g.marks.some((m) => m.id === only));
  if (!rows.length) return doc;
  const added = rows.map((g): MarkBlock => {
    const first = g.marks[0];
    const b = createBlock("mark", doc.meta.lang, first.layout.pageId, { kind: "total", place: "center" }) as MarkBlock;
    const source = first.meta?.source;
    return { ...b, ...(source ? { meta: { source: { id: source.id } } } : {}), layout: { ...b.layout, pageId: first.layout.pageId, y: first.layout.y } };
  });
  return settleSheet({ ...doc, blocks: [...doc.blocks, ...added] });
}
