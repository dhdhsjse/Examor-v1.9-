import { HeaderIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "header" };

export const toolInsertHeader: Feature = {
  id: "tool.insert.header",
  kind: "tool",
  label: "Exam header",
  icon: <HeaderIcon />,
  tone: "amber",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
