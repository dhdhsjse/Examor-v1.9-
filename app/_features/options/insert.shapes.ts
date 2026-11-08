import type { Option } from "@/app/_features/core/types";
import { inspectorInsertShapes } from "@/app/_features/inspectors/inspector-insert-shapes";

// No heading: a single row, "Shapes", that opens the gallery in the right panel (pick a shape, then drag on the page to draw it).
export const insertShapesOption: Option = {
  id: "option.insert.shapes",
  order: 30,
  features: [inspectorInsertShapes],
};
