import { TableIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "asset", assetId: "table-irab" };

export const toolArabicIrabTable: Feature = {
  id: "tool.arabic.irab-table",
  kind: "tool",
  label: "I'rab table",
  icon: <TableIcon />,
  tone: "emerald",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
