"use client";

import FeatureRenderer, { resolveLabel } from "@/app/_features/core/FeatureRenderer";
import type { Ctx, Feature } from "@/app/_features/core/types";
import { DRAG_MIME } from "@/app/_lib/tools";

// One feature as a full-width row. Clicking runs it; tools with a drag payload can also be dragged onto the page.
export default function FeatureRow({ feature, ctx }: { feature: Feature; ctx: Ctx }) {
  // Features that only render their own surface (fields, panels) are drawn as they are.
  if (!feature.run) return <FeatureRenderer feature={feature} ctx={ctx} />;

  const label = resolveLabel(feature.label, ctx.t);
  const drag = feature.dragPayload;
  return (
    <button
      type="button"
      onClick={() => void feature.run?.(ctx)}
      draggable={!!drag}
      onDragStart={(e) => {
        if (!drag) return;
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(drag));
        e.dataTransfer.effectAllowed = "copy";
      }}
      title={label}
      className="flex h-9 w-full items-center gap-3 rounded-md px-2 text-start text-[13px] text-ink transition-colors duration-100 hover:bg-subtle"
    >
      <span className="grid size-5 shrink-0 place-items-center text-muted">{feature.icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {feature.hotkey && <span className="text-[10px] text-faint">{feature.hotkey}</span>}
    </button>
  );
}
