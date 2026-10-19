"use client";

import {
  AArrowDown,
  AArrowUp,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  ChevronDown,
  IndentDecrease,
  IndentIncrease,
  FoldVertical,
  Italic,
  Strikethrough,
  Underline,
} from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ColorGrid, FontSelect } from "@/app/_components/rich/FormatBar";
import type { Ctx } from "@/app/_features/core/types";
import type { T } from "@/app/_lib/uiLang";
import type { Block, TextboxBlock } from "@/app/_lib/types";
import { setFont, type FormatTarget, type StyleKey } from "./formatTarget";

// The Word-ribbon controls of Home → Formatting and of the text box panel. Font, size, style, color and
// alignment format a FormatTarget (formatTarget.ts): the selected words of a text box being typed in, else
// the whole block. Line spacing and the place in the box are always the whole block's.

const LINE_SPACINGS = [1, 1.15, 1.5, 2];
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72]; // as in Word
const MIN_SIZE = 8;
const MAX_SIZE = 72;

const frame = (on: boolean) =>
  `rounded-md border transition-colors disabled:opacity-35 ${on ? "border-indigo-500 bg-indigo-50 text-accent" : "border-line bg-white text-ink hover:border-indigo-300"}`;
export const toggleCls = (on: boolean) => `grid h-8 flex-1 place-items-center ${frame(on)}`; // shares the row's width
const squareCls = `grid size-8 flex-none place-items-center ${frame(false)}`;
export const selectCls = "w-full rounded-md border border-line bg-white px-2 py-1.5 text-[13px] text-ink outline-none focus:border-indigo-400";

// A titled part of the panel, like a group of the Word ribbon.
export function RibbonGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-lg border border-line p-3">
      <h3 className="text-[11px] font-semibold tracking-wide text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

// A small dropdown under a control: closes on a click elsewhere, or on Escape (which then goes no further,
// so the block stays selected, see Editor's shortcuts). Spread `props` on the element around both.
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || !open) return;
    e.stopPropagation();
    setOpen(false);
  };
  return { open, setOpen, props: { ref, onKeyDown } };
}

// The font (`defaultLabel`: what "no font of its own" shows, e.g. the exam's font).
export function FontFamily({ t, target, defaultLabel }: { t: T; target: FormatTarget; defaultLabel: string }) {
  return (
    <div className="min-w-0" title={t("Font")}>
      <FontSelect value={target.family} onChange={target.setFamily} defaultLabel={defaultLabel} className={selectCls} />
    </div>
  );
}

