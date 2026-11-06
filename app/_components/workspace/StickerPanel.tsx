"use client";

import { useEffect, useState } from "react";
import { MARK_STEP, formatMark, snapMark } from "@/app/_lib/sheet/marks";
import { MAX_RECENT, readRecentMarks, remembered, writeRecentMarks } from "@/app/_lib/sheet/stickers";
import { DRAG_MIME, type ToolAction } from "@/app/_lib/tools";
import type { RuleLine } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";

// The marks most often written in a barème (any other is typed in the box under them, or in the sticker's properties)
export const COMMON_MARKS = [0.125, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5];
const RULES: { line: RuleLine; label: string }[] = [
  { line: "row", label: "Line between rows" },
  { line: "exercise", label: "Line between exercises" },
  { line: "hidden", label: "Invisible break" },
];

const number = (value: number): ToolAction => ({ kind: "block", type: "mark", preset: { kind: "number", value } });
const total: ToolAction = { kind: "block", type: "mark", preset: { kind: "total" } };
const words = (text: string, color?: string, width?: number): ToolAction => ({ kind: "block", type: "mark", preset: { kind: "text", text, ...(color ? { color } : {}), ...(width ? { width } : {}) } });
// The Text box button is the Text box tool of Insert (draw the box on the page); dragged onto the page it makes a box of the usual size
const textboxDrag: ToolAction = { kind: "block", type: "textbox" };
const line = (l: RuleLine): ToolAction => ({ kind: "block", type: "rule", preset: { line: l } });

const same = (a: ToolAction | null, b: ToolAction) => !!a && JSON.stringify(a) === JSON.stringify(b);

type Chip = "normal" | "wide";

