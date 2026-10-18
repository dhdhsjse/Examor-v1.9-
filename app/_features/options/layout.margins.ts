import type { Option } from "@/app/_features/core/types";
import { inspectorLayoutMargins } from "@/app/_features/inspectors/inspector-layout-margins";

// No heading: the option is a single row that already says "Margins".
export const layoutMarginsOption: Option = {
  id: "option.layout.margins",
  order: 20,
  features: [inspectorLayoutMargins],
};
