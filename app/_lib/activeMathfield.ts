// The equation field currently open in the Properties panel, so the floating math
// keyboard (elsewhere on screen) knows where to type.

import type { MathfieldElement } from "mathlive";

interface Active {
  field: MathfieldElement;
  onInput: () => void; // tell the app the equation changed
}

let active: Active | null = null;

export function setActiveMathfield(a: Active | null) {
  active = a;
}

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
