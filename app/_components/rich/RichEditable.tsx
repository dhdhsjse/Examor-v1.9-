"use client";

import { useImperativeHandle, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent, type Ref } from "react";
import { fontStack } from "@/app/_lib/fonts";
import {
  applyStyle,
  decodeStyle,
  deleteRange,
  encodeStyle,
  insertText,
  parseRich,
  plainText,
  runCss,
  serializeRich,
  styleAt,
  type Run,
  type RunStyle,
  type StylePatch,
} from "@/app/_lib/richText";

export interface RichHandle {
  focus: (at?: "end" | "all") => void;
  selection: () => { start: number; end: number };
  // Style the selection (nothing selected = the whole text). Returns the new value.
  apply: (patch: StylePatch | "clear") => void;
  toggle: (key: "b" | "i" | "u") => void;
  insert: (text: string, at?: number) => void;
  setValue: (value: string, select?: { start: number; end: number }) => void;
  element: () => HTMLDivElement | null;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelectionStyle?: (style: RunStyle) => void; // for the format bar
  multiline?: boolean;
  placeholder?: string;
  dir?: "rtl" | "ltr" | "auto";
  className?: string;
  style?: CSSProperties;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void; // called before the built-in keys
  onFocus?: () => void;
  onBlur?: (e: React.FocusEvent<HTMLDivElement>) => void;
  ref?: Ref<RichHandle>;
}

// ---- DOM ⇄ text with styles ----

function render(el: HTMLDivElement, value: string) {
  el.replaceChildren();
  for (const run of parseRich(value)) {
    if (!run.text) continue;
    const st = encodeStyle(run.style);
    if (!st) {
      el.append(document.createTextNode(run.text));
      continue;
    }
    const span = document.createElement("span");
    span.dataset.st = st;
    Object.assign(span.style, runCss(run.style, fontStack));
    span.textContent = run.text;
    el.append(span);
  }
  // A last empty line needs something after the "\n" to be visible.
  if (value.endsWith("\n")) {
    const br = document.createElement("br");
    br.dataset.end = "1";
    el.append(br);
  }
  el.dataset.empty = String(!plainText(value));
}

function read(el: HTMLDivElement): string {
  const runs: Run[] = [];
  const walk = (node: Node, st: RunStyle) => {
    if (node.nodeType === Node.TEXT_NODE) {
      runs.push({ text: node.textContent ?? "", style: st });
      return;
    }
    if (!(node instanceof HTMLElement) || node.tagName === "BR") return;
    // Lines the browser made itself (DIV/P) start with a line break.
    if ((node.tagName === "DIV" || node.tagName === "P") && runs.length) runs.push({ text: "\n", style: st });
    const next = node.dataset.st ? { ...st, ...decodeStyle(node.dataset.st) } : st;
    node.childNodes.forEach((c) => walk(c, next));
  };
  el.childNodes.forEach((c) => walk(c, {}));
  return serializeRich(runs);
}

// Only our own spans, text and <br>: anything else came from the browser.
const isClean = (el: HTMLElement) => [...el.querySelectorAll("*")].every((n) => (n.tagName === "SPAN" && (n as HTMLElement).dataset.st) || n.tagName === "BR");

function getSel(el: HTMLDivElement): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  if (!el.contains(r.startContainer) || !el.contains(r.endContainer)) return null;
  const at = (node: Node, offset: number) => {
    const pre = document.createRange();
    pre.selectNodeContents(el);
    pre.setEnd(node, offset);
    return pre.toString().length;
  };
  return { start: at(r.startContainer, r.startOffset), end: at(r.endContainer, r.endOffset) };
}

function setSel(el: HTMLDivElement, start: number, end: number) {
  const find = (target: number): [Node, number] => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n = 0;
    let last: Text | null = null;
    while (walker.nextNode()) {
      const t = walker.currentNode as Text;
      const len = t.textContent?.length ?? 0;
      if (n + len >= target) return [t, target - n];
      n += len;
      last = t;
    }
    return last ? [last, last.textContent?.length ?? 0] : [el, 0];
  };
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  const [sn, so] = find(start);
  const [en, eo] = find(end);
  r.setStart(sn, so);
  r.setEnd(en, eo);
  sel.removeAllRanges();
  sel.addRange(r);
}

