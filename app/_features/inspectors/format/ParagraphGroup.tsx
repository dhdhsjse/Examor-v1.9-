"use client";

import { AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowDownAZ, ArrowDownZA, IndentDecrease, IndentIncrease, List, ListChevronsUpDown, ListOrdered, ListTree, PaintBucket, Pilcrow, PilcrowLeft, PilcrowRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Ctx } from "@/app/_features/core/types";
import { FILL_COLORS, TEXT_COLORS } from "@/app/_lib/fonts";
import { formattingMarks, useShowMarks } from "@/app/_lib/formattingMarks";
import { BULLET_KINDS, NUMBER_KINDS, isBulletKind, markerText, type ListKind } from "@/app/_lib/lists";
import { LINE_STEPS, MAX_LINE, MAX_SPACE, MIN_LINE } from "@/app/_lib/paragraphFormat";
import type { T } from "@/app/_lib/uiLang";
import { ColorGrid } from "@/app/_components/rich/FormatBar";
import type { ParagraphTarget } from "./formatTarget";
import { ColorMenu, Divider, Menu, MenuButton, MenuHeading, MenuItem, MenuSeparator, RibbonButton, RibbonGroup, RibbonRow } from "./ribbonUi";

const BULLET_NAMES: Record<string, string> = { bullet: "Bullet", circle: "Circle", square: "Square", arrow: "Arrow", check: "Check mark", dash: "Dash" };

// A square with a dashed outline and a solid line on the sides that have a border.
function SideIcon({ sides, size = 15 }: { sides: string; size?: number }) {
  const solid = { t: "M2.5 2.5h11", b: "M2.5 13.5h11", l: "M2.5 2.5v11", r: "M13.5 2.5v11" } as const;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
      <rect x="2.5" y="2.5" width="11" height="11" strokeWidth="1" strokeDasharray="1.2 1.6" opacity="0.55" />
      {(["t", "b", "l", "r"] as const).filter((s) => sides.includes(s)).map((s) => (
        <path key={s} d={solid[s]} strokeWidth="2" strokeLinecap="square" />
      ))}
    </svg>
  );
}

// A number the teacher can type (Enter or leaving the field applies it) or step with the arrow keys.
function NumberField({ label, value, min, max, step, decimals = 0, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; decimals?: number; unit?: string; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const round = (n: number) => Math.max(min, Math.min(Number(n.toFixed(decimals)), max));
  const apply = (n: number) => {
    setDraft(null);
    if (Number.isFinite(n)) onChange(round(n));
  };
  return (
    <label className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-[12.5px] text-ink">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="text"
          inputMode="decimal"
          value={draft ?? value.toFixed(decimals)}
          aria-label={label}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== null && apply(Number(draft.replace(",", ".")))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft !== null) apply(Number(draft.replace(",", ".")));
            else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              apply(value + (e.key === "ArrowUp" ? step : -step));
            }
          }}
          className="h-7 w-14 rounded-md border border-line bg-white px-1.5 text-end text-[12.5px] tabular-nums outline-none focus:border-indigo-400"
        />
        <span className="w-4 text-[11px] text-faint">{unit}</span>
      </span>
    </label>
  );
}

// The sample of a numbering style: "1. 2. 3.", "a) b) c)"…
const sample = (kind: ListKind) =>
  [1, 2, 3]
    .map((n) => markerText(kind, n, 0, kind === "arabic-alpha"))
    .join("  ");

// Bullets and numbering: the icon switches the list on and off (with the style used last), the arrow lists the styles.
function ListMenu({ t, para, kinds, icon, title, shortcut }: { t: T; para: ParagraphTarget; kinds: ListKind[]; icon: ReactNode; title: string; shortcut?: string }) {
  const [last, setLast] = useState<ListKind>(kinds[0]);
  const active = para.list && kinds.includes(para.list);
  const bullets = isBulletKind(kinds[0]);
  const pick = (kind: ListKind | null) => {
    if (kind) setLast(kind);
    para.setList(kind);
  };
  return (
    <MenuButton title={title} shortcut={shortcut} icon={icon} pressed={!!active} disabled={!para.can.list} onMain={() => pick(active ? null : last)} width={bullets ? 190 : 200}>
      {(close) => (
        <Menu label={title}>
          <MenuHeading>{bullets ? t("Bullet styles") : t("Numbering styles")}</MenuHeading>
          {kinds.map((kind) => (
            <MenuItem
              key={kind}
              label={bullets ? t(BULLET_NAMES[kind]) : sample(kind)}
              icon={bullets ? <span className="text-[15px] leading-none">{markerText(kind, 1)}</span> : undefined}
              checked={para.list === kind}
              onSelect={() => {
                pick(para.list === kind ? null : kind);
                close();
              }}
            />
          ))}
          <MenuSeparator />
          <MenuItem
            label={t("None")}
            disabled={!active}
            onSelect={() => {
              pick(null);
              close();
            }}
          />
        </Menu>
      )}
    </MenuButton>
  );
}

