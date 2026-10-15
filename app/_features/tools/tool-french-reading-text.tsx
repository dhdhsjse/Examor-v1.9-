import { BookIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "text", preset: { style: "body", text: "Lisez attentivement le texte suivant, puis répondez aux questions." } };

export const toolFrenchReadingText: Feature = {
  id: "tool.french.reading-text",
  kind: "tool",
  label: "Reading text",
  icon: <BookIcon />,
  tone: "emerald",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
