// Turns the raw SMILES MAYGEN produced for one formula into the data file the app ships:
// canonical, de-duplicated, classified, school-filtered, ranked and capped. No Java in here: the generator script
// runs MAYGEN and hands the lines to this function, so the rules are unit-tested.
import type { ChemEngine } from "../engine/ChemEngine";
import { DATABASE } from "../resolve/database";
import { describeMolecule } from "./describe";
import { simplicity } from "./rank";
import { schoolIssues } from "./school";
import type { IsomerEntry, IsomerFile } from "./types";

export const CAPS = { school: 40, other: 20 };

export async function buildIsomerFile(engine: ChemEngine, formula: string, rawSmiles: string[], caps = CAPS): Promise<IsomerFile> {
  const seen = new Set<string>();
  const rows: { entry: IsomerEntry; score: number }[] = [];
  for (const raw of rawSmiles) {
    const text = raw.trim().split(/\s+/)[0];
    if (!text) continue;
    let graph;
    try {
      graph = await engine.fromSmiles(text);
    } catch {
      continue; // a structure RDKit cannot read is not offered
    }
    if (engine.formula(graph) !== formula) continue;
    const smiles = await engine.toSmiles(graph);
    if (seen.has(smiles)) continue;
    seen.add(smiles);

    const issues = schoolIssues(graph);
    const school = issues.length === 0;
    const info = await describeMolecule(engine, graph);
    const known = DATABASE.find((d) => d.smiles === smiles);
    const entry: IsomerEntry = { smiles, ...info, school, ...(school ? {} : { issues }) };
    // Names come from the local database only: they are never generated.
    if (known) entry.name = { en: known.names.en[0], fr: known.names.fr[0], ...(known.names.ar.length ? { ar: known.names.ar[0] } : {}) };
    rows.push({ entry, score: simplicity(graph, info, school, smiles) - (known ? 1000 : 0) });
  }
  rows.sort((a, b) => Number(b.entry.school) - Number(a.entry.school) || a.score - b.score || a.entry.smiles.localeCompare(b.entry.smiles));
  const school = rows.filter((r) => r.entry.school);
  const other = rows.filter((r) => !r.entry.school);
  return {
    formula,
    total: rows.length,
    schoolTotal: school.length,
    entries: [...school.slice(0, caps.school), ...other.slice(0, caps.other)].map((r) => r.entry),
  };
}
