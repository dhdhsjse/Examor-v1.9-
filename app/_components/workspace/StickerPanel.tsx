"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { formatMark } from "@/app/_lib/sheet/marks";
import { COMMON_MARKS, SIGNS, parseSticker, readAddedStickers, withSticker, withoutSticker, writeAddedStickers, type LibrarySticker } from "@/app/_lib/sheet/stickers";
import { DRAG_MIME, type ToolAction } from "@/app/_lib/tools";
import { useT } from "@/app/_lib/uiLang";
import { inputCls } from "../inspector/fields";

// (the signs keep their colors: ✓ green, ✗ red; other words are written in the ink of the sheet)
const WORD_COLORS: Record<string, string> = { "✓": "#15803d", "✗": "#b91c1c" };

const actionOf = (s: LibrarySticker): ToolAction =>
  typeof s === "number"
    ? { kind: "block", type: "mark", preset: { kind: "number", value: s } }
    : { kind: "block", type: "mark", preset: { kind: "text", text: s, ...(WORD_COLORS[s] ? { color: WORD_COLORS[s] } : {}) } };
// (one line: thin between rows; its properties make it thick, between exercises, or hidden)
const line: ToolAction = { kind: "block", type: "rule", preset: { line: "row" } };

const same = (a: ToolAction | null, b: ToolAction) => !!a && JSON.stringify(a) === JSON.stringify(b);

// The stickers of the correction sheet, in the left toolbox: the usual marks, then the marks and words the teacher added with + (each can be taken
// off again with its tiny ×; the usual ones stay), then the line that cuts the rows, ✓ and ✗ (the total of each row is made with the sheet: see generate.ts
// stickersFor). One is chosen, then each click on the page puts it there (the Stamp tool stays in hand: a barème is many marks); it can also be
// dragged onto the page. A sticker on the page can be clicked even then, to move it or delete it.
export default function StickerPanel({ stamp, onPick, pad }: {
  stamp: ToolAction | null;
  onPick: (action: ToolAction | null) => void;
  pad: boolean;
}) {
  const t = useT();
  const [typed, setTyped] = useState("");
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<LibrarySticker[]>(readAddedStickers);

  const save = (next: LibrarySticker[]) => {
    setAdded(next);
    writeAddedStickers(next);
  };

  const chip = (action: ToolAction, label: string, title: string) => {
    const on = same(stamp, action);
    return (
      <button
        key={title + label}
        type="button"
        title={title}
        aria-pressed={on}
        data-sticker={label}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_MIME, JSON.stringify(action));
          e.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => onPick(on ? null : action)}
        className={`h-7 w-full min-w-0 truncate rounded-[5px] px-1.5 text-xs font-medium tabular-nums transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-accent ${
          on ? "bg-emerald-600 text-white" : "bg-subtle text-ink hover:bg-hover"
        }`}
      >
        {label}
      </button>
    );
  };

  const labelOf = (s: LibrarySticker) => (typeof s === "number" ? formatMark(s, pad) : s);
  const fixedChip = (s: LibrarySticker) => chip(actionOf(s), labelOf(s), labelOf(s));
  // a sticker the teacher added, with a tiny × in its corner (seen on hover; always on a touch screen) to take it off again
  const addedChip = (s: LibrarySticker) => {
    const label = labelOf(s);
    const remove = () => {
      save(withoutSticker(added, s));
      if (same(stamp, actionOf(s))) onPick(null); // (and put down, if it was in hand)
    };
    return (
      <div key={`${typeof s}-${s}`} className="group relative grid">
        {chip(actionOf(s), label, label)}
        <button
          type="button"
          aria-label={`${t("Remove")} ${label}`}
          title={t("Remove")}
          data-testid="sticker-remove"
          onClick={remove}
          className="absolute -top-0.5 -right-0.5 grid size-2.5 place-items-center rounded-full bg-ink text-surface opacity-0 shadow-sm outline-none transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent [@media(hover:none)]:opacity-100"
        >
          <X size={6} strokeWidth={3.5} aria-hidden />
        </button>
      </div>
    );
  };

  // what is typed joins the library (a mark, or a few words) and is taken in hand; one already there is just taken
  const addTyped = () => {
    const s = parseSticker(typed);
    if (s === null) return;
    save(withSticker(added, s));
    onPick(actionOf(s));
    setTyped("");
    setAdding(false);
  };
  const giveUp = () => {
    setTyped("");
    setAdding(false);
  };

  // (the last chip, +, becomes a box to type a mark or a word in: Enter adds it, Escape or leaving the box gives up)
  const add = adding ? (
    <input
      key="typed"
      type="text"
      autoFocus
      value={typed}
      maxLength={12}
      placeholder={t("Mark or word")}
      aria-label={t("Add a sticker")}
      data-testid="sticker-typed"
      onChange={(e) => setTyped(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation(); // (the keys are the box's, not the editor's shortcuts)
        if (e.key === "Enter") addTyped();
        if (e.key === "Escape") giveUp();
      }}
      onBlur={giveUp}
      className={`${inputCls} col-span-2 h-7 min-w-0 px-1.5`}
    />
  ) : (
    <button
      key="add"
      type="button"
      title={t("Add a sticker")}
      aria-label={t("Add a sticker")}
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
        <div className="grid grid-cols-4 gap-1" role="group" aria-label={t("Marks")} data-testid="sticker-library">
          {COMMON_MARKS.map(fixedChip)}
          {added.map(addedChip)}
          {add}
        </div>
        <div className="h-px bg-line" />
        <div className="grid grid-cols-3 gap-1">
          {chip(line, "―", t("Line"))}
          {SIGNS.map(fixedChip)}
        </div>
      </div>
    </section>
  );
}
