import { ArabicLetterIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "open", preset: { text: "اشكل الجملة التالية شكلا تاما :", lines: 2, points: 2 } };

export const toolArabicTashkeel: Feature = {
  id: "tool.arabic.tashkeel",
  kind: "tool",
  label: "Tashkeel",
  icon: <ArabicLetterIcon />,
  tone: "emerald",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
