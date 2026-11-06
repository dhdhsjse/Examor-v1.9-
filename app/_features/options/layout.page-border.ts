import type { Option } from "@/app/_features/core/types";
import { inspectorLayoutPageBorder } from "@/app/_features/inspectors/inspector-layout-page-border";

// No heading: the option is a single row that already says "Page borders".
export const layoutPageBorderOption: Option = {
  id: "option.layout.page-border",
  order: 25,
  features: [inspectorLayoutPageBorder],
};
