import { VectorIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "asset", assetId: "phys-incline" };

export const toolPhysicsForces: Feature = {
  id: "tool.physics.forces",
  kind: "tool",
  label: "Forces",
  icon: <VectorIcon />,
  tone: "emerald",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
