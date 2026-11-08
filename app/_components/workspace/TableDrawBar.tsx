"use client";

import { Check, Eraser, PenLine, SquareArrowOutUpRight, SquareDashedMousePointer, TableCellsMerge, TableCellsSplit } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/app/_lib/uiLang";
import { MAX_COLS, MAX_ROWS } from "@/app/_lib/table";
import type { TableDrawMode } from "./TableDrawLayer";

// (the buttons of the page's floating tool bar, ToolRail)
const toolBtn = (on: boolean) =>
  `ui-icon grid size-8 place-items-center rounded-[5px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40 ${on ? "bg-accent text-white" : "text-ink hover:bg-hover"}`;
const sep = <span aria-hidden className="mx-0.5 h-5 w-px bg-line" />;

// A cell cut across (down): the icons of the horizontal and vertical line tools
function LineIcon({ axis }: { axis: "h" | "v" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="2" y="2" width="12" height="12" rx="1.5" strokeOpacity="0.55" />
      {axis === "h" ? <path d="M2 8h12" strokeDasharray="2 1.6" strokeWidth="1.8" /> : <path d="M8 2v12" strokeDasharray="2 1.6" strokeWidth="1.8" />}
    </svg>
  );
}

const HINTS: Record<TableDrawMode, string> = {
  draw: "Drag on the paper to draw a table, then drag inside it to draw its lines",
  h: "Click a cell to cut it across, or drag over several cells",
  v: "Click a cell to cut it down, or drag over several cells",
  erase: "Erase a border; adjoining rectangular cells merge. Other borders are hidden.",
  cells: "Drag to select · Shift extends · Enter or double-click to edit · Delete clears",
};

interface Props {
  /** The tool in hand (null: the table tools are not in hand) */
  mode: TableDrawMode | null;
  onMode: (mode: TableDrawMode) => void;
  /** A table is selected (Merge, Split and the Table Studio work on it) */
  hasTable: boolean;
  /** Cells of it are selected, and how many (a merged cell counts once); `span`: one merged cell alone, its rows and columns */
  cells: number;
  span: { rows: number; cols: number } | null;
  onMerge: () => void;
  onSplit: (cols: number, rows: number) => void;
  canSplit: (cols: number, rows: number) => boolean;
  onOpenStudio: () => void;
  onDone: () => void;
  /** Something to tell for a moment instead of the hint */
  message: string | null;
}

