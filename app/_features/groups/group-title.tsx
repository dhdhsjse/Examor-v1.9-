import type { Group } from "@/app/_features/core/types";
import { titleField } from "@/app/_features/fields/field-title";
import { statusIndicatorPanel } from "@/app/_features/panels/status-indicator";

// The exam name (click to rename) and the save status. Shrinks first when the window is narrow.
export const titleGroup: Group = {
  id: "group.title",
  order: 20,
  className: "flex min-w-0 shrink items-center gap-1.5",
  features: [titleField, statusIndicatorPanel],
};
