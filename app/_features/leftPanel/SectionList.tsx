"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { resolveLabel } from "@/app/_features/core/FeatureRenderer";
import type { Ctx, Section } from "@/app/_features/core/types";

// The sections as compact rows (like Figma's layer rows): icon, label, chevron. Clicking one opens it.
export default function SectionList({ sections, ctx, onOpen }: { sections: Section[]; ctx: Ctx; onOpen: (id: string) => void }) {
  const Chevron = ctx.dir === "rtl" ? ChevronLeft : ChevronRight;
  return (
    <ul role="list" className="flex flex-col p-2">
      {[...sections]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onOpen(s.id)}
              className="group flex h-8 w-full items-center gap-2 rounded-[5px] px-1.5 text-start text-xs text-ink transition-colors duration-100 outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="ui-icon grid size-4 shrink-0 place-items-center text-muted">{s.icon}</span>
              <span className="min-w-0 flex-1 truncate">{resolveLabel(s.label, ctx.t)}</span>
              <Chevron size={12} strokeWidth={2} aria-hidden className="shrink-0 text-faint group-hover:text-muted" />
            </button>
          </li>
        ))}
    </ul>
  );
}
