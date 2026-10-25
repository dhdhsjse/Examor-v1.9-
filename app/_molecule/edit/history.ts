// Local undo / redo of the Studio. Only the final Insert / Update goes into the exam's own history.

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  key?: string; // the kind of the last change, to merge a burst of the same one (a drag) into one step
  at: number;
}

const MERGE_MS = 900;

export const createHistory = <T,>(present: T, now = Date.now()): History<T> => ({ past: [], present, future: [], at: now });

// A change with the same `key` as the last one, soon after it, replaces it instead of adding a step.
export function commit<T>(h: History<T>, next: T, key?: string, now = Date.now()): History<T> {
  if (next === h.present) return h;
  if (key && key === h.key && now - h.at < MERGE_MS) return { ...h, present: next, future: [], at: now };
  return { past: [...h.past, h.present], present: next, future: [], key, at: now };
}

export function undo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], key: undefined, at: 0 };
}

export function redo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), key: undefined, at: 0 };
}

export const canUndo = (h: History<unknown>) => h.past.length > 0;
export const canRedo = (h: History<unknown>) => h.future.length > 0;
