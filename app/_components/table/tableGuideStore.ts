import { useSyncExternalStore } from "react";

// A line of the selected table being dragged on the page (canvas/blocks/TableHandles): where it is and the stretches of the same size the
// magnet found, in px of the table's box (as seen: x from its left). The page's table layer (workspace/TableDrawLayer) draws them over the
// table, since the selected block's own node is not seen (see ExamCanvas, "ghost").
export type TableGuide = { id: string; vertical: boolean; at: number; marks: [number, number][] } | null;

let guide: TableGuide = null;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

export function setTableGuide(next: TableGuide) {
  if (JSON.stringify(next) === JSON.stringify(guide)) return;
  guide = next;
  listeners.forEach((fn) => fn());
}

export const useTableGuide = () => useSyncExternalStore(subscribe, () => guide, () => null);
