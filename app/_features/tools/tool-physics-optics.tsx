import { FlaskIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "asset", assetId: "phys-lens" };

export const toolPhysicsOptics: Feature = {
  id: "tool.physics.optics",
  kind: "tool",
  label: "Optics",
  icon: <FlaskIcon />,
  tone: "emerald",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
