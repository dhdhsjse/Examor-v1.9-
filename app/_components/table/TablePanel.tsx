"use client";

import { ArrowLeftRight, SquareArrowOutUpRight, TableCellsMerge, TableCellsSplit } from "lucide-react";
import { useState } from "react";
import { MAX_COLS, MAX_ROWS, anchorOf, colsOf, resizeTable, rowsOf, tableMirrored, wholeMerges } from "@/app/_lib/table";
import type { Lang, TableBlock } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import type { BlockPatch } from "@/app/_lib/useExam";
import TableGrid from "./TableGrid";
import { makeActions } from "./tableActions";
import { clampSel, selRange, type Sel } from "./tableSel";

interface Props {
  b: TableBlock;
  lang: Lang;
  onChange: (patch: BlockPatch, field: string) => void;
  /** The font of the exam (the cells have it until they choose another) */
  examFont?: string;
  /** Back to the Table Studio on this table (with a shape chosen in the Shapes button: ready to draw it) */
  onOpenStudio: (shape?: string) => void;
}

const btn = "flex h-7 items-center justify-center gap-1.5 rounded-md border border-line px-2 text-[11px] font-medium text-ink transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:pointer-events-none disabled:opacity-40";
const btnOn = "border-indigo-300 bg-indigo-50 text-indigo-700";
const numCls = "h-7 w-full rounded-md border border-line bg-white px-1.5 text-[12px] text-ink outline-none focus:border-indigo-400";

function Count({ label, value, max, onChange, testId }: { label: string; value: number; max: number; onChange: (n: number) => void; testId: string }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-[10.5px] font-medium text-muted">{label}</span>
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
// there), its rows and columns, reversing the columns and merging the selected cells. Everything else (the look of the cells, lines,
// formulas, shapes) is in the Table Studio. Every change is one of the block's own updates, so it is part of the exam's undo history.
export default function TablePanel({ b, lang, onChange, examFont, onOpenStudio }: Props) {
  const t = useT();
  const [picked, setSel] = useState<Sel | null>(null);
  const rows = rowsOf(b);
  const cols = colsOf(b);
  const sel = clampSel(picked, rows, cols);
  const range = sel ? wholeMerges(b, selRange(sel)) : null;
  const apply = (patch: Partial<TableBlock>, key: string) => onChange(patch as BlockPatch, key);
  const actions = makeActions(b, range, tableMirrored(b, lang === "ar"), apply, setSel);
  // a merged cell alone selected: the button splits it
  const split = actions.canUnmerge && !!range && !!sel && (() => {
    const a = anchorOf(b, sel.focus.r, sel.focus.c);
    const m = b.merges?.find((g) => g.r === a.r && g.c === a.c);
    return !!m && range.r0 === m.r && range.c0 === m.c && range.r1 === m.r + m.rs - 1 && range.c1 === m.c + m.cs - 1;
  })();
  const mergeText = split ? t("Split merged cells") : t("Merge cells");

  return (
    <div className="flex flex-col gap-2.5" data-testid="table-panel">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted">{t("Table")}</span>
        <button type="button" onClick={() => onOpenStudio()} data-testid="open-table-studio" className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800">
          {t("Open in Table Studio")}
          <SquareArrowOutUpRight size={11} aria-hidden />
        </button>
      </div>

      <div className="-mx-1 overflow-hidden rounded-md border border-line">
        <TableGrid table={b} lang={lang} sel={sel} onSelect={setSel} onChange={apply} compact maxHeight={260} actions={actions} examFont={examFont} testId="panel-grid" />
      </div>

      <div className="flex gap-2">
        <Count label={t("Rows")} value={rows} max={MAX_ROWS} onChange={(n) => apply(resizeTable(b, n, cols), "size")} testId="table-rows" />
        <Count label={t("Columns")} value={cols} max={MAX_COLS} onChange={(n) => apply(resizeTable(b, rows, n), "size")} testId="table-cols" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={actions.flip} aria-pressed={actions.flipped} title={t("The columns in the other order: A B C D… becomes …D C B A. The text keeps its direction.")} data-testid="table-flip" className={`${btn} ${actions.flipped ? btnOn : ""}`}>
          <ArrowLeftRight size={13} aria-hidden />
          {t("Reverse columns")}
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
          {mergeText}
        </button>
      </div>
    </div>
  );
}
