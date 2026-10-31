// The keyboard's clipboard, like a phone keyboard's: the last equations the teacher finished writing, ready to be put in again with
// one click, and the ones pinned to keep for good. Kept in the browser (localStorage), shared by the page and the studios.
//
// An equation is "finished" when the teacher leaves its field (activeMathfield.ts calls `recordEquation` then): one still being
// typed, one with an empty box left in it, or a short one (x², 3x…) quicker to type again, is not kept.

const KEY = "examBuilder.equationClipboard";
export const MAX_RECENT = 20;
export const MAX_PINNED = 60;
const MIN_LENGTH = 6; // characters of LaTeX, spaces left out

export interface ClipboardState {
  pinned: string[]; // newest first
  recent: string[]; // newest first, never one that is pinned
}

const EMPTY: ClipboardState = { pinned: [], recent: [] };

const clean = (latex: string) => latex.trim();

/** Worth keeping: finished (no box left to fill) and long enough not to be quicker to type again. */
export function worthKeeping(latex: string): boolean {
  const l = clean(latex);
  if (/\\placeholder|#\?|#0|#@/.test(l)) return false;
  return l.replace(/\s+|\\[,;:!]|\\left|\\right/g, "").length >= MIN_LENGTH;
}

// ---- Pure updates (tested) ----

/** `replaces`: what the same field gave last time (the teacher came back to finish it): that older draft goes, the new one takes its
 *  place at the top. */
export function withRecorded(s: ClipboardState, latex: string, replaces?: string): ClipboardState {
  const l = clean(latex);
  if (!worthKeeping(l) || s.pinned.includes(l)) return s;
  const old = replaces === undefined ? undefined : clean(replaces);
  if (s.recent[0] === l && (old === undefined || old === l || !s.recent.includes(old))) return s;
  return { ...s, recent: [l, ...s.recent.filter((x) => x !== l && x !== old)].slice(0, MAX_RECENT) };
}

export function withPinned(s: ClipboardState, latex: string): ClipboardState {
  const l = clean(latex);
  if (!l || s.pinned.includes(l)) return s;
  return {
    pinned: [l, ...s.pinned].slice(0, MAX_PINNED),
    recent: s.recent.filter((x) => x !== l),
  };
}

/** Unpinned, it goes back to the top of the recent ones rather than vanishing. */
export function withUnpinned(s: ClipboardState, latex: string): ClipboardState {
  if (!s.pinned.includes(latex)) return s;
  return {
    pinned: s.pinned.filter((x) => x !== latex),
    recent: [latex, ...s.recent.filter((x) => x !== latex)].slice(0, MAX_RECENT),
  };
}

export const withRemoved = (s: ClipboardState, latex: string): ClipboardState => ({
  pinned: s.pinned.filter((x) => x !== latex),
  recent: s.recent.filter((x) => x !== latex),
});

export const withRecentCleared = (s: ClipboardState): ClipboardState => ({
  ...s,
  recent: [],
});

// ---- The store ----

let state: ClipboardState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : []);

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (raw) {
      const pinned = strings(raw.pinned).slice(0, MAX_PINNED);
      state = {
        pinned,
        recent: strings(raw.recent)
          .filter((x) => !pinned.includes(x))
          .slice(0, MAX_RECENT),
      };
    }
  } catch {
    // nothing saved, or no storage: start empty
  }
}

function set(next: ClipboardState) {
  if (next === state) return;
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // not saved (private window, full storage): it still works until the page is closed
  }
  listeners.forEach((listen) => listen());
}

const update = (fn: (s: ClipboardState) => ClipboardState) => {
  load();
  set(fn(state));
};

// What each equation field gave last time, so leaving it twice (finished, then corrected) keeps only the final version.
const lastFrom = new WeakMap<object, string>();

/** The teacher left `field` with `latex` in it. */
export function recordEquation(field: object, latex: string) {
  const before = lastFrom.get(field);
  if (worthKeeping(latex)) lastFrom.set(field, clean(latex));
  update((s) => withRecorded(s, latex, before));
}
export const pinEquation = (latex: string) => update((s) => withPinned(s, latex));
export const unpinEquation = (latex: string) => update((s) => withUnpinned(s, latex));
export const removeEquation = (latex: string) => update((s) => withRemoved(s, latex));
export const clearRecentEquations = () => update(withRecentCleared);

// For useSyncExternalStore. Another tab of the app saving its own clipboard is picked up too.
export function subscribeClipboard(listen: () => void) {
  listeners.add(listen);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    loaded = false;
    state = EMPTY;
    load();
    listen();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listen);
    window.removeEventListener("storage", onStorage);
  };
}

export function clipboardSnapshot(): ClipboardState {
  load();
  return state;
}

export const serverClipboard = () => EMPTY;
