"use client";

import { Columns3, Rows3, Trash2 } from "lucide-react";
import { useState } from "react";
import TableGrid from "@/app/_components/table/TableGrid";
import { makeActions } from "@/app/_components/table/tableActions";
import { clampSel, selRange, type Sel } from "@/app/_components/table/tableSel";
import { sampleData } from "@/app/_lib/chart/catalog";
import type { ChartConfig } from "@/app/_lib/chart/types";
import { DEFAULT_FONT } from "@/app/_lib/fonts";
import { colsOf, rowsOf, wholeMerges, type TableData } from "@/app/_lib/table";
import type { ExamMeta } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import { Check, Seg } from "./controls";
import type { Edit } from "./useChartStudio";

interface Props {
  c: ChartConfig;
  edit: Edit;
  meta: ExamMeta;
  undo: () => void;
  redo: () => void;
}

// The table the chart is made from, a spreadsheet like the one of the Table Studio (formulas, copy and paste from Excel, filling by dragging),
// and how it is read: the series in the columns or in the rows, a first row of names, a first column of categories.
export default function DataPanel({ c, edit, meta, undo, redo }: Props) {
  const t = useT();
  const [picked, setSel] = useState<Sel | null>(null);
  const data = c.data;
  const inRows = data.seriesIn === "rows";
  const header = data.header !== false;
  const labels = data.labels !== false;
  // (the first row and the first column are drawn as headers: the row of names when the series are in the columns, the column of names when they are in the rows)
  const table: TableData = { cells: data.cells, header: inRows ? labels : header, firstCol: inRows ? header : labels, calc: data.calc ?? true };
  const sel = clampSel(picked, rowsOf(table), colsOf(table));
  const range = sel ? wholeMerges(table, selRange(sel)) : null;
  const apply = (patch: Partial<TableData>, key: string) =>
    edit((x) => ({ ...x, data: { ...x.data, ...(patch.cells ? { cells: patch.cells } : {}), ...(patch.calc !== undefined ? { calc: patch.calc } : {}) } }), `data:${key}`);
  const actions = makeActions(table, range, false, apply, setSel);
  const setData = (patch: Partial<ChartConfig["data"]>, key: string) => edit((x) => ({ ...x, data: { ...x.data, ...patch } }), `data:${key}`);
  const classes = c.family === "histogram" && c.variant === "classes";
  const raw = c.family === "histogram" && c.variant === "raw";

  const hint = (() => {
    switch (c.family) {
      case "scatter":
        return t("The first column holds the x values, the other columns the y values of each series.");
      case "histogram":
        return classes ? t("Three columns: the lower end of each class, its upper end, and its number.") : t("A column of values: the classes are made from them (Classes, in the options).");
      case "box":
        return t("One column of values for each series: each gets a box.");
      case "waterfall":
        return t("One column of amounts: each is added to the running total (Steps, in the options, marks the totals).");
      case "pie":
        return t("One column of values: one slice for each row. A doughnut can have several columns (rings).");
      default:
        return t("Each column is a series, each row a category. Type a formula such as =SUM(B2:B4) to work a number out.");
    }
  })();

  const btn = "flex h-7 items-center gap-1.5 rounded-md border border-line bg-white px-2 text-xs font-medium text-ink hover:border-accent disabled:opacity-40";

  return (
    <div data-testid="data-panel" className="flex min-h-0 flex-1 flex-col border-t border-line bg-white">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-line px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Data")}</h3>
        {!classes && !raw && c.family !== "box" && (
          <div className="flex items-center gap-2 text-xs text-muted">
            {t("Series in")}
            <Seg value={inRows ? "rows" : "columns"} onChange={(v) => setData({ seriesIn: v === "rows" ? "rows" : undefined }, "orientation")} options={[{ value: "columns", label: t("Columns") }, { value: "rows", label: t("Rows") }]} testId="series-in" />
          </div>
        )}
        <Check checked={header} onChange={(v) => setData({ header: v }, "header")} label={inRows ? t("First column: names of the series") : t("First row: names of the series")} testId="data-header" />
        {!classes && !raw && c.family !== "box" && (
          <Check checked={labels} onChange={(v) => setData({ labels: v }, "labels")} label={inRows ? t("First row: the categories") : c.family === "scatter" ? t("First column: the x values") : t("First column: the categories")} testId="data-labels" />
        )}
        <div className="ms-auto flex flex-wrap items-center gap-1.5">
          <button type="button" className={btn} disabled={!actions.hasSelection} onClick={() => actions.insertRows(true)} data-testid="insert-row" title={t("Insert row below")}>
            <Rows3 size={13} />
            {t("Add a row")}
          </button>
          <button type="button" className={btn} disabled={!actions.hasSelection} onClick={() => actions.insertCols(true)} data-testid="insert-col" title={t("Insert column after")}>
            <Columns3 size={13} />
            {t("Add a column")}
          </button>
          <button type="button" className={btn} disabled={!actions.hasSelection} onClick={() => actions.deleteRows()} data-testid="delete-row" title={t("Delete row")}>
            <Trash2 size={13} />
            {t("Delete row")}
          </button>
          <button type="button" className={btn} disabled={!actions.hasSelection} onClick={() => actions.deleteCols()} data-testid="delete-col" title={t("Delete column")}>
            <Trash2 size={13} />
            {t("Delete column")}
          </button>
          <button type="button" className={btn} onClick={() => edit((x) => ({ ...x, data: sampleData(x.family, x.variant, meta.lang) }), "data:sample")} data-testid="sample-data" title={t("Replace the table with the example of this kind of chart")}>
            {t("Example data")}
          </button>
        </div>
      </div>
      <p className="border-b border-line bg-indigo-50/50 px-3 py-1 text-[11px] text-indigo-900">{hint}</p>
      <TableGrid table={table} lang={meta.lang} sel={sel} onSelect={setSel} onChange={apply} onUndo={undo} onRedo={redo} actions={actions} examFont={meta.fontFamily ?? DEFAULT_FONT} testId="chart-grid" compact singleLine />
    </div>
  );
}
