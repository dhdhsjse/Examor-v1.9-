import type { Group } from "@/app/_features/core/types";
import { inspectorPanel } from "@/app/_features/panels/inspector-panel";

export const propertiesGroup: Group = {
  id: "group.properties",
  order: 20,
  when: (ctx) => ctx.shell.rightTab === "properties",
  className: "min-h-0 flex-1 overflow-y-auto",
  features: [inspectorPanel],
};
