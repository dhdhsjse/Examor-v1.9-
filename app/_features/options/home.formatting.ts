import type { Option } from "@/app/_features/core/types";
import { inspectorHomeFont } from "@/app/_features/inspectors/inspector-home-font";
import { inspectorHomeFormatting } from "@/app/_features/inspectors/inspector-home-formatting";

// Text formatting: the font (from the font library), then size, style, alignment and spacing.
export const homeFormattingOption: Option = {
  id: "option.home.formatting",
  order: 10,
  label: (t) => t("Text"),
  features: [inspectorHomeFont, inspectorHomeFormatting],
};