const fmt = (v: number) => v.toFixed(v === 1.15 ? 2 : 1);

// Line spacing (times the normal line) and the space before and after a paragraph.
function SpacingMenu({ t, para }: { t: T; para: ParagraphTarget }) {
  const near = (a: number, b: number) => Math.abs(a - b) < 0.005;
  return (
    <MenuButton title={t("Line and paragraph spacing")} icon={<ListChevronsUpDown size={16} />} disabled={!para.can.line} width={236}>
      {(close) => (
        <div className="flex flex-col">
          <MenuHeading>{t("Line spacing")}</MenuHeading>
          <Menu label={t("Line spacing")}>
            {LINE_STEPS.map((v) => (
              <MenuItem
                key={v}
                label={fmt(v)}
                checked={near(para.lineHeight, v)}
                onSelect={() => {
                  para.setLineHeight(v === 1 ? null : v);
                  close();
                }}
              />
            ))}
          </Menu>
          <NumberField label={t("Custom")} value={para.lineHeight} min={MIN_LINE} max={MAX_LINE} step={0.05} decimals={2} onChange={(v) => para.setLineHeight(near(v, 1) ? null : v)} />
          <MenuSeparator />
          <MenuHeading>{t("Spacing between paragraphs")}</MenuHeading>
          {para.can.space ? (
            <>
              <NumberField label={t("Before")} value={para.spaceBefore} min={0} max={MAX_SPACE} step={2} unit="px" onChange={(v) => para.setSpace({ before: v })} />
              <NumberField label={t("After")} value={para.spaceAfter} min={0} max={MAX_SPACE} step={2} unit="px" onChange={(v) => para.setSpace({ after: v })} />
            </>
          ) : (
            <p className="px-2 pb-1.5 text-[11px] leading-snug text-faint">{t("The space between paragraphs is set in text boxes.")}</p>
          )}
        </div>
      )}
    </MenuButton>
  );
}

// Lines around the paragraph, on the sides the teacher picks, in a color.
function BordersMenu({ t, para }: { t: T; para: ParagraphTarget }) {
  const sides = para.border ?? "";
  const set = (next: string) => para.setBorder(next, para.borderColor);
  const toggle = (side: string) => set(sides.includes(side) ? sides.replace(side, "") : sides + side);
  const items: { side: string; label: string }[] = [
    { side: "b", label: "Bottom border" },
    { side: "t", label: "Top border" },
    { side: "l", label: "Left border" },
    { side: "r", label: "Right border" },
  ];
  return (
    <MenuButton title={t("Borders")} icon={<SideIcon sides={sides || "b"} />} pressed={!!sides} disabled={!para.can.border} width={210}>
      {(close) => (
        <div className="flex flex-col">
          <Menu label={t("Borders")}>
            {items.map(({ side, label }) => (
              <MenuItem key={side} label={t(label)} icon={<SideIcon sides={side} size={14} />} checked={sides.includes(side) ? true : undefined} onSelect={() => toggle(side)} />
            ))}
            <MenuSeparator />
            <MenuItem
              label={t("All borders")}
              icon={<SideIcon sides="tblr" size={14} />}
              onSelect={() => {
                set("tblr");
                close();
              }}
            />
            <MenuItem
              label={t("No border")}
              disabled={!sides}
              onSelect={() => {
                set("");
                close();
              }}
            />
          </Menu>
          <MenuSeparator />
          <MenuHeading>{t("Border color")}</MenuHeading>
          <div className="px-1.5 pb-1.5">
            <ColorGrid value={para.borderColor} autoLabel={t("Auto")} colors={TEXT_COLORS} onChange={(c) => para.setBorder(sides || "tblr", c)} />
          </div>
        </div>
      )}
    </MenuButton>
  );
}

