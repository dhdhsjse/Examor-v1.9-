"use client";

import { TableProperties, TriangleAlert } from "lucide-react";
import { useState } from "react";
import type { TableStudioStart } from "@/app/_components/table-studio/tablePreset";
import { DEFAULT_FONT } from "@/app/_lib/fonts";
import { pickImage } from "@/app/_lib/images";
import { anchorOf, colsOf, isFixedTable, rowsOf, tableMirrored, wholeMerges } from "@/app/_lib/table";
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
  /** Back to the Table Studio on this table (opened on its shapes and pictures, with a shape or a picture ready to put, when `start` says so) */
  onOpenStudio: (start?: TableStudioStart) => void;
}

// The properties of a selected table, in the right panel: the same grid, format bar and settings as the Table Studio, so a table made
// there (or by the plain Table tool) can be changed at any time, formulas and all, and a button goes back to the Studio. Every change is
// one of the block's own updates, so it is part of the exam's undo history (Ctrl+Z works while the grid has the focus). With no cell
// selected the font is the font of the whole table.
// A table with shapes or pictures over it is fixed like a picture: nothing of it can be changed here (what is over it would not follow),
// only a warning and the button to the Studio, which opens on the shapes and pictures and has a button back to the cells.
export default function TablePanel({ b, lang, onChange, examFont, onOpenStudio }: Props) {
  const t = useT();
  const [picked, setSel] = useState<Sel | null>(null);
  const openButton = (start?: TableStudioStart) => (
    <button
      type="button"
      onClick={() => onOpenStudio(start)}
      data-testid="open-table-studio"
      className="flex items-center justify-center gap-2 rounded-lg border border-accent bg-accent-soft px-3 py-2 text-sm font-medium text-accent-strong transition-colors hover:bg-white"
    >
      <TableProperties size={16} />
      {t("Open in Table Studio")}
    </button>
  );

  if (isFixedTable(b)) {
    return (
      <div className="flex flex-col gap-3" data-testid="table-panel">
        <div role="note" data-testid="table-locked" className="flex gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12px] leading-snug text-amber-900">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{t("This table is fixed")}</p>
            <p>{t("It has shapes or images on it, so it is fixed like a picture and changing the table is not available in this form. Open it in the Table Studio to edit the shapes and images first; its Back to the Table Studio button leads to the data.")}</p>
            <p className="text-[11px] text-amber-800/80">{t("Shapes and images on this table: {count}", { count: b.shapes?.length ?? 0 })}</p>
          </div>
        </div>
        {openButton({ view: "shapes" })}
      </div>
    );
  }

  const sel = clampSel(picked, rowsOf(b), colsOf(b));
  const range = sel ? wholeMerges(b, selRange(sel)) : null;
  const active = sel ? anchorOf(b, sel.focus.r, sel.focus.c) : null;
  const apply = (patch: Partial<TableBlock>, key: string) => onChange(patch as BlockPatch, key);
  const actions = makeActions(b, range, tableMirrored(b, lang === "ar"), apply, setSel);

  return (
    <div className="flex flex-col gap-3" data-testid="table-panel">
      {openButton()}
      <div className="-mx-1 overflow-hidden rounded-lg border border-line">
        <TableFormatBar
          table={b}
          range={range}
          active={active}
          actions={actions}
          examFont={examFont ?? DEFAULT_FONT}
          onPickShape={(shape) => onOpenStudio({ view: "shapes", shape })}
          onPickImage={async () => {
            const picture = await pickImage();
            if (picture) onOpenStudio({ view: "shapes", picture });
          }}
        />
        <TableGrid table={b} lang={lang} sel={sel} onSelect={setSel} onChange={apply} compact maxHeight={300} actions={actions} examFont={examFont} testId="panel-grid" />
      </div>
      <p className="rounded-md bg-indigo-50/70 px-2.5 py-2 text-[11px] leading-snug text-indigo-900">
        {t("Drag the lines of the table on the page, or the lines between the column letters and the row numbers here, to change the width of the columns and the height of the rows.")}
      </p>
      <TableSettings table={b} onChange={apply} />
    </div>
  );
}