// Word's size box: type a size (Enter or leaving the box applies it; arrow keys change it by 1), pick one
// of the usual sizes from its list, or grow / shrink to the next usual size.
export function FontSize({ t, target }: { t: T; target: FormatTarget }) {
  const size = target.size;
  const [draft, setDraft] = useState<string | null>(null);
  const menu = usePopover();
  const set = (v: number) => {
    setDraft(null);
    if (Number.isFinite(v) && v > 0) target.setSize(Math.max(MIN_SIZE, Math.min(Math.round(v), MAX_SIZE)));
  };
  const next = (up: boolean) => (up ? FONT_SIZES.find((s) => s > size) ?? MAX_SIZE : [...FONT_SIZES].reverse().find((s) => s < size) ?? MIN_SIZE);
  return (
    <div className="flex flex-none items-center gap-1">
      <div {...menu.props} className="relative flex h-8 items-center rounded-md border border-line bg-white focus-within:border-indigo-400">
        <input
          type="text"
          inputMode="numeric"
          value={draft ?? String(size)}
          title={t("Font size")}
          aria-label={t("Font size")}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== null && set(Number(draft.replace(",", ".")))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft !== null) set(Number(draft.replace(",", ".")));
            else if (e.key === "Escape") setDraft(null);
            else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              set(size + (e.key === "ArrowUp" ? 1 : -1));
            }
          }}
          className="h-full w-9 rounded-s-md bg-transparent text-center text-[13px] text-ink tabular-nums outline-none"
        />
        <button type="button" tabIndex={-1} aria-label={t("Font size")} aria-haspopup="listbox" aria-expanded={menu.open} onClick={() => menu.setOpen(!menu.open)} className="grid h-full w-5 place-items-center rounded-e-md text-muted hover:bg-subtle">
          <ChevronDown size={12} />
        </button>
        {menu.open && (
          <ul role="listbox" aria-label={t("Font size")} className="absolute start-0 top-full z-20 mt-1 max-h-56 w-16 overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-lg">
            {FONT_SIZES.map((s) => (
              <li key={s} role="option" aria-selected={s === size}>
                <button
                  type="button"
                  onClick={() => {
                    set(s);
                    menu.setOpen(false);
                  }}
                  className={`w-full px-2 py-1 text-center text-[13px] tabular-nums hover:bg-subtle ${s === size ? "font-semibold text-accent" : "text-ink"}`}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="button" title={t("Bigger")} aria-label={t("Bigger")} disabled={size >= MAX_SIZE} onClick={() => set(next(true))} className={squareCls}>
        <AArrowUp size={15} />
      </button>
      <button type="button" title={t("Smaller")} aria-label={t("Smaller")} disabled={size <= MIN_SIZE} onClick={() => set(next(false))} className={squareCls}>
        <AArrowDown size={15} />
      </button>
    </div>
  );
}

// Bold, italic, underline, strikethrough.
export function StyleToggles({ t, target }: { t: T; target: FormatTarget }) {
  const items: { key: StyleKey; label: string; Icon: typeof Bold }[] = [
    { key: "bold", label: t("Bold"), Icon: Bold },
    { key: "italic", label: t("Italic"), Icon: Italic },
    { key: "underline", label: t("Underline"), Icon: Underline },
    { key: "strike", label: t("Strikethrough"), Icon: Strikethrough },
  ];
  return (
    <div className="flex flex-1 gap-1" role="group" aria-label={t("Text style")}>
      {items.map(({ key, label, Icon }) => (
        <button key={key} type="button" aria-pressed={target.style[key]} title={label} aria-label={label} onClick={() => target.toggle(key)} className={toggleCls(target.style[key])}>
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}

// A button showing a color under an icon; it opens the swatches below it (Word's "Font color" button).
export function ColorButton({ title, icon, value, shown, autoLabel, colors, onChange }: {
  title: string;
  icon: ReactNode;
  value: string | undefined; // undefined = automatic
  shown: string; // what the bar under the icon shows
  autoLabel: string;
  colors?: string[];
  onChange: (color: string | undefined) => void;
}) {
  const { open, setOpen, props } = usePopover();
  return (
    <div {...props} className="relative">
      <button type="button" title={title} aria-label={title} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)} className={`flex h-8 flex-none items-center gap-0.5 px-1.5 ${frame(open)}`}>
        <span className="flex flex-col items-center leading-none">
          {icon}
          <span className="mt-0.5 h-1 w-4 rounded-full ring-1 ring-black/10" style={{ background: shown }} />
        </span>
        <ChevronDown size={12} className="text-muted" />
      </button>
      {open && (
        <div className="absolute end-0 top-full z-20 mt-1 w-[204px] rounded-lg border border-line bg-white p-2 shadow-lg">
          <ColorGrid
            value={value}
            autoLabel={autoLabel}
            colors={colors}
            onChange={(c) => {
              onChange(c);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

// Left / center / right / justify (texts and text boxes only), then for text boxes decrease / increase
// indent, like Word. While typing in a text box: its paragraphs with the cursor or the selection.
export function AlignButtons({ t, target }: { t: T; target: FormatTarget }) {
  const options = [
    { value: "left", label: "Align left", Icon: AlignLeft },
    { value: "center", label: "Center", Icon: AlignCenter },
    { value: "right", label: "Align right", Icon: AlignRight },
    { value: "justify", label: "Justify", Icon: AlignJustify },
  ] as const;
  return (
    <>
      <div className="flex gap-1.5" role="group" aria-label={t("Alignment")}>
        {options.map(({ value, label, Icon }) => (
          <button key={value} type="button" disabled={!target.canAlign} aria-pressed={target.align === value} title={t(label)} aria-label={t(label)} onClick={() => target.setAlign(target.align === value ? undefined : value)} className={toggleCls(target.align === value)}>
            <Icon size={15} />
          </button>
        ))}
        {target.indent && (
          <>
            <span className="mx-0.5 w-px self-stretch bg-line" aria-hidden />
            <button type="button" disabled={!target.indent.out} title={`${t("Decrease indent")} (Ctrl+Shift+M)`} aria-label={t("Decrease indent")} onClick={() => target.shiftIndent(-1)} className={toggleCls(false)}>
              <IndentDecrease size={15} />
            </button>
            <button type="button" disabled={!target.indent.in} title={`${t("Increase indent")} (Ctrl+M)`} aria-label={t("Increase indent")} onClick={() => target.shiftIndent(1)} className={toggleCls(false)}>
              <IndentIncrease size={15} />
            </button>
          </>
        )}
      </div>
      {!target.canAlign && <p className="text-[10px] leading-snug text-faint">{t("Alignment is for texts and text boxes.")}</p>}
    </>
  );
}

// Line spacing, times the normal one.
export function LineSpacing({ ctx, b }: { ctx: Ctx; b: Block }) {
  const lineHeight = b.font?.lineHeight ?? 1;
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-muted">{ctx.t("Line spacing")}</span>
      <select value={String(lineHeight)} onChange={(e) => setFont(ctx, b, { lineHeight: Number(e.target.value) === 1 ? undefined : Number(e.target.value) }, "line-height")} className={`${selectCls} w-24`}>
        {/* A spacing set elsewhere that is not in the list still shows */}
        {[...new Set([...LINE_SPACINGS, lineHeight])].sort((x, y) => x - y).map((v) => (
          <option key={v} value={String(v)}>
            {v.toFixed(v === 1.15 ? 2 : 1)}
          </option>
        ))}
      </select>
    </label>
  );
}

// Where the text sits in a text box.
export function VerticalAlign({ ctx, b }: { ctx: Ctx; b: TextboxBlock }) {
  const v = b.valign ?? "top";
  const options = [
    { value: "top", label: "Top", Icon: ArrowUpToLine },
    { value: "middle", label: "Middle", Icon: FoldVertical },
    { value: "bottom", label: "Bottom", Icon: ArrowDownToLine },
  ] as const;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-muted">{ctx.t("In the box")}</span>
      <div className="flex gap-1.5" role="group" aria-label={ctx.t("In the box")}>
        {options.map(({ value, label, Icon }) => (
          <button key={value} type="button" aria-pressed={v === value} title={ctx.t(label)} aria-label={ctx.t(label)} onClick={() => ctx.shell.updateBlock(b.id, { valign: value }, "valign")} className={toggleCls(v === value)}>
            <Icon size={15} />
          </button>
        ))}
      </div>
    </div>
  );
}
