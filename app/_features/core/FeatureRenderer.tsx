"use client";

import ToolTile from "@/app/_components/ToolTile";
import type { T } from "@/app/_lib/uiLang";
import { iconBtn } from "./ui";
import type { Ctx, Feature } from "./types";

// A label is either a plain English key (translated) or a function of t.
export function resolveLabel(label: Feature["label"], t: T) {
  return typeof label === "function" ? label(t) : t(label);
}

// Draws one feature by its kind. Menu items are drawn by their group's dropdown instead.
export default function FeatureRenderer({ feature, ctx }: { feature: Feature; ctx: Ctx }) {
  if (feature.kind === "tool" && feature.dragPayload) {
    return (
      <ToolTile
        icon={feature.icon}
        label={resolveLabel(feature.label, ctx.t)}
        tone={feature.tone ?? "indigo"}
        action={feature.dragPayload}
        onUse={() => void feature.run?.(ctx)}
      />
    );
  }
  if (feature.kind === "action") {
    return (
      <button type="button" title={resolveLabel(feature.label, ctx.t)} className={iconBtn} onClick={() => void feature.run?.(ctx)}>
        {feature.icon}
      </button>
    );
  }
  if (feature.kind === "menu-item") return null;
  return feature.render ? <>{feature.render({ ctx })}</> : null;
}
