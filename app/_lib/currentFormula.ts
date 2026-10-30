// The formula of a text box being edited (tiptap-math.ts), so the Properties panel can show it in a big equation field too, like an
// equation block's: what is typed in either one goes to the other. It is the formula last clicked in, until the cursor goes back to the
// words of the box or the box closes.

import { useSyncExternalStore } from "react";

export interface CurrentFormula {
  id: number; // which formula (another id: another formula, a new field in the panel)
  latex: string;
  setLatex: (latex: string) => void; // typed in the panel: the formula in the text takes it
}

let current: CurrentFormula | null = null;
const listeners = new Set<() => void>();

export function setCurrentFormula(f: CurrentFormula | null) {
  if (f === current) return;
  current = f;
  listeners.forEach((listen) => listen());
}

/** The formula `id` is no longer the one being edited (it went away). Another one that took over stays. */
export function dropCurrentFormula(id: number) {
  if (current?.id === id) setCurrentFormula(null);
}

export const getCurrentFormula = () => current;

export function useCurrentFormula(): CurrentFormula | null {
  return useSyncExternalStore(
    (listen) => {
      listeners.add(listen);
      return () => {
        listeners.delete(listen);
      };
    },
    () => current,
    () => null,
  );
}
