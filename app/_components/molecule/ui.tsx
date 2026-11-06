"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Small building blocks of the Molecule Studio. The bars over the drawing look like the floating tool bar of the page (white, a hairline,
// small square buttons); the panels use the grey groups of the Graph Studio (`graph-studio/fields`).

/** A floating bar over the drawing (the look of the page's tool bar). */
export const floatingBar = "flex items-center gap-0.5 rounded-md border border-line bg-surface p-1 shadow-sm";

// A button with an icon and a short label (or only an icon, with the label as its tooltip), as on the floating tool bar.
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
  testId?: string;
}) {
  const tip = [hint ?? label, shortcut ? `(${shortcut})` : ""].filter(Boolean).join(" ");
  const size = iconOnly ? "size-8" : "h-8 px-2.5";
  const look = active ? "bg-accent text-white" : tone === "danger" ? "text-red-600 enabled:hover:bg-red-50" : "text-ink enabled:hover:bg-hover";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tip}
      aria-label={iconOnly ? label : undefined}
      aria-pressed={active}
      data-testid={testId}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[5px] text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40 ${size} ${look}`}
    >
      {icon}
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}

// A keyboard key, for hints.
export const Kbd = ({ children }: { children: ReactNode }) => <kbd className="rounded border border-line bg-subtle px-1 py-px font-sans text-[11px] font-semibold text-muted">{children}</kbd>;

// A small menu that opens under (or over) its button and closes on a click outside or Escape.
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
        <div role="menu" className={`absolute z-30 flex min-w-48 flex-col rounded-md border border-line bg-surface p-1 shadow-lg ${up ? "bottom-full mb-1.5" : "top-full mt-1.5"} ${align === "end" ? "end-0" : "start-0"}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ children, onClick, disabled, hint }: { children: ReactNode; onClick: () => void; disabled?: boolean; hint?: string }) {
  return (
    <button role="menuitem" onClick={onClick} disabled={disabled} className="flex items-center justify-between gap-6 rounded-[5px] px-2.5 py-1.5 text-start text-xs text-ink whitespace-nowrap enabled:hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40">
      <span>{children}</span>
      {hint && <span className="text-[11px] text-faint">{hint}</span>}
    </button>
  );
}

// "C2H4O2" with real subscripts.
export const Formula = ({ text }: { text: string }) => <>{text.split(/(\d+)/).map((part, i) => (/^\d+$/.test(part) ? <sub key={i}>{part}</sub> : part))}</>;
