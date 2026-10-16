import { GeometryIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "asset", assetId: "math-triangle" };

export const toolMathGeometry: Feature = {
  id: "tool.math.geometry",
  kind: "tool",
  label: "Geometry",
  icon: <GeometryIcon />,
  tone: "emerald",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
