// The text being typed in on the page with the plain-text editor (RichEditable: every text of a block except a text
// box, which has its own Tiptap editor), as the ribbon of the right panel sees it: it formats the selected words
// through `handle`, and shows `style`, the style the selected words share.
//
// It is a small store of its own, not state of the shell: the selection changes with every key, and only the ribbon
// cares (the shell would draw the whole editor again for each one).

import { useSyncExternalStore } from "react";
import type { RichHandle } from "@/app/_components/rich/RichEditable";
import { fieldKey, type EditField } from "./editRegions";
import type { RunStyle } from "./richText";

export interface RichSession {
  blockId: string;
  field: EditField;
  handle: RichHandle;
  style: RunStyle;
  /** Something is selected (otherwise the buttons style the whole text, like the bar above it). */
  hasSelection: boolean;
}

let current: RichSession | null = null;
const listeners = new Set<() => void>();

const sameStyle = (a: RunStyle, b: RunStyle) => {
  const keys = Object.keys(a) as (keyof RunStyle)[];
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
};

const same = (a: RichSession | null, b: RichSession | null) =>
  a === b || (!!a && !!b && a.blockId === b.blockId && a.handle === b.handle && a.hasSelection === b.hasSelection && fieldKey(a.field) === fieldKey(b.field) && sameStyle(a.style, b.style));

function publish(next: RichSession | null) {
  if (same(current, next)) return; // (a cursor moving inside words of the same style changes nothing for the ribbon)
  current = next;
  for (const listener of listeners) listener();
}

export const richSessions = {
  get: () => current,
  set: publish,
  /** The editor closing: only when the published session still is its own (another text may have started since). */
  clear: (handle: RichHandle) => {
    if (current?.handle === handle) publish(null);
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
};

/** The plain-text editor being typed in (null when none is). Only the components that call this are drawn again when it changes. */
export const useRichSession = (): RichSession | null => useSyncExternalStore(richSessions.subscribe, richSessions.get, () => null);
