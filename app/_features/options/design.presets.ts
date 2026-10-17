import type { Option } from "@/app/_features/core/types";
import { designExamplesAction } from "@/app/_features/actions/design-examples";

export const designPresetsOption: Option = {
  id: "option.design.presets",
  order: 10,
  label: (t) => t("Presets"),
  features: [designExamplesAction],
};
