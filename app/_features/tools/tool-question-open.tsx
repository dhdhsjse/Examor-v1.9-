import { OpenQuestionIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "open" };

export const toolQuestionOpen: Feature = {
  id: "tool.question.open",
  kind: "tool",
  label: "Open question",
  icon: <OpenQuestionIcon />,
  tone: "indigo",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
