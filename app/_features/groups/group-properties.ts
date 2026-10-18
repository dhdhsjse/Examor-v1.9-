import type { Group } from "@/app/_features/core/types";
import { hasActiveInspector } from "@/app/_features/groups/group-active-inspector";
import { inspectorPanel } from "@/app/_features/panels/inspector-panel";

// Block / exam properties. Gives way to an inspector opened from the left panel.
export const propertiesGroup: Group = {
  id: "group.properties",
  order: 20,
  when: (ctx) => ctx.shell.rightTab === "properties" && !hasActiveInspector(ctx),
  className: "min-h-0 flex-1 overflow-y-auto",
  features: [inspectorPanel],
};
