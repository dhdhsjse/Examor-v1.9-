import { toolGraphStudio } from "@/app/_features/tools/tool-graph-studio";
import type { Group } from "@/app/_features/core/types";
import { toolMathGeometry } from "@/app/_features/tools/tool-math-geometry";
import { toolMathGraph } from "@/app/_features/tools/tool-math-graph";
import { toolMathNumberLine } from "@/app/_features/tools/tool-math-number-line";

export const mathGroup: Group = {
  id: "group.math",
  order: 20,
  when: (ctx) => ctx.shell.subject === "Math",
  label: (t) => t("{subject} tools", { subject: t("Math") }),
  className: "grid grid-cols-2 gap-1.5",
  features: [toolMathGraph, toolGraphStudio, toolMathGeometry, toolMathNumberLine],
};
