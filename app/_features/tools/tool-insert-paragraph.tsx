import { RtlTextIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "text", preset: { style: "body" } };

export const toolInsertParagraph: Feature = {
  id: "tool.insert.paragraph",
  kind: "tool",
  label: "Paragraph",
  icon: <RtlTextIcon />,
  tone: "amber",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
