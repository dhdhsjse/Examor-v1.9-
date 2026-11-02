import { DividerIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "divider" };

// A separating line between two parts of the exam; its look (dashed, double, with a text, "cut here"…) is chosen in its Properties.
export const toolInsertDivider: Feature = {
  id: "tool.insert.divider",
  kind: "tool",
  label: "Separator",
  icon: <DividerIcon />,
  tone: "amber",
  tags: ["line", "separator", "divider", "ligne", "séparateur", "trait", "خط", "فاصل"],
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
