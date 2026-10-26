import { GraphPaperIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "graph-studio" };

// Opens the Graph Studio (a coordinate system on millimetre paper, with labelled axes). The "Function graph" tile next to it
// puts a plotted function on the page; this one is for the paper students plot on, or a graph drawn by hand.
export const toolGraphStudio: Feature = {
  id: "tool.graph-studio",
  kind: "tool",
  label: (t) => t("Graph paper"),
  icon: <GraphPaperIcon />,
  tone: "emerald",
  tags: ["graph", "graphique", "millimetre", "millimétré", "papier", "paper", "grid", "grille", "axes", "plot", "courbe", "curve", "coordinates", "repère", "رسم بياني", "منحنى", "ورق", "محور"],
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
