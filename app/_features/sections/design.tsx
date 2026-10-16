import { Palette } from "lucide-react";
import type { Section } from "@/app/_features/core/types";
import { designPresetsOption } from "@/app/_features/options/design.presets";

export const designSection: Section = {
  id: "section.design",
  order: 30,
  label: (t) => t("Design"),
  icon: <Palette size={20} strokeWidth={1.7} />,
  options: [designPresetsOption],
};