const ALIGNS = [
  { value: "left", label: "Align left", Icon: AlignLeft },
  { value: "center", label: "Center", Icon: AlignCenter },
  { value: "right", label: "Align right", Icon: AlignRight },
  { value: "justify", label: "Justify", Icon: AlignJustify },
] as const;

// What a block that is not a text cannot do says why.
const only = (t: T, title: string, ok: boolean) => (ok ? title : `${title} — ${t("For texts and text boxes")}`);

// Lists, indent, order, alignment, direction, spacing, shading and borders: the "Paragraph" group of the Word ribbon.
export default function ParagraphGroup({ ctx, para }: { ctx: Ctx; para: ParagraphTarget }) {
  const { t } = ctx;
  const { can } = para;
  const showMarks = useShowMarks();
  return (
    <RibbonGroup title={t("Paragraph")}>
      <RibbonRow>
        <ListMenu t={t} para={para} kinds={BULLET_KINDS} icon={<List size={16} />} title={only(t, t("Bullets"), can.list)} />
        <ListMenu t={t} para={para} kinds={NUMBER_KINDS} icon={<ListOrdered size={16} />} title={only(t, t("Numbering"), can.list)} />
        <RibbonButton title={only(t, t("Multilevel list"), can.list)} icon={<ListTree size={16} />} pressed={para.list === "multi"} disabled={!can.list} onClick={() => para.setList(para.list === "multi" ? null : "multi")} />
        <Divider />
        <RibbonButton title={t("Decrease indent")} shortcut="Ctrl+Shift+M" icon={<IndentDecrease size={16} className="rtl:-scale-x-100" />} disabled={!can.indent || !para.indent.out} onClick={() => para.shiftIndent(-1)} />
        <RibbonButton title={t("Increase indent")} shortcut="Ctrl+M" icon={<IndentIncrease size={16} className="rtl:-scale-x-100" />} disabled={!can.indent || !para.indent.in} onClick={() => para.shiftIndent(1)} />
        <Divider />
        <MenuButton title={only(t, t("Sort"), can.sort)} icon={<ArrowDownAZ size={16} />} disabled={!can.sort}>
          {(close) => (
            <Menu label={t("Sort")}>
              <MenuItem
                label={t("Sort A to Z")}
                icon={<ArrowDownAZ size={15} />}
                onSelect={() => {
                  para.sort("asc");
                  close();
                }}
              />
              <MenuItem
                label={t("Sort Z to A")}
                icon={<ArrowDownZA size={15} />}
                onSelect={() => {
                  para.sort("desc");
                  close();
                }}
              />
            </Menu>
          )}
        </MenuButton>
      </RibbonRow>

      <RibbonRow>
        {ALIGNS.map(({ value, label, Icon }) => (
          <RibbonButton key={value} title={only(t, t(label), can.align)} icon={<Icon size={15} />} pressed={para.align === value} disabled={!can.align} onClick={() => para.setAlign(para.align === value ? undefined : value)} />
        ))}
        <Divider />
        <RibbonButton title={only(t, t("Left-to-right"), can.dir)} icon={<PilcrowRight size={16} />} pressed={para.dirShown === "ltr"} disabled={!can.dir} onClick={() => para.setDirection(para.dir === "ltr" ? null : "ltr")} />
        <RibbonButton title={only(t, t("Right-to-left"), can.dir)} icon={<PilcrowLeft size={16} />} pressed={para.dirShown === "rtl"} disabled={!can.dir} onClick={() => para.setDirection(para.dir === "rtl" ? null : "rtl")} />
        <Divider />
        <SpacingMenu t={t} para={para} />
      </RibbonRow>

      <RibbonRow>
        <ColorMenu
          title={only(t, t("Shading"), can.shading)}
          icon={<PaintBucket size={15} />}
          value={para.shading}
          initial="#fef08a"
          autoLabel={t("No color")}
          colors={FILL_COLORS}
          disabled={!can.shading}
          toggle
          onChange={(c) => para.setShading(c ?? null)}
        />
        <BordersMenu t={t} para={para} />
        <Divider />
        <RibbonButton title={t("Show formatting marks")} icon={<Pilcrow size={16} />} pressed={showMarks} onClick={formattingMarks.toggle} />
      </RibbonRow>
    </RibbonGroup>
  );
}
