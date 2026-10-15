import type { Group } from "@/app/_features/core/types";
import { libraryPanel } from "@/app/_features/panels/library-panel";

export const libraryGroup: Group = {
  id: "group.library",
  order: 30,
  when: (ctx) => ctx.shell.rightTab === "library",
  className: "min-h-0 flex-1 overflow-y-auto",
  features: [libraryPanel],
};