// A text box where parts of the text can have their own color, font, size, bold…
// The value is the text with style markers (see richText.ts).
export default function RichEditable({ value, onChange, onSelectionStyle, multiline, placeholder, dir = "auto", className, style, onKeyDown, onFocus, onBlur, ref }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const shown = useRef<string | null>(null); // the value the DOM shows
  const lastSel = useRef({ start: 0, end: 0 });

  // Redraw only when the value changed from outside (typing already updated the DOM).
  useLayoutEffect(() => {
    const node = el.current;
    if (!node || value === shown.current) return;
    const focused = document.activeElement === node;
    const sel = focused ? getSel(node) : null;
    render(node, value);
    shown.current = value;
    if (focused && sel) setSel(node, sel.start, sel.end);
  }, [value]);

  const commit = (next: string, sel?: { start: number; end: number }) => {
    const node = el.current;
    if (!node) return;
    render(node, next);
    shown.current = next;
    if (sel) {
      node.focus();
      setSel(node, sel.start, sel.end);
      lastSel.current = sel;
    }
    onChange(next);
    if (sel) onSelectionStyle?.(styleAt(next, sel.start, sel.end));
  };

  const currentSel = () => (el.current && getSel(el.current)) || lastSel.current;

  useImperativeHandle(ref, () => ({
    focus: (at) => {
      const node = el.current;
      if (!node) return;
      node.focus();
      const len = plainText(shown.current ?? value).length;
      if (at === "all") setSel(node, 0, len);
      else if (at === "end") setSel(node, len, len);
      else setSel(node, lastSel.current.start, lastSel.current.end);
    },
    selection: currentSel,
    apply: (patch) => {
      const cur = shown.current ?? value;
      const sel = currentSel();
      const whole = sel.start === sel.end;
      const range = whole ? { start: 0, end: plainText(cur).length } : sel;
      commit(applyStyle(cur, range.start, range.end, patch), sel);
    },
    toggle: (key) => {
      const cur = shown.current ?? value;
      const sel = currentSel();
      const range = sel.start === sel.end ? { start: 0, end: plainText(cur).length } : sel;
      const on = !!styleAt(cur, range.start, range.end)[key];
      commit(applyStyle(cur, range.start, range.end, { [key]: on ? null : true }), sel);
    },
    insert: (text, at) => {
      const cur = shown.current ?? value;
      const sel = currentSel();
      const pos = at ?? sel.start;
      commit(insertText(at === undefined ? deleteRange(cur, sel.start, sel.end) : cur, pos, text), { start: pos + text.length, end: pos + text.length });
    },
    setValue: (next, select) => commit(next, select),
    element: () => el.current,
  }));

  // Replace the selection with plain text (Enter, paste).
  const typeText = (text: string) => {
    const cur = shown.current ?? value;
    const sel = currentSel();
    const pos = sel.start + text.length;
    commit(insertText(deleteRange(cur, sel.start, sel.end), sel.start, text), { start: pos, end: pos });
  };

  const trackSelection = () => {
    const node = el.current;
    const sel = node && getSel(node);
    if (!sel) return;
    lastSel.current = sel;
    onSelectionStyle?.(styleAt(shown.current ?? value, sel.start, sel.end));
  };

  return (
    <div
      ref={el}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline={multiline}
      dir={dir}
      spellCheck={false}
      data-placeholder={placeholder}
      className={`rich-edit ${className ?? ""}`}
      style={{ whiteSpace: "pre-wrap", overflowWrap: "break-word", userSelect: "text", ...style }}
      onInput={() => {
        const node = el.current;
        if (!node) return;
        const next = read(node);
        // The browser added its own tags: redraw with ours, keeping the cursor.
        if (!isClean(node)) {
          const sel = getSel(node);
          render(node, next);
          if (sel) setSel(node, sel.start, sel.end);
        }
        node.dataset.empty = String(!plainText(next));
        shown.current = next;
        onChange(next);
        trackSelection();
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        const mod = e.ctrlKey || e.metaKey;
        if (mod && ["b", "i", "u"].includes(e.key.toLowerCase())) {
          // Our own bold / italic / underline (not the browser's <b> tags).
          e.preventDefault();
          const cur = shown.current ?? value;
          const sel = currentSel();
          if (sel.start === sel.end) return;
          const key = e.key.toLowerCase() as "b" | "i" | "u";
          const on = !!styleAt(cur, sel.start, sel.end)[key];
          commit(applyStyle(cur, sel.start, sel.end, { [key]: on ? null : true }), sel);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (multiline) typeText("\n");
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain").replace(/\r/g, "");
        typeText(multiline ? text : text.replace(/\n+/g, " "));
      }}
      onDrop={(e) => e.preventDefault()}
      onKeyUp={trackSelection}
      onMouseUp={trackSelection}
      onFocus={() => {
        onFocus?.();
        trackSelection();
      }}
      onBlur={onBlur}
    />
  );
}
