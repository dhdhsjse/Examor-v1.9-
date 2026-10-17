"use client";

import { HeaderSketch } from "@/app/_components/HeaderSketch";
import type { Ctx } from "@/app/_features/core/types";
import type { HeaderFooterTemplate } from "@/app/_lib/onboardingTypes";

interface Props {
  ctx: Ctx;
  label: string; // "Header style" / "Footer" (English key)
  items: HeaderFooterTemplate[];
  value: string;
  onChange: (id: string) => void;
}

// The headers (or footers) of the library as small cards: a sketch of the header, or its text.
export default function ChromePicker({ ctx, label, items, value, onChange }: Props) {
  const t = ctx.t;
  return (
    <fieldset className="rounded-xl border border-line p-3">
      <legend className="px-1 text-xs font-semibold text-ink">{t(label)}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((it) => {
          const on = it.id === value;
          return (
            <button
              key={it.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(it.id)}
              className={`flex flex-col gap-1.5 rounded-lg border p-2 text-start text-[11px] transition-colors ${
                on ? "border-indigo-500 bg-indigo-50/60 font-semibold text-indigo-700 ring-1 ring-indigo-200" : "border-line text-muted hover:border-indigo-300 hover:text-ink"
              }`}
            >
              <span className="pointer-events-none flex h-9 items-center justify-center overflow-hidden rounded bg-white px-1.5 ring-1 ring-black/5">
                {it.sketch ? (
                  <HeaderSketch style={it.sketch} />
                ) : (
                  <span className="truncate text-[9px] text-slate-500" dir="auto">
                    {t(it.sample ?? it.nameKey)}
                  </span>
                )}
              </span>
              <span className="leading-tight">{t(it.nameKey)}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
