import type { Bar } from "@/app/_features/core/types";
import { mathKeyboardOverlay } from "@/app/_features/overlays/overlay-math-keyboard";

// Sits over the pages (inside the page area).
export const canvasBar: Bar = {
  id: "bar.canvas",
  position: "bottom",
  order: 20,
  className: "contents",
  groups: [],
  features: [mathKeyboardOverlay],
};
