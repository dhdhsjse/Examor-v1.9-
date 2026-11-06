// Normalisation of what a teacher types: Latin and Arabic names, molecular formulas.
import { ELEMENTS, hillFormula } from "../chem";

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

// Latin: lower case, no accents, plain apostrophes, single spaces ("éthanoïque" -> "ethanoique").
function normalizeLatin(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[‐‑–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// Arabic: no tashkeel or tatweel, one alef, one yaa, one ta marbuta/ha.
function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

export const normalizeName = (s: string) => normalizeArabic(normalizeLatin(s));

export const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

// "C₂H₄O₂" -> "C2H4O2"
export const normalizeSubscripts = (s: string) =>
  s.replace(new RegExp(`[${SUBSCRIPTS}]`, "g"), (c) => String(SUBSCRIPTS.indexOf(c)));

// Counts of a plain formula ("C2H4O2", "CO2", "HCl"); null if the text is not one. Case matters (Co is not CO).
export function parseFormula(input: string): Record<string, number> | null {
  const s = normalizeSubscripts(input.trim()).replace(/\s+/g, "");
  if (!/^(?:[A-Z][a-z]?\d*)+$/.test(s)) return null;
  const counts: Record<string, number> = {};
  for (const m of s.matchAll(/([A-Z][a-z]?)(\d*)/g)) {
    if (!ELEMENTS.has(m[1])) return null;
    counts[m[1]] = (counts[m[1]] ?? 0) + (m[2] ? parseInt(m[2], 10) : 1);
  }
  return counts;
}

// The same formula whatever order it was typed in: "H4C2O2", "C2H4O2" -> "C2H4O2".
export function canonicalFormula(input: string): string | null {
  const counts = parseFormula(input);
  return counts ? hillFormula(counts) : null;
}

// The formulas that text typed without capitals can be ("h2o" -> H2O, "co2" -> CO2 and Co2, "nacl" -> NaCl), canonical, one-letter
// symbols first (so the common reading comes first). Empty when the text has no reading, or already is a formula as typed.
export function formulaReadings(input: string, max = 6): string[] {
  const s = normalizeSubscripts(input.trim()).replace(/\s+/g, "");
  if (s.length > 24 || !/^[a-z][a-z\d]*$/i.test(s) || parseFormula(s)) return [];
  const out: string[] = [];
  const walk = (i: number, counts: Record<string, number>) => {
    if (out.length >= max) return;
    if (i === s.length) {
      const f = hillFormula(counts);
      if (!out.includes(f)) out.push(f);
      return;
    }
    for (const len of [1, 2]) {
      const part = s.slice(i, i + len);
      if (part.length < len || /\d/.test(part)) continue;
      const symbol = part[0].toUpperCase() + part.slice(1).toLowerCase();
      if (!ELEMENTS.has(symbol)) continue;
      const digits = /^\d*/.exec(s.slice(i + len))![0];
      const n = digits ? parseInt(digits, 10) : 1;
      if (n === 0) continue;
      walk(i + len + digits.length, { ...counts, [symbol]: (counts[symbol] ?? 0) + n });
    }
  };
  walk(0, {});
  return out;
}

export type InputKind = "molfile" | "formula" | "smiles-or-name";

export function detectKind(input: string): InputKind {
  if (/M {2}END/.test(input) || /V[23]000/.test(input)) return "molfile";
  if (parseFormula(input)) return "formula";
  return "smiles-or-name";
}
