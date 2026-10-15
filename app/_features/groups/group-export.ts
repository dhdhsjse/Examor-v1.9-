import type { Group } from "@/app/_features/core/types";
import { exportButtonPanel } from "@/app/_features/panels/export-button";

export const exportGroup: Group = {
  id: "group.export",
  order: 70,
  features: [exportButtonPanel],
};
