import type { Option } from "@/app/_features/core/types";
import { inspectorLayoutHeaderFooter } from "@/app/_features/inspectors/inspector-layout-header-footer";

// No heading: the option is a single row that already says "Header and footer".
export const layoutHeaderFooterOption: Option = {
  id: "option.layout.header-footer",
  order: 30,
  features: [inspectorLayoutHeaderFooter],
};
