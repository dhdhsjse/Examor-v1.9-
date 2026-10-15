import type { Bar } from "@/app/_features/core/types";
import { exportRendererOverlay } from "@/app/_features/overlays/overlay-export-renderer";
import { historyOverlay } from "@/app/_features/overlays/overlay-history";
import { pickerOverlay } from "@/app/_features/overlays/overlay-picker";
import { previewOverlay } from "@/app/_features/overlays/overlay-preview";
import { toastOverlay } from "@/app/_features/overlays/overlay-toast";

export const overlayBar: Bar = {
  id: "bar.overlays",
  position: "overlay",
  order: 40,
  className: "contents",
  groups: [],
  features: [pickerOverlay, previewOverlay, historyOverlay, exportRendererOverlay, toastOverlay],
};
