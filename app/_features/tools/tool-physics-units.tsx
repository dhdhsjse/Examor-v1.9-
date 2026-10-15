import { RulerIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "asset", assetId: "table-units" };

export const toolPhysicsUnits: Feature = {
  id: "tool.physics.units",
  kind: "tool",
  label: "Units",
  icon: <RulerIcon />,
  tone: "emerald",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
