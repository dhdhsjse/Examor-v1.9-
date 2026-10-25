// The local molecule database (data/molecules.json) and its lookups.
import raw from "../data/molecules.json";
import { canonicalFormula, normalizeName } from "./normalize";

export type Lang = "ar" | "fr" | "en";

export interface DbEntry {
  id: string;
  smiles: string;
  formula: string;
  names: Record<Lang, string[]>;
  tags: string[];
  level: string;
  reviewed: boolean; // false = names not yet checked by a chemistry teacher
}

export const DATABASE = raw as unknown as DbEntry[];

const LANGS: Lang[] = ["ar", "fr", "en"];

let nameIndex: Map<string, DbEntry[]> | null = null;
let formulaIndex: Map<string, DbEntry[]> | null = null;

function build() {
  nameIndex = new Map();
  formulaIndex = new Map();
  for (const e of DATABASE) {
    for (const lang of LANGS) {
      for (const n of e.names[lang] ?? []) {
        const key = normalizeName(n);
        const list = nameIndex.get(key) ?? [];
        if (!list.includes(e)) list.push(e);
        nameIndex.set(key, list);
      }
    }
    const f = canonicalFormula(e.formula) ?? e.formula;
    formulaIndex.set(f, [...(formulaIndex.get(f) ?? []), e]);
  }
}

export function findByName(name: string): DbEntry[] {
  if (!nameIndex) build();
  return nameIndex!.get(normalizeName(name)) ?? [];
}

export function findByFormula(formula: string): DbEntry[] {
  if (!formulaIndex) build();
  const f = canonicalFormula(formula);
  return f ? (formulaIndex!.get(f) ?? []) : [];
}

// Autocomplete: entries with a name that starts with, then contains, what was typed.
export function suggest(input: string, limit = 8): DbEntry[] {
  const q = normalizeName(input);
  if (!q) return [];
  const starts: DbEntry[] = [];
  const contains: DbEntry[] = [];
  for (const e of DATABASE) {
    const names = LANGS.flatMap((l) => e.names[l] ?? []).map(normalizeName);
    if (names.some((n) => n.startsWith(q))) starts.push(e);
    else if (names.some((n) => n.includes(q))) contains.push(e);
  }
  return [...starts, ...contains].slice(0, limit);
}

export const entryName = (e: DbEntry, lang: Lang): string => e.names[lang]?.[0] ?? e.names.en[0] ?? e.names.fr[0] ?? e.id;

// Problems that make the database unsafe to ship (used by the CI script and the tests).
export function validateStructure(entries: DbEntry[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const owner = new Map<string, string>();
  for (const e of entries) {
    if (ids.has(e.id)) problems.push(`duplicate id: ${e.id}`);
    ids.add(e.id);
    for (const lang of LANGS) {
      for (const n of e.names[lang] ?? []) {
        const key = normalizeName(n);
        const prev = owner.get(key);
        if (prev && prev !== e.id) problems.push(`name "${n}" is used by both ${prev} and ${e.id}`);
        owner.set(key, e.id);
      }
    }
    if (!e.names.en.length || !e.names.fr.length) problems.push(`${e.id}: needs an English and a French name`);
  }
  return problems;
}
