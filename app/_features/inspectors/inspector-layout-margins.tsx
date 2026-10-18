import { Move } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";
import MarginsInspector from "./margins/MarginsInspector";

// Page layout → Margins. Opens its settings in the right panel: presets and a field per side,
// shown live on the canvas (see MarginsInspector).
export const inspectorLayoutMargins: Feature = {
  id: "inspector.layout.margins",
  kind: "panel",
  target: "inspector",
  order: 10,
  label: "Margins",
  icon: <Move size={18} strokeWidth={1.7} />,
  renderInspector: ({ ctx }) => <MarginsInspector ctx={ctx} />,
};
