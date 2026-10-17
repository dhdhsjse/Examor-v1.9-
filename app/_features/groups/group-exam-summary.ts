import type { Group } from "@/app/_features/core/types";
import { examSummaryPanel } from "@/app/_features/panels/exam-summary";

// The status bar at the foot of the toolbox: pinned to the bottom, also while the tools scroll.
export const examSummaryGroup: Group = {
  id: "group.exam-summary",
  order: 50,
  className: "sticky bottom-0 mt-auto",
  features: [examSummaryPanel],
};
