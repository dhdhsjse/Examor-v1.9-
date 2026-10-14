"use client";

import { useCallback, useState } from "react";
import { PAGE_HEIGHT, PAGE_WIDTH } from "./a4";

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 2;
export const ZOOM_PRESETS = [0.5, 0.65, 0.75, 1, 1.5];
export const DEFAULT_ZOOM = 0.65;

const clamp = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

// Zoom level of the workspace. "fit" follows the window size; otherwise a fixed value.
export function useZoom(viewport: { width: number; height: number }) {
  const [fitMode, setFitMode] = useState(false);
  const [custom, setCustom] = useState(DEFAULT_ZOOM);

  // Zoom that shows one whole page inside the visible area.
  const fit = viewport.width
    ? clamp(Math.min((viewport.width - 80) / PAGE_WIDTH, (viewport.height - 60) / PAGE_HEIGHT))
    : DEFAULT_ZOOM;
  const zoom = fitMode ? fit : custom;

  const setZoom = useCallback((z: number) => {
    setFitMode(false);
    setCustom(clamp(Math.round(z * 100) / 100));
  }, []);

  const fitPage = useCallback(() => setFitMode(true), []);

  return { zoom, fitMode, setZoom, fitPage };
}
