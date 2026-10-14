"use client";

import type { ReactNode, Ref } from "react";

// Small form pieces used by every block editor. `dir="auto"` lets Arabic flow right-to-left.

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="text-[10px] leading-snug text-faint">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink outline-none transition-colors placeholder:text-faint focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

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

export function NumberInput(props: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
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
      className={`${inputCls} w-20`}
    />
  );
}

// Row of buttons where one is active.
export function Segmented<T extends string>(props: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-md bg-subtle p-0.5 ring-1 ring-line">
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => props.onChange(o.value)}
          className={`flex-1 rounded px-2 py-1 text-xs transition-colors ${
            o.value === props.value ? "bg-white font-semibold text-indigo-600 shadow-sm" : "text-muted hover:text-ink"
          }`}
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
      className={`flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
        danger
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-line text-ink hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
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
      className="grid size-7 shrink-0 place-items-center rounded-md text-faint hover:bg-red-50 hover:text-red-600"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M2 2l6 6M8 2L2 8" />
      </svg>
    </button>
  );
}

export function AddRowButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 py-1.5 text-xs font-medium text-muted hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-600"
    >
      <span className="text-sm leading-none">+</span> {children}
    </button>
  );
}
