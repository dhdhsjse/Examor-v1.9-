import { TableIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "asset", assetId: "table-conjugation" };

export const toolFrenchConjugation: Feature = {
  id: "tool.french.conjugation",
  kind: "tool",
  label: "Conjugation",
  icon: <TableIcon />,
  tone: "emerald",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
