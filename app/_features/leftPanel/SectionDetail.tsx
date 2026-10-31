"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { resolveLabel } from "@/app/_features/core/FeatureRenderer";
import type { Ctx, Feature, Section } from "@/app/_features/core/types";
import { iconBtn } from "@/app/_features/core/ui";
import OptionGroup from "./OptionGroup";

// A section opened: a back button, then its options one under another.
export default function SectionDetail({ section, ctx, onBack, onLibrary }: { section: Section; ctx: Ctx; onBack: () => void; onLibrary: (f: Feature) => void }) {
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => backRef.current?.focus(), []);

  const BackIcon = ctx.dir === "rtl" ? ArrowRight : ArrowLeft;
  const label = resolveLabel(section.label, ctx.t);
  const options = [...section.options].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div role="region" aria-label={label} className="flex flex-col">
      <div className="sticky top-0 z-10 flex h-10 items-center gap-1 border-b border-line bg-surface px-2">
        <button ref={backRef} type="button" onClick={onBack} aria-label={ctx.t("Back")} title={ctx.t("Back")} className={iconBtn}>
          <BackIcon aria-hidden />
        </button>
        <span className="truncate text-xs font-semibold text-ink">{label}</span>
      </div>
      <div className="flex flex-col divide-y divide-line">
        {options.map((o) => (
          <OptionGroup key={o.id} option={o} ctx={ctx} onLibrary={onLibrary} />
        ))}
      </div>
    </div>
  );
}
