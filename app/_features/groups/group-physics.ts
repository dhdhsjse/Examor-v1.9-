import { toolCircuitStudio } from "@/app/_features/tools/tool-circuit-studio";
import { toolGraphStudio } from "@/app/_features/tools/tool-graph-studio";
import type { Group } from "@/app/_features/core/types";
import { toolMolecule } from "@/app/_features/tools/tool-molecule";
import { toolMoleculeLab } from "@/app/_features/tools/tool-molecule-lab";
import { toolPhysicsCircuit } from "@/app/_features/tools/tool-physics-circuit";
import { toolPhysicsForces } from "@/app/_features/tools/tool-physics-forces";
import { toolPhysicsOptics } from "@/app/_features/tools/tool-physics-optics";
import { toolPhysicsUnits } from "@/app/_features/tools/tool-physics-units";

export const physicsGroup: Group = {
  id: "group.physics",
  order: 20,
  when: (ctx) => ctx.shell.subject === "Physics",
  label: (t) => t("{subject} tools", { subject: t("Physics") }),
  className: "grid grid-cols-2 gap-1.5",
  features: [toolPhysicsCircuit, toolPhysicsForces, toolPhysicsUnits, toolPhysicsOptics, toolMolecule, toolMoleculeLab, toolGraphStudio, toolCircuitStudio],
};
