import { Type } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";
import FormattingInspector from "./home/FormattingInspector";

// Home → Formatting. Opens the font and paragraph settings of the selected block in the right panel,
// and keeps them there while other blocks are selected (see FormattingInspector).
export const inspectorHomeFormatting: Feature = {
  id: "inspector.home.formatting",
  kind: "panel",
  target: "inspector",
  followsSelection: true,
  order: 10,
  label: "Formatting",
  icon: <Type size={18} strokeWidth={1.7} />,
  renderInspector: ({ ctx }) => <FormattingInspector ctx={ctx} />,
};
