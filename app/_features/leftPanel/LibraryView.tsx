"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { resolveLabel } from "@/app/_features/core/FeatureRenderer";
import type { Ctx, Feature, LibraryTemplate } from "@/app/_features/core/types";
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
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-ink">{label}</span>
          <span className="text-[11px] text-muted">{ctx.t("Choose a template")}</span>
        </div>
      </div>
      {templates.length === 0 ? (
        <p className="p-4 text-xs text-faint">{ctx.t("No templates available")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-3">
          {templates.map((tpl) => (
            <LibraryCard key={tpl.id} ctx={ctx} template={tpl} onChoose={() => onChoose(tpl)} />
          ))}
        </div>
      )}
    </div>
  );
}
