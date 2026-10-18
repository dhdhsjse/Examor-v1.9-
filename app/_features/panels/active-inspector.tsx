import { X } from "lucide-react";
import { resolveLabel } from "@/app/_features/core/FeatureRenderer";
import type { Feature } from "@/app/_features/core/types";
import { iconBtn } from "@/app/_features/core/ui";
import { findSectionFeature } from "@/app/_features/sections";

// The inspector opened from the left panel (a feature with target: 'inspector'), in place of the
// Properties content. The close button goes back to the block / exam properties.
// Finds the feature by id in the sections, as the left navigation does (it does not import it directly).
export const activeInspectorPanel: Feature = {
  id: "panel.active-inspector",
  kind: "panel",
  label: "Settings",
  render: ({ ctx }) => {
    const feature = findSectionFeature(ctx.activeInspectorId);
    if (!feature?.renderInspector) return null;
    const label = resolveLabel(feature.label, ctx.t);
    return (
      <section aria-label={label} className="flex flex-col gap-3.5 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-sm font-semibold text-ink">{label}</h2>
          <button type="button" onClick={ctx.closeInspector} aria-label={ctx.t("Close")} title={ctx.t("Close")} className={iconBtn}>
            <X size={16} strokeWidth={1.7} />
          </button>
        </div>
        {feature.renderInspector({ ctx })}
      </section>
    );
  },
};
