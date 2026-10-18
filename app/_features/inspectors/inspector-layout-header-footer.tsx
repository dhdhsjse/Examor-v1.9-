import { PanelsTopLeft } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";
import HeaderFooterInspector from "./header-footer/HeaderFooterInspector";

// Page layout → Header and footer. Opens the header and footer settings in the right panel, for the
// whole document or for the page in view (see HeaderFooterInspector). It is also where the exam header
// is edited: selecting one on the page opens this inspector (Editor.tsx).
export const inspectorLayoutHeaderFooter: Feature = {
  id: "inspector.layout.header-footer",
  kind: "panel",
  target: "inspector",
  order: 10,
  label: "Header and footer",
  icon: <PanelsTopLeft size={18} strokeWidth={1.7} />,
  // Opened again for each exam header selected on the page, so it starts on that header's page and scope.
  renderInspector: ({ ctx }) => {
    const s = ctx.shell.selected;
    return <HeaderFooterInspector key={s && (s.type === "header" || s.meta?.role) ? s.id : "page"} ctx={ctx} />;
  },
};
