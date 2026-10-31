"use client";

import { CornerDownRight, SlidersHorizontal } from "lucide-react";
import FeatureRenderer, { resolveLabel } from "@/app/_features/core/FeatureRenderer";
import type { Ctx, Feature } from "@/app/_features/core/types";
import { goesInText } from "@/app/_lib/textSnippets";
import { DRAG_MIME } from "@/app/_lib/tools";

interface Props {
  feature: Feature;
  ctx: Ctx;
  onLibrary: (feature: Feature) => void; // opens the feature's library instead of inserting
}

// One feature as a full-width row. An inspector feature opens its settings in the right panel (the left
// panel stays where it is); a feature with a library opens it; otherwise clicking runs the feature.
// Tools with a drag payload can also be dragged onto the page. A tool that is a mode (`checked`, e.g.
// drawing a text box) shows as pressed while it is on.
export default function FeatureRow({ feature, ctx, onLibrary }: Props) {
  const inspector = feature.target === "inspector";
  // Features that only render their own surface (fields, panels) are drawn as they are.
  if (!inspector && !feature.run && !feature.library) return <FeatureRenderer feature={feature} ctx={ctx} />;

  const label = resolveLabel(feature.label, ctx.t);
  const drag = inspector ? undefined : feature.dragPayload;
  const open = inspector ? ctx.activeInspectorId === feature.id : !!feature.checked?.(ctx);
  // A text box is being typed in and this question type goes inside it: the press keeps the box open, with its cursor.
  const intoText = !!ctx.shell.textEditor && goesInText(drag);
  const intoTextTip = ctx.t("Adds it in the text box");
  const onClick = () => {
    if (inspector) return ctx.openInspector(feature.id);
    if (feature.library) return onLibrary(feature);
    void feature.run?.(ctx);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      // (data-text-format keeps the box open; no default keeps its cursor)
      data-text-format={intoText ? "" : undefined}
      onMouseDown={(e) => {
        if (intoText) e.preventDefault();
      }}
      aria-pressed={inspector || feature.checked ? open : undefined}
      draggable={!!drag}
      onDragStart={(e) => {
        if (!drag) return;
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(drag));
        e.dataTransfer.effectAllowed = "copy";
      }}
      title={intoText ? `${label} — ${intoTextTip}` : label}
      className={`group flex h-8 w-full items-center gap-2 rounded-[5px] px-1.5 text-start text-xs transition-colors duration-100 outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        open ? "bg-accent-soft text-accent" : "text-ink hover:bg-hover"
      }`}
    >
      <span className={`ui-icon grid size-4 shrink-0 place-items-center ${open ? "text-accent" : "text-muted"}`}>{feature.icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {intoText && <CornerDownRight size={12} strokeWidth={2} aria-label={intoTextTip} className="shrink-0 text-accent rtl:-scale-x-100" />}
      {feature.hotkey && <span className="text-[11px] text-faint">{feature.hotkey}</span>}
      {inspector && (
        <SlidersHorizontal
          size={12}
          strokeWidth={2}
          aria-hidden
          className={`shrink-0 ${open ? "text-accent" : "text-faint opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"}`}
        />
      )}
    </button>
  );
}
