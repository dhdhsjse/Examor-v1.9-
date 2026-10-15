"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface MenuItem {
  label: string;
  hint?: string;
  checked?: boolean;
  separator?: boolean; // line above this item
  onClick: () => void;
}

// A button that opens a small dropdown list. Used by menu groups.
export default function Dropdown({ trigger, items, alignEnd, className }: { trigger: ReactNode; items: MenuItem[]; alignEnd?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button onClick={() => setOpen(!open)} className="flex h-7 items-center rounded-md px-2 text-[13px] font-medium text-ink transition-colors hover:bg-subtle">
        {trigger}
      </button>
      {open && (
        <div className={`absolute top-full z-30 mt-1.5 w-56 rounded-lg border border-line bg-white p-1 shadow-lg ${alignEnd ? "end-0" : "start-0"}`}>
          {items.map((it) => (
            <div key={it.label}>
              {it.separator && <div className="my-1 h-px bg-line" />}
              <button
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-start text-[13px] hover:bg-subtle ${it.checked ? "font-semibold text-indigo-600" : "text-ink"}`}
              >
                {it.label}
                {it.checked ? <span>✓</span> : it.hint && <span className="text-[11px] text-faint" dir="ltr">{it.hint}</span>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