// The floating bar of the tables, under the selected table (or at the top of the pages while the tools are in hand and no table is
// selected), like the page's tool bar: the pen, the horizontal and vertical lines, the eraser, the selection of cells, then Merge and
// Split, the Table Studio, and Done. The hint of the tool in hand is at its end.
export default function TableDrawBar({ mode, onMode, hasTable, cells, span, onMerge, onSplit, canSplit, onOpenStudio, onDone, message }: Props) {
  const t = useT();
  const [splitOpen, setSplitOpen] = useState(false);
  const [cols, setCols] = useState("2");
  const [rows, setRows] = useState("1");
  const splitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!splitOpen) return;
    splitRef.current?.querySelector("input")?.focus();
    const close = (e: Event) => {
      if (!splitRef.current?.contains(e.target as Node)) setSplitOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
    };
  }, [splitOpen]);

  const tool = (m: TableDrawMode, label: string, icon: React.ReactNode, testId: string) => (
    <button type="button" onClick={() => { setSplitOpen(false); onMode(m); }} aria-pressed={mode === m} title={t(label)} aria-label={t(label)} data-testid={testId} className={toolBtn(mode === m)}>
      {icon}
    </button>
  );
  // Merge and Split need cells: without any, they put the Select cells tool in hand
  const needCells = (go: () => void) => () => (cells ? go() : onMode("cells"));
  const openSplit = () => {
    const merged = span && span.cols * span.rows > 1;
    setCols(String(merged ? span.cols : 2));
    setRows(String(merged ? span.rows : 1));
    setSplitOpen(true);
  };
  const count = (label: string, value: string, set: (n: string) => void, max: number, testId: string) => (
    <label className="flex items-center justify-between gap-3 text-xs text-ink">
      <span dir="auto">{t(label)}</span>
      <input
        type="number"
        min={1}
        max={max}
        value={value}
        data-testid={testId}
        onChange={(e) => {
          set(e.target.value);
        }}
        className="h-7 w-14 rounded-[5px] border border-line bg-surface px-1.5 text-right tabular-nums outline-none focus:ring-2 focus:ring-accent"
      />
    </label>
  );
  const validSplit = splitOpen && canSplit(Number(cols), Number(rows));
  const dismissSplit = () => { setSplitOpen(false); splitRef.current?.querySelector("button")?.focus(); };
  const submitSplit = () => { if (validSplit) { onSplit(Number(cols), Number(rows)); dismissSplit(); } };

  return (
    <div
      data-testid="table-draw-bar"
      dir="ltr"
      onMouseDown={(e) => !(e.target as HTMLElement).closest("input") && e.preventDefault()}
      className="pointer-events-auto relative w-max max-w-full rounded-md border border-line bg-surface p-1 shadow-sm"
    >
      <div role="toolbar" aria-label={t("Table tools")} className="flex flex-wrap items-center gap-0.5">
        {tool("draw", "Draw a table: pen", <PenLine aria-hidden />, "table-tool-draw")}
        {tool("h", "Horizontal line", <LineIcon axis="h" />, "table-tool-h")}
        {tool("v", "Vertical line", <LineIcon axis="v" />, "table-tool-v")}
        {tool("erase", "Erase a line", <Eraser aria-hidden />, "table-tool-erase")}
        {tool("cells", "Select cells", <SquareDashedMousePointer aria-hidden />, "table-tool-cells")}
        {sep}
        <button type="button" onClick={needCells(onMerge)} disabled={!hasTable || cells === 1} title={t(cells ? "Merge cells" : "Select the cells to merge first")} aria-label={t("Merge cells")} data-testid="table-bar-merge" className={toolBtn(false)}>
          <TableCellsMerge aria-hidden />
        </button>
        <div ref={splitRef} className="relative" onKeyDown={(e) => {
          if (!splitOpen) return;
          if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); dismissSplit(); }
          if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); e.stopPropagation(); submitSplit(); }
        }}>
          <button type="button" onClick={needCells(() => (splitOpen ? setSplitOpen(false) : openSplit()))} disabled={!hasTable} aria-expanded={splitOpen} title={t(cells ? "Split cells" : "Select the cells to split first")} aria-label={t("Split cells")} data-testid="table-bar-split" className={toolBtn(splitOpen)}>
            <TableCellsSplit aria-hidden />
          </button>
          {splitOpen && (
            <div role="dialog" aria-label={t("Split cells")} data-testid="table-split-pop" className="absolute top-full right-0 z-40 mt-2 flex w-52 flex-col gap-2 rounded-lg border border-line bg-surface p-3 shadow-lg group-data-[side=above]/table-dock:top-auto group-data-[side=above]/table-dock:bottom-full group-data-[side=above]/table-dock:mt-0 group-data-[side=above]/table-dock:mb-2">
              <span dir="auto" className="text-xs font-semibold text-ink">{t("Split cells")}</span>
              {count("Columns", cols, setCols, MAX_COLS, "table-split-cols")}
              {count("Rows", rows, setRows, MAX_ROWS, "table-split-rows")}
              {!validSplit && <p dir="auto" role="status" className="text-xs leading-relaxed text-muted">{t("This split does not fit. Choose fewer rows or columns, or enlarge the cells.")}</p>}
              <button
                type="button"
                data-testid="table-split-go"
                onClick={submitSplit}
                disabled={!validSplit}
                className="mt-1 h-7 rounded-[5px] bg-accent text-xs font-medium text-white outline-none transition-colors hover:bg-accent-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("Split")}
              </button>
            </div>
          )}
        </div>
        {sep}
        <button type="button" onClick={onOpenStudio} disabled={!hasTable} title={t("Open in Table Studio")} aria-label={t("Open in Table Studio")} data-testid="table-bar-studio" className={toolBtn(false)}>
          <SquareArrowOutUpRight aria-hidden />
        </button>
        {mode && (
          <button type="button" onClick={onDone} title={t("Done (Esc)")} aria-label={t("Done (Esc)")} data-testid="table-bar-done" className={toolBtn(false)}>
            <Check aria-hidden />
          </button>
        )}
      </div>
      {(message || mode) && (
        <p dir="auto" role="status" data-testid="table-bar-hint" className={`mx-1.5 mt-1 max-w-80 pb-0.5 text-xs leading-relaxed ${message ? "font-medium text-amber-700" : "text-muted"}`}>
          {t(message ?? HINTS[mode!])}
        </p>
      )}
    </div>
  );
}
