"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface MenuItem {
  label: string;
  hint?: string;
  checked?: boolean;
  separator?: boolean; // line above this item
  heading?: string; // small section title above this item
  onClick: () => void;
}

// A button that opens a small dropdown list. Used by menu groups.
export default function Dropdown({ trigger, items, alignEnd, className }: { trigger: ReactNode; items: MenuItem[]; alignEnd?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  // Close on a press anywhere else. `pointerdown`, because the desktop window's drag areas
  // swallow `mousedown`.
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  // Opened from the keyboard: focus the checked (or first) item.
  const focusItem = (pick: (rows: HTMLButtonElement[], i: number) => number) => {
    const rows = [...(menu.current?.querySelectorAll<HTMLButtonElement>("[role^=menuitem]") ?? [])];
    const i = rows.indexOf(document.activeElement as HTMLButtonElement);
    rows[(pick(rows, i) + rows.length) % rows.length]?.focus();
  };
  const onMenuKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") focusItem((_, i) => i + 1);
    else if (e.key === "ArrowUp") focusItem((rows, i) => (i < 0 ? rows.length - 1 : i - 1));
    else if (e.key === "Home") focusItem(() => 0);
    else if (e.key === "End") focusItem((rows) => rows.length - 1);
    else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      if (e.key === "Escape") button.current?.focus();
      return;
    } else return;
    e.preventDefault();
  };

  return (
    <div ref={ref} className={`relative ${className ?? ""}`} onKeyDown={open ? onMenuKey : undefined}>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (open || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
          e.preventDefault();
          setOpen(true);
          requestAnimationFrame(() => focusItem((rows) => Math.max(0, rows.findIndex((r) => r.getAttribute("aria-checked") === "true"))));
        }}
        className={`flex h-7 items-center whitespace-nowrap rounded-[5px] px-2 text-xs font-medium text-ink transition-colors outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent ${open ? "bg-hover" : ""}`}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={menu}
          role="menu"
          className={`absolute top-full z-50 mt-1 w-max min-w-52 max-w-72 rounded-md bg-neutral-900 p-1 text-white shadow-lg ${alignEnd ? "end-0" : "start-0"}`}
        >
          {items.map((it) => (
            <div key={it.label}>
              {it.separator && <div className="-mx-1 my-1 h-px bg-white/15" />}
              {it.heading && <p className="px-2 pt-1 pb-0.5 text-[11px] font-semibold text-white/60">{it.heading}</p>}
              <button
                type="button"
                role={it.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                aria-checked={it.checked}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
                className={`flex h-7 w-full items-center justify-between gap-3 rounded-[5px] px-2 text-start text-xs outline-none hover:bg-accent focus-visible:bg-accent ${it.checked ? "font-semibold" : ""}`}
              >
                {it.label}
                {it.checked ? <Check size={12} strokeWidth={2.5} aria-hidden /> : it.hint && <span className="text-[11px] text-white/60" dir="ltr">{it.hint}</span>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
