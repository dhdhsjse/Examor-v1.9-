import { BlankIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "blank", preset: { text: "Complétez avec le bon déterminant :", content: "[Le] chat dort sur [la] chaise." } };

export const toolFrenchGrammar: Feature = {
  id: "tool.french.grammar",
  kind: "tool",
  label: "Grammar",
  icon: <BlankIcon />,
  tone: "emerald",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
