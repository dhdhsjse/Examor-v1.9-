import type { Bar } from "@/app/_features/core/types";
import { canvasBar } from "./bars/bar-canvas";
import { overlayBar } from "./bars/bar-overlays";
import { outilsGenerauxBar } from "./bars/bar-outils-generaux";
import { rightPanelBar } from "./bars/bar-right-panel";
import { topBar } from "./bars/bar-top";

// The whole screen. The only file that knows every bar.
export const appLayout: Bar[] = [topBar, outilsGenerauxBar, canvasBar, rightPanelBar, overlayBar];
