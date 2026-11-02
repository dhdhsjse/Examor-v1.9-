"use client";

import { useCallback, useState } from "react";
import { canRedoStudio, canUndoStudio, editStudioHistory, isStudioDirty, redoStudioHistory, startStudioHistory, undoStudioHistory, type StudioHistory } from "@/app/_lib/studioHistory";
import type { StudioGraph } from "./mathGraphPreset";

// The state of the Function Studio: the graph, with its own undo and redo (the exam's undo history gets one step when the graph is
// inserted or updated). A change is some fields of the graph; `key` names what changed, so that typing a formula or dragging the
// graph is one step of the undo, not one per key or per pixel.
export function useMathGraphStudio(initial: StudioGraph) {
  const [history, setHistory] = useState<StudioHistory<StudioGraph>>(() => startStudioHistory(initial));
  const graph = history.present;
  const apply = useCallback((changes: Partial<StudioGraph>, key: string) => setHistory((h) => editStudioHistory(h, { ...h.present, ...changes }, key, Date.now())), []);
  const undo = useCallback(() => setHistory(undoStudioHistory), []);
  const redo = useCallback(() => setHistory(redoStudioHistory), []);
  return { graph, apply, undo, redo, canUndo: canUndoStudio(history), canRedo: canRedoStudio(history), dirty: isStudioDirty(history) };
}
