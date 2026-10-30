import { SquarePen } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

// Wider than any page: the box is fitted between the page's margins (useExam.addBlock).
const PAGE_WIDE = 10000;

const action: ToolAction = { kind: "block", type: "textbox", preset: { width: PAGE_WIDE, sizing: "auto-height" } };

// A free question: a text box from one margin to the other that grows with its text. While typing in it (or in
// any text box), the question types of Insert → Questions go inside it, at the cursor (textSnippets.ts).
export const toolQuestionFree: Feature = {
  id: "tool.question.free",
  kind: "tool",
  label: "Free question",
  icon: <SquarePen size={18} strokeWidth={1.7} />,
  tone: "indigo",
  tags: ["free", "text box", "libre", "question libre", "سؤال حر"],
  dragPayload: action,
  run: (ctx) => {
    ctx.shell.runTool(action);
    ctx.shell.notify(ctx.t("Type the question, then pick a question type to add it inside"));
  },
};
