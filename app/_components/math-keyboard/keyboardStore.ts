// What the keyboard remembers outside any one screen, so the page and the studios share one keyboard: which layout (Math or
// Physics) the teacher picked by hand, where the window was left, and whether it is open in a studio. An external store, read
// with useSyncExternalStore, because the keyboard is drawn from the page and from each studio, never at the same time.

import { useSyncExternalStore } from "react";
import { KEYBOARD_LAYOUTS, layoutFor, type KeyboardLayout } from "@/app/_lib/keyboard/layouts";
import type { Subject } from "@/app/_lib/subjects";

const LAYOUT_KEY = "examBuilder.keyboardLayout";
const POS_KEY = "examBuilder.keyboardPos";

export type Point = { x: number; y: number };

interface State {
  /** The layout picked by hand; null until the teacher picks one (then the exam's subject decides). */
  choice: KeyboardLayout | null;
  subject: Subject;
  /** Where the window was left (its top-left corner); null = docked at the bottom, centred. */
  pos: Point | null;
  /** The keyboard is open in a studio (on the page, `shell.mathKeyboard` says it). Never remembered: a studio opens without it. */
  studio: boolean;
}

function load(): Pick<State, "choice" | "pos"> {
  let choice: KeyboardLayout | null = null;
  let pos: Point | null = null;
  try {
    const saved = localStorage.getItem(LAYOUT_KEY);
    choice = KEYBOARD_LAYOUTS.find((l) => l === saved) ?? null;
    const p = JSON.parse(localStorage.getItem(POS_KEY) ?? "null");
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) pos = { x: p.x, y: p.y };
  } catch {
    // no storage (private window…): the keyboard just starts from its defaults
  }
  return { choice, pos };
}

let state: State = { choice: null, subject: "General", pos: null, studio: false };
let loaded = false;
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((listen) => listen());
}

function snapshot(): State {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    state = { ...state, ...load() }; // the first read, before anyone subscribes: no notification needed
  }
  return state;
}

const subscribe = (listen: () => void) => {
  listeners.add(listen);
  return () => {
    listeners.delete(listen);
  };
};

const remember = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // not remembered: harmless
  }
};

/** The exam's subject, which decides the layout while none was picked by hand. */
export function setKeyboardSubject(subject: Subject) {
  if (snapshot().subject !== subject) set({ subject });
}

/** The teacher picks Math or Physics. */
export function chooseKeyboardLayout(layout: KeyboardLayout) {
  snapshot();
  remember(LAYOUT_KEY, layout);
  set({ choice: layout });
}

/** Where the window was left (null = back to its docked place). */
export function setKeyboardPos(pos: Point | null) {
  snapshot();
  remember(POS_KEY, pos && JSON.stringify(pos));
  set({ pos });
}

export function setStudioKeyboard(open: boolean) {
  if (snapshot().studio !== open) set({ studio: open });
}

export const toggleStudioKeyboard = () => setStudioKeyboard(!snapshot().studio);

export function useKeyboardStore() {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { ...s, layout: s.choice ?? layoutFor(s.subject) };
}
