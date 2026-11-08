"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Baseline,
  Bold,
  Italic,
  Minus,
  PaintBucket,
  Plus,
  RemoveFormatting,
  SquareDashed,
} from "lucide-react";
import { useState } from "react";
import { ColorMenu } from "@/app/_features/inspectors/format/ribbonUi";
import { FontSelect } from "@/app/_components/rich/FormatBar";
import { DEFAULT_FONT, FILL_COLORS, TEXT_COLORS } from "@/app/_lib/fonts";
import type {
  BorderMode,
  TableCellStyle,
  TableData,
  TableLine,
} from "@/app/_lib/table";
import { useT } from "@/app/_lib/uiLang";
import { inputCls } from "../inspector/fields";
import type { TableActions } from "./tableActions";

const FILLS = ["#ffffff", ...FILL_COLORS];
const LINE_COLORS = [
  "#111827",
  "#6b7280",
  "#9ca3af",
  "#dc2626",
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#7c3aed",
];
const WIDTHS = [0.5, 1, 1.5, 2, 3];
type Dash = "solid" | NonNullable<TableLine["dash"]>;

const seg = "flex h-7 items-center rounded-[5px] bg-subtle p-0.5";
const segBtn = (on: boolean) =>
  `grid h-6 flex-1 place-items-center rounded-[4px] text-ink transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent ${on ? "bg-surface shadow-sm text-accent" : "hover:bg-hover"}`;
const label = "-mb-1 text-xs text-muted";
const selectCls = `${inputCls} h-7 min-w-0`;

// A square with the lines a border button draws (the others faint)
function BorderIcon({ on }: { on: ("t" | "b" | "l" | "r" | "h" | "v")[] }) {
  const line = (k: (typeof on)[number], d: string) => (
    <path
      key={k}
      d={d}
      strokeOpacity={on.includes(k) ? 1 : 0.25}
      strokeDasharray={on.includes(k) ? undefined : "1.5 1.5"}
    />
  );
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      {line("t", "M2 2h12")}
      {line("b", "M2 14h12")}
      {line("l", "M2 2v12")}
      {line("r", "M14 2v12")}
      {line("h", "M2 8h12")}
      {line("v", "M8 2v12")}
    </svg>
  );
}

