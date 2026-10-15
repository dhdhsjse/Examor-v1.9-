import { VerseIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "text", preset: { style: "body", text: "صدر البيت .....................          عجز البيت ....................." } };

export const toolArabicPoetry: Feature = {
  id: "tool.arabic.poetry",
  kind: "tool",
  label: "Poetry verse",
  icon: <VerseIcon />,
  tone: "emerald",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
