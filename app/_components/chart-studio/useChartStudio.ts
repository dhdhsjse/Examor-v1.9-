"use client";

import { useCallback, useState } from "react";
import type { ChartConfig } from "@/app/_lib/chart/types";
import { canRedoStudio, canUndoStudio, editStudioHistory, isStudioDirty, redoStudioHistory, startStudioHistory, undoStudioHistory, type StudioHistory } from "@/app/_lib/studioHistory";

/** How a part of the Studio changes the chart: a function of the chart (so that two changes made at once do not undo each other), and a key naming what changed */
export type Edit = (change: (c: ChartConfig) => ChartConfig, key: string) => void;

// The state of the Chart Studio: the chart, with its own undo and redo (the exam's undo history gets one step when the chart is inserted or
// updated). `key` names what changed, so that typing a title or dragging a number is one step of the undo, not one per key.
export function useChartStudio(initial: ChartConfig) {
  const [history, setHistory] = useState<StudioHistory<ChartConfig>>(() => startStudioHistory(initial));
  const config = history.present;
  const edit = useCallback<Edit>((change, key) => setHistory((h) => editStudioHistory(h, change(h.present), key, Date.now())), []);
  const undo = useCallback(() => setHistory(undoStudioHistory), []);
  const redo = useCallback(() => setHistory(redoStudioHistory), []);
  return { config, edit, undo, redo, canUndo: canUndoStudio(history), canRedo: canRedoStudio(history), dirty: isStudioDirty(history) };
}
