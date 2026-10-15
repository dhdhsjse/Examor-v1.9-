import { CircuitIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "asset", assetId: "phys-circuit" };

export const toolPhysicsCircuit: Feature = {
  id: "tool.physics.circuit",
  kind: "tool",
  label: "Circuit",
  icon: <CircuitIcon />,
  tone: "emerald",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
