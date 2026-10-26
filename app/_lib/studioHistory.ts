// Undo and redo for a Studio's own document, whatever its type. Edits of the same field made within COALESCE_MS of each other
// replace each other, so typing in one field or dragging one thing is one step, not one per key or per pixel. Pure functions
// (no React), unit-tested through the Studios that use it.

export const COALESCE_MS = 800;
const LIMIT = 100;

export type StudioHistory<T> = {
  past: T[];
  present: T;
  future: T[];
  /** What it was opened with: the Studio is "dirty" when the present is not that */
  start: T;
  /** The key of the last edit and when it was made, to merge a quick series of edits */
  last: { key: string; at: number } | null;
};

/** How two documents are told apart: by default, by what they hold (not by being the same object). */
export const sameDocument = <T>(a: T, b: T) => a === b || JSON.stringify(a) === JSON.stringify(b);

export const startStudioHistory = <T>(doc: T): StudioHistory<T> => ({ past: [], present: doc, future: [], start: doc, last: null });

/** `next` is the new document; `key` names what was changed ("" = never merged). The same document back is not a step. */
export function editStudioHistory<T>(h: StudioHistory<T>, next: T, key: string, now: number): StudioHistory<T> {
  if (sameDocument(h.present, next)) return h;
  const merge = key !== "" && h.last?.key === key && now - h.last.at < COALESCE_MS && h.past.length > 0;
  const past = merge ? h.past : [...h.past, h.present].slice(-LIMIT);
  return { ...h, past, present: next, future: [], last: { key, at: now } };
}

export function undoStudioHistory<T>(h: StudioHistory<T>): StudioHistory<T> {
  if (!h.past.length) return h;
  return { ...h, past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], last: null };
}

export function redoStudioHistory<T>(h: StudioHistory<T>): StudioHistory<T> {
  if (!h.future.length) return h;
  return { ...h, past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), last: null };
}

export const canUndoStudio = <T>(h: StudioHistory<T>) => h.past.length > 0;
export const canRedoStudio = <T>(h: StudioHistory<T>) => h.future.length > 0;
export const isStudioDirty = <T>(h: StudioHistory<T>) => !sameDocument(h.present, h.start);
