import type { Feature } from "@/app/_features/core/types";
import { openOnboarding } from "@/app/_lib/onboarding";

export const fileReconfigureAction: Feature = {
  id: "action.file.reconfigure-layout",
  kind: "menu-item",
  label: "Configure page layout…",
  order: 2,
  run: () => openOnboarding(),
};
