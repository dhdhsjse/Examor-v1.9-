"use client";

import { TableProperties } from "lucide-react";
import { useState } from "react";
import { DEFAULT_FONT } from "@/app/_lib/fonts";
import { anchorOf, colsOf, rowsOf, tableMirrored, wholeMerges } from "@/app/_lib/table";
import type { Lang, TableBlock } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import type { BlockPatch } from "@/app/_lib/useExam";
import TableFormatBar from "./TableFormatBar";
import TableGrid from "./TableGrid";
import TableSettings from "./TableSettings";
import { makeActions } from "./tableActions";
import { clampSel, selRange, type Sel } from "./tableSel";

interface Props {
  b: TableBlock;
  lang: Lang;
  onChange: (patch: BlockPatch, field: string) => void;
  /** The font of the exam, named in the font list */
  examFont?: string;
  /** Back to the Table Studio on this table (with a shape chosen in the Shapes button: ready to draw it) */
  onOpenStudio: (shape?: string) => void;
}

// The properties of a selected table, in the right panel: the same grid, format bar and settings as the Table Studio, so a table made
// there (or by the plain Table tool) can be changed at any time, formulas and all, and a button goes back to the Studio. Every change is
// one of the block's own updates, so it is part of the exam's undo history (Ctrl+Z works while the grid has the focus). With no cell
// selected the font is the font of the whole table.
export default function TablePanel({ b, lang, onChange, examFont, onOpenStudio }: Props) {
  const t = useT();
  const [picked, setSel] = useState<Sel | null>(null);
  const sel = clampSel(picked, rowsOf(b), colsOf(b));
  const range = sel ? wholeMerges(b, selRange(sel)) : null;
  const active = sel ? anchorOf(b, sel.focus.r, sel.focus.c) : null;
  const apply = (patch: Partial<TableBlock>, key: string) => onChange(patch as BlockPatch, key);
  const actions = makeActions(b, range, tableMirrored(b, lang === "ar"), apply, setSel);
  const shapes = b.shapes?.length ?? 0;

  return (
    <div className="flex flex-col gap-3" data-testid="table-panel">
      <button
        type="button"
        onClick={() => onOpenStudio()}
        data-testid="open-table-studio"
        className="flex items-center justify-center gap-2 rounded-lg border border-accent bg-accent-soft px-3 py-2 text-sm font-medium text-accent-strong transition-colors hover:bg-white"
      >
        <TableProperties size={16} />
        {t("Open in Table Studio")}
      </button>
      {shapes > 0 && <p className="-mt-1 text-[11px] leading-snug text-faint">{t("{count} shapes over this table: they are changed in the Table Studio.", { count: shapes })}</p>}
      <div className="-mx-1 overflow-hidden rounded-lg border border-line">
        <TableFormatBar table={b} range={range} active={active} actions={actions} examFont={examFont ?? DEFAULT_FONT} onPickShape={(shape) => onOpenStudio(shape)} />
        <TableGrid table={b} lang={lang} sel={sel} onSelect={setSel} onChange={apply} compact maxHeight={300} actions={actions} examFont={examFont} testId="panel-grid" />
      </div>
      <p className="rounded-md bg-indigo-50/70 px-2.5 py-2 text-[11px] leading-snug text-indigo-900">
        {t("Drag the lines of the table on the page, or the lines between the column letters and the row numbers here, to change the width of the columns and the height of the rows.")}
      </p>
      <TableSettings table={b} onChange={apply} />
    </div>
  );
}
