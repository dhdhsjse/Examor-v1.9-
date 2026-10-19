import { CaseSensitive } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";
import FontInspector from "./home/FontInspector";

// Home → Font. Opens the fonts of the font library in the right panel, for the selected block; stays
// open while other blocks are selected (see FontInspector).
export const inspectorHomeFont: Feature = {
  id: "inspector.home.font",
  kind: "panel",
  target: "inspector",
  followsSelection: true,
  order: 5,
  label: "Font",
  icon: <CaseSensitive size={18} strokeWidth={1.7} />,
  renderInspector: ({ ctx }) => <FontInspector ctx={ctx} />,
};
