import type { Bar } from "@/app/_features/core/types";
import { libraryGroup } from "@/app/_features/groups/group-library";
import { propertiesGroup } from "@/app/_features/groups/group-properties";
import { tabsGroup } from "@/app/_features/groups/group-tabs";
import { stripLibraryToggle } from "@/app/_features/toggles/strip-library";
import { stripPropertiesToggle } from "@/app/_features/toggles/strip-properties";

export const rightPanelBar: Bar = {
  id: "bar.right-panel",
  position: "right",
  order: 30,
  collapse: {
    width: 300,
    minWidth: 248,
    maxWidth: 640,
    label: "Properties panel",
    hide: "Hide properties panel",
    show: "Show properties panel",
    hotkey: "Ctrl+]",
    strip: [stripPropertiesToggle, stripLibraryToggle],
  },
  className: "flex flex-col",
  groups: [tabsGroup, propertiesGroup, libraryGroup],
};
