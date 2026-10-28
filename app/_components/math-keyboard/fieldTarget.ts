// Where the keyboard types in a studio: the plain text field (input or textarea) the teacher last clicked in. The studios have no
// equation field (activeMathfield.ts is for the Properties panel of the page), so the keys type their text form there
// (app/_lib/keyboard/plainText.ts). The keyboard's buttons never take the focus (mousedown is prevented), so the field keeps its
// cursor and its selection while a key is pressed.

import { useSyncExternalStore } from "react";
import type { PlainFlavor } from "@/app/_lib/keyboard/plainText";

type TextField = HTMLInputElement | HTMLTextAreaElement;

/** Inside the keyboard window: clicking there is not "choosing a field". */
export const KEYBOARD_ATTR = "data-math-keyboard";

// Types of <input> that take text and a cursor (a number or a checkbox has no selection to type into).
const TEXT_TYPES = new Set(["text", "search", "url", "tel"]);

let field: TextField | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listen) => listen());

function isTextField(el: EventTarget | null): el is TextField {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  return el instanceof HTMLInputElement && TEXT_TYPES.has(el.type) && !el.readOnly && !el.disabled;
}

/** Remember the text field the teacher clicks in, for as long as the studio is open. Returns the way to stop. */
export function trackTextFields(): () => void {
  const pick = (el: EventTarget | null) => {
    if (!isTextField(el) || el.closest(`[${KEYBOARD_ATTR}]`) || field === el) return;
    field = el;
    notify();
  };
  const onFocus = (e: FocusEvent) => pick(e.target);
  pick(document.activeElement); // a field that already has the focus when the studio opens
  document.addEventListener("focusin", onFocus);
  return () => {
    document.removeEventListener("focusin", onFocus);
    field = null;
    notify();
  };
}

const live = () => (field?.isConnected ? field : null);

/** What the field reads: its formula field, or any other text. null = no field to type in. */
export function fieldFlavor(): PlainFlavor | null {
  const el = live();
  return el ? (el.dataset.keyboard === "formula" ? "formula" : "label") : null;
}

/** For useSyncExternalStore: the kind of field the keys type in now (null = none, they do nothing). */
export function useFieldFlavor(): PlainFlavor | null {
  return useSyncExternalStore(
    (listen) => {
      listeners.add(listen);
      return () => {
        listeners.delete(listen);
      };
    },
    fieldFlavor,
    () => null,
  );
}

/** The text selected in the field, which keys like "fraction" and "brackets" wrap. */
export function fieldSelection(): string {
  const el = live();
  return el ? el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0) : "";
}

// Gives the field the focus again if a click elsewhere took it, with its cursor where it was.
function focused(el: TextField) {
  if (document.activeElement !== el) el.focus({ preventScroll: true });
}

/** Type `text` in the field in place of its selection, and leave the cursor `caret` characters from the start of it. */
export function typeInField(text: string, caret = text.length): boolean {
  const el = live();
  if (!el) return false;
  focused(el);
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  el.setSelectionRange(start, end);
  // insertText is what typing does: the field's own undo keeps it and React's onChange sees it. setRangeText is the way out where
  // the browser refuses it.
  if (!document.execCommand("insertText", false, text)) {
    el.setRangeText(text, start, end, "end");
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  }
  el.setSelectionRange(start + caret, start + caret);
  return true;
}

/** ◀ ▶: the cursor one character along (a selection closes at its edge). */
export function moveInField(by: -1 | 1) {
  const el = live();
  if (!el) return;
  focused(el);
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? start;
  const to = start !== end ? (by < 0 ? start : end) : Math.min(Math.max(start + by, 0), el.value.length);
  el.setSelectionRange(to, to);
}

/** ⌫ and Undo: what the keys of the same name do in the field. */
export function commandInField(command: "delete" | "undo") {
  const el = live();
  if (!el) return;
  focused(el);
  document.execCommand(command);
}
