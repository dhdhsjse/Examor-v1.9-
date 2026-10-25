import type { ChemEngine } from "../engine/ChemEngine";
import { DATABASE, type DbEntry, validateStructure } from "./database";
import { canonicalFormula } from "./normalize";

// Every SMILES parses and is already canonical, every formula matches its SMILES, no duplicate ids or names.
export async function validateDatabase(engine: ChemEngine, entries: DbEntry[] = DATABASE): Promise<string[]> {
  const problems = validateStructure(entries);
  for (const e of entries) {
    try {
      const g = await engine.fromSmiles(e.smiles);
      const canonical = await engine.toSmiles(g);
      if (canonical !== e.smiles) problems.push(`${e.id}: SMILES should be written canonically as "${canonical}" (is "${e.smiles}")`);
      const formula = engine.formula(g);
      if (formula !== canonicalFormula(e.formula)) problems.push(`${e.id}: formula ${e.formula} does not match the structure (${formula})`);
    } catch (err) {
      problems.push(`${e.id}: ${(err as Error).message} ("${e.smiles}")`);
    }
  }
  return problems;
}
