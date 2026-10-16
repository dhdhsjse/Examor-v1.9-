import { BlankIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "blank" };

export const toolQuestionBlank: Feature = {
  id: "tool.question.blank",
  kind: "tool",
  label: "Fill the blank",
  icon: <BlankIcon />,
  tone: "indigo",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
