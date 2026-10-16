import { EquationIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "equation" };

export const toolInsertEquation: Feature = {
  id: "tool.insert.equation",
  kind: "tool",
  label: "Equation",
  icon: <EquationIcon />,
  tone: "amber",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
