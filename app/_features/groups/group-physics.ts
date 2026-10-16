import type { Group } from "@/app/_features/core/types";
import { toolPhysicsCircuit } from "@/app/_features/tools/tool-physics-circuit";
import { toolPhysicsForces } from "@/app/_features/tools/tool-physics-forces";
import { toolPhysicsOptics } from "@/app/_features/tools/tool-physics-optics";
import { toolPhysicsUnits } from "@/app/_features/tools/tool-physics-units";

export const physicsGroup: Group = {
  id: "group.physics",
  order: 20,
  when: (ctx) => ctx.shell.subject === "Physics",
  label: (t) => t("{subject} tools", { subject: t("Physics") }),
  className: "grid grid-cols-2 gap-2",
  features: [toolPhysicsCircuit, toolPhysicsForces, toolPhysicsUnits, toolPhysicsOptics],
};
