import type { Bar } from "@/app/_features/core/types";
import { arabicGroup } from "@/app/_features/groups/group-arabic";
import { examSummaryGroup } from "@/app/_features/groups/group-exam-summary";
import { frenchGroup } from "@/app/_features/groups/group-french";
import { insertGroup } from "@/app/_features/groups/group-insert";
import { mathGroup } from "@/app/_features/groups/group-math";
import { physicsGroup } from "@/app/_features/groups/group-physics";
import { questionsGroup } from "@/app/_features/groups/group-questions";
import { sciencesGroup } from "@/app/_features/groups/group-sciences";
import { toolboxSearchGroup } from "@/app/_features/groups/group-toolbox-search";

export const outilsGenerauxBar: Bar = {
  id: "bar.outils-generaux",
  position: "left",
  order: 10,
  collapsible: true,
  className: "flex w-[248px] shrink-0 flex-col gap-4 overflow-y-auto border-e border-line bg-surface pb-4",
  groups: [
    toolboxSearchGroup,
    mathGroup,
    physicsGroup,
    sciencesGroup,
    arabicGroup,
    frenchGroup,
    questionsGroup,
    insertGroup,
    examSummaryGroup,
  ],
};
