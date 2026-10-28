import { Search } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";
import FindReplaceInspector from "./home/FindReplaceInspector";

// Home → Find and replace (Ctrl+F). Searches every text of the exam in the right panel and replaces one match or all of them; stays
// open while blocks are selected, so clicking a result goes to its block without closing the panel.
export const inspectorHomeFind: Feature = {
  id: "inspector.home.find",
  kind: "panel",
  target: "inspector",
  followsSelection: true,
  order: 20,
  label: "Find and replace",
  icon: <Search size={18} strokeWidth={1.7} />,
  renderInspector: ({ ctx }) => <FindReplaceInspector ctx={ctx} />,
};
