import type { Bar } from "@/app/_features/core/types";
import { exportRendererOverlay } from "@/app/_features/overlays/overlay-export-renderer";
import { historyOverlay } from "@/app/_features/overlays/overlay-history";
import { moleculeOverlay } from "@/app/_features/overlays/overlay-molecule";
import { circuitStudioOverlay } from "@/app/_features/overlays/overlay-circuit-studio";
import { probaStudioOverlay } from "@/app/_features/overlays/overlay-proba-studio";
import { tableStudioOverlay } from "@/app/_features/overlays/overlay-table-studio";
import { graphStudioOverlay } from "@/app/_features/overlays/overlay-graph-studio";
import { chartStudioOverlay } from "@/app/_features/overlays/overlay-chart-studio";
import { moleculeLabOverlay } from "@/app/_features/overlays/overlay-molecule-lab";
import { pickerOverlay } from "@/app/_features/overlays/overlay-picker";
import { onboardingOverlay } from "@/app/_features/overlays/onboarding";
import { previewOverlay } from "@/app/_features/overlays/overlay-preview";
import { sheetWizardOverlay } from "@/app/_features/overlays/overlay-sheet-wizard";
import { toastOverlay } from "@/app/_features/overlays/overlay-toast";

export const overlayBar: Bar = {
  id: "bar.overlays",
  position: "overlay",
  order: 40,
  className: "contents",
  groups: [],
  features: [onboardingOverlay, pickerOverlay, sheetWizardOverlay, previewOverlay, historyOverlay, moleculeOverlay, moleculeLabOverlay, graphStudioOverlay, circuitStudioOverlay, probaStudioOverlay, tableStudioOverlay, chartStudioOverlay, exportRendererOverlay, toastOverlay],
};
