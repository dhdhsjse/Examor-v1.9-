// name / formula / SMILES / molfile  ->  a ranked list of candidate molecules.
import type { ChemEngine } from "../engine/ChemEngine";
import { DATABASE, type DbEntry, type Lang, findByFormula, findByName, suggest } from "./database";
import { detectKind } from "./normalize";
import { loadIsomers } from "../isomers/load";

// How many structures of the isomer table the search list shows (the whole table is in the isomer gallery).
const MAX_FROM_TABLE = 12;

export interface Candidate {
  id: string;
  smiles: string;
  formula: string;
  names: { ar?: string; fr?: string; en?: string };
  source: "local-db" | "isomer-table" | "opsin" | "direct";
  tags?: string[];
  rank: number;
  molfile?: string; // set when the input was a molfile
}

export interface ResolveContext {
  lang: Lang;
  engine: ChemEngine;
}

export interface ResolveResult {
  candidates: Candidate[];
  error?: string; // why nothing could be read (shown to the teacher)
}

// A database molecule as a candidate (also used by the Studio to open one from its browser).
export const fromEntry = (e: DbEntry, rank = 100): Candidate => ({
  id: e.id,
  smiles: e.smiles,
  formula: e.formula,
  names: { ar: e.names.ar?.[0], fr: e.names.fr?.[0], en: e.names.en?.[0] },
  source: "local-db",
  tags: e.tags,
  rank,
});

function add(list: Candidate[], c: Candidate) {
  const dup = list.find((x) => x.smiles === c.smiles);
  if (!dup) list.push(c);
  else if (c.rank > dup.rank) dup.rank = c.rank;
}

// Tries everything that could make sense of the input: a name, a formula, SMILES. "NO" is a formula (nitric
// oxide) and also valid SMILES (hydroxylamine), so both are returned.
export async function resolve(input: string, ctx: ResolveContext): Promise<ResolveResult> {
  const text = input.trim();
  if (!text) return { candidates: [] };
  const out: Candidate[] = [];
  const kind = detectKind(text);

  if (kind === "molfile") {
    // A molfile starts with a (possibly blank) title line, so it is passed on untrimmed.
    try {
      const g = await ctx.engine.fromMolfile(input);
      const smiles = await ctx.engine.toSmiles(g);
      return { candidates: [{ id: "molfile", smiles, formula: ctx.engine.formula(g), names: {}, source: "direct", rank: 100, molfile: input }] };
    } catch (e) {
      return { candidates: [], error: (e as Error).message };
    }
  }

  for (const e of findByName(text)) add(out, fromEntry(e, 100));
  if (kind === "formula") {
    for (const e of findByFormula(text)) add(out, fromEntry(e, 90));
    // The isomer table (school-level structures, simplest first) completes the list: a formula is ambiguous.
    const table = await loadIsomers(text);
    table?.entries
      .filter((e) => e.school)
      .slice(0, MAX_FROM_TABLE)
      .forEach((e, i) => add(out, { id: `isomer:${e.smiles}`, smiles: e.smiles, formula: table.formula, names: { ar: e.name?.ar, fr: e.name?.fr, en: e.name?.en }, source: "isomer-table", rank: 85 - i / 100 }));
  }

  // SMILES: only when it is not simply a name we already found.
  if (!out.length || kind === "formula") {
    if (!/\s/.test(text)) {
      try {
        const g = await ctx.engine.fromSmiles(text);
        const smiles = await ctx.engine.toSmiles(g);
        const known = DATABASE.find((e) => e.smiles === smiles);
        add(out, known ? fromEntry(known, 80) : { id: `smiles:${smiles}`, smiles, formula: ctx.engine.formula(g), names: {}, source: "direct", rank: 80 });
      } catch {
        // not SMILES either: the suggestions below are the last resort
      }
    }
  }

  if (!out.length) for (const e of suggest(text, 6)) add(out, fromEntry(e, 50));

  out.sort((a, b) => b.rank - a.rank);
  if (!out.length) return { candidates: [], error: kind === "formula" ? "noFormulaMatch" : "noMatch" };
  return { candidates: out };
}
