import { FractionIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "equation", preset: { latex: "\\frac{a}{b}+\\frac{c}{d}=\\frac{\\ldots}{\\ldots}" } };

export const toolMathFraction: Feature = {
  id: "tool.math.fraction",
  kind: "tool",
  label: "Fraction",
  icon: <FractionIcon />,
  tone: "emerald",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
