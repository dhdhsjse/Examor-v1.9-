import type { Group } from "@/app/_features/core/types";
import { redoToggle } from "@/app/_features/toggles/redo";
import { undoToggle } from "@/app/_features/toggles/undo";

export const editGroup: Group = {
  id: "group.edit",
  order: 50,
  className: "flex items-center",
  features: [undoToggle, redoToggle],
};
