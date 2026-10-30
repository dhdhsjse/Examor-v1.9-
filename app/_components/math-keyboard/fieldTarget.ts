// Where the keyboard types when it is not the equation of the Properties panel (activeMathfield.ts): the text field the teacher last
// clicked in. That is an input or a textarea (the studios, the panels) or a text being written on the page (a text box, a question:
// a contenteditable). The keys type their text form there (app/_lib/keyboard/plainText.ts). The keyboard's buttons never take the
// focus (mousedown is prevented), so the field keeps its cursor and its selection while a key is pressed.

import { useSyncExternalStore } from "react";
import type { PlainFlavor } from "@/app/_lib/keyboard/plainText";

type TextField = HTMLInputElement | HTMLTextAreaElement;
type Field = TextField | HTMLElement; // an HTMLElement that is not an input: the editing host of a contenteditable

/** Inside the keyboard window: clicking there is not "choosing a field". */
export const KEYBOARD_ATTR = "data-math-keyboard";

// Types of <input> that take text and a cursor (a number or a checkbox has no selection to type into).
const TEXT_TYPES = new Set(["text", "search", "url", "tel"]);

let field: Field | null = null;
// The cursor in a contenteditable field, kept so that it comes back if a click elsewhere took the focus.
let savedRange: Range | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listen) => listen());

const isInput = (el: Field): el is TextField => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

function isTextField(el: EventTarget | null): el is TextField {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  return el instanceof HTMLInputElement && TEXT_TYPES.has(el.type) && !el.readOnly && !el.disabled;
}

// The element of a contenteditable that has the focus and holds the cursor (its outermost editable element).
function editingHost(el: EventTarget | null): HTMLElement | null {
  if (!(el instanceof HTMLElement) || !el.isContentEditable) return null;
  let host = el;
  while (host.parentElement?.isContentEditable) host = host.parentElement;
  return host;
}

let users = 0;
let stopListening: (() => void) | null = null;

function pick(target: EventTarget | null) {
  if (target instanceof Element && target.closest(`[${KEYBOARD_ATTR}]`)) return;
  // The equation field (MathLive): the keys type there again, through activeMathfield.ts.
  if (target instanceof Element && target.tagName === "MATH-FIELD") {
    if (field) {
      field = null;
      notify();
    }
    return;
  }
  const next = isTextField(target) ? target : editingHost(target);
  if (!next || field === next) return;
  field = next;
  savedRange = null;
  notify();
  if (waiting) {
    const run = waiting;
    waiting = null;
    run();
  }
}

// A key pressed before a text was open (the keyboard opened the selected one): typed as soon as that text takes the focus.
let waiting: (() => void) | null = null;
let waitingTimer: ReturnType<typeof setTimeout> | undefined;

/** Run `fn` when the next text field takes the focus (given up after a moment if none does). */
export function whenField(fn: () => void) {
  waiting = fn;
  clearTimeout(waitingTimer);
  waitingTimer = setTimeout(() => (waiting = null), 1500);
}

