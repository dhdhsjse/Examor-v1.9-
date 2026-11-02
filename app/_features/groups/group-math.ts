import type { Group } from "@/app/_features/core/types";
import { toolChartStudio } from "@/app/_features/tools/tool-chart-studio";
import { toolMathGraph } from "@/app/_features/tools/tool-math-graph";
import { toolProbaStudio } from "@/app/_features/tools/tool-proba-studio";

export const mathGroup: Group = {
  id: "group.math",
  order: 20,
  when: (ctx) => ctx.shell.subject === "Math",
  label: (t) => t("{subject} tools", { subject: t("Math") }),
  className: "grid grid-cols-2 gap-1.5",
  features: [toolMathGraph, toolChartStudio, toolProbaStudio],
};
