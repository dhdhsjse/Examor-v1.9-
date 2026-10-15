import type { Group } from "@/app/_features/core/types";
import { titleField } from "@/app/_features/fields/field-title";
import { statusIndicatorPanel } from "@/app/_features/panels/status-indicator";

export const titleGroup: Group = {
  id: "group.title",
  order: 20,
  className: "flex w-[260px] min-w-0 items-center gap-1.5",
  features: [titleField, statusIndicatorPanel],
};
