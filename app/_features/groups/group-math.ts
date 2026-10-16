import type { Group } from "@/app/_features/core/types";
import { toolMathFraction } from "@/app/_features/tools/tool-math-fraction";
import { toolMathGeometry } from "@/app/_features/tools/tool-math-geometry";
import { toolMathGraph } from "@/app/_features/tools/tool-math-graph";
import { toolMathNumberLine } from "@/app/_features/tools/tool-math-number-line";

export const mathGroup: Group = {
  id: "group.math",
  order: 20,
  when: (ctx) => ctx.shell.subject === "Math",
  label: (t) => t("{subject} tools", { subject: t("Math") }),
  className: "grid grid-cols-2 gap-2",
  features: [toolMathGraph, toolMathGeometry, toolMathNumberLine, toolMathFraction],
};
