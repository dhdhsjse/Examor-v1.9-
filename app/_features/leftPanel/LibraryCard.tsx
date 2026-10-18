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
      className="relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface text-start transition hover:border-indigo-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
    >
      <span className="grid aspect-[4/3] place-items-center bg-subtle text-faint">
        <FileText size={28} strokeWidth={1.5} />
      </span>
      <span className="flex flex-col gap-0.5 px-2.5 py-2">
        <span className="text-[13px] font-semibold text-ink">{label}</span>
        {description && <span className="text-[11px] leading-snug text-muted">{description}</span>}
      </span>
      {template.recommended && (
        <span className="absolute end-2 top-2 rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">{ctx.t("Recommended")}</span>
      )}
    </button>
  );
}
