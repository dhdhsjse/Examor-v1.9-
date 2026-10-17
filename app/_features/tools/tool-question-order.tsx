import { OrderIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "order" };

export const toolQuestionOrder: Feature = {
  id: "tool.question.order",
  kind: "tool",
  label: "Put in order",
  icon: <OrderIcon />,
  tone: "indigo",
  tags: ["order", "sequence", "ordre", "رتب"],
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
