"use client";

import { useSyncExternalStore } from "react";

// Home → Show formatting marks (¶): the paragraph and line-break marks of the text box being typed in, as Word's button does. A
// view setting of the person, not of the exam: kept here (and for the next visit in the browser), not in the document.

const KEY = "examBuilder.showMarks";
let on = false;
try {
  on = localStorage.getItem(KEY) === "1";
} catch {
  // (no storage: off)
}
const listeners = new Set<() => void>();

export const formattingMarks = {
  get: () => on,
  toggle: () => {
    on = !on;
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch {
      // (the choice only lasts until the page is closed)
    }
    for (const l of listeners) l();
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};

export const useShowMarks = (): boolean => useSyncExternalStore(formattingMarks.subscribe, formattingMarks.get, () => false);
