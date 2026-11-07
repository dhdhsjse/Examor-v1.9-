"use client";

import { Check, ChevronDown, Minus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode, type Ref } from "react";
import { useT } from "@/app/_lib/uiLang";
import InfoTip from "../InfoTip";
import RichEditable, { type RichHandle } from "../rich/RichEditable";

// Small form pieces used by every block editor. `dir="auto"` lets Arabic flow right-to-left.
// One grid for the whole panel (Figma-like):
//  · every control is 28px high (h-7) on a grey fill, a border on hover, the accent border on focus;
//  · labels are 12px muted: 4px above their control (Field), or at the start of a 28px row with the control at its end (Row, Toggle);
//  · the fields of an editor are 8px apart (the panel's stack); a group is set off by a hairline, 12px above and below it (Group).
// An explanation goes in an (i) tooltip next to its label (`hint`), not in a paragraph under the control.

// The label line of a field: its name, its (i), and an optional small action at the end (Shuffle, Make blank…).
function LabelLine({ label, hint, action }: { label: ReactNode; hint?: string; action?: ReactNode }) {
  const t = useT();
  return (
    <span className="flex min-h-5 items-center gap-1">
      <span className="min-w-0 truncate text-xs text-muted" title={typeof label === "string" ? label : undefined}>{label}</span>
      {hint && <InfoTip label={t("More info")} text={hint} />}
      {action && <span className="ms-auto flex shrink-0 items-center gap-0.5">{action}</span>}
    </span>
  );
}

// A label over its control. `group`: for a row of buttons (a <label> would press its first button when its text is clicked).
export function Field({ label, hint, action, children, group }: { label: string; hint?: string; action?: ReactNode; children: ReactNode; group?: boolean }) {
  // (with an action in its label line it is not a <label> either: the click on the action would reach the control too)
  const Tag = group || action ? "div" : "label";
  return (
    <Tag className="flex min-w-0 flex-col gap-1" role={group ? "group" : undefined} aria-label={group ? label : undefined}>
      <LabelLine label={label} hint={hint} action={action} />
      {children}
    </Tag>
  );
}

// A label at the start, its control at the end, 28px high (a stepper, a number, a switch, a small menu, icon buttons).
export function Row({ label, hint, children }: { label: ReactNode; hint?: string; children: ReactNode }) {
  const t = useT();
  return (
    <div className="flex min-h-7 items-center justify-between gap-2" role="group" aria-label={typeof label === "string" ? label : undefined}>
      <span className="flex min-w-0 items-center gap-1 text-xs leading-tight text-muted">
        {label}
        {hint && <InfoTip label={t("More info")} text={hint} />}
      </span>
      <div className="flex shrink-0 items-center gap-1">{children}</div>
    </div>
  );
}

