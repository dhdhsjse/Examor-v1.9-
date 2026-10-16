import type { Feature } from "@/app/_features/core/types";
import { OnboardingModal } from "./OnboardingModal";

export const onboardingOverlay: Feature = {
  id: "overlay.onboarding",
  kind: "overlay",
  label: "Page setup",
  render: ({ ctx }) => <OnboardingModal ctx={ctx} />,
};
