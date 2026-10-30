// Word's "Change case" (Aa): sentence case, lowercase, UPPERCASE, Capitalize Each Word, tOGGLE cASE. Pure functions on
// characters, so the styled text can keep the style of each letter (richText.ts#mapChars): the result has one entry
// per input character (a letter that becomes two, like "ß" → "SS", carries its style onto both). Scripts without
// case (Arabic) pass through untouched.

export type CaseMode = "sentence" | "lower" | "upper" | "title" | "toggle";

export const CASE_MODES: CaseMode[] = ["sentence", "lower", "upper", "title", "toggle"];

const isLetter = (c: string) => /\p{L}/u.test(c);
const isDigit = (c: string) => /\p{N}/u.test(c);
const isSpace = (c: string) => /\s/u.test(c);
// What a word is made of: letters, digits and the apostrophe of l'école, d'abord, aujourd'hui.
const isWordChar = (c: string) => isLetter(c) || isDigit(c) || c === "'" || c === "’";
// A full stop, "!", "?", "…" or the Arabic question mark ends a sentence when a space follows.
const isSentenceEnd = (c: string) => ".!?…؟".includes(c);

const lower = (c: string) => c.toLowerCase();
const upper = (c: string) => c.toUpperCase();

/** The characters with their case changed; one entry per character (it may be longer: "ß" → "SS"). */
export function caseChars(chars: string[], mode: CaseMode): string[] {
  switch (mode) {
    case "lower":
      return chars.map(lower);
    case "upper":
      return chars.map(upper);
    case "toggle":
      return chars.map((c) => (c !== lower(c) ? lower(c) : c !== upper(c) ? upper(c) : c));
    case "title": {
      let start = true; // the first character of the selection counts as the start of a word, like Word
      return chars.map((c) => {
        const out = start && isLetter(c) ? upper(c) : c;
        start = !isWordChar(c);
        return out;
      });
    }
    case "sentence": {
      let capital = true; // the next letter starts a sentence
      return chars.map((c, i) => {
        if (c === "\n") {
          capital = true;
          return c;
        }
        if (isLetter(c)) {
          const out = capital ? upper(c) : lower(c);
          capital = false;
          return out;
        }
        if (isDigit(c)) capital = false; // ("5 m/s" is not "5 M/s")
        else if (isSentenceEnd(c) && (i + 1 >= chars.length || isSpace(chars[i + 1]) || /["'»”’)\]]/.test(chars[i + 1]))) capital = true;
        return c;
      });
    }
  }
}

/** The word around an offset of a text (a cursor between two words has none): [start, end) in UTF-16 units. */
export function wordAt(text: string, offset: number): { start: number; end: number } | null {
  let a = Math.max(0, Math.min(offset, text.length));
  let b = a;
  while (a > 0 && isWordChar(text[a - 1])) a--;
  while (b < text.length && isWordChar(text[b])) b++;
  return b > a ? { start: a, end: b } : null;
}

/** A text with its case changed. */
export const applyCase = (text: string, mode: CaseMode) => caseChars([...text], mode).join("");

/**
 * What Shift+F3 does to this text, like Word: lowercase → Capitalize Each Word → UPPERCASE → lowercase. A text
 * with no letters has nothing to change.
 */
export function cycleCase(text: string): CaseMode {
  if (text === applyCase(text, "upper")) return "lower";
  if (text === applyCase(text, "lower")) return "title";
  return "upper";
}
