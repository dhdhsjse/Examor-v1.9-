"use client";

import { FlipHorizontal2, AlignCenter, AlignLeft, AlignRight, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, ArrowDownAZ, ArrowUpAZ, Baseline, Bold, Columns3, Grid3x3, Hash, Italic, PaintBucket, Rows3, TableCellsMerge, TableCellsSplit, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { ColorMenu, Divider, Menu, MenuButton, MenuHeading, MenuItem, MenuSeparator, RibbonButton, RibbonRow, fieldCls, keepFocus } from "@/app/_features/inspectors/format/ribbonUi";
import { FontSelect } from "@/app/_components/rich/FormatBar";
import { ShapesMenuButton } from "@/app/_components/shapes/ShapeGallery";
import { DEFAULT_FONT, FILL_COLORS, TEXT_COLORS } from "@/app/_lib/fonts";
import { styleAt, type CellRange, type NumberFormat, type TableData } from "@/app/_lib/table";
import { useT } from "@/app/_lib/uiLang";
import type { TableActions } from "./tableActions";

const SIZES = [10, 11, 12, 14, 16, 18, 20, 24, 28];
const FILLS = ["#ffffff", ...FILL_COLORS];

// The unit after a number ("V", "Ω", "m/s"): typed here, put on every number of the selected cells.
function UnitField({ fmt, onApply }: { fmt: NumberFormat; onApply: (suffix: string) => void }) {
  const t = useT();
  const [text, setText] = useState((fmt.suffix ?? "").trim());
  return (
    <form
      className="flex items-center gap-1 px-1.5 pb-1"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(text.trim() ? ` ${text.trim()}` : "");
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("Unit after the number")}
        aria-label={t("Unit after the number")}
        data-testid="table-unit"
        className="h-7 min-w-0 flex-1 rounded-md border border-line bg-white px-1.5 text-[12.5px] outline-none focus:border-indigo-400"
      />
      <button type="submit" onMouseDown={keepFocus} className="h-7 rounded-md border border-line px-2 text-xs font-medium text-ink hover:bg-subtle">
        {t("Apply")}
      </button>
    </form>
  );
}

interface Props {
  table: TableData;
  /** The selected cells (null = none: the formatting goes to the whole table, and what needs cells is off) */
  range: CellRange | null;
  /** The active cell, whose look the buttons show */
  active: { r: number; c: number } | null;
  actions: TableActions;
  /** The exam's font, named in the font list as the one the cells have until they choose another */
  examFont?: string;
  /** The Shapes button: what to do with the shape chosen in the gallery (none = no button) */
  onPickShape?: (shape: string) => void;
  shapesActive?: boolean;
}

