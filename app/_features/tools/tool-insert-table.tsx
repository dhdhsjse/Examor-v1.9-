import { TableIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "table" };

export const toolInsertTable: Feature = {
  id: "tool.insert.table",
  kind: "tool",
  label: "Table",
  icon: <TableIcon />,
  tone: "amber",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