function listen() {
  const onFocus = (e: FocusEvent) => pick(e.target);
  const onSelection = () => {
    const sel = document.getSelection();
    if (field && !isInput(field) && sel?.rangeCount && field.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
  };
  document.addEventListener("focusin", onFocus);
  document.addEventListener("selectionchange", onSelection);
  return () => {
    document.removeEventListener("focusin", onFocus);
    document.removeEventListener("selectionchange", onSelection);
  };
}

/** Follow the text fields the teacher clicks in, while the page or a studio is shown. Returns the way to stop. */
export function trackTextFields(): () => void {
  if (users++ === 0) stopListening = listen();
  // A studio that opens starts from its own fields, not the text of the page under it: only the field that has the focus now.
  field = null;
  savedRange = null;
  pick(document.activeElement);
  notify();
  return () => {
    // A studio that closes takes its fields with it: forget the one clicked there.
    field = null;
    savedRange = null;
    notify();
    if (--users === 0) {
      stopListening?.();
      stopListening = null;
    }
  };
}

const live = () => (field?.isConnected ? field : null);

/** What the field reads: its formula field, a text on the page, or any other text. null = no field to type in. */
export function fieldFlavor(): PlainFlavor | null {
  const el = live();
  if (!el) return null;
  if (!isInput(el)) return "text";
  return el.dataset.keyboard === "formula" ? "formula" : "label";
}

// Text fields that take real formulas (a text box: tiptap-math.ts), with the way to put one in at their cursor.
const formulaFields = new WeakMap<HTMLElement, (latex: string) => void>();

/** `el` takes formulas: a key pressed while it is the field puts `insert(latex)` there instead of the key's text. Returns the way to stop. */
export function registerFormulaField(el: HTMLElement, insert: (latex: string) => void): () => void {
  formulaFields.set(el, insert);
  notify();
  return () => {
    formulaFields.delete(el);
    notify();
  };
}

const formulaInsert = () => {
  const el = live();
  return el && !isInput(el) ? formulaFields.get(el) : undefined;
};

/** Put the key's formula in the field at its cursor; false when the field takes no formulas (then its text is typed). */
export function insertFormulaInField(latex: string): boolean {
  const insert = formulaInsert();
  if (!insert) return false;
  focused(live()!);
  insert(latex);
  return true;
}

/** For useSyncExternalStore: whether the field takes real formulas (every key works there). */
export function useFieldTakesFormulas(): boolean {
  return useSyncExternalStore(
    (listen) => {
      listeners.add(listen);
      return () => {
        listeners.delete(listen);
      };
    },
    () => !!formulaInsert(),
    () => false,
  );
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

/** The field is written right to left (Arabic): math typed there must be kept left to right, or ∈, ⊂, < … show turned around. */
export function fieldIsRtl(): boolean {
  const el = live();
  return !!el && getComputedStyle(el).direction === "rtl";
}

/** The text selected in the field, which keys like "fraction" and "brackets" wrap. */
export function fieldSelection(): string {
  const el = live();
  if (!el) return "";
  if (isInput(el)) return el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0);
  const sel = document.getSelection();
  return sel && el.contains(sel.anchorNode) ? sel.toString() : (savedRange?.toString() ?? "");
}

// Gives the field the focus again if a click elsewhere took it, with its cursor where it was.
function focused(el: Field) {
  if (document.activeElement === el) return;
  el.focus({ preventScroll: true });
  if (!isInput(el) && savedRange && el.contains(savedRange.startContainer)) {
    const sel = document.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(savedRange);
  }
}

// The cursor of a contenteditable `by` characters along.
function stepCaret(by: number) {
  const sel = document.getSelection();
  for (let i = 0; i < Math.abs(by); i++) sel?.modify("move", by < 0 ? "backward" : "forward", "character");
}

/** Type `text` in the field in place of its selection, and leave the cursor `caret` characters from the start of it. */
export function typeInField(text: string, caret = text.length): boolean {
  const el = live();
  if (!el) return false;
  focused(el);
  if (!isInput(el)) {
    // What typing does: the editor of the text (ProseMirror, RichEditable) sees it as typed and keeps it in its undo.
    document.execCommand("insertText", false, text);
    stepCaret(caret - text.length);
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

/** The cursor after the last character of the field (a text the keyboard just opened is written on at its end). */
export function caretToEnd() {
  const el = live();
  if (!el) return;
  focused(el);
  if (isInput(el)) return el.setSelectionRange(el.value.length, el.value.length);
  const sel = document.getSelection();
  sel?.selectAllChildren(el);
  sel?.collapseToEnd();
}

/** ◀ ▶: the cursor one character along (a selection closes at its edge). */
export function moveInField(by: -1 | 1) {
  const el = live();
  if (!el) return;
  focused(el);
  if (!isInput(el)) {
    const sel = document.getSelection();
    if (sel && !sel.isCollapsed) {
      if (by < 0) sel.collapseToStart();
      else sel.collapseToEnd();
    } else stepCaret(by);
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
  document.execCommand(command);
}
