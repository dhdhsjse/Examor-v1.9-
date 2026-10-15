import { FlaskIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "asset", assetId: "sci-watercycle" };

export const toolSciencesWaterCycle: Feature = {
  id: "tool.sciences.water-cycle",
  kind: "tool",
  label: "Water cycle",
  icon: <FlaskIcon />,
  tone: "emerald",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
