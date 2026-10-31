import type { Group } from "@/app/_features/core/types";
import { modeExamToggle } from "@/app/_features/toggles/mode-exam";
import { modeKeyToggle } from "@/app/_features/toggles/mode-key";

export const viewGroup: Group = {
  id: "group.view",
  order: 60,
  className: "flex shrink-0 rounded-[6px] bg-subtle p-0.5",
  features: [modeExamToggle, modeKeyToggle],
};
