import type { Group } from "@/app/_features/core/types";
import { tabLibraryToggle } from "@/app/_features/toggles/tab-library";
import { tabPropertiesToggle } from "@/app/_features/toggles/tab-properties";

export const tabsGroup: Group = {
  id: "group.tabs",
  order: 10,
  className: "flex h-9 shrink-0 items-center gap-3 border-b border-line px-3",
  features: [tabPropertiesToggle, tabLibraryToggle],
};
