import { Frame } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";
import PageBorderInspector from "./page-border/PageBorderInspector";

// Page layout → Page borders. Opens the designs of a border around the page in the right panel (see PageBorderInspector).
export const inspectorLayoutPageBorder: Feature = {
  id: "inspector.layout.page-border",
  kind: "panel",
  target: "inspector",
  order: 10,
  label: "Page borders",
  icon: <Frame size={18} strokeWidth={1.7} />,
  renderInspector: ({ ctx }) => <PageBorderInspector ctx={ctx} />,
};
