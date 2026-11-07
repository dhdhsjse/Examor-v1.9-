"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { formatMark, snapMark } from "@/app/_lib/sheet/marks";
import { MAX_RECENT, readRecentMarks, remembered, writeRecentMarks } from "@/app/_lib/sheet/stickers";
import { DRAG_MIME, type ToolAction } from "@/app/_lib/tools";
import { useT } from "@/app/_lib/uiLang";
import { inputCls } from "../inspector/fields";

// The marks most often written in a barème (any other is typed in the box under them, or in the sticker's properties)
export const COMMON_MARKS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 0.125];

const number = (value: number): ToolAction => ({ kind: "block", type: "mark", preset: { kind: "number", value } });
const words = (text: string, color?: string): ToolAction => ({ kind: "block", type: "mark", preset: { kind: "text", text, ...(color ? { color } : {}) } });
// (one line: thin between rows; its properties make it thick, between exercises, or hidden)
const line: ToolAction = { kind: "block", type: "rule", preset: { line: "row" } };

const same = (a: ToolAction | null, b: ToolAction) => !!a && JSON.stringify(a) === JSON.stringify(b);

// The stickers of the correction sheet, in the left toolbox: the marks (the usual ones, then the ones typed lately, any other typed in the box), ✓
// and ✗, and the line that cuts the rows (the total of each row is made with the sheet: see generate.ts stickersFor). One is chosen, then each click on the page puts it there (the Stamp tool stays in hand:
// a barème is many marks); it can also be dragged onto the page. A sticker on the page can be clicked even then, to move it or delete it.
export default function StickerPanel({ stamp, onPick, pad }: {
  stamp: ToolAction | null;
  onPick: (action: ToolAction | null) => void;
  pad: boolean;
}) {
  const t = useT();
  const [typed, setTyped] = useState("");
  const [adding, setAdding] = useState(false);
  const [recent, setRecent] = useState<number[]>(readRecentMarks);

  const chip = (action: ToolAction, label: string, title: string, opts: { disabled?: boolean; onPick?: () => void } = {}) => {
    const on = !opts.disabled && same(stamp, action);
    return (
      <button
        key={title + label}
        type="button"
        title={title}
        aria-pressed={on}
        data-sticker={label}
        draggable={!opts.disabled}
        disabled={opts.disabled}
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_MIME, JSON.stringify(action));
          e.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => {
          opts.onPick?.();
          onPick(on ? null : action);
        }}
        className={`h-7 min-w-0 truncate rounded-[5px] px-1.5 text-xs font-medium tabular-nums transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40 ${
          on ? "bg-emerald-600 text-white" : "bg-subtle text-ink hover:bg-hover disabled:hover:bg-subtle"
        }`}
      >
        {label}
      </button>
    );
  };

  // a mark picked from outside the usual ones is kept for next time (it joins the grid)
  const remember = (v: number) => {
    if (COMMON_MARKS.includes(v)) return;
    const next = remembered(recent, v, MAX_RECENT);
    setRecent(next);
    writeRecentMarks(next);
  };
  const pickTyped = () => {
    const v = Number(typed.replace(",", "."));
    if (typed.trim() === "" || !Number.isFinite(v) || v <= 0) return;
    const mark = snapMark(v);
    onPick(number(mark));
    remember(mark);
    setTyped("");
    setAdding(false);
  };
  // a typed mark is taken off the grid (and put down, if it was in hand)
  const forget = (v: number) => {
    const next = recent.filter((r) => r !== v);
    setRecent(next);
    writeRecentMarks(next);
    if (same(stamp, number(v))) onPick(null);
  };
  const lately = recent.filter((v) => !COMMON_MARKS.includes(v));
  const markChip = (v: number) => chip(number(v), formatMark(v, pad), formatMark(v, pad), { onPick: () => remember(v) });
  // (a typed mark has a tiny × in its corner, seen on hover)
  const typedChip = (v: number) => (
    <div key={`typed-${v}`} className="group relative grid">
      {markChip(v)}
      <button
        type="button"
        aria-label={`${t("Remove")} ${formatMark(v, pad)}`}
        title={t("Remove")}
        data-testid="sticker-forget"
        onClick={() => forget(v)}
        className="absolute -top-1 -right-1 grid size-3.5 place-items-center rounded-full bg-ink text-[9px] leading-none text-surface opacity-0 shadow-sm outline-none transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent [@media(hover:none)]:opacity-100"
      >
        <X size={8} strokeWidth={3} aria-hidden />
      </button>
    </div>
  );

  // (the last chip, +, becomes a box to type another mark in: Enter takes it, Escape or leaving the box gives up)
  const other = adding ? (
    <input
      key="typed"
      type="text"
      inputMode="decimal"
      autoFocus
      value={typed}
      placeholder={t("Other mark")}
      aria-label={t("Another mark")}
      data-testid="sticker-typed"
      onChange={(e) => setTyped(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") pickTyped();
        if (e.key === "Escape") {
          e.stopPropagation();
          setTyped("");
          setAdding(false);
        }
      }}
      onBlur={() => {
        setTyped("");
        setAdding(false);
      }}
      className={`${inputCls} col-span-2 h-7 min-w-0 px-1.5`}
    />
  ) : (
    <button
      key="add"
      type="button"
      title={t("Other mark")}
      aria-label={t("Other mark")}
      data-testid="sticker-add"
      onClick={() => setAdding(true)}
      className="grid h-7 place-items-center rounded-[5px] border border-dashed border-line text-muted outline-none hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Plus size={14} strokeWidth={2} aria-hidden />
    </button>
  );

  return (
    <section aria-label={t("Stickers")} className="rounded-[6px] border border-line" data-testid="sticker-panel">
      <h3 className="flex h-7 items-center px-2 text-xs font-semibold text-ink">{t("Stickers")}</h3>
      <div className="flex flex-col gap-1.5 px-1.5 pb-1.5">
        <div className="grid grid-cols-4 gap-1" role="group" aria-label={t("Marks")} data-testid="sticker-recent">
          {COMMON_MARKS.map(markChip)}
          {lately.map(typedChip)}
          {other}
        </div>
        <div className="h-px bg-line" />
        <div className="grid grid-cols-3 gap-1">
          {chip(line, "―", t("Line"))}
          {chip(words("✓", "#15803d"), "✓", "✓")}
          {chip(words("✗", "#b91c1c"), "✗", "✗")}
        </div>
      </div>
    </section>
  );
}