// "Ab" across, or turned to read from the top down (90) or from the bottom up (270), with an arrow the way it reads
function TurnIcon({ rot }: { rot: 0 | 90 | 270 }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
      <g transform={rot ? `rotate(${rot === 90 ? 90 : -90} 8 8)` : undefined}>
        <text x="8" y="9" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="currentColor" fontFamily="system-ui, sans-serif">
          Ab
        </text>
        <path d="M3 12.5h9m-2-2 2 2-2 2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

const BORDERS: {
  mode: BorderMode;
  title: string;
  on: ("t" | "b" | "l" | "r" | "h" | "v")[];
}[] = [
  { mode: "all", title: "All borders", on: ["t", "b", "l", "r", "h", "v"] },
  { mode: "outer", title: "Outside borders", on: ["t", "b", "l", "r"] },
  { mode: "inner", title: "Inside borders", on: ["h", "v"] },
  { mode: "none", title: "No borders", on: [] },
  { mode: "top", title: "Top border", on: ["t"] },
  { mode: "bottom", title: "Bottom border", on: ["b"] },
  { mode: "left", title: "Left border", on: ["l"] },
  { mode: "right", title: "Right border", on: ["r"] },
];

// The look of the selected cells (or of the whole table when none is selected) in the table's Properties: the text and the fill, then
// the borders, drawn with the line chosen above them.
export default function TableStyleSection({
  table,
  actions,
  examFont,
  onWhole,
}: {
  table: TableData;
  actions: TableActions;
  examFont?: string;
  /** Forget the selected cells: the look goes to the whole table */ onWhole: () => void;
}) {
  const t = useT();
  const [dash, setDash] = useState<Dash>("solid");
  const [width, setWidth] = useState(1);
  const [color, setColor] = useState<string | undefined>(undefined);
  const size = actions.common("size");
  const shownSize = size ?? table.font?.size ?? 14;
  const align = actions.common("align");
  const valign = actions.common("valign") ?? "middle";
  const pen: TableLine | undefined = (() => {
    const l: TableLine = {};
    if (width !== 1) l.w = width;
    if (dash !== "solid") l.dash = dash;
    if (color) l.color = color;
    return Object.keys(l).length ? l : undefined;
  })();
  const style = (patch: Partial<TableCellStyle>) => actions.style(patch);
  const resize = (d: number) =>
    style({ size: Math.max(6, Math.min(72, shownSize + d)) });

  return (
    <>
      <div className="-mb-1 flex items-center justify-between gap-2">
        <span className="text-xs text-muted">
          {t(actions.hasSelection ? "Selected cells" : "Whole table")}
        </span>
        {actions.hasSelection && (
          <button
            type="button"
            onClick={onWhole}
            data-testid="table-style-whole"
            className="h-5 rounded-[4px] px-1 text-xs font-medium text-accent outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("Whole table")}
          </button>
        )}
      </div>
      <div className="flex gap-1.5">
        <div className="min-w-0 flex-1">
          <FontSelect
            value={actions.fontName}
            onChange={actions.setFont}
            defaultLabel={`${t("Exam font")} (${examFont ?? DEFAULT_FONT})`}
            className={selectCls}
          />
        </div>
        <div className={`${seg} w-24 flex-none`}>
          <button
            type="button"
            onClick={() => resize(-1)}
            title={t("Smaller")}
            aria-label={t("Smaller")}
            className={segBtn(false)}
          >
            <Minus size={12} />
          </button>
          <span
            data-testid="table-style-size"
            className="w-7 text-center text-xs tabular-nums text-ink"
          >
            {shownSize}
          </span>
          <button
            type="button"
            onClick={() => resize(1)}
            title={t("Bigger")}
            aria-label={t("Bigger")}
            className={segBtn(false)}
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      <div className="flex gap-1.5">
        <div className={`${seg} flex-1`}>
          <button
            type="button"
            onClick={() => actions.toggle("bold")}
            aria-pressed={actions.isOn("bold")}
            title={t("Bold")}
            aria-label={t("Bold")}
            data-testid="table-style-bold"
            className={segBtn(actions.isOn("bold"))}
          >
            <Bold size={13} />
          </button>
          <button
            type="button"
            onClick={() => actions.toggle("italic")}
            aria-pressed={actions.isOn("italic")}
            title={t("Italic")}
            aria-label={t("Italic")}
            className={segBtn(actions.isOn("italic"))}
          >
            <Italic size={13} />
          </button>
        </div>
        <div className="flex flex-none items-center gap-0.5 rounded-[5px] bg-subtle px-0.5">
          <ColorMenu
            title={t("Text color")}
            icon={<Baseline size={14} />}
            value={actions.common("color")}
            initial="#dc2626"
            autoLabel={t("Auto")}
            colors={TEXT_COLORS}
            onChange={(c) => style({ color: c })}
          />
          <ColorMenu
            title={t("Cell fill")}
            icon={<PaintBucket size={14} />}
            value={actions.common("fill")}
            initial="#fef08a"
            autoLabel={t("None")}
            colors={FILLS}
            onChange={(c) => style({ fill: c })}
          />
        </div>
        <button
          type="button"
          onClick={() =>
            style({
              font: undefined,
              bold: undefined,
              italic: undefined,
              size: undefined,
              color: undefined,
              fill: undefined,
              align: undefined,
              valign: undefined,
              rot: undefined,
            })
          }
          title={t("Clear formatting")}
          aria-label={t("Clear formatting")}
          className="grid h-7 w-7 flex-none place-items-center rounded-[5px] bg-subtle text-ink hover:bg-hover"
        >
          <RemoveFormatting size={13} />
        </button>
      </div>

      <div className="flex gap-1.5">
        <div className={`${seg} flex-1`}>
          {(
            [
              ["left", "Align left", AlignLeft],
              ["center", "Center", AlignCenter],
              ["right", "Align right", AlignRight],
            ] as const
          ).map(([a, title, Icon]) => (
            <button
              key={a}
              type="button"
              onClick={() => style({ align: align === a ? undefined : a })}
              aria-pressed={align === a}
              title={t(title)}
              aria-label={t(title)}
              className={segBtn(align === a)}
            >
              <Icon size={13} />
            </button>
          ))}
        </div>
        <div className={`${seg} flex-1`}>
          {(
            [
              ["top", "Align text to the top", AlignVerticalJustifyStart],
              ["middle", "Center text vertically", AlignVerticalJustifyCenter],
              ["bottom", "Align text to the bottom", AlignVerticalJustifyEnd],
            ] as const
          ).map(([v, title, Icon]) => (
            <button
              key={v}
              type="button"
              onClick={() => style({ valign: v === "middle" ? undefined : v })}
              aria-pressed={valign === v}
              title={t(title)}
              aria-label={t(title)}
              className={segBtn(valign === v)}
            >
              <Icon size={13} />
            </button>
          ))}
        </div>
      </div>

      <div className={seg}>
        {(
          [
            [0, "Text across"],
            [90, "Text from the top down"],
            [270, "Text from the bottom up"],
          ] as const
        ).map(([rot, title]) => {
          const on = (actions.common("rot") ?? 0) === rot;
          return (
            <button key={rot} type="button" onClick={() => style({ rot: rot || undefined })} aria-pressed={on} title={t(title)} aria-label={t(title)} data-testid={`table-text-rot-${rot}`} className={segBtn(on)}>
              <TurnIcon rot={rot} />
            </button>
          );
        })}
      </div>

      <span className={label}>{t("Borders")}</span>
      <div className="flex gap-1.5">
        <div className="min-w-0 flex-1">
          <select
            value={dash}
            onChange={(e) => setDash(e.target.value as Dash)}
            title={t("Line style")}
            aria-label={t("Line style")}
            data-testid="table-line-dash"
            className={selectCls}
          >
            {(["solid", "dashed", "dotted", "double"] as const).map((d) => (
              <option key={d} value={d}>
                {t(
                  d === "solid"
                    ? "Solid"
                    : d === "dashed"
                      ? "Dashed"
                      : d === "dotted"
                        ? "Dotted"
                        : "Double line",
                )}
              </option>
            ))}
          </select>
        </div>
        <div className="w-20 flex-none">
          <select
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            title={t("Line width")}
            aria-label={t("Line width")}
            data-testid="table-line-width"
            className={selectCls}
          >
            {WIDTHS.map((w) => (
              <option key={w} value={w}>
                {w} px
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-none items-center rounded-[5px] bg-subtle px-0.5">
          <ColorMenu
            title={t("Line color")}
            icon={<SquareDashed size={14} />}
            value={color}
            initial="#111827"
            autoLabel={t("Auto")}
            colors={LINE_COLORS}
            onChange={setColor}
          />
        </div>
      </div>
      <div className="grid grid-cols-8 gap-0.5 rounded-[5px] bg-subtle p-0.5">
        {BORDERS.map((b) => {
          const side =
            b.mode === "top" ||
            b.mode === "bottom" ||
            b.mode === "left" ||
            b.mode === "right";
          const on =
            side &&
            actions.borderOn(b.mode as "top" | "bottom" | "left" | "right");
          return (
            <button
              key={b.mode}
              type="button"
              onClick={() =>
                actions.borders(
                  b.mode,
                  false,
                  b.mode === "none" ? undefined : pen,
                )
              }
              aria-pressed={side ? on : undefined}
              title={t(b.title)}
              aria-label={t(b.title)}
              data-testid={`table-border-${b.mode}`}
              className={segBtn(on)}
            >
              <BorderIcon on={b.on} />
            </button>
          );
        })}
      </div>
    </>
  );
}
