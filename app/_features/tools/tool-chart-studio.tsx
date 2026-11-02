import { ChartColumn } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "chart-studio" };

// Opens the Chart Studio: columns, bars, lines, pies, areas, scatters, radars, histograms, boxes, waterfalls, funnels and combinations, made from a
// table that works like a spreadsheet. The chart goes on the page as a picture that the Studio opens again (double-click).
export const toolChartStudio: Feature = {
  id: "tool.chart-studio",
  kind: "tool",
  label: (t) => t("Chart Studio"),
  icon: <ChartColumn size={18} strokeWidth={1.7} />,
  tone: "emerald",
  tags: ["chart", "graphique", "diagramme", "histogram", "histogramme", "pie", "camembert", "secteurs", "bar", "barres", "column", "colonnes", "line", "courbe", "statistics", "statistiques", "boxplot", "boîte à moustaches", "scatter", "nuage de points", "radar", "radar", "رسم", "مخطط", "إحصاء", "أعمدة", "دائري", "مدرج تكراري"],
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