// A group of settings inside an editor, set off from what is above it by a hairline (no card). `title`: a small heading, with its (i) and an action.
export function Group({ title, hint, action, label, children }: { title?: ReactNode; hint?: string; action?: ReactNode; label?: string; children: ReactNode }) {
  const t = useT();
  return (
    <section aria-label={label ?? (typeof title === "string" ? title : undefined)} className="mt-1 flex flex-col gap-2 border-t border-line pt-3">
      {(title || action) && (
        <div className="flex min-h-5 items-center gap-1">
          {title && <h3 className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-ink">{title}</h3>}
          {hint && <InfoTip label={t("More info")} text={hint} />}
          {action && <span className="ms-auto flex shrink-0 items-center gap-0.5">{action}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

// A small text button for the end of a label line or of a group's title (Shuffle, Reset, Make blank…).
export function TextAction({ children, onClick, title, onMouseDown, disabled }: { children: ReactNode; onClick: () => void; title?: string; onMouseDown?: (e: MouseEvent) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={onMouseDown}
      className="flex h-5 items-center gap-1 rounded-[4px] px-1 text-xs text-muted outline-none hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

// An on/off switch (a checkbox drawn as one).
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      aria-label={label}
      onChange={(e) => onChange(e.target.checked)}
      className="relative h-4 w-7 shrink-0 cursor-pointer appearance-none rounded-full bg-muted/40 transition-colors outline-none before:absolute before:top-0.5 before:left-0.5 before:size-3 before:rounded-full before:bg-[#fff] before:shadow-sm before:transition-transform before:content-[''] checked:bg-accent checked:before:translate-x-3 focus-visible:ring-2 focus-visible:ring-accent rtl:before:right-0.5 rtl:before:left-auto rtl:checked:before:-translate-x-3"
    />
  );
}

// An on/off setting: its label at the start, a switch at the end (the same 28px row as the others), its explanation in an (i).
export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: string }) {
  const t = useT();
  return (
    <label className="flex min-h-7 cursor-pointer items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-1 text-xs leading-tight text-muted">
        {label}
        {hint && <InfoTip label={t("More info")} text={hint} />}
      </span>
      <Switch checked={checked} onChange={onChange} />
    </label>
  );
}

// A compact dropdown: a button showing the current choice ("Français ▾") and a small list to pick
// another. Arrow keys move in the list, Escape closes it. `full`: as wide as its column.
export function MenuSelect<T extends string>({ value, options, onChange, label, full }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string; // what is being chosen, for screen readers
  full?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    // Start on the current choice.
    box.current?.querySelector<HTMLButtonElement>("[aria-selected=true]")?.focus();
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const pick = (v: T) => {
    setOpen(false);
    button.current?.focus();
    if (v !== value) onChange(v);
  };
  const onListKey = (e: KeyboardEvent) => {
    const rows = [...(box.current?.querySelectorAll<HTMLButtonElement>("[role=option]") ?? [])];
    const i = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      rows[(i + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length]?.focus();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    } else if (e.key === "Tab") setOpen(false);
  };

  return (
    <div ref={box} className={`relative min-w-0 ${full ? "w-full" : "max-w-full"}`}>
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label ?? ""}`}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`flex h-7 max-w-full items-center justify-between gap-1 rounded-[5px] border bg-subtle ps-2 pe-1 text-xs text-ink transition-colors hover:border-line focus-visible:border-accent focus-visible:outline-none ${full ? "w-full" : ""} ${open ? "border-accent" : "border-transparent"}`}
      >
        <span dir="auto" className="min-w-0 truncate">{current?.label}</span>
        <ChevronDown size={12} strokeWidth={2} className="shrink-0 text-muted" aria-hidden />
      </button>
      {open && (
        <div role="listbox" aria-label={label} onKeyDown={onListKey} className="absolute end-0 top-full z-30 mt-1 max-h-72 min-w-36 overflow-y-auto rounded-[5px] border border-line bg-surface p-1 text-ink shadow-md">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => pick(o.value)}
              className={`flex h-7 w-full items-center justify-between gap-3 rounded-[4px] px-2 text-start text-xs outline-none hover:bg-hover focus-visible:bg-hover ${o.value === value ? "font-semibold" : ""}`}
            >
              <span dir="auto">{o.label}</span>
              {o.value === value && <Check size={12} strokeWidth={2.5} aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// The look of every text box of the panel. 28px high on one line (20px line + 3px padding + 1px border, top and bottom). `min-w-0`: it
// shrinks in a row instead of pushing out of it; a long word breaks rather than running out of a rich box.
export const inputCls =
  "w-full min-w-0 rounded-[5px] border border-transparent bg-subtle px-2 py-[3px] text-xs leading-5 text-ink outline-none transition-colors [overflow-wrap:anywhere] placeholder:text-faint hover:border-line focus:border-accent focus:bg-white";

// (an input of a fixed width: the class without its w-full)
const boxCls = inputCls.replace("w-full ", "");

export function TextInput(props: { value: string; onChange: (v: string) => void; placeholder?: string; ariaLabel?: string; title?: string; className?: string }) {
  return (
    <input
      dir="auto"
      value={props.value}
      placeholder={props.placeholder}
      title={props.title}
      aria-label={props.ariaLabel}
      onChange={(e) => props.onChange(e.target.value)}
      className={`${boxCls} h-7 ${props.className ?? "w-full"}`}
    />
  );
}

export function TextArea({ value, onChange, rows, placeholder, ref }: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  ref?: Ref<HTMLTextAreaElement>;
}) {
  return (
    <textarea
      ref={ref}
      dir="auto"
      rows={rows ?? 3}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputCls} resize-y leading-snug`}
    />
  );
}

// A number box. `className`: its width (as wide as its column by default; w-16 in a row).
export function NumberInput(props: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; ariaLabel?: string; className?: string }) {
  return (
    <input
      type="number"
      value={props.value}
      min={props.min}
      max={props.max}
      step={props.step ?? 1}
      aria-label={props.ariaLabel}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (!Number.isNaN(v)) props.onChange(Math.min(props.max ?? Infinity, Math.max(props.min ?? -Infinity, v)));
      }}
      className={`${boxCls} h-7 tabular-nums ${props.className ?? "w-full"}`}
    />
  );
}

