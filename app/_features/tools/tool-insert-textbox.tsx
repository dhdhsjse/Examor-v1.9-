import { SquareDashedText } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "block", type: "textbox" };

// A text in a box of any size: the text wraps inside it. Click, then drag on the page to draw the box
// (like Word's "Draw Text Box"; clicking again or Escape cancels); or drag the tile onto the page for a
// box of the usual size. A selected text box opens its ribbon in the right panel.
export const toolInsertTextbox: Feature = {
  id: "tool.insert.textbox",
  kind: "tool",
  label: "Text box",
  icon: <SquareDashedText size={18} strokeWidth={1.7} />,
  tone: "amber",
  hotkey: "B",
  tags: ["draw", "frame", "zone", "cadre", "مربع"],
  dragPayload: action,
  checked: (ctx) => ctx.shell.canvasTool === "textbox",
  run: (ctx) => ctx.shell.setCanvasTool(ctx.shell.canvasTool === "textbox" ? "select" : "textbox"),
};
