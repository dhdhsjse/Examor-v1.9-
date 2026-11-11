"use client";

import { useMemo, useState, type ReactNode } from "react";

export interface HeaderPickItem {
  value: string;
  label: string; // translated
  category: string; // "classic" | "modern" | "colorful" | "exam" | "earlier"; "" = above the families (None)
  preview: ReactNode;
}

const FAMILIES: { id: string; name: string }[] = [
  { id: "classic", name: "Classic" },
  { id: "modern", name: "Modern" },
  { id: "colorful", name: "Colorful" },
  { id: "exam", name: "Exam headers" },
  { id: "earlier", name: "Earlier styles" },
];

// The header library as a grid of live pictures, by family: a row of family tabs ("All" shows them one after the other, each under
// its name), the grid scrolls. The family of the chosen header is open first.
export function HeaderPicker({ items, value, onChange, t, cols = 2 }: { items: HeaderPickItem[]; value: string; onChange: (v: string) => void; t: (s: string) => string; cols?: number }) {
  const current = items.find((i) => i.value === value);
  const [family, setFamily] = useState<string>("all");
  const families = useMemo(() => FAMILIES.filter((f) => items.some((i) => i.category === f.id)), [items]);
  const loose = items.filter((i) => !i.category);
  const shown = family === "all" ? families : families.filter((f) => f.id === family);
  const tab = (on: boolean) =>
    `shrink-0 rounded-full px-2.5 py-1 text-[11px] leading-none transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent ${on ? "bg-accent font-semibold text-white" : "bg-subtle text-muted hover:bg-hover hover:text-ink"}`;
  const tile = (i: HeaderPickItem) => {
    const on = i.value === value;
    return (
      <button
        key={i.value}
        type="button"
        title={i.label}
        aria-pressed={on}
        onClick={() => onChange(i.value)}
        className={`group flex min-w-0 flex-col gap-1 rounded-[6px] border p-1 text-start text-[11px] leading-4 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          on ? "border-accent bg-accent/5 text-ink ring-1 ring-accent" : "border-line text-muted hover:border-faint hover:text-ink"
        }`}
      >
        <span data-paper="" className="pointer-events-none flex min-h-7 items-center justify-center overflow-hidden rounded-[3px] bg-white ring-1 ring-black/5">
          {i.preview}
        </span>
        <span className="truncate px-0.5">{i.label}</span>
      </button>
    );
  };
  const grid = (list: HeaderPickItem[]) => (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {list.map(tile)}
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      <div role="tablist" aria-label={t("Header families")} className="-mx-0.5 flex gap-1 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none]">
        {[{ id: "all", name: "All" }, ...families].map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={family === f.id} onClick={() => setFamily(f.id)} className={tab(family === f.id)}>
            {t(f.name)}
            {f.id !== "all" && current?.category === f.id && <span aria-hidden className="ms-1 inline-block size-1.5 rounded-full bg-current align-middle" />}
          </button>
        ))}
      </div>
      <div className="max-h-[min(62vh,560px)] overflow-y-auto overscroll-contain rounded-[6px] pe-1">
        {loose.length > 0 && family === "all" && <div className="mb-2">{grid(loose)}</div>}
        {shown.map((f) => (
          <section key={f.id} className="mb-3 last:mb-0">
            <h4 className="sticky top-0 z-10 bg-surface py-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
              {t(f.name)} <span className="font-normal normal-case tracking-normal">· {items.filter((i) => i.category === f.id).length}</span>
            </h4>
            {grid(items.filter((i) => i.category === f.id))}
          </section>
        ))}
      </div>
    </div>
  );
}
