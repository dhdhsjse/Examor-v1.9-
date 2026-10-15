import { TreeIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "asset", assetId: "table-classify" };

export const toolSciencesClassification: Feature = {
  id: "tool.sciences.classification",
  kind: "tool",
  label: "Classification",
  icon: <TreeIcon />,
  tone: "emerald",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
