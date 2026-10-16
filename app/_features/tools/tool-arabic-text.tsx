import { RtlTextIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "text", preset: { style: "body", text: "اقرأ النص التالي ثم أجب عن الأسئلة :" } };

export const toolArabicText: Feature = {
  id: "tool.arabic.text",
  kind: "tool",
  label: "Arabic text",
  icon: <RtlTextIcon />,
  tone: "emerald",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
