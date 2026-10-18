import type { Option } from "@/app/_features/core/types";
import { inspectorLayoutPageFormat } from "@/app/_features/inspectors/inspector-layout-page-format";

// No heading: the option is a single row that already says "Page format".
export const layoutPageFormatOption: Option = {
  id: "option.layout.page-format",
  order: 10,
  features: [inspectorLayoutPageFormat],
};
