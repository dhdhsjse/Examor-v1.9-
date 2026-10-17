"use client";

import { useCallback, useState } from "react";
import { PAGE_HEIGHT, PAGE_WIDTH } from "./a4";
import { CANVAS_TOP_GAP, LABEL_HEIGHT } from "./pageStack";

// "Fit page" keeps the page label above the page and the page itself clear of the floating
// tools / zoom bar below it (38px high, 16px off the bottom, + a small margin).
const FIT_SPACE_Y = CANVAS_TOP_GAP + LABEL_HEIGHT + 62;

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 4;
export const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
export const DEFAULT_ZOOM = 0.65;

export type FitMode = "page" | "width" | null;

export const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

// Zoom level of the workspace: any value between 10% and 400%, or "fit" to the window.
export function useZoom(viewport: { width: number; height: number }) {
  const [fitMode, setFitMode] = useState<FitMode>(null);
  const [custom, setCustom] = useState(DEFAULT_ZOOM);

  // Zoom that shows one whole page (or the page width) inside the visible area.
  const fit = !viewport.width
    ? DEFAULT_ZOOM
    : fitMode === "width"
      ? clampZoom((viewport.width - 80) / PAGE_WIDTH)
      : clampZoom(Math.min((viewport.width - 80) / PAGE_WIDTH, (viewport.height - FIT_SPACE_Y) / PAGE_HEIGHT));
  const zoom = fitMode ? fit : custom;

  const setZoom = useCallback((z: number) => {
    setFitMode(null);
    setCustom(clampZoom(Math.round(z * 1000) / 1000));
  }, []);

  const fitPage = useCallback(() => setFitMode("page"), []);
  const fitWidth = useCallback(() => setFitMode("width"), []);

  return { zoom, fitMode, setZoom, fitPage, fitWidth };
}
