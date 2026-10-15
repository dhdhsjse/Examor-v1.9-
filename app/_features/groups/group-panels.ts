import type { Group } from "@/app/_features/core/types";
import { barLeftToggle } from "@/app/_features/toggles/bar-left-toggle";
import { barRightToggle } from "@/app/_features/toggles/bar-right-toggle";

// Show / hide the side bars.
export const panelsGroup: Group = {
  id: "group.panels",
  order: 65,
  className: "flex items-center gap-0.5",
  features: [barLeftToggle, barRightToggle],
};
