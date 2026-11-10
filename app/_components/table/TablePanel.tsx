"use client";

import { ArrowLeftRight, PanelLeft, PanelRight, PanelTop, SquareArrowOutUpRight, TableCellsMerge, TableCellsSplit, TriangleAlert } from "lucide-react";
import { MAX_COLS, MAX_ROWS, anchorOf, colsOf, isFixedTable, resizeTable, rowsOf, tableMirrored, wholeMerges } from "@/app/_lib/table";
import type { Lang, TableBlock } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import type { BlockPatch } from "@/app/_lib/useExam";
import { inputCls } from "../inspector/fields";
import TableGrid from "./TableGrid";
import TableStyleSection from "./TableStyleSection";
import { makeActions } from "./tableActions";
import { clampSel, selRange } from "./tableSel";
import { useTableSel } from "./tableSelStore";

interface Props {
  b: TableBlock;
  lang: Lang;
  onChange: (patch: BlockPatch, field: string) => void;
  /** The font of the exam (the cells have it until they choose another) */
  examFont?: string;
  /** Back to the Table Studio on this table (with a shape chosen in the Shapes button: ready to draw it) */
  onOpenStudio: (shape?: string) => void;
}

// (the look of the panel's other buttons and boxes: inspector/fields.tsx)
const btn = "flex h-7 min-w-0 items-center justify-center gap-1.5 rounded-[5px] bg-subtle px-2 text-xs font-medium text-ink transition-colors outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40 [&>svg]:shrink-0";
const btnOn = "bg-accent-soft! text-accent!";
const numCls = `${inputCls} h-7 tabular-nums`;

function Count({ label, value, max, onChange, testId }: { label: string; value: number; max: number; onChange: (n: number) => void; testId: string }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <input
        type="number"
        value={value}
        min={1}
        max={max}
        data-testid={testId}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n >= 1) onChange(Math.min(max, Math.round(n)));
        }}
        className={numCls}
      />
    </label>
  );
}

