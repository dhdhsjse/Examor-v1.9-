import { Move } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";

// Page layout → Margins. Opens its settings in the right panel (placeholder until the controls are built).
export const inspectorLayoutMargins: Feature = {
  id: "inspector.layout.margins",
  kind: "panel",
  target: "inspector",
  order: 10,
  label: "Margins",
  icon: <Move size={18} strokeWidth={1.7} />,
  renderInspector: ({ ctx }) => <p className="text-sm italic text-faint">{ctx.t("Margin settings will be added here.")}</p>,
};
