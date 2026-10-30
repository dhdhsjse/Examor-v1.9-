// Bulleted and numbered lists for texts and text boxes (Word's Bullets, Numbering and Multilevel list). A list is
// not a structure of its own: each paragraph says whether it is an item (`list`) and how deep (its indent level),
// and the markers are worked out from that, in order: "1.", "2."… counted per level, restarting after a paragraph
// that is not an item. The canvas (blockLayout.ts) and the editor (textboxEditor.ts) both ask `listMarkers`,
// so what is typed and what is printed number the same way. Pure functions, unit-tested.

export type ListKind =
  | "bullet" // • ○ ▪, by level
  | "circle"
  | "square"
  | "arrow"
  | "check"
  | "dash"
  | "decimal" // 1. 2. 3.
  | "decimal-paren" // 1) 2) 3)
  | "lower-alpha" // a. b. c.
  | "upper-alpha" // A. B. C.
  | "lower-roman" // i. ii. iii.
  | "upper-roman" // I. II. III.
  | "arabic-alpha" // أ- ب- ج-
  | "multi"; // 1. then a. then i. by level (أ- in Arabic)

/** Room kept before the text of a list item for its marker (px); wider markers make their own room. */
export const LIST_GAP = 22;

export const BULLET_KINDS: ListKind[] = ["bullet", "circle", "square", "arrow", "check", "dash"];
export const NUMBER_KINDS: ListKind[] = ["decimal", "decimal-paren", "lower-alpha", "upper-alpha", "lower-roman", "upper-roman", "arabic-alpha"];

export const isListKind = (v: unknown): v is ListKind => typeof v === "string" && ([...BULLET_KINDS, ...NUMBER_KINDS, "multi"] as string[]).includes(v);
export const isBulletKind = (k: ListKind) => BULLET_KINDS.includes(k);

// The marks of the bullets that follow the level, like Word's default bullet list.
const LEVEL_BULLETS = ["•", "○", "▪"];
const BULLETS: Partial<Record<ListKind, string>> = { circle: "○", square: "▪", arrow: "➤", check: "✓", dash: "–" };

// The Arabic letters of school lists, in the order of the exercises (أ، ب، ج، د، هـ، و، ز، ح، ط، ي…).
const ARABIC_ALPHA = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح", "ط", "ي", "ك", "ل", "م", "ن", "س", "ع", "ف", "ص", "ق", "ر", "ش", "ت", "ث", "خ", "ذ", "ض", "ظ", "غ"];

// a, b … z, aa, bb … (Word repeats the letter after z).
function latinLetters(n: number): string {
  const i = (n - 1) % 26;
  return String.fromCharCode(97 + i).repeat(Math.floor((n - 1) / 26) + 1);
}

function arabicLetters(n: number): string {
  const i = (n - 1) % ARABIC_ALPHA.length;
  return ARABIC_ALPHA[i].repeat(Math.floor((n - 1) / ARABIC_ALPHA.length) + 1);
}

const ROMAN: [number, string][] = [
  [1000, "m"],
  [900, "cm"],
  [500, "d"],
  [400, "cd"],
  [100, "c"],
  [90, "xc"],
  [50, "l"],
  [40, "xl"],
  [10, "x"],
  [9, "ix"],
  [5, "v"],
  [4, "iv"],
  [1, "i"],
];

/** Roman numerals in lowercase (1 → "i", 14 → "xiv"); numbers from 4000 on stay as digits. */
export function roman(n: number): string {
  if (n <= 0 || n >= 4000) return String(n);
  let rest = n;
  let out = "";
  for (const [value, text] of ROMAN) {
    while (rest >= value) {
      out += text;
      rest -= value;
    }
  }
  return out;
}

/** The marker of the n-th item (from 1) of a list of this kind at this level. `arabic`: the letters of a multilevel list are Arabic ones. */
export function markerText(kind: ListKind, n: number, level = 0, arabic = false): string {
  switch (kind) {
    case "bullet":
      return LEVEL_BULLETS[level % LEVEL_BULLETS.length];
    case "circle":
    case "square":
    case "arrow":
    case "check":
    case "dash":
      return BULLETS[kind] as string;
    case "decimal":
      return `${n}.`;
    case "decimal-paren":
      return `${n})`;
    case "lower-alpha":
      return `${latinLetters(n)}.`;
    case "upper-alpha":
      return `${latinLetters(n).toUpperCase()}.`;
    case "lower-roman":
      return `${roman(n)}.`;
    case "upper-roman":
      return `${roman(n).toUpperCase()}.`;
    case "arabic-alpha":
      return `${arabicLetters(n)}-`;
    case "multi":
      // 1. → a. → i. → 1. …
      return level % 3 === 0 ? `${n}.` : level % 3 === 1 ? (arabic ? `${arabicLetters(n)}-` : `${latinLetters(n)}.`) : `${roman(n)}.`;
  }
}

/** One paragraph of a text, as far as its list is concerned: `list` (missing = not an item) and its indent level. */
export interface ListItem {
  list?: ListKind | null;
  level: number;
  /** The letters of a multilevel list are Arabic ones (a right-to-left paragraph). */
  arabic?: boolean;
}

/**
 * The marker of every paragraph (null for a paragraph that is not an item). Counting is per level: an item deeper than
 * the one before starts again at 1 and goes back to where it was when the level comes back; a paragraph that is not
 * an item, or an item of another kind at the same level, starts the numbering again.
 */
export function listMarkers(items: ListItem[]): (string | null)[] {
  const counters = new Map<number, number>();
  const kinds = new Map<number, ListKind>();
  return items.map((it) => {
    if (!it.list) {
      counters.clear();
      kinds.clear();
      return null;
    }
    const level = Math.max(0, Math.round(it.level));
    for (const k of [...counters.keys()]) if (k > level) {
      counters.delete(k);
      kinds.delete(k);
    }
    if (kinds.get(level) !== it.list) counters.delete(level);
    kinds.set(level, it.list);
    const n = (counters.get(level) ?? 0) + 1;
    counters.set(level, n);
    return markerText(it.list, n, level, it.arabic);
  });
}

/** The kind to put on a paragraph that already has `current`, when the teacher picks `wanted`: the same one again takes the list off (like Word's buttons). */
export const toggledList = (current: ListKind | null | undefined, wanted: ListKind): ListKind | null => (current === wanted ? null : wanted);