// The properties of a selected table, in the right panel, kept small: a preview of the table (its cells are typed in and selected
// there), its rows and columns, how the text sits in the cells, the header row and header column, reversing the columns and merging the selected cells. Everything else
// (the font, colors, lines, formulas, shapes) is in the Table Studio. Every change is one of the block's own updates, so it is part of the exam's undo history.
export default function TablePanel({ b, lang, onChange, examFont, onOpenStudio }: Props) {
  const t = useT();
  // (shared with the page: cells picked there with the table tools are selected here too)
  const [picked, setSel] = useTableSel(b.id);
  // A table with shapes or pictures over it is fixed like a picture: nothing of it can be changed here (what is over it would not follow),
  // only a warning and the button to the Studio.
  if (isFixedTable(b)) {
    return (
      <div className="flex flex-col gap-3" data-testid="table-panel">
        <div role="note" data-testid="table-locked" className="flex gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12px] leading-snug text-amber-900">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-amber-700" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{t("This table is fixed")}</p>
            <p>{t("It has shapes or images on it, so it is fixed like a picture and changing the table is not available in this form. Open it in the Table Studio to change its cells and what is over them.")}</p>
            <p className="text-xs text-amber-800/80">{t("Shapes and images on this table: {count}", { count: b.shapes?.length ?? 0 })}</p>
          </div>
        </div>
        <button type="button" onClick={() => onOpenStudio()} data-testid="open-table-studio" className="flex items-center justify-center gap-2 rounded-lg border border-accent bg-accent-soft px-3 py-2 text-sm font-medium text-accent-strong transition-colors hover:bg-white">
          {t("Open in Table Studio")}
          <SquareArrowOutUpRight size={14} aria-hidden />
        </button>
      </div>
    );
  }
  const rows = rowsOf(b);
  const cols = colsOf(b);
  const sel = clampSel(picked, rows, cols);
  const range = sel ? wholeMerges(b, selRange(sel)) : null;
  const apply = (patch: Partial<TableBlock>, key: string) => onChange(patch as BlockPatch, key);
  const mirrored = tableMirrored(b, lang === "ar");
  const actions = makeActions(b, range, mirrored, apply, setSel);
  // a merged cell alone selected: the button splits it
  const split = actions.canUnmerge && !!range && !!sel && (() => {
    const a = anchorOf(b, sel.focus.r, sel.focus.c);
    const m = b.merges?.find((g) => g.r === a.r && g.c === a.c);
    return !!m && range.r0 === m.r && range.c0 === m.c && range.r1 === m.r + m.rs - 1 && range.c1 === m.c + m.cs - 1;
  })();
  const mergeText = split ? t("Split merged cells") : t("Merge cells");

  return (
    <div className="flex flex-col gap-2" data-testid="table-panel">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <span className="text-xs text-muted">{t("Table")}</span>
        <button type="button" onClick={() => onOpenStudio()} data-testid="open-table-studio" className="flex h-5 items-center gap-1 rounded-[4px] px-1 text-xs font-medium text-accent outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent">
          {t("Open in Table Studio")}
          <SquareArrowOutUpRight size={11} aria-hidden />
        </button>
      </div>

      <div className="overflow-hidden rounded-[5px] border border-line">
        <TableGrid table={b} lang={lang} sel={sel} onSelect={setSel} onChange={apply} compact maxHeight={420} actions={actions} examFont={examFont} testId="panel-grid" />
      </div>

      <div className="flex gap-2">
        <Count label={t("Rows")} value={rows} max={MAX_ROWS} onChange={(n) => apply(resizeTable(b, n, cols), "size")} testId="table-rows" />
        <Count label={t("Columns")} value={cols} max={MAX_COLS} onChange={(n) => apply(resizeTable(b, rows, n), "size")} testId="table-cols" />
      </div>

      <TableStyleSection actions={actions} onWhole={() => setSel(null)} />

      {/* the headers: across the top and down the first column (bold and shaded) */}
      <span className="-mb-1 text-xs text-muted">{t("Headers")}</span>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => apply({ header: !b.header }, "header")}
          aria-pressed={b.header}
          title={t("First row is a header (bold)")}
          data-testid="table-header-row"
          className={`${btn} ${b.header ? btnOn : ""}`}
        >
          <PanelTop size={13} aria-hidden />
          <span className="truncate">{t("Row")}</span>
        </button>
        <button
          type="button"
          onClick={() => apply({ firstCol: b.firstCol ? undefined : true }, "firstCol")}
          aria-pressed={!!b.firstCol}
          title={t("First column is a header (bold)")}
          data-testid="table-header-col"
          className={`${btn} ${b.firstCol ? btnOn : ""}`}
        >
          {/* (the first column is on the right when the table reads right to left) */}
          {mirrored ? <PanelRight size={13} aria-hidden /> : <PanelLeft size={13} aria-hidden />}
          <span className="truncate">{t("Column")}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={actions.flip} aria-pressed={actions.flipped} title={t("The columns in the other order: A B C D… becomes …D C B A. The text keeps its direction.")} data-testid="table-flip" className={`${btn} ${actions.flipped ? btnOn : ""}`}>
          <ArrowLeftRight size={13} aria-hidden />
          <span className="truncate">{t("Reverse")}</span>
        </button>
        <button
          type="button"
          onClick={() => (split ? actions.unmerge() : actions.merge())}
          disabled={!split && !actions.canMerge}
          title={actions.hasSelection ? mergeText : t("Select cells in the table to merge them")}
          data-testid="table-merge"
          className={btn}
        >
          {split ? <TableCellsSplit size={13} aria-hidden /> : <TableCellsMerge size={13} aria-hidden />}
          <span className="truncate">{split ? t("Split") : t("Merge")}</span>
        </button>
      </div>
    </div>
  );
}
