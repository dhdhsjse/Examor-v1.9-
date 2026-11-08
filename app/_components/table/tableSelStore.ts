import { useCallback, useSyncExternalStore } from "react";
import type { Sel } from "./tableSel";

// The selected cells of the table selected on the page, shared by the right panel's grid (TablePanel) and the page (cells picked with the
// table tools' Select cells, see workspace/TableDrawLayer): cells picked in one are selected in the other, and the panel's buttons, the
// floating bar's Merge and Split work on them. One table at a time: picking cells of another table forgets the first one's.
type State = { id: string | null; sel: Sel | null };

const empty: State = { id: null, sel: null };
let state: State = empty;
const listeners = new Set<() => void>();

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

export function setTableSel(id: string, sel: Sel | null) {
  const old = state.sel;
  const same = old === sel || (!!old && !!sel && old.anchor.r === sel.anchor.r && old.anchor.c === sel.anchor.c && old.focus.r === sel.focus.r && old.focus.c === sel.focus.c);
  if (state.id === id && same) return;
  state = { id, sel };
  listeners.forEach((fn) => fn());
}

/** The selected cells of table `id` now (null: none), outside React */
export const tableSelOf = (id: string): Sel | null => (state.id === id ? state.sel : null);

/** The selected cells of table `id` (null: none) and the call that changes them */
export function useTableSel(id: string | undefined): [Sel | null, (sel: Sel | null) => void] {
  const s = useSyncExternalStore(subscribe, () => state, () => empty);
  const sel = id && s.id === id ? s.sel : null;
  const set = useCallback((next: Sel | null) => {
    if (id) setTableSel(id, next);
  }, [id]);
  return [sel, set];
}
