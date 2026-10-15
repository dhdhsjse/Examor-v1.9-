import { McqIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "mcq" };

export const toolQuestionMcq: Feature = {
  id: "tool.question.mcq",
  kind: "tool",
  label: "Multiple choice",
  icon: <McqIcon />,
  tone: "indigo",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
