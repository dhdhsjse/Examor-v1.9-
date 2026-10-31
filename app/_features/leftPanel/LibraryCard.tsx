"use client";

import { FileText } from "lucide-react";
import { resolveLabel } from "@/app/_features/core/FeatureRenderer";
import type { Ctx, LibraryTemplate } from "@/app/_features/core/types";

interface Props {
  ctx: Ctx;
  template: LibraryTemplate;
  onChoose: () => void;
}

// One template: a placeholder picture, its name and a short description. Enter or Space chooses it.
export default function LibraryCard({ ctx, template, onChoose }: Props) {
  const label = resolveLabel(template.label, ctx.t);
  const description = template.description ? resolveLabel(template.description, ctx.t) : null;
  return (
    <button
      type="button"
      onClick={onChoose}
      className="relative flex flex-col overflow-hidden rounded-[5px] border border-line bg-surface text-start transition-colors hover:border-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="grid aspect-[4/3] place-items-center bg-subtle text-faint">
        <FileText size={24} strokeWidth={1.5} aria-hidden />
      </span>
      <span className="flex flex-col gap-0.5 px-2 py-1.5">
        <span className="text-xs font-semibold text-ink">{label}</span>
        {description && <span className="text-[11px] leading-snug text-muted">{description}</span>}
      </span>
      {template.recommended && (
        <span className="absolute end-2 top-2 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">{ctx.t("Recommended")}</span>
      )}
    </button>
  );
}
