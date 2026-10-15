import { TrueFalseIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "truefalse" };

export const toolQuestionTrueFalse: Feature = {
  id: "tool.question.truefalse",
  kind: "tool",
  label: "True / False",
  icon: <TrueFalseIcon />,
  tone: "indigo",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
