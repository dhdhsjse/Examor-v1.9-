"use client";

import { Check, ChevronDown, Minus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { useT } from "@/app/_lib/uiLang";
import RichEditable, { type RichHandle } from "../rich/RichEditable";

// Small form pieces used by every block editor. `dir="auto"` lets Arabic flow right-to-left.
// Figma-like: 28px controls on a grey fill, a border on hover, the accent border on focus; 11px labels.

// `group`: for a row of buttons (a <label> would press its first button when its text is clicked).
export function Field({ label, hint, children, group }: { label: string; hint?: string; children: ReactNode; group?: boolean }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="flex flex-col gap-1.5" role={group ? "group" : undefined} aria-label={group ? label : undefined}>
      <span className="px-0.5 text-[11px] font-medium tracking-[0.01em] text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] leading-snug text-faint">{hint}</span>}
    </Tag>
  );
}

// A checkbox with its label (and a small explanation under it).
export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-[13px] leading-snug tracking-[-0.01em] text-ink">
      <span className="flex flex-col gap-0.5">
        {label}
        {hint && <span className="text-[11px] leading-snug text-faint">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="relative h-[22px] w-[38px] shrink-0 cursor-pointer appearance-none rounded-full bg-slate-300 transition-colors duration-200 outline-none before:absolute before:top-[2px] before:left-[2px] before:size-[18px] before:rounded-full before:bg-white before:shadow before:transition-transform before:duration-200 before:content-[''] checked:bg-emerald-500 checked:before:translate-x-[16px] focus-visible:ring-2 focus-visible:ring-accent rtl:before:right-[2px] rtl:before:left-auto rtl:checked:before:-translate-x-[16px]"
      />
    </label>
  );
}

// A compact dropdown: a button showing the current choice ("Français ▾") and a small list to pick
// another. Arrow keys move in the list, Escape closes it.
export function MenuSelect<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string; // what is being chosen, for screen readers
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
    <div ref={box} className="relative">
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
        className={`flex h-8 items-center gap-1 rounded-lg border bg-subtle ps-2.5 pe-1.5 text-[13px] tracking-[-0.01em] text-ink transition-colors hover:border-line focus-visible:border-accent focus-visible:outline-none ${open ? "border-accent" : "border-transparent"}`}
      >
        <span dir="auto">{current?.label}</span>
        <ChevronDown size={12} strokeWidth={2} className="text-muted" aria-hidden />
      </button>
      {open && (
        <div role="listbox" aria-label={label} onKeyDown={onListKey} className="absolute end-0 top-full z-30 mt-1 min-w-36 rounded-xl bg-neutral-900/95 p-1.5 text-white shadow-[0_12px_32px_rgba(0,0,0,0.3)] backdrop-blur">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => pick(o.value)}
              className={`flex h-8 w-full items-center justify-between gap-3 rounded-lg px-2.5 text-start text-[13px] outline-none hover:bg-accent focus-visible:bg-accent ${o.value === value ? "font-semibold" : ""}`}
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

export const inputCls =
  "w-full rounded-lg border border-transparent bg-subtle px-2.5 py-1.5 text-[13px] leading-5 tracking-[-0.01em] text-ink outline-none transition-colors duration-150 placeholder:text-faint hover:border-line focus:border-accent focus:bg-white";

export function TextInput(props: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input dir="auto" value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} className={inputCls} />
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

export function NumberInput(props: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; inline?: boolean }) {
  return (
    <input
      type="number"
      value={props.value}
      min={props.min}
      max={props.max}
      step={props.step ?? 1}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (!Number.isNaN(v)) props.onChange(Math.min(props.max ?? Infinity, Math.max(props.min ?? -Infinity, v)));
      }}
      className={`${inputCls} w-20 ${props.inline ? "w-20! shrink-0 rounded-lg! bg-white! text-center text-[13px]! font-medium tabular-nums shadow-sm" : ""}`}
    />
  );
}

