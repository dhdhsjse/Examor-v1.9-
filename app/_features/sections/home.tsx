import { Home } from "lucide-react";
import type { Section } from "@/app/_features/core/types";
import { homeRecentOption } from "@/app/_features/options/home.recent";

export const homeSection: Section = {
  id: "section.home",
  order: 10,
  label: (t) => t("Home"),
  icon: <Home size={20} strokeWidth={1.7} />,
  options: [homeRecentOption],
};
