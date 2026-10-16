import type { Group } from "@/app/_features/core/types";
import { leftNavigationFeature } from "@/app/_features/leftPanel";

// Sits where the questions and insert groups used to be.
export const navigationGroup: Group = {
  id: "group.navigation",
  order: 30,
  features: [leftNavigationFeature],
};
