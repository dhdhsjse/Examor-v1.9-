"use client";

import { useCallback, useState } from "react";
import { canRedoStudio, canUndoStudio, editStudioHistory, isStudioDirty, redoStudioHistory, startStudioHistory, undoStudioHistory, type StudioHistory } from "@/app/_lib/studioHistory";
import type { TableData, TablePatch } from "@/app/_lib/table";

/** What the Studio holds: the table, and how wide it is on the page */
export type StudioTable = TableData & { width: number };

// The state of the Table Studio: the table, with its own undo and redo (the exam's undo history gets one step when the table is
// inserted). A change is a patch of the table (see _lib/table/ops.ts); `key` names what changed, so that typing in a cell or dragging a
// column is one step of the undo, not one per key or per pixel.
export function useTableStudio(initial: StudioTable) {
  const [history, setHistory] = useState<StudioHistory<StudioTable>>(() => startStudioHistory(initial));
  const table = history.present;

  const apply = useCallback((patch: TablePatch, key: string) => setHistory((h) => editStudioHistory(h, { ...h.present, ...patch }, key, Date.now())), []);
  const setWidth = useCallback((width: number) => setHistory((h) => editStudioHistory(h, { ...h.present, width }, "width", Date.now())), []);
  // Another table to start from (one step of the undo): its width stays.
  const load = useCallback((next: TableData) => setHistory((h) => editStudioHistory(h, { ...next, width: h.present.width }, `start:${Date.now()}`, Date.now())), []);
  const undo = useCallback(() => setHistory(undoStudioHistory), []);
  const redo = useCallback(() => setHistory(redoStudioHistory), []);

  return { table, apply, setWidth, load, undo, redo, canUndo: canUndoStudio(history), canRedo: canRedoStudio(history), dirty: isStudioDirty(history) };
}
