// Where the keyboard types when it is not typing in an equation: the text field the teacher last clicked in. That is an input or a
// textarea (an axis title, the formula of a graph, an option of a question), or on the page a place typed in on the sheet itself
// (a question, a text box, a cell: a contenteditable). The keys type their text form there (app/_lib/keyboard/plainText.ts). The
// keyboard's buttons never take the focus (mousedown is prevented), so the field keeps its cursor and its selection while a key is
// pressed. Clicking in an equation field (MathLive) makes the equation the target instead: see `fieldFlavor() === null`.

import { useSyncExternalStore } from "react";
import type { PlainFlavor } from "@/app/_lib/keyboard/plainText";

type TextField = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

/** Inside the keyboard window: clicking there is not "choosing a field". */
export const KEYBOARD_ATTR = "data-math-keyboard";

// Types of <input> that take text and a cursor (a number or a checkbox has no selection to type into).
const TEXT_TYPES = new Set(["text", "search", "url", "tel"]);

const isInput = (el: TextField): el is HTMLInputElement | HTMLTextAreaElement => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

let field: { el: TextField; fallback: PlainFlavor } | null = null;
let lastFallback: PlainFlavor = "label"; // the kind of text of the latest tracker, for a field found without its focus event
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listen) => listen());

function isTextField(el: EventTarget | null): el is TextField {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) return TEXT_TYPES.has(el.type) && !el.readOnly && !el.disabled;
  // a place typed in on the sheet (not the equation field, which has its own commands)
  return el instanceof HTMLElement && el.tagName !== "MATH-FIELD" && el.isContentEditable && el.getAttribute("contenteditable") !== "false";
}

/**
 * Remember the text field the teacher clicks in, for as long as the studio (or the page) is open. `fallback` is the kind of text a field
 * takes unless it says otherwise (data-keyboard): a studio's labels read their scripts as markup, the page's prose takes Unicode.
 * An equation field being clicked in makes the equation the target. Returns the way to stop.
 */
export function trackTextFields(fallback: PlainFlavor = "label"): () => void {
  lastFallback = fallback;
  const pick = (el: EventTarget | null) => {
    if (el instanceof HTMLElement && el.closest(`[${KEYBOARD_ATTR}]`)) return;
    if (el instanceof HTMLElement && el.tagName === "MATH-FIELD") {
      if (field) {
        field = null;
        notify();
      }
      return;
    }
    if (!isTextField(el) || field?.el === el) return;
    field = { el, fallback };
    notify();
  };
  const onFocus = (e: FocusEvent) => pick(e.target);
  // A field that is gone from the page (another block was chosen) stops being the target: look again once the page has settled.
  const settle = () => window.setTimeout(notify, 150);
  pick(document.activeElement); // a field that already has the focus when the studio opens
  document.addEventListener("focusin", onFocus);
  document.addEventListener("pointerup", settle);
  document.addEventListener("focusout", settle);
  return () => {
    document.removeEventListener("focusin", onFocus);
    document.removeEventListener("pointerup", settle);
    document.removeEventListener("focusout", settle);
    if (field?.fallback === fallback) {
      field = null;
      notify();
    }
  };
}

// The field to type in: the one remembered, or the one that has the focus now if its focus event was missed (a page that was reloaded
// under the keyboard, a tracker started after the click).
function current() {
  const a = document.activeElement;
  if (a && field?.el !== a && isTextField(a) && !a.closest(`[${KEYBOARD_ATTR}]`)) field = { el: a, fallback: lastFallback };
  return field?.el.isConnected ? field : null;
}

const live = () => current()?.el ?? null;

/** Look at the fields again (the keyboard window calls it when the page is clicked: the target may have changed). */
export const refreshFields = notify;

/** What the field reads: its formula field, or any other text. null = no field to type in. */
export function fieldFlavor(): PlainFlavor | null {
  const f = current();
  if (!f) return null;
  const own = f.el.dataset.keyboard;
  if (own === "formula" || own === "label") return own;
  // a cell of a table that starts with = is a formula: it reads x^2, not x²
  if (!isInput(f.el) && f.el.textContent?.trimStart().startsWith("=")) return "formula";
  return f.fallback;
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

// The selection of a place typed in on the sheet, if it is inside that place.
function sheetSelection(el: HTMLElement): Selection | null {
  const sel = window.getSelection();
  return sel && sel.rangeCount && el.contains(sel.anchorNode) ? sel : null;
}

/** The text selected in the field, which keys like "fraction" and "brackets" wrap. */
export function fieldSelection(): string {
  const el = live();
  if (!el) return "";
  if (isInput(el)) return el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0);
  return sheetSelection(el)?.toString() ?? "";
}

// Gives the field the focus again if a click elsewhere took it, with its cursor where it was.
function focused(el: TextField) {
  if (document.activeElement !== el) el.focus({ preventScroll: true });
}

const graphemes = (s: string) => (typeof Intl !== "undefined" && "Segmenter" in Intl ? [...new Intl.Segmenter().segment(s)].length : Array.from(s).length);

/** Type `text` in the field in place of its selection, and leave the cursor `caret` characters from the start of it. */
export function typeInField(text: string, caret = text.length): boolean {
  const el = live();
  if (!el) return false;
  focused(el);
  if (!isInput(el)) {
    // on the sheet: insertText is what typing does, so the editor (ProseMirror, RichEditable) sees it as typed
    if (!document.execCommand("insertText", false, text)) return false;
    const back = graphemes(text.slice(caret));
    const sel = window.getSelection();
    for (let i = 0; i < back; i++) sel?.modify("move", "backward", "character");
    return true;
  }
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
  if (!isInput(el)) {
    const sel = sheetSelection(el);
    if (!sel) return;
    if (sel.isCollapsed) sel.modify("move", by < 0 ? "backward" : "forward", "character");
    else if (by < 0) sel.collapseToStart();
    else sel.collapseToEnd();
    return;
  }
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
  if (!isInput(el) && command === "undo") {
    // an editor on the sheet keeps its own history, which answers to Ctrl+Z; the browser's is the way out
    const key = new KeyboardEvent("keydown", { key: "z", code: "KeyZ", ctrlKey: true, bubbles: true, cancelable: true });
    if (el.dispatchEvent(key)) document.execCommand("undo");
    return;
  }
  document.execCommand(command);
}
