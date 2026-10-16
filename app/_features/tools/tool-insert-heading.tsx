import { HeadingIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "text", preset: { style: "heading" } };

export const toolInsertHeading: Feature = {
  id: "tool.insert.heading",
  kind: "tool",
  label: "Heading",
  icon: <HeadingIcon />,
  tone: "amber",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
