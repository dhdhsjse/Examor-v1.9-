import type { Bar } from "@/app/_features/core/types";
import { libraryGroup } from "@/app/_features/groups/group-library";
import { propertiesGroup } from "@/app/_features/groups/group-properties";
import { tabsGroup } from "@/app/_features/groups/group-tabs";

export const rightPanelBar: Bar = {
  id: "bar.right-panel",
  position: "right",
  order: 30,
  collapsible: true,
  className: "flex w-[288px] shrink-0 flex-col border-s border-line bg-surface",
  groups: [tabsGroup, propertiesGroup, libraryGroup],
};
