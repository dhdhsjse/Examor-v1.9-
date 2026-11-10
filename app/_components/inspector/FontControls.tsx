"use client";

import { DEFAULT_SIZE, textSpec } from "@/app/_lib/blockLayout";
import { COMMON_COLORS, DEFAULT_FONT } from "@/app/_lib/fonts";
import { cellLook, colsOf, isFixedTable, rowsOf, styleAt, wholeMerges } from "@/app/_lib/table";
import type { Block, BlockFont, ExamMeta, TableBlock } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import type { BlockPatch } from "@/app/_lib/useExam";
import { ColorGrid, FontSelect } from "../rich/FormatBar";
import { makeActions } from "../table/tableActions";
import { clampSel, selRange } from "../table/tableSel";
import { useTableSel } from "../table/tableSelStore";
import { Group, Stepper, TextAction, inputCls } from "./fields";
import type { OnChange } from "./QuestionEditors";

const TEXT_TYPES: Block["type"][] = ["mcq", "truefalse", "blank", "open", "match", "order", "classify", "text", "textbox", "table", "header"];
// (a table with shapes or pictures is fixed like a picture: its font is changed in the Table Studio)
export const hasFontControls = (b: Block) => TEXT_TYPES.includes(b.type) && !(b.type === "table" && isFixedTable(b));

type Props = { b: Block; meta: ExamMeta; onChange: OnChange };

// "Text style" in the right panel: of the whole block, or of the selected cells of a table.
export function BlockFontControls({ b, meta, onChange }: Props) {
  return b.type === "table" ? <TableFontControls b={b} meta={meta} onChange={onChange} /> : <WholeBlockFont b={b} meta={meta} onChange={onChange} />;
}

// A table: with cells selected (here, in the panel's grid, or on the page) what is chosen goes to them alone, like the Alignment above it.
// With no cell selected, to the whole table. All its cells selected: the font is the table's (tableActions), as in the Table Studio.
function TableFontControls({ b, meta, onChange }: Omit<Props, "b"> & { b: TableBlock }) {
  const t = useT();
  const [picked, setSel] = useTableSel(b.id);
  const sel = clampSel(picked, rowsOf(b), colsOf(b));
  if (!sel) return <WholeBlockFont b={b} meta={meta} onChange={onChange} />;
  const range = wholeMerges(b, selRange(sel));
  const actions = makeActions(b, range, false, (patch, key) => onChange(patch as BlockPatch, key), setSel);
  const size = cellLook(b, range.r0, range.c0).size ?? b.font?.size ?? meta.fontSize ?? DEFAULT_SIZE;
  let changed = false;
  for (let r = range.r0; r <= range.r1; r++)
    for (let c = range.c0; c <= range.c1; c++) {
      const s = styleAt(b, r, c);
      if (s.font || s.size || s.color) changed = true;
    }

  return (
    <Group
      title={t("Text style")}
      action={
        <>
          {changed && <TextAction onClick={() => actions.style({ font: undefined, size: undefined, color: undefined })}>{t("Reset")}</TextAction>}
          <span data-testid="table-text-scope" className="rounded bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-muted">
            {actions.fontForTable ? t("Whole table") : t("Selected cells")}
          </span>
        </>
      }
    >
      <div className="flex items-center gap-1.5">
        <FontSelect value={actions.fontName} onChange={actions.setFont} defaultLabel={`${t("Exam font")} (${meta.fontFamily ?? DEFAULT_FONT})`} className={`${inputCls} h-7 flex-1 truncate`} />
        <Stepper value={size} min={8} max={60} onChange={(v) => actions.style({ size: v })} title={t("Font size")} />
      </div>
      <ColorGrid value={actions.common("color")} autoLabel={t("Auto")} colors={COMMON_COLORS} onChange={(color) => actions.style({ color })} />
    </Group>
  );
}

// "Text style" of the whole block: font and size on one line, then the color. Single words are styled on the page.
function WholeBlockFont({ b, meta, onChange }: Props) {
  const t = useT();
  const font = b.font ?? {};
  const set = (patch: Partial<BlockFont>) => {
    const next = { ...font, ...patch };
    for (const k of Object.keys(next) as (keyof BlockFont)[]) if (next[k] === undefined) delete next[k];
    onChange({ font: Object.keys(next).length ? next : undefined }, "font");
  };
  const size = b.type === "text" ? textSpec(b, meta).font.size : (font.size ?? meta.fontSize ?? DEFAULT_SIZE);
  const header = b.type === "header";
  const changed = !!(font.family || font.size || font.color);

  return (
    <Group title={t("Text style")} action={changed && <TextAction onClick={() => onChange({ font: undefined }, "font")}>{t("Reset")}</TextAction>}>
      <div className="flex items-center gap-1.5">
        <FontSelect value={font.family} onChange={(family) => set({ family })} defaultLabel={`${t("Exam font")} (${meta.fontFamily ?? DEFAULT_FONT})`} className={`${inputCls} h-7 flex-1 truncate`} />
        {!header && <Stepper value={size} min={8} max={60} onChange={(v) => set({ size: v })} title={t("Font size")} />}
      </div>
      {!header && <ColorGrid value={font.color} autoLabel={t("Auto")} colors={b.type === "table" ? COMMON_COLORS : undefined} onChange={(color) => set({ color })} />}
    </Group>
  );
}
