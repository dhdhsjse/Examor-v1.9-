import { ChartColumn } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "chart-studio" };

// Opens the Chart Studio: bars, a line or a pie, made from a short list of names and values. The chart goes on the page as a picture that
// the Studio opens again (double-click).
export const toolChartStudio: Feature = {
  id: "tool.chart-studio",
  kind: "tool",
  label: (t) => t("Chart Studio"),
  icon: <ChartColumn size={18} strokeWidth={1.7} />,
  tone: "emerald",
  tags: ["chart", "graphique", "diagramme", "pie", "camembert", "circulaire", "secteurs", "bar", "barres", "bâtons", "line", "courbe", "statistics", "statistiques", "رسم", "مخطط", "إحصاء", "أعمدة", "دائري"],
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
