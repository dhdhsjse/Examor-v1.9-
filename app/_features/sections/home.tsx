import { House } from "lucide-react";
import type { Section } from "@/app/_features/core/types";
import { homeEditingOption } from "@/app/_features/options/home.editing";
import { homeFormattingOption } from "@/app/_features/options/home.formatting";

export const homeSection: Section = {
  id: "section.home",
  order: 10,
  label: (t) => t("Home"),
  icon: <House size={18} strokeWidth={1.7} />,
  options: [homeFormattingOption, homeEditingOption],
};
