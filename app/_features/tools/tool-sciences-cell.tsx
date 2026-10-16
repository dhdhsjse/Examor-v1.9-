import { CellIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "asset", assetId: "sci-cell" };

export const toolSciencesCell: Feature = {
  id: "tool.sciences.cell",
  kind: "tool",
  label: "Cell diagram",
  icon: <CellIcon />,
  tone: "emerald",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
