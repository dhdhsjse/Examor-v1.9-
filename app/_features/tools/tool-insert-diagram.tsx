import { DiagramIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "library" };

export const toolInsertDiagram: Feature = {
  id: "tool.insert.diagram",
  kind: "tool",
  label: "Diagram",
  icon: <DiagramIcon />,
  tone: "amber",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
