import { toolCircuitStudio } from "@/app/_features/tools/tool-circuit-studio";
import { toolGraphStudio } from "@/app/_features/tools/tool-graph-studio";
import type { Group } from "@/app/_features/core/types";
import { toolMolecule } from "@/app/_features/tools/tool-molecule";
import { toolMoleculeLab } from "@/app/_features/tools/tool-molecule-lab";

export const physicsGroup: Group = {
  id: "group.physics",
  order: 20,
  when: (ctx) => ctx.shell.subject === "Physics",
  label: (t) => t("{subject} tools", { subject: t("Physics") }),
  className: "grid grid-cols-2 gap-1.5",
  features: [toolMolecule, toolMoleculeLab, toolGraphStudio, toolCircuitStudio],
};