// Row of buttons where one is active.
export function Segmented<T extends string>(props: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; roomy?: boolean }) {
  const roomy = !!props.roomy;
  return (
    <div className={`flex gap-0.5 bg-subtle ${roomy ? "rounded-xl p-1" : "rounded-[10px] p-[3px]"}`}>
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => props.onChange(o.value)}
          aria-pressed={o.value === props.value}
          className={`flex-1 px-2 outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            roomy
              ? "h-8 rounded-lg text-[13px] tracking-[-0.01em] transition-[background-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.97]"
              : "h-7 rounded-[8px] text-xs tracking-[-0.005em] transition-[background-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.97]"
          } ${o.value === props.value ? "bg-white font-semibold text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SmallButton({ children, onClick, danger, title }: { children: ReactNode; onClick: () => void; danger?: boolean; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium tracking-[-0.01em] transition-[transform,background-color] duration-100 ease-out outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98] ${
        danger ? "text-red-700 hover:bg-red-50" : "bg-subtle text-ink hover:bg-hover"
      }`}
    >
      {children}
    </button>
  );
}

// Small "x" button to remove a row.
export function RemoveButton({ onClick, title = "Remove" }: { onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-label={title}
      className="grid size-8 shrink-0 place-items-center rounded-lg text-faint transition-[transform,background-color,color] duration-100 outline-none hover:bg-red-50 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-accent active:scale-90"
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
      className="flex h-8 w-full items-center gap-1.5 rounded-lg px-2.5 text-[13px] tracking-[-0.01em] text-muted transition-[transform,background-color,color] duration-100 outline-none hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98]"
    >
      <Plus size={12} strokeWidth={2} aria-hidden /> {children}
    </button>
  );
}

// A text box that keeps the styled words (colors, fonts…) of the text. Same look as the inputs.
export function RichInput({ value, onChange, multiline, rows = 1, placeholder, ref, roomy, bare }: {
  roomy?: boolean; // larger, rounder (the question editors)
  bare?: boolean; // no box of its own: it sits in a row of a list
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
      className={`${inputCls} rich-input relative leading-snug ${roomy ? "rounded-xl! px-3! py-2! text-[13px]! tracking-[-0.01em]" : ""} ${bare ? "bg-transparent! px-1! py-1.5! text-[14px]! tracking-[-0.01em] border-transparent! hover:border-transparent! focus:bg-transparent! focus:border-transparent!" : ""}`}
      style={{ minHeight: rows > 1 ? `${rows * 1.4 + 0.8}em` : undefined }}
    />
  );
}

// Big buttons with a small drawing, several per row (header styles, heading looks).
export function ChoiceGrid<T extends string>(props: { value: T; options: { value: T; label: string; preview: ReactNode }[]; onChange: (v: T) => void; cols?: number }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${props.cols ?? 3}, minmax(0, 1fr))` }}>
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => props.onChange(o.value)}
          aria-pressed={o.value === props.value}
          className={`flex flex-col items-stretch gap-1.5 rounded-xl p-2 text-[11px] tracking-[-0.005em] transition-[transform,background-color,box-shadow] duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] ${
            o.value === props.value ? "bg-white font-semibold text-ink shadow-[0_0_0_2px_var(--color-accent,#4f46e5),0_4px_14px_rgba(0,0,0,0.08)]" : "bg-subtle text-muted hover:bg-hover hover:text-ink"
          }`}
        >
          <span className="pointer-events-none flex h-8 items-center justify-center overflow-hidden rounded-lg bg-white">{o.preview}</span>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// − 14 + : a small number stepper.
export function Stepper({ value, onChange, min, max, title }: { value: number; onChange: (v: number) => void; min: number; max: number; title?: string }) {
  const t = useT();
  const b = "grid size-8 place-items-center rounded-lg text-muted transition-[transform,background-color,color] duration-100 outline-none hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent active:scale-90 disabled:opacity-35 disabled:hover:bg-transparent disabled:active:scale-100";
  return (
    <div className="flex items-center rounded-[10px] bg-subtle p-0.5" title={title}>
      <button type="button" className={b} aria-label={t("Decrease")} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus size={12} strokeWidth={2} aria-hidden />
      </button>
      <span className="w-8 text-center text-[13px] font-medium tabular-nums text-ink">{value}</span>
      <button type="button" className={b} aria-label={t("Increase")} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus size={12} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
