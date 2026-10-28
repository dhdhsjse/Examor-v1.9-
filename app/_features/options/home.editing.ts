import type { Option } from "@/app/_features/core/types";
import { inspectorHomeFind } from "@/app/_features/inspectors/inspector-home-find";
import { inspectorHomeSymbols } from "@/app/_features/inspectors/inspector-home-symbols";

// Editing the texts: find and replace in the whole exam, and the symbols to put in the text being typed.
export const homeEditingOption: Option = {
  id: "option.home.editing",
  order: 20,
  label: (t) => t("Editing"),
  features: [inspectorHomeFind, inspectorHomeSymbols],
};
