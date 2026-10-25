"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Small building blocks of the Molecule Studio, so that every control looks and behaves the same.

// Two or three exclusive choices.
export function Seg<T extends string>({ value, options, onChange, vertical, label }: { value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void; vertical?: boolean; label?: string }) {
  return (
    <div role="group" aria-label={label} className={`flex overflow-hidden rounded-lg border border-line bg-white ${vertical ? "flex-col" : ""}`}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          title={o.hint}
          className={`flex-1 px-2.5 py-1.5 text-start text-xs font-medium transition-colors ${value === o.value ? "bg-accent text-white" : "text-ink hover:bg-subtle"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// A titled group of controls, with one line saying what it is for.
export function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h4 className="text-xs font-semibold text-ink">{title}</h4>
        {hint && <p className="text-[11px] leading-snug text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

// A button with an icon and a short label (or only an icon, with the label as its tooltip).
export function ActionButton({
  icon,
  label,
  hint,
  shortcut,
  onClick,
  disabled,
  active,
  tone,
  iconOnly,
  primary,
  testId,
}: {
  icon?: ReactNode;
  label: string;
  hint?: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  tone?: "danger";
  iconOnly?: boolean;
  primary?: boolean;
  testId?: string;
}) {
  const tip = [hint ?? label, shortcut ? `(${shortcut})` : ""].filter(Boolean).join(" ");
  const base = "inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  const size = iconOnly ? "size-8" : "px-2.5 py-1.5";
  const look = primary
    ? "bg-accent text-white hover:bg-accent-strong"
    : active
      ? "border border-accent bg-accent-soft text-accent-strong"
      : tone === "danger"
        ? "border border-red-200 text-red-700 hover:bg-red-50"
        : "border border-line bg-white text-ink hover:bg-subtle";
  return (
    <button onClick={onClick} disabled={disabled} title={tip} aria-label={iconOnly ? label : undefined} aria-pressed={active} data-testid={testId} className={`${base} ${size} ${look}`}>
      {icon}
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}

// A keyboard key, for hints.
export const Kbd = ({ children }: { children: ReactNode }) => <kbd className="rounded border border-line bg-subtle px-1 py-px font-sans text-[10px] font-semibold text-muted">{children}</kbd>;

// A small menu that opens under its button and closes on a click outside or Escape.
export function Menu({ trigger, children, align = "start", up }: { trigger: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: "start" | "end"; up?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("mousedown", away);
    window.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", esc, true);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div role="menu" className={`absolute z-30 flex min-w-48 flex-col rounded-lg border border-line bg-white p-1 shadow-lg ${up ? "bottom-full mb-1" : "top-full mt-1"} ${align === "end" ? "end-0" : "start-0"}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ children, onClick, disabled, hint }: { children: ReactNode; onClick: () => void; disabled?: boolean; hint?: string }) {
  return (
    <button role="menuitem" onClick={onClick} disabled={disabled} className="flex items-center justify-between gap-6 rounded-md px-2.5 py-1.5 text-start text-xs text-ink hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40">
      <span>{children}</span>
      {hint && <span className="text-[10px] text-faint">{hint}</span>}
    </button>
  );
}

// "C2H4O2" with real subscripts.
export const Formula = ({ text }: { text: string }) => <>{text.split(/(\d+)/).map((part, i) => (/^\d+$/.test(part) ? <sub key={i}>{part}</sub> : part))}</>;
