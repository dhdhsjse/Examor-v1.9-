import type { Group } from "@/app/_features/core/types";
import { toolSearchPanel } from "@/app/_features/panels/tool-search";

export const toolboxSearchGroup: Group = {
  id: "group.toolbox-search",
  order: 10,
  features: [toolSearchPanel],
};
