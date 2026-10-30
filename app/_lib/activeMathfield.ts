// The equation field currently open in the Properties panel, so the floating math
// keyboard (elsewhere on screen) knows where to type.

import type { MathfieldElement } from "mathlive";

interface Active {
  field: MathfieldElement;
  onInput: () => void; // tell the app the equation changed
}

let active: Active | null = null;
const listeners = new Set<() => void>();
// A key pressed before the field was there (an equation just added, or the Properties panel just shown): typed when it comes.
let waiting: (() => void) | null = null;

export function setActiveMathfield(a: Active | null) {
  active = a;
  listeners.forEach((listen) => listen());
  if (a && waiting) {
    const run = waiting;
    waiting = null;
    run();
  }
}

/** `field` stops being where the keyboard types (it lost the focus, or went away); another field that took over stays. */
export function clearActiveMathfield(field: MathfieldElement) {
  if (active?.field === field) setActiveMathfield(null);
}

/** Run `fn` in the equation field: now if one is open, else as soon as one opens (only the last such call is kept). */
export function whenMathfield(fn: () => void) {
  if (active) fn();
  else waiting = fn;
}

/** Run `fn` in the next equation field that opens (a formula just put in a text), not in the one open now. */
export function onNextMathfield(fn: () => void) {
  waiting = fn;
}

// For useSyncExternalStore: lets the keyboard show whether there is a field to type in.
export const subscribeActiveMathfield = (listen: () => void) => {
  listeners.add(listen);
  return () => {
    listeners.delete(listen);
  };
};
export const hasActiveMathfield = () => active !== null;

// Run a MathLive command in the field (insert, delete, move...) and save the result.
export function mathCommand(command: string | [string, ...unknown[]]) {
  if (!active) return;
  active.field.focus();
  active.field.executeCommand(command as Parameters<MathfieldElement["executeCommand"]>[0]);
  active.onInput();
}

export function focusMathfield() {
  active?.field.focus();
}
