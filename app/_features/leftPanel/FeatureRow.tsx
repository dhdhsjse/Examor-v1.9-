"use client";

import { SlidersHorizontal } from "lucide-react";
import FeatureRenderer, { resolveLabel } from "@/app/_features/core/FeatureRenderer";
import type { Ctx, Feature } from "@/app/_features/core/types";
import { DRAG_MIME } from "@/app/_lib/tools";

interface Props {
  feature: Feature;
  ctx: Ctx;
  onLibrary: (feature: Feature) => void; // opens the feature's library instead of inserting
}

// One feature as a full-width row. An inspector feature opens its settings in the right panel (the left
// panel stays where it is); a feature with a library opens it; otherwise clicking runs the feature.
// Tools with a drag payload can also be dragged onto the page.
export default function FeatureRow({ feature, ctx, onLibrary }: Props) {
  const inspector = feature.target === "inspector";
  // Features that only render their own surface (fields, panels) are drawn as they are.
  if (!inspector && !feature.run && !feature.library) return <FeatureRenderer feature={feature} ctx={ctx} />;

  const label = resolveLabel(feature.label, ctx.t);
  const drag = inspector ? undefined : feature.dragPayload;
  const open = inspector && ctx.activeInspectorId === feature.id;
  const onClick = () => {
    if (inspector) return ctx.openInspector(feature.id);
    if (feature.library) return onLibrary(feature);
    void feature.run?.(ctx);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={inspector ? open : undefined}
      draggable={!!drag}
      onDragStart={(e) => {
        if (!drag) return;
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(drag));
        e.dataTransfer.effectAllowed = "copy";
      }}
      title={label}
      className={`flex h-9 w-full items-center gap-3 rounded-md px-2 text-start text-[13px] transition-colors duration-100 ${
        open ? "bg-accent-soft text-accent" : "text-ink hover:bg-subtle"
      }`}
    >
      <span className={`grid size-5 shrink-0 place-items-center ${open ? "text-accent" : "text-muted"}`}>{feature.icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {feature.hotkey && <span className="text-[10px] text-faint">{feature.hotkey}</span>}
      {inspector && <SlidersHorizontal size={14} strokeWidth={1.7} aria-hidden className={`shrink-0 ${open ? "text-accent" : "text-faint"}`} />}
    </button>
  );
}
