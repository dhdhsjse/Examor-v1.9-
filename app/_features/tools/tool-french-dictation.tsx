import { PenLinesIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "open", preset: { text: "Dictée", lines: 10, points: 5 } };

export const toolFrenchDictation: Feature = {
  id: "tool.french.dictation",
  kind: "tool",
  label: "Dictation",
  icon: <PenLinesIcon />,
  tone: "emerald",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
