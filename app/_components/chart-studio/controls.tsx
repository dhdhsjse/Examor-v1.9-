"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import type { NumberFormat } from "@/app/_lib/table/format";
import { useT } from "@/app/_lib/uiLang";

export const inputCls = "w-full rounded-lg border border-line bg-subtle px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent disabled:opacity-50";

/** A part of the right side that opens and closes (the title of the chart, the axes, a series…) */
export function Section({ id, title, open, onToggle, children }: { id: string; title: string; open: boolean; onToggle: (id: string) => void; children: ReactNode }) {
  return (
    <section data-testid={`section-${id}`} data-open={open || undefined} className="border-b border-line">
      <button type="button" onClick={() => onToggle(id)} aria-expanded={open} className="flex w-full items-center gap-1.5 px-4 py-2.5 text-start text-sm font-semibold text-ink hover:bg-subtle">
        {open ? <ChevronDown size={15} className="text-muted" /> : <ChevronRight size={15} className="text-muted rtl:rotate-180" />}
        {title}
      </button>
      {open && <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>}
    </section>
  );
}

export function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      {title && <h4 className="text-[11px] font-semibold uppercase tracking-wide text-faint">{title}</h4>}
      {children}
    </div>
  );
}

/** A label and its control side by side */
export function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 text-xs text-muted">{label}</span>
        <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5">{children}</div>
      </div>
      {hint && <p className="text-[11px] leading-snug text-faint">{hint}</p>}
    </div>
  );
}

export function Check({ checked, onChange, label, testId, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; testId?: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-2 text-sm text-ink ${disabled ? "opacity-50" : ""}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} data-testid={testId} className="mt-0.5 accent-indigo-600" />
      <span className="min-w-0">
        {label}
        {hint && <span className="mt-0.5 block text-[11px] leading-snug text-faint">{hint}</span>}
      </span>
    </label>
  );
}

/** A choice between a few things, side by side */
export function Seg<T extends string | number>({ value, options, onChange, testId }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; testId?: string }) {
  return (
    <div role="group" data-testid={testId} className="flex rounded-lg bg-subtle p-0.5 ring-1 ring-line">
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} data-value={String(o.value)} onClick={() => onChange(o.value)} className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${o.value === value ? "bg-white text-accent-strong shadow-sm" : "text-muted hover:text-ink"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A choice from a list */
export function Pick<T extends string | number>({ value, options, onChange, testId, className = "" }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; testId?: string; className?: string }) {
  return (
    <select
      value={String(value)}
      data-testid={testId}
      onChange={(e) => {
        const o = options.find((x) => String(x.value) === e.target.value);
        if (o) onChange(o.value);
      }}
      className={`${inputCls} !w-auto max-w-[170px] ${className}`}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/**
 * A number typed by the teacher: what is typed is his while the field has the focus (a lone "-" or "1," is on its way to a number), and a valid
 * number within the limits goes to the chart as it is typed. The decimal comma is read. With `auto`, an empty field is "Auto" (null).
 */
export function Num({ value, onCommit, min = -1e9, max = 1e9, auto, label, testId, className = "", placeholder }: { value: number | null; onCommit: (n: number | null) => void; min?: number; max?: number; auto?: boolean; label?: string; testId?: string; className?: string; placeholder?: string }) {
  const id = useId();
  const t = useT();
  const [text, setText] = useState<string | null>(null);
  const n = Number((text ?? "").replace(",", "."));
  const empty = (text ?? "").trim() === "";
  const bad = text !== null && !(auto && empty) && (empty || !Number.isFinite(n) || n < min || n > max);
  const shown = value === null ? "" : String(Math.round(value * 1e6) / 1e6);
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-xs text-muted">
          {label}
        </label>
      )}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        dir="ltr"
        value={text ?? shown}
        placeholder={auto ? (placeholder ?? t("Auto")) : placeholder}
        data-testid={testId}
        aria-invalid={bad || undefined}
        onFocus={(e) => {
          setText(shown);
          e.target.select();
        }}
        onChange={(e) => {
          setText(e.target.value);
          const v = Number(e.target.value.replace(",", "."));
          if (auto && e.target.value.trim() === "") onCommit(null);
          else if (e.target.value.trim() !== "" && Number.isFinite(v) && v >= min && v <= max) onCommit(v);
        }}
        onBlur={() => setText(null)}
        className={`${inputCls} tabular-nums ${bad ? "border-red-400" : ""}`}
      />
    </div>
  );
}

/** A color: the browser's chooser, and (when it can be left out) a button back to the automatic one */
export function ColorField({ value, onChange, auto, testId, label }: { value: string | null | undefined; onChange: (c: string | null) => void; auto?: boolean; testId?: string; label?: string }) {
  const t = useT();
  const ok = /^#[0-9a-f]{6}$/i.test(value ?? "");
  return (
    <div className="flex items-center gap-1.5">
      <input type="color" value={ok ? (value as string) : "#888888"} aria-label={label ?? t("Color")} data-testid={testId} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded-md border border-line bg-white p-0.5" />
      {auto && (
        <button type="button" onClick={() => onChange(null)} disabled={!ok} className="rounded-md border border-line px-2 py-1 text-xs text-ink hover:border-accent disabled:opacity-40">
          {t("Auto")}
        </button>
      )}
    </div>
  );
}

/** How numbers are written: decimals, percent, thousands, a unit before or after */
export function NumberFormatEditor({ value, onChange, testId }: { value: NumberFormat; onChange: (f: NumberFormat) => void; testId?: string }) {
  const t = useT();
  const set = (patch: Partial<NumberFormat>) => {
    const next: NumberFormat = { ...value, ...patch };
    for (const k of Object.keys(next) as (keyof NumberFormat)[]) if (next[k] === undefined || next[k] === false || next[k] === "") delete next[k];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      <Row label={t("Decimals")}>
        <Pick
          value={value.decimals ?? -1}
          onChange={(d) => set({ decimals: d < 0 ? undefined : d })}
          options={[{ value: -1, label: t("Automatic") }, ...[0, 1, 2, 3, 4].map((d) => ({ value: d, label: String(d) }))]}
          testId={testId && `${testId}-decimals`}
        />
      </Row>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Check checked={!!value.percent} onChange={(percent) => set({ percent })} label={t("Percent")} testId={testId && `${testId}-percent`} />
        <Check checked={!!value.thousands} onChange={(thousands) => set({ thousands })} label={t("Space between thousands")} testId={testId && `${testId}-thousands`} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">{t("Before the number")}</span>
          <input value={value.prefix ?? ""} onChange={(e) => set({ prefix: e.target.value })} dir="ltr" className={inputCls} data-testid={testId && `${testId}-prefix`} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">{t("After the number")}</span>
          <input value={value.suffix ?? ""} onChange={(e) => set({ suffix: e.target.value })} dir="ltr" className={inputCls} data-testid={testId && `${testId}-suffix`} />
        </div>
      </div>
    </div>
  );
}
