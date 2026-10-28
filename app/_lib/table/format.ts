// Numbers in table cells: reading what was typed ("12,5", "1 200", "50 %") and writing a value the way the cell asks
// (decimals, percent, a unit before or after, the decimal comma of the exam's language). Pure functions.

/** How a number is shown (a cell's `fmt`); a number typed in the cell and the result of a formula are shown the same way */
export type NumberFormat = {
  /** Digits after the decimal mark (missing = as many as there are, up to 10) */
  decimals?: number;
  /** ×100 and a % sign */
  percent?: boolean;
  /** Text written before and after the number, as typed (e.g. " Ω", "€ ") */
  prefix?: string;
  suffix?: string;
  /** A thin space between the thousands: 1 200 */
  thousands?: boolean;
};

const NUMBER = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i;

/**
 * The number a text is, or null if it is not one. Both "," and "." are decimal marks, spaces between digits are thousands
 * ("1 200,5"), and a trailing % divides by 100. A text with anything else in it (a unit, a word) is text.
 */
export function parseNumber(text: string): number | null {
  let s = text.replace(/[\s\u00a0\u202f]/g, "");
  if (!s) return null;
  let scale = 1;
  if (s.endsWith("%")) {
    s = s.slice(0, -1);
    scale = 0.01;
  }
  if (!NUMBER.test(s)) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? roundOff(n * scale) : null;
}

// (0.1 + 0.2 is not shown as 0.30000000000000004)
const roundOff = (n: number) => Math.round(n * 1e10) / 1e10;

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");

/** The text of a number for a format; `mark` is the decimal mark ("," for a French or Arabic exam) */
export function formatNumber(n: number, fmt: NumberFormat = {}, mark = ","): string {
  const value = fmt.percent ? n * 100 : n;
  const decimals = fmt.decimals === undefined ? undefined : Math.max(0, Math.min(Math.round(fmt.decimals), 12));
  let text = decimals === undefined ? String(roundOff(value)) : value.toFixed(decimals);
  if (/e/i.test(text)) text = value.toFixed(decimals ?? 6).replace(/\.?0+$/, "");
  if (text === "-0" || /^-0(\.0+)?$/.test(text)) text = text.slice(1);
  const [first, frac] = text.split(".");
  let int = first;
  const negative = int.startsWith("-");
  if (negative) int = int.slice(1);
  if (fmt.thousands) int = group(int);
  const body = (negative ? "-" : "") + int + (frac ? mark + frac : "");
  return `${fmt.prefix ?? ""}${body}${fmt.percent ? " %" : ""}${fmt.suffix ?? ""}`;
}

/** The numbers of a column of text, for a series (1, 2 → 3, 4, 5…): null when one is not a number */
export const numbersOf = (texts: string[]): number[] | null => {
  const out: number[] = [];
  for (const t of texts) {
    const n = parseNumber(t);
    if (n === null) return null;
    out.push(n);
  }
  return out;
};
