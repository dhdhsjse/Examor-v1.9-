import { SquareDashedText } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";
import TextboxInspector from "./textbox/TextboxInspector";

// The ribbon of a selected text box. It has no row in the left panel: it opens by itself when a text box
// is selected (`edits`, see blockInspectors in sections/index.ts) and only shows while one is.
export const inspectorTextbox: Feature = {
  id: "inspector.textbox",
  kind: "panel",
  target: "inspector",
  edits: ["textbox"],
  label: "Text box",
  icon: <SquareDashedText size={18} strokeWidth={1.7} />,
  renderInspector: ({ ctx }) => <TextboxInspector ctx={ctx} />,
};
