import { LayoutGrid } from "lucide-react";
import type { Section } from "@/app/_features/core/types";
import { layoutHeaderFooterOption } from "@/app/_features/options/layout.header-footer";
import { layoutMarginsOption } from "@/app/_features/options/layout.margins";
import { layoutPageFormatOption } from "@/app/_features/options/layout.page-format";

export const layoutSection: Section = {
  id: "section.layout",
  order: 40,
  label: (t) => t("Page layout"),
  icon: <LayoutGrid size={18} strokeWidth={1.7} />,
  options: [layoutPageFormatOption, layoutMarginsOption, layoutHeaderFooterOption],
};
