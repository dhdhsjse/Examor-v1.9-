import { ClassifyIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "classify" };

export const toolQuestionClassify: Feature = {
  id: "tool.question.classify",
  kind: "tool",
  label: "Sort into groups",
  icon: <ClassifyIcon />,
  tone: "indigo",
  tags: ["classify", "sort", "classer", "صنف"],
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
