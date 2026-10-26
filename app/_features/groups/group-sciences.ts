import { toolCircuitStudio } from "@/app/_features/tools/tool-circuit-studio";
import { toolGraphStudio } from "@/app/_features/tools/tool-graph-studio";
import type { Group } from "@/app/_features/core/types";
import { toolMolecule } from "@/app/_features/tools/tool-molecule";
import { toolMoleculeLab } from "@/app/_features/tools/tool-molecule-lab";
import { toolSciencesCell } from "@/app/_features/tools/tool-sciences-cell";
import { toolSciencesClassification } from "@/app/_features/tools/tool-sciences-classification";
import { toolSciencesFoodChain } from "@/app/_features/tools/tool-sciences-food-chain";
import { toolSciencesWaterCycle } from "@/app/_features/tools/tool-sciences-water-cycle";

export const sciencesGroup: Group = {
  id: "group.sciences",
  order: 20,
  when: (ctx) => ctx.shell.subject === "Sciences",
  label: (t) => t("{subject} tools", { subject: t("Sciences") }),
  className: "grid grid-cols-2 gap-1.5",
  features: [toolSciencesCell, toolSciencesFoodChain, toolSciencesWaterCycle, toolSciencesClassification, toolMolecule, toolMoleculeLab, toolGraphStudio, toolCircuitStudio],
};
