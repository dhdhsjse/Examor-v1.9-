import { GraphIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "graph" };

export const toolInsertGraph: Feature = {
  id: "tool.insert.graph",
  kind: "tool",
  label: "Graph",
  icon: <GraphIcon />,
  tone: "amber",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
