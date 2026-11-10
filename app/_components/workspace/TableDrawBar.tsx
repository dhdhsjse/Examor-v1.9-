"use client";

import { ChevronDown, Eraser, PaintBucket, PenLine, SquareDashedMousePointer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ColorGrid } from "@/app/_components/rich/FormatBar";
import { FILL_COLORS } from "@/app/_lib/fonts";
import { useT } from "@/app/_lib/uiLang";
import { MAX_COLS, MAX_ROWS } from "@/app/_lib/table";
import type { TableDrawMode } from "./TableDrawLayer";
import { SelectIcon } from "./ToolRail";

const FILLS = ["#ffffff", ...FILL_COLORS];

// (the buttons of the page's floating tool bar, ToolRail)
const toolBtn = (on: boolean) =>
  `ui-icon grid size-8 place-items-center rounded-[5px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40 ${on ? "bg-accent text-white" : "text-ink hover:bg-hover"}`;
const sep = <span aria-hidden className="mx-0.5 h-5 w-px bg-line" />;

// A cell, with what is drawn in it (the stroke's width comes from .ui-icon, like the icons next to it)
function CellIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="4" width="19" height="16" rx="2" />
      {children}
    </svg>
  );
}
// Merge: one cell, two arrows closing in. Split: the cell cut in two, the arrows moving apart.
const MergeIcon = () => <CellIcon><path d="M5.5 12H11M8 9l3 3-3 3M18.5 12H13M16 9l-3 3 3 3" /></CellIcon>;
const SplitIcon = () => <CellIcon><path d="M12 4v16M10 12H5M8 9l-3 3 3 3M14 12h5M16 9l3 3-3 3" /></CellIcon>;

interface Props {
  /** The tool in hand (null: the table tools are not in hand) */
  mode: TableDrawMode | null;
  onMode: (mode: TableDrawMode) => void;
  /** A table is selected (Merge and Split work on it) */
  hasTable: boolean;
  /** Cells of it are selected, and how many (a merged cell counts once); `span`: one merged cell alone, its rows and columns */
  cells: number;
  span: { rows: number; cols: number } | null;
  onMerge: () => void;
  onSplit: (cols: number, rows: number) => void;
  canSplit: (cols: number, rows: number) => boolean;
  /** The color of the bucket (undefined: it takes the fill off) */
  fill: string | undefined;
  /** The bucket is pressed: it comes in hand (and colors the selected cells) */
  onBucket: () => void;
  /** A color is chosen: the same, with that color */
  onFill: (color: string | undefined) => void;
  /** Puts the table tools down (only shown while they are in hand) */
  onExit: () => void;
  /** Something to tell for a moment */
  message: string | null;
}

// The floating bar of the tables, under the selected table, or at the bottom of the worksheet in the place of the page's tool bar while
// the tools are in hand: the arrow that puts them down, the pen, the eraser, the selection of cells, the bucket, then Merge and Split.
export default function TableDrawBar({ mode, onMode, hasTable, cells, span, onMerge, onSplit, canSplit, fill, onBucket, onFill, onExit, message }: Props) {
  const t = useT();
  const [fillOpen, setFillOpen] = useState(false);
  const fillRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!fillOpen) return;
    const away = (e: Event) => {
      if (!fillRef.current?.contains(e.target as Node)) setFillOpen(false);
    };
    // (first, so that Esc closes the colors and not the table tools)
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setFillOpen(false);
    };
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc, true);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc, true);
    };
  }, [fillOpen]);

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
        {mode && (
          <button type="button" onClick={onExit} title={t("Select and move")} aria-label={t("Select and move")} data-testid="table-tool-exit" className={toolBtn(false)}>
            <SelectIcon />
          </button>
        )}
        {tool("draw", "Draw a table: pen", <PenLine aria-hidden />, "table-tool-draw")}
        {tool("erase", "Erase a line", <Eraser aria-hidden />, "table-tool-erase")}
        {tool("cells", "Select cells", <SquareDashedMousePointer aria-hidden />, "table-tool-cells")}
        <div ref={fillRef} className="relative flex items-center">
          <button type="button" onClick={onBucket} aria-pressed={mode === "fill"} title={t("Cell fill")} aria-label={t("Cell fill")} data-testid="table-tool-fill" className={`${toolBtn(mode === "fill")} relative rounded-e-none`}>
            <PaintBucket aria-hidden />
            <span aria-hidden data-testid="table-fill-swatch" className="absolute inset-x-2 bottom-[3px] h-[3px] rounded-full ring-1 ring-black/20" style={{ background: fill ?? "transparent" }} />
          </button>
          <button
            type="button"
            onClick={() => setFillOpen(!fillOpen)}
            aria-expanded={fillOpen}
            aria-haspopup="dialog"
            title={t("Fill color")}
            aria-label={t("Fill color")}
            data-testid="table-fill-menu"
            className={`grid h-8 w-4 place-items-center rounded-e-[5px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent ${mode === "fill" ? "bg-accent-strong text-white" : "text-muted hover:bg-hover hover:text-ink"}`}
          >
            <ChevronDown size={12} strokeWidth={2} aria-hidden />
          </button>
          {fillOpen && (
            <div role="dialog" aria-label={t("Fill color")} data-testid="table-fill-pop" className="absolute top-full right-0 z-40 mt-2 w-[196px] rounded-lg border border-line bg-surface p-2 shadow-lg group-data-[side=above]/table-dock:top-auto group-data-[side=above]/table-dock:bottom-full group-data-[side=above]/table-dock:mt-0 group-data-[side=above]/table-dock:mb-2">
              <ColorGrid
                value={fill}
                autoLabel={t("None")}
                colors={FILLS}
                onChange={(color) => {
                  onFill(color);
                  setFillOpen(false);
                }}
              />
            </div>
          )}
        </div>
        {sep}
        <button type="button" onClick={needCells(onMerge)} disabled={!hasTable || cells === 1} title={t(cells ? "Merge cells" : "Select the cells to merge first")} aria-label={t("Merge cells")} data-testid="table-bar-merge" className={toolBtn(false)}>
          <MergeIcon />
        </button>
        <div ref={splitRef} className="relative" onKeyDown={(e) => {
          if (!splitOpen) return;
          if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); dismissSplit(); }
          if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); e.stopPropagation(); submitSplit(); }
        }}>
          <button type="button" onClick={needCells(() => (splitOpen ? setSplitOpen(false) : openSplit()))} disabled={!hasTable} aria-expanded={splitOpen} title={t(cells ? "Split cells" : "Select the cells to split first")} aria-label={t("Split cells")} data-testid="table-bar-split" className={toolBtn(splitOpen)}>
            <SplitIcon />
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
      </div>
      {message && (
        <p dir="auto" role="status" data-testid="table-bar-note" className="mx-1.5 mt-1 max-w-80 pb-0.5 text-xs leading-relaxed font-medium text-amber-700">
          {t(message)}
        </p>
      )}
    </div>
  );
}