// The stickers of the correction sheet, in the left toolbox: the marks (the usual ones, the ones typed lately, any other typed in), the signs between
// them, the total of a row, and the lines that cut the rows. One is chosen, then
// each click on the page puts it there (the Stamp tool stays in hand: a barème is many marks); it can also be dragged onto the page.
export default function StickerPanel({ stamp, onPick, pad, onPad, totalOn, textboxOn, onTextbox }: {
  stamp: ToolAction | null;
  onPick: (action: ToolAction | null) => void;
  pad: boolean;
  onPad: (pad: boolean) => void;
  totalOn: boolean;
  textboxOn: boolean; // the Text box tool is in hand
  onTextbox: () => void; // take it in hand, or put it down
}) {
  const t = useT();
  const [typed, setTyped] = useState("");
  const [recent, setRecent] = useState<number[]>(readRecentMarks);

  // (no total sticker without a column for the totals: one that was in hand is put down)
  useEffect(() => {
    if (!totalOn && same(stamp, total)) onPick(null);
  }, [totalOn, stamp, onPick]);

  // (`tool`: a button that does not put a sticker in hand but starts a tool of the editor)
  const chip = (action: ToolAction, label: string, title: string, variant: Chip = "normal", disabled = false, tool?: { on: boolean; run: () => void }) => {
    const on = tool ? tool.on : !disabled && same(stamp, action);
    return (
      <button
        key={title + label}
        type="button"
        title={title}
        aria-pressed={on}
        data-sticker={label}
        draggable={!disabled}
        disabled={disabled}
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_MIME, JSON.stringify(action));
          e.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => (tool ? tool.run() : onPick(on ? null : action))}
        className={`h-9 min-w-0 rounded-xl px-2 text-[13px] font-medium tracking-[-0.01em] tabular-nums transition-[transform,background-color,box-shadow] duration-100 ease-out outline-none select-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 disabled:hover:bg-subtle ${variant === "wide" ? "col-span-2" : ""} ${
          on ? "bg-emerald-600 text-white shadow-[0_1px_2px_rgba(5,150,105,0.35)]" : "bg-subtle text-ink hover:bg-hover"}`}
      >
        {label}
      </button>
    );
  };
  const hint = (label: string) => t("{label} — click, then click on the page (or drag it there)", { label });
  const heading = (text: string) => <h3 className="mt-5 mb-2 px-1 text-xs font-semibold tracking-[0.04em] text-muted uppercase first:mt-0">{text}</h3>;

  const typedMark = snapMark(Number(typed));
  const typedOk = typed.trim() !== "" && Number.isFinite(Number(typed)) && Number(typed) > 0;
  // a mark picked from outside the usual ones is kept for next time
  const remember = (v: number) => {
    if (COMMON_MARKS.includes(v)) return;
    const next = remembered(recent, v, MAX_RECENT);
    setRecent(next);
    writeRecentMarks(next);
  };
  const pickTyped = () => {
    if (!typedOk) return;
    onPick(number(typedMark));
    remember(typedMark);
  };
  const lately = recent.filter((v) => !COMMON_MARKS.includes(v));

  return (
    <div className="flex flex-col" data-testid="sticker-panel">
      {heading(t("Marks"))}
      <div className="grid grid-cols-4 gap-1.5">{COMMON_MARKS.map((v) => chip(number(v), formatMark(v, pad), hint(formatMark(v, pad))))}</div>
      <div className="mt-2 flex gap-1.5">
        <input
          type="number"
          min={MARK_STEP}
          step={MARK_STEP}
          value={typed}
          placeholder={t("Another mark")}
          aria-label={t("Another mark")}
          data-testid="sticker-typed"
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") pickTyped();
          }}
          className="h-9 min-w-0 flex-1 rounded-xl border border-transparent bg-subtle px-3 text-[13px] tracking-[-0.01em] text-ink transition-colors duration-150 outline-none placeholder:text-faint hover:border-line focus:border-accent focus:bg-white"
        />
        <button
          type="button"
          data-testid="sticker-typed-go"
          disabled={!typedOk}
          onClick={pickTyped}
          className="h-9 min-w-11 rounded-xl bg-emerald-600 px-3 text-[13px] font-semibold text-white tabular-nums shadow-[0_1px_2px_rgba(5,150,105,0.35)] transition-[transform,background-color] duration-100 ease-out outline-none hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.96] disabled:opacity-40 disabled:shadow-none disabled:active:scale-100"
        >
          {typedOk ? formatMark(typedMark, pad) : "—"}
        </button>
      </div>
      <label className="mt-3 flex cursor-pointer items-center gap-2.5 px-1 text-xs leading-tight tracking-[-0.01em] text-ink select-none">
        <input type="checkbox" data-testid="sheet-pad" checked={pad} onChange={(e) => onPad(e.target.checked)} className="size-4 shrink-0 accent-accent" />
        <span>{t("Write whole marks with a zero: 01, 02")}</span>
      </label>
      {lately.length > 0 && (
        <div data-testid="sticker-recent">
          {heading(t("Recent"))}
          <div className="grid grid-cols-4 gap-1.5">
            {lately.map((v) => (
              <span key={v} className="contents" onClickCapture={() => remember(v)}>
                {chip(number(v), formatMark(v, pad), hint(formatMark(v, pad)))}
              </span>
            ))}
          </div>
        </div>
      )}

      {heading(t("Total of a row"))}
      <div className="grid grid-cols-4 gap-1.5">{chip(total, `Σ ${t("Total")}`, totalOn ? hint(t("Total")) : t("Turn on the column of the totals to use this."), "wide", !totalOn)}</div>

      {heading(t("Other"))}
      <div className="grid grid-cols-4 gap-1.5">
        {chip(words("✓", "#15803d"), "✓", hint("✓"))}
        {chip(words("✗", "#b91c1c"), "✗", hint("✗"))}
        {chip(textboxDrag, t("Text box"), hint(t("Text box")), "wide", false, { on: textboxOn, run: onTextbox })}
      </div>

      {heading(t("Row lines"))}
      <div className="flex flex-col gap-1.5">{RULES.map((r) => chip(line(r.line), t(r.label), hint(t(r.label))))}</div>
    </div>
  );
}
