"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { resolveLabel } from "@/app/_features/core/FeatureRenderer";
import type { Ctx, Section } from "@/app/_features/core/types";

// The sections as full-width rows: icon, label, chevron. Clicking one opens it.
export default function SectionList({ sections, ctx, onOpen }: { sections: Section[]; ctx: Ctx; onOpen: (id: string) => void }) {
  const Chevron = ctx.dir === "rtl" ? ChevronLeft : ChevronRight;
  return (
    <ul role="list" className="flex flex-col">
      {[...sections]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onOpen(s.id)}
              className="flex h-14 w-full items-center gap-3 border-b border-line px-4 text-start text-sm font-medium text-ink transition-colors duration-100 hover:bg-subtle"
            >
              <span className="grid size-6 shrink-0 place-items-center text-indigo-500">{s.icon}</span>
              <span className="min-w-0 flex-1 truncate">{resolveLabel(s.label, ctx.t)}</span>
              <Chevron size={16} strokeWidth={1.7} className="shrink-0 text-faint" />
            </button>
          </li>
        ))}
    </ul>
  );
}
