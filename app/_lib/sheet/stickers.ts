// The sticker library of the correction sheet, in the left toolbox: the usual stickers (fixed), and the ones the teacher adds, which they can take off
// again. The added ones live in the browser (a convenience, not part of the exam file); everything else here is pure.
import { snapMark } from "./marks";

/** A sticker of the library: a mark (a number) or a few words (✓, ✗, "NR"…) */
export type LibrarySticker = number | string;

// The marks most often written in a barème (the top grid), and the signs (beside the line): always there, never taken off
export const COMMON_MARKS: readonly number[] = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 0.125];
export const SIGNS: readonly string[] = ["✓", "✗"];
export const isDefaultSticker = (s: LibrarySticker) => (typeof s === "number" ? COMMON_MARKS.includes(s) : SIGNS.includes(s));

export const MAX_ADDED = 24;
export const MAX_WORDS = 12; // (a sticker sits in a narrow column)

/** What is typed in the + box: a mark if it reads as one (a comma is a decimal point), else the words; null for nothing */
export function parseSticker(typed: string): LibrarySticker | null {
  const text = typed.trim();
  if (!text) return null;
  const v = Number(text.replace(",", "."));
  if (Number.isFinite(v)) return v > 0 ? snapMark(v) : null;
  return text.slice(0, MAX_WORDS);
}

/** The added stickers with `item` at their end (once; a usual sticker is not added: it is there already), at most `max` kept */
export function withSticker(added: readonly LibrarySticker[], item: LibrarySticker, max = MAX_ADDED): LibrarySticker[] {
  if (isDefaultSticker(item) || added.includes(item) || added.length >= max) return [...added];
  return [...added, item];
}

export const withoutSticker = (added: readonly LibrarySticker[], item: LibrarySticker): LibrarySticker[] => added.filter((x) => x !== item);

// ---- the browser's storage (a private window or blocked storage just keeps none) ----

const KEY = "examor.sheet.stickers";
const KEY_OLD_MARKS = "examor.sheet.recentMarks"; // (before: the marks typed lately)

const isMark = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const isSticker = (v: unknown): v is LibrarySticker => isMark(v) || (typeof v === "string" && v.trim() !== "" && v.length <= MAX_WORDS);

function readList(key: string): unknown[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

export function readAddedStickers(): LibrarySticker[] {
  const saved = readList(KEY) ?? (readList(KEY_OLD_MARKS) ?? []).filter(isMark).map(snapMark);
  return saved.filter(isSticker).reduce<LibrarySticker[]>((list, s) => withSticker(list, s), []);
}

export function writeAddedStickers(list: readonly LibrarySticker[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* (nothing to do: the list just does not last) */
  }
}
