import { LayoutTemplate } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";
import PageFormatInspector from "./page-format/PageFormatInspector";

// Page layout → Page format. Opens the orientation and paper size of the page in view in the right
// panel (see PageFormatInspector). Each page has its own format.
export const inspectorLayoutPageFormat: Feature = {
  id: "inspector.layout.page-format",
  kind: "panel",
  target: "inspector",
  order: 10,
  label: "Page format",
  icon: <LayoutTemplate size={18} strokeWidth={1.7} />,
  renderInspector: ({ ctx }) => <PageFormatInspector ctx={ctx} />,
};
