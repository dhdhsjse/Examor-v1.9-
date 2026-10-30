import type { Group } from "@/app/_features/core/types";
import { barLeftToggle } from "@/app/_features/toggles/bar-left-toggle";
import { barRightToggle } from "@/app/_features/toggles/bar-right-toggle";
import { mathKeyboardToggle } from "@/app/_features/toggles/math-keyboard";

// Show / hide the side bars and the math keyboard.
export const panelsGroup: Group = {
  id: "group.panels",
  order: 65,
  className: "flex shrink-0 items-center gap-0.5",
  features: [barLeftToggle, barRightToggle, mathKeyboardToggle],
};
