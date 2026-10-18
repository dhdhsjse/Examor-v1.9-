import type { Ctx, Group } from "@/app/_features/core/types";
import { activeInspectorPanel } from "@/app/_features/panels/active-inspector";
import { findSectionFeature } from "@/app/_features/sections";

// True when a left-panel inspector is open (and still exists), so it takes the Properties tab.
export const hasActiveInspector = (ctx: Ctx) => !!findSectionFeature(ctx.activeInspectorId)?.renderInspector;

export const activeInspectorGroup: Group = {
  id: "group.active-inspector",
  order: 15,
  when: (ctx) => ctx.shell.rightTab === "properties" && hasActiveInspector(ctx),
  className: "min-h-0 flex-1 overflow-y-auto",
  features: [activeInspectorPanel],
};
