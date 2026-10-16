import { LabelIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "asset", assetId: "sci-foodchain" };

export const toolSciencesFoodChain: Feature = {
  id: "tool.sciences.food-chain",
  kind: "tool",
  label: "Food chain",
  icon: <LabelIcon />,
  tone: "emerald",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
