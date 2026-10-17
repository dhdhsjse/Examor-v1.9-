import { MatchIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "match" };

export const toolQuestionMatch: Feature = {
  id: "tool.question.match",
  kind: "tool",
  label: "Matching",
  icon: <MatchIcon />,
  tone: "indigo",
  tags: ["match", "link", "relier", "اربط"],
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
