import type { Ctx, Group } from "@/app/_features/core/types";
import { activeInspectorPanel } from "@/app/_features/panels/active-inspector";
import { findSectionFeature } from "@/app/_features/sections";

// True when an inspector is open (and still exists), so it takes the Properties tab. An inspector of one
// kind of block (`edits`, e.g. the text box ribbon) only while such a block is selected.
export const hasActiveInspector = (ctx: Ctx) => {
  const feature = findSectionFeature(ctx.activeInspectorId);
  if (!feature?.renderInspector) return false;
  const selected = ctx.shell.selected;
  return !feature.edits || (!!selected && feature.edits.includes(selected.type));
};

export const activeInspectorGroup: Group = {
  id: "group.active-inspector",
  order: 15,
  when: (ctx) => ctx.shell.rightTab === "properties" && hasActiveInspector(ctx),
  className: "min-h-0 flex-1 overflow-y-auto",
  features: [activeInspectorPanel],
};
