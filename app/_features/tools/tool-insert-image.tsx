import { ImageIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "importImage" };

export const toolInsertImage: Feature = {
  id: "tool.insert.image",
  kind: "tool",
  label: "Image",
  icon: <ImageIcon />,
  tone: "amber",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
