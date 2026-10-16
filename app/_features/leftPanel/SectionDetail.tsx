"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { resolveLabel } from "@/app/_features/core/FeatureRenderer";
import type { Ctx, Section } from "@/app/_features/core/types";
import OptionGroup from "./OptionGroup";

// A section opened: a back button, then its options one under another.
export default function SectionDetail({ section, ctx, onBack }: { section: Section; ctx: Ctx; onBack: () => void }) {
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => backRef.current?.focus(), []);

  const BackIcon = ctx.dir === "rtl" ? ArrowRight : ArrowLeft;
  const label = resolveLabel(section.label, ctx.t);
  const options = [...section.options].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div role="region" aria-label={label} className="flex flex-col">
      <div className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-line bg-surface px-2">
        <button
          ref={backRef}
          type="button"
          onClick={onBack}
          aria-label={ctx.t("Back")}
          title={ctx.t("Back")}
          className="grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-subtle hover:text-ink"
        >
          <BackIcon size={18} strokeWidth={1.7} />
        </button>
        <span className="truncate text-sm font-semibold text-ink">{label}</span>
      </div>
      <div className="flex flex-col gap-4 p-3">
        {options.map((o) => (
          <OptionGroup key={o.id} option={o} ctx={ctx} />
        ))}
      </div>
    </div>
  );
}
