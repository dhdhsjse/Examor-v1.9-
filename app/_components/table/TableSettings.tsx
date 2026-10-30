"use client";

import type { ReactNode } from "react";
import { Field, NumberInput, Segmented, SmallButton, Toggle } from "@/app/_components/inspector/fields";
import { MAX_COLS, MAX_ROWS, colsOf, resizeTable, rowsOf, type TableBorders, type TableData, type TablePatch } from "@/app/_lib/table";
import { useT } from "@/app/_lib/uiLang";

const BANDED = "#eef2ff";
const BORDER_STYLES: { value: TableBorders; label: string }[] = [
  { value: "grid", label: "Grid" },
  { value: "box", label: "Box" },
  { value: "rows", label: "Rows" },
  { value: "columns", label: "Columns" },
  { value: "none", label: "None" },
];

function Color({ label, value, onChange, testId }: { label: string; value: string; onChange: (c: string) => void; testId?: string }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-ink">
      {label}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId} className="h-6 w-9 cursor-pointer rounded border border-line bg-white p-0.5" />
    </label>
  );
}

interface Props {
  table: TableData;
  onChange: (patch: TablePatch, key: string) => void;
  /** The width of the table on the page, in px (the Studio chooses it; on the page the handles do) */
  width?: { value: number; max: number; onChange: (w: number) => void };
  children?: ReactNode;
}

// What is true of the whole table: its size, the header, the first column, banded rows, the lines, formulas. Used by the Studio and by
// the right panel, so the two say the same things.
export default function TableSettings({ table, onChange, width, children }: Props) {
  const t = useT();
  const rows = rowsOf(table);
  const cols = colsOf(table);
  const custom = !!table.colWidths || !!table.rowHeights?.some((h) => h > 0);
  const set = (patch: TablePatch, name: string) => onChange(patch, `table:${name}`);

  return (
    <div className="flex flex-col gap-3" data-testid="table-settings">
      <div className="flex gap-4">
        <Field label={t("Rows")}>
          <NumberInput value={rows} min={1} max={MAX_ROWS} onChange={(n) => onChange(resizeTable(table, n, cols), "size")} />
        </Field>
        <Field label={t("Columns")}>
          <NumberInput value={cols} min={1} max={MAX_COLS} onChange={(n) => onChange(resizeTable(table, rows, n), "size")} />
        </Field>
        {width && (
          <Field label={t("Width (px)")}>
            <NumberInput value={Math.round(width.value)} min={120} max={width.max} onChange={width.onChange} />
          </Field>
        )}
      </div>

      <Toggle checked={table.header} onChange={(header) => set({ header }, "header")} label={t("First row is a header (bold)")} />
      {table.header && (
        <div className="flex flex-col gap-2 ps-6">
          <Color label={t("Header fill")} value={table.headerFill ?? "#f3f4f6"} onChange={(headerFill) => set({ headerFill }, "headerFill")} testId="table-header-fill" />
          <Color label={t("Header text color")} value={table.headerColor ?? "#111827"} onChange={(headerColor) => set({ headerColor }, "headerColor")} />
        </div>
      )}
      <Toggle checked={!!table.flip} onChange={(on) => set({ flip: on || undefined }, "flip")} label={t("Flip the table")} hint={t("The columns in the other order: A B C D… becomes …D C B A. The text keeps its direction.")} />
      <Toggle checked={!!table.firstCol} onChange={(on) => set({ firstCol: on || undefined }, "firstCol")} label={t("First column in bold")} />
      <Toggle checked={!!table.banded} onChange={(on) => set({ banded: on ? BANDED : undefined }, "banded")} label={t("Shade every second row")} />
      {table.banded && (
        <div className="ps-6">
          <Color label={t("Shading color")} value={table.banded} onChange={(banded) => set({ banded }, "bandedColor")} />
        </div>
      )}

      <Field label={t("Lines")} group>
        <Segmented value={table.borders ?? "grid"} options={BORDER_STYLES.map((o) => ({ value: o.value, label: t(o.label) }))} onChange={(borders) => set({ borders: borders === "grid" ? undefined : borders }, "borders")} />
      </Field>
      {(table.borders ?? "grid") !== "none" && <Color label={t("Line color")} value={table.borderColor ?? "#111827"} onChange={(borderColor) => set({ borderColor }, "borderColor")} />}

      <Toggle checked={!!table.calc} onChange={(calc) => set({ calc: calc || undefined }, "calc")} label={t("Formulas")} hint={t("A cell that starts with = is worked out: =SUM(B2:B4), =A2*B2, =ROUND(C2/3; 1)")} />

      {custom && <SmallButton onClick={() => onChange({ colWidths: undefined, rowHeights: undefined }, "sizes")}>{t("Equal columns, automatic rows")}</SmallButton>}
      {children}
    </div>
  );
}
