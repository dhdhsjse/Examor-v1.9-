import type { Group } from "@/app/_features/core/types";
import { modeExamToggle } from "@/app/_features/toggles/mode-exam";
import { modeKeyToggle } from "@/app/_features/toggles/mode-key";

export const viewGroup: Group = {
  id: "group.view",
  order: 60,
  className: "flex rounded-md bg-subtle p-0.5 ring-1 ring-line",
  features: [modeExamToggle, modeKeyToggle],
};
