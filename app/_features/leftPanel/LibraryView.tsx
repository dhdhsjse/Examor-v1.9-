"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { resolveLabel } from "@/app/_features/core/FeatureRenderer";
import type { Ctx, Feature, LibraryTemplate } from "@/app/_features/core/types";
import { iconBtn } from "@/app/_features/core/ui";
import LibraryCard from "./LibraryCard";

interface Props {
  ctx: Ctx;
  feature: Feature;
  onBack: () => void;
  onChoose: (template: LibraryTemplate) => void;
}

// The templates a tool offers, as cards. Choosing one inserts it; the back button leaves without inserting.
export default function LibraryView({ ctx, feature, onBack, onChoose }: Props) {
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => backRef.current?.focus(), []);

  const BackIcon = ctx.dir === "rtl" ? ArrowRight : ArrowLeft;
  const label = resolveLabel(feature.label, ctx.t);
  const templates = feature.library?.templates ?? [];

  return (
    <div role="region" aria-label={label} className="flex flex-col">
      <div className="sticky top-0 z-10 flex h-10 items-center gap-1 border-b border-line bg-surface px-2">
        <button ref={backRef} type="button" onClick={onBack} aria-label={ctx.t("Back")} title={ctx.t("Back")} className={iconBtn}>
          <BackIcon aria-hidden />
        </button>
        <span className="truncate text-xs font-semibold text-ink">{label}</span>
        <span className="truncate text-[11px] text-faint">· {ctx.t("Choose a template")}</span>
      </div>
      {templates.length === 0 ? (
        <p className="p-3 text-[11px] text-faint">{ctx.t("No templates available")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 p-2">
          {templates.map((tpl) => (
            <LibraryCard key={tpl.id} ctx={ctx} template={tpl} onChoose={() => onChoose(tpl)} />
          ))}
        </div>
      )}
    </div>
  );
}