// The format bar of a table, for the Studio and for the right panel: what is done to the selected cells. Pressing a button never
// takes the focus from the grid (or from the cell being typed in).
export default function TableFormatBar({ table, range, active, actions, examFont, onPickShape, shapesActive }: Props) {
  const t = useT();
  const none = !actions.hasSelection || !range || !active; // (what needs cells: rows, columns, sorting)
  const at = active ?? { r: 0, c: 0 };
  // what the buttons show: the look all the target cells share (the selection's, or the whole table's when none is selected)
  const look = { size: actions.common("size"), color: actions.common("color"), fill: actions.common("fill"), align: actions.common("align"), valign: actions.common("valign") ?? "middle" };
  const style = styleAt(table, at.r, at.c);
  const g = actions.target;
  const single = g.r0 === g.r1 && g.c0 === g.c1;
  // Borders: the selection as a whole, or each of its cells alone (the choice is kept while the bar is open; one cell has nothing to choose)
  const [separate, setSeparate] = useState(false);
  // after a choice in a list the keys (arrows, Ctrl+B…) are the grid's again: it takes the focus back, the selection is kept
  const root = useRef<HTMLDivElement>(null);
  const backToGrid = () => root.current?.parentElement?.querySelector<HTMLElement>("[data-table-grid]")?.focus({ preventScroll: true });
  const each = separate && !single;
  const fmt = style.fmt ?? {};
  const decimals = (d: number | undefined) => actions.setFormat({ ...fmt, decimals: d });
  const fmtOrNone = (next: NumberFormat) => actions.setFormat(Object.keys(next).filter((k) => next[k as keyof NumberFormat] !== undefined && next[k as keyof NumberFormat] !== false).length ? next : undefined);

  return (
    <div ref={root} data-testid="table-format-bar" className="flex flex-col gap-1 border-b border-line bg-white px-2 py-1.5" onMouseDown={(e) => !(e.target instanceof HTMLElement && e.target.closest("input, select, textarea, label")) && e.preventDefault()}>
      <RibbonRow>
        <FontSelect value={actions.fontName} onChange={(family) => {
            actions.setFont(family);
            backToGrid();
          }} defaultLabel={`${t("Exam font")} (${examFont ?? DEFAULT_FONT})`} className={`${fieldCls} !w-36 flex-none`} />
        <span data-testid="table-font-scope" title={t("The font and the formatting go to each selected cell; with the whole table selected, or no cell, to the whole table")} className="flex-none rounded bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-muted">
          {actions.fontForTable ? t("Whole table") : t("Selected cells")}
        </span>
        <Divider />
        <RibbonButton title={t("Bold")} shortcut="Ctrl+B" icon={<Bold size={15} />} pressed={actions.isOn("bold")} onClick={() => actions.toggle("bold")} />
        <RibbonButton title={t("Italic")} shortcut="Ctrl+I" icon={<Italic size={15} />} pressed={actions.isOn("italic")} onClick={() => actions.toggle("italic")} />
        <MenuButton title={t("Font size")} label={String(look.size ?? "")} width={86}>
          {(close) => (
            <Menu label={t("Font size")}>
              <MenuItem
                label={t("Automatic")}
                checked={look.size === undefined}
                onSelect={() => {
                  actions.style({ size: undefined });
                  close();
                }}
              />
              {SIZES.map((s) => (
                <MenuItem
                  key={s}
                  label={String(s)}
                  checked={look.size === s}
                  onSelect={() => {
                    actions.style({ size: s });
                    close();
                  }}
                />
              ))}
            </Menu>
          )}
        </MenuButton>
        <ColorMenu title={t("Text color")} icon={<Baseline size={15} />} value={look.color} initial="#dc2626" autoLabel={t("Auto")} colors={TEXT_COLORS} onChange={(color) => actions.style({ color })} />
        <ColorMenu title={t("Cell fill")} icon={<PaintBucket size={15} />} value={look.fill} initial="#fef08a" autoLabel={t("None")} colors={FILLS} onChange={(fill) => actions.style({ fill })} />
        <Divider />
        <RibbonButton title={t("Align left")} icon={<AlignLeft size={15} />} pressed={look.align === "left"} onClick={() => actions.style({ align: look.align === "left" ? undefined : "left" })} />
        <RibbonButton title={t("Center")} icon={<AlignCenter size={15} />} pressed={look.align === "center"} onClick={() => actions.style({ align: look.align === "center" ? undefined : "center" })} />
        <RibbonButton title={t("Align right")} icon={<AlignRight size={15} />} pressed={look.align === "right"} onClick={() => actions.style({ align: look.align === "right" ? undefined : "right" })} />
        <MenuButton title={t("Vertical alignment")} icon={look.valign === "top" ? <AlignVerticalJustifyStart size={15} /> : look.valign === "bottom" ? <AlignVerticalJustifyEnd size={15} /> : <AlignVerticalJustifyCenter size={15} />} width={170}>
          {(close) => (
            <Menu label={t("Vertical alignment")}>
              {(["top", "middle", "bottom"] as const).map((v) => (
                <MenuItem
                  key={v}
                  label={t(v === "top" ? "Align text to the top" : v === "middle" ? "Center text vertically" : "Align text to the bottom")}
                  checked={look.valign === v}
                  onSelect={() => {
                    actions.style({ valign: v === "middle" ? undefined : v });
                    close();
                  }}
                />
              ))}
            </Menu>
          )}
        </MenuButton>
        <Divider />
        <MenuButton title={t("Borders")} icon={<Grid3x3 size={15} />} width={230}>
          {(close) => {
            const run = (mode: Parameters<typeof actions.borders>[0]) => () => {
              actions.borders(mode, each);
              close();
            };
            return (
              <Menu label={t("Borders")}>
                {!single && (
                  <>
                    <MenuHeading>{t("Apply to")}</MenuHeading>
                    <MenuItem label={t("The selection as a whole")} checked={!separate} onSelect={() => setSeparate(false)} />
                    <MenuItem label={t("Each cell separately")} checked={separate} onSelect={() => setSeparate(true)} />
                    <MenuSeparator />
                  </>
                )}
                <MenuItem label={t("All borders")} onSelect={run("all")} />
                {!each && <MenuItem label={t("Outside borders")} onSelect={run("outer")} />}
                {!each && <MenuItem label={t("Inside borders")} onSelect={run("inner")} />}
                <MenuSeparator />
                {(
                  [
                    ["top", "Top border"],
                    ["bottom", "Bottom border"],
                    ["left", "Left border"],
                    ["right", "Right border"],
                  ] as const
                ).map(([side, label]) => (
                  <MenuItem key={side} label={t(label)} checked={actions.borderOn(side, each)} onSelect={run(side)} />
                ))}
                <MenuSeparator />
                <MenuItem label={t("No borders")} onSelect={run("none")} />
                <MenuItem label={t("Back to the table's border style")} onSelect={run("reset")} />
              </Menu>
            );
          }}
        </MenuButton>
        <RibbonButton title={t(actions.canUnmerge && single ? "Split merged cells" : "Merge cells")} icon={actions.canUnmerge && single ? <TableCellsSplit size={15} /> : <TableCellsMerge size={15} />} disabled={!actions.canMerge} pressed={actions.canUnmerge && single} onClick={() => (actions.canUnmerge && single ? actions.unmerge() : actions.merge())} />
        {actions.canUnmerge && !(single) && <RibbonButton title={t("Split merged cells")} icon={<TableCellsSplit size={15} />} onClick={actions.unmerge} />}
        <Divider />
        <MenuButton title={t("Number format")} icon={<Hash size={15} />} width={230}>
          {(close) => (
            <Menu label={t("Number format")}>
              <MenuItem
                label={t("As typed")}
                checked={!style.fmt}
                onSelect={() => {
                  actions.setFormat(undefined);
                  close();
                }}
              />
              <MenuHeading>{t("Decimals")}</MenuHeading>
              {[0, 1, 2, 3].map((d) => (
                <MenuItem
                  key={d}
                  label={d === 0 ? t("No decimals") : t("{count} decimals", { count: d })}
                  checked={fmt.decimals === d}
                  onSelect={() => {
                    decimals(d);
                    close();
                  }}
                />
              ))}
              <MenuSeparator />
              <MenuItem label={t("Percent")} checked={!!fmt.percent} onSelect={() => fmtOrNone({ ...fmt, percent: !fmt.percent })} />
              <MenuItem label={t("Space between thousands")} checked={!!fmt.thousands} onSelect={() => fmtOrNone({ ...fmt, thousands: !fmt.thousands })} />
              <MenuSeparator />
              <UnitField key={fmt.suffix ?? ""} fmt={fmt} onApply={(suffix) => fmtOrNone({ ...fmt, suffix: suffix || undefined })} />
            </Menu>
          )}
        </MenuButton>
        <Divider />
        <MenuButton title={t("Rows and columns")} icon={<Rows3 size={15} />} width={200} disabled={none}>
          {(close) => (
            <Menu label={t("Rows and columns")}>
              {(
                [
                  ["Insert row above", () => actions.insertRows(false)],
                  ["Insert row below", () => actions.insertRows(true)],
                  ["Insert column before", () => actions.insertCols(false)],
                  ["Insert column after", () => actions.insertCols(true)],
                ] as const
              ).map(([label, run]) => (
                <MenuItem
                  key={label}
                  label={t(label)}
                  icon={label.includes("column") ? <Columns3 size={14} /> : <Rows3 size={14} />}
                  onSelect={() => {
                    run();
                    close();
                  }}
                />
              ))}
              <MenuSeparator />
              <MenuItem
                label={t("Delete row")}
                icon={<Trash2 size={14} />}
                onSelect={() => {
                  actions.deleteRows();
                  close();
                }}
              />
              <MenuItem
                label={t("Delete column")}
                icon={<Trash2 size={14} />}
                onSelect={() => {
                  actions.deleteCols();
                  close();
                }}
              />
            </Menu>
          )}
        </MenuButton>
        <RibbonButton title={t("Flip the table: the first column goes to the other side")} icon={<FlipHorizontal2 size={15} />} pressed={actions.flipped} onClick={actions.flip} />
        <RibbonButton title={t("Sort A to Z")} icon={<ArrowDownAZ size={15} />} disabled={none} onClick={() => actions.sort("asc")} />
        <RibbonButton title={t("Sort Z to A")} icon={<ArrowUpAZ size={15} />} disabled={none} onClick={() => actions.sort("desc")} />
        {onPickShape && (
          <>
            <Divider />
            <ShapesMenuButton variant="icon" active={shapesActive} onPick={onPickShape} testId="table-shapes" />
          </>
        )}
      </RibbonRow>
    </div>
  );
}
