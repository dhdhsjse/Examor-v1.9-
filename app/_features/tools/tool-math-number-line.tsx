import { NumberLineIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "asset", assetId: "math-numberline" };

export const toolMathNumberLine: Feature = {
  id: "tool.math.number-line",
  kind: "tool",
  label: "Number line",
  icon: <NumberLineIcon />,
  tone: "emerald",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