// Row of buttons where one is active. The labels share the width evenly; one too long for its button ends in "…" (the whole of it on hover).
export function Segmented<T extends string>(props: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex min-w-0 rounded-[5px] bg-subtle p-0.5">
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.label}
          onClick={() => props.onChange(o.value)}
          aria-pressed={o.value === props.value}
          className={`h-6 min-w-0 flex-1 truncate rounded-[4px] px-1.5 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            o.value === props.value ? "bg-white font-semibold text-ink ring-1 ring-line" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SmallButton({ children, onClick, danger, title, className }: { children: ReactNode; onClick: () => void; danger?: boolean; title?: string; className?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-7 min-w-0 items-center justify-center gap-1.5 rounded-[5px] px-2 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        danger ? "text-red-700 hover:bg-red-50" : "bg-subtle text-ink hover:bg-hover"
      } ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

// A square icon button of the panel (28px, no fill until hovered): a layer order, an alignment, a curve's options…
export const iconButtonCls =
  "grid size-7 shrink-0 place-items-center rounded-[5px] text-muted outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-35";

// Small "x" button to remove a row.
export function RemoveButton({ onClick, title = "Remove" }: { onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-label={title}
      className="grid size-7 shrink-0 place-items-center rounded-[5px] text-faint outline-none hover:bg-red-50 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-accent"
    >
      <X size={12} strokeWidth={2} aria-hidden />
    </button>
  );
}

export function AddRowButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-7 w-full items-center gap-1.5 rounded-[5px] px-2 text-xs text-muted outline-none hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Plus size={12} strokeWidth={2} aria-hidden /> {children}
    </button>
  );
}

// A text box that keeps the styled words (colors, fonts…) of the text. Same look as the inputs.
export function RichInput({ value, onChange, multiline, rows = 1, placeholder, ref }: {
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  ref?: Ref<RichHandle>;
}) {
  return (
    <RichEditable
      ref={ref}
      value={value}
      onChange={onChange}
      multiline={multiline}
      placeholder={placeholder}
      // (one line: 28px with its text centered, like the inputs; several: tighter lines, `rows` of them high at first)
      className={`${inputCls} rich-input relative ${multiline || rows > 1 ? "leading-snug" : "leading-5"}`}
      style={{ minHeight: rows > 1 ? Math.round(rows * 16.5 + 8) : 28 }}
    />
  );
}

// Big buttons with a small drawing, several per row (header styles, heading looks).
export function ChoiceGrid<T extends string>(props: { value: T; options: { value: T; label: string; preview: ReactNode }[]; onChange: (v: T) => void; cols?: number }) {
  return (
    <div className={`grid ${(props.cols ?? 3) > 3 ? "gap-1" : "gap-1.5"}`} style={{ gridTemplateColumns: `repeat(${props.cols ?? 3}, minmax(0, 1fr))` }}>
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.label}
          onClick={() => props.onChange(o.value)}
          aria-pressed={o.value === props.value}
          className={`flex min-w-0 flex-col items-stretch gap-0.5 rounded-[5px] border px-0.5 pt-0.5 pb-px text-[11px] leading-4 tracking-tight transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            // (the chosen one is marked by its border and color, not bold: a bold label would no longer fit its tile)
            o.value === props.value ? "border-accent text-ink" : "border-line text-muted hover:border-faint hover:text-ink"
          }`}
        >
          <span data-paper="" className="pointer-events-none flex h-8 items-center justify-center overflow-hidden rounded-[3px] bg-white">{o.preview}</span>
          <span className="truncate">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

// − 14 + : a small number stepper.
export function Stepper({ value, onChange, min, max, title }: { value: number; onChange: (v: number) => void; min: number; max: number; title?: string }) {
  const t = useT();
  const b = "grid size-7 place-items-center rounded-[5px] text-muted outline-none hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-35 disabled:hover:bg-transparent";
  return (
    <div className="flex shrink-0 items-center rounded-[5px] bg-subtle" title={title}>
      <button type="button" className={b} aria-label={t("Decrease")} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus size={12} strokeWidth={2} aria-hidden />
      </button>
      <span className="w-7 text-center text-xs tabular-nums text-ink">{value}</span>
      <button type="button" className={b} aria-label={t("Increase")} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus size={12} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
