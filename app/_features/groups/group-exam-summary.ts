import type { Group } from "@/app/_features/core/types";
import { examSummaryPanel } from "@/app/_features/panels/exam-summary";

export const examSummaryGroup: Group = {
  id: "group.exam-summary",
  order: 50,
  features: [examSummaryPanel],
};
