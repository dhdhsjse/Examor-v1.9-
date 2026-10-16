import { GraphIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "graph" };

export const toolMathGraph: Feature = {
  id: "tool.math.graph",
  kind: "tool",
  label: "Function graph",
  icon: <GraphIcon />,
  tone: "emerald",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
