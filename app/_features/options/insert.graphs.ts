import type { Option } from "@/app/_features/core/types";
import { toolInsertDiagram } from "@/app/_features/tools/tool-insert-diagram";
import { toolInsertGraph } from "@/app/_features/tools/tool-insert-graph";

export const insertGraphsOption: Option = {
  id: "option.insert.graphs",
  order: 30,
  label: (t) => t("Graphs"),
  features: [toolInsertGraph, toolInsertDiagram],
};
