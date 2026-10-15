import type { Group } from "@/app/_features/core/types";
import { tabLibraryToggle } from "@/app/_features/toggles/tab-library";
import { tabPropertiesToggle } from "@/app/_features/toggles/tab-properties";

export const tabsGroup: Group = {
  id: "group.tabs",
  order: 10,
  className: "flex h-10 shrink-0 items-end gap-4 border-b border-line px-3.5",
  features: [tabPropertiesToggle, tabLibraryToggle],
};
