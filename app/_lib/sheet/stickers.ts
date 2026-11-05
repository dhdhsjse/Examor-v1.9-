// What the sticker library of the correction sheet keeps for the teacher: the marks typed lately. The list lives in the browser (a convenience, not part of
// the exam file); everything else here is pure.
export const MAX_RECENT = 6;
/** `list` with `item` first (once), and at most `max` kept */
export function remembered<T>(list: readonly T[], item: T, max: number): T[] {
  return [item, ...list.filter((x) => x !== item)].slice(0, max);
}

// ---- the browser's storage (a private window or blocked storage just leaves the lists empty) ----

const KEY_MARKS = "examor.sheet.recentMarks";

function read<T>(key: string, ok: (v: unknown) => v is T, max: number): T[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(raw) ? raw.filter(ok).slice(0, max) : [];
  } catch {
    return [];
  }
}

function write(key: string, list: unknown[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* (nothing to do: the list just does not last) */
  }
}

const isMark = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

export const readRecentMarks = () => read(KEY_MARKS, isMark, MAX_RECENT);
export const writeRecentMarks = (list: number[]) => write(KEY_MARKS, list);
