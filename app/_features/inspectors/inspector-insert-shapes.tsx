import { Shapes } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";
import ShapesInspector from "./shape/ShapesInspector";

// Insert → Shapes: lines, rectangles, arrows, flowchart symbols, stars, callouts… The gallery opens in the right panel.
export const inspectorInsertShapes: Feature = {
  id: "inspector.insert.shapes",
  kind: "panel",
  target: "inspector",
  order: 25,
  label: "Shapes",
  icon: <Shapes size={18} strokeWidth={1.7} />,
  tags: ["shape", "arrow", "line", "box", "flowchart", "callout", "star", "forme", "flèche", "شكل", "سهم"],
  renderInspector: ({ ctx }) => <ShapesInspector ctx={ctx} />,
};
