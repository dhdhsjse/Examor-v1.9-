import { Shapes } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";
import ShapeInspector from "./shape/ShapeInspector";

// The properties of a selected shape. It has no row in the left panel: it opens by itself when a shape is selected (`edits`, see
// blockInspectors in sections/index.ts) and only shows while one is.
export const inspectorShape: Feature = {
  id: "inspector.shape",
  kind: "panel",
  target: "inspector",
  edits: ["shape"],
  label: "Shape",
  icon: <Shapes size={18} strokeWidth={1.7} />,
  renderInspector: ({ ctx }) => <ShapeInspector ctx={ctx} />,
};
