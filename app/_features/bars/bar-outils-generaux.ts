import type { Bar } from "@/app/_features/core/types";
import { arabicGroup } from "@/app/_features/groups/group-arabic";
import { examSummaryGroup } from "@/app/_features/groups/group-exam-summary";
import { frenchGroup } from "@/app/_features/groups/group-french";
import { mathGroup } from "@/app/_features/groups/group-math";
import { physicsGroup } from "@/app/_features/groups/group-physics";
import { navigationGroup } from "@/app/_features/groups/group-navigation";
import { sciencesGroup } from "@/app/_features/groups/group-sciences";
import { toolboxSearchGroup } from "@/app/_features/groups/group-toolbox-search";

export const outilsGenerauxBar: Bar = {
  id: "bar.outils-generaux",
  position: "left",
  order: 10,
  collapse: { width: 248, minWidth: 200, maxWidth: 440, label: "Toolbox", hide: "Hide toolbox", show: "Show toolbox", hotkey: "Ctrl+[" },
  className: "flex flex-col overflow-y-auto",
  groups: [
    toolboxSearchGroup,
    mathGroup,
    physicsGroup,
    sciencesGroup,
    arabicGroup,
    frenchGroup,
    navigationGroup,
    examSummaryGroup,
  ],
};
