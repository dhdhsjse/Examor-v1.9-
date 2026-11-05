// The total of a row: a row with several marks needs a total sticker to show what they add up to. Stamping the marks one by one, it is easy to forget it:
// these find the rows that lack one and put it in the column of the totals, in the middle of the marks.
import { createBlock } from "../blocks";
import type { ExamDoc, MarkBlock } from "../types";
import { rowGroups, type RowGroup } from "./marks";
import { settleSheet } from "./settle";

/** The rows with two or more marks and no total (a sheet without a column of totals has none to ask for) */
export function rowsWithoutTotal(doc: Pick<ExamDoc, "pages" | "blocks" | "meta" | "sheet">): RowGroup[] {
  if (!doc.sheet?.total) return [];
  return rowGroups(doc).filter((g) => g.totals.length === 0 && g.marks.filter((m) => m.kind === "number").length >= 2);
}

/** The sheet with the totals those rows lack: each in the middle of its marks, on the page of the first of them */
export function addTotals(doc: ExamDoc): ExamDoc {
  const rows = rowsWithoutTotal(doc);
  if (!rows.length) return doc;
  const added = rows.map((g): MarkBlock => {
    const first = g.marks[0];
    const b = createBlock("mark", doc.meta.lang, first.layout.pageId, { kind: "total", place: "center" }) as MarkBlock;
    const source = first.meta?.source;
    return { ...b, ...(source ? { meta: { source: { id: source.id } } } : {}), layout: { ...b.layout, pageId: first.layout.pageId, y: first.layout.y } };
  });
  return settleSheet({ ...doc, blocks: [...doc.blocks, ...added] });
}
