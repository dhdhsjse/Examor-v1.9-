// CI check of the isomer tables: every structure parses and is written canonically, its formula is the table's, nothing
// is duplicated, and every classification flag still equals what the CURRENT rules compute (so a table generated with
// older rules, or edited by hand, is caught). Names must be the database's.
import { ISOMER_LOADERS } from "../data/isomers";
import type { ChemEngine } from "../engine/ChemEngine";
import { DATABASE } from "../resolve/database";
import { canonicalFormula } from "../resolve/normalize";
import { CAPS } from "./build";
import { describeMolecule } from "./describe";
import { schoolIssues } from "./school";
import type { IsomerFile } from "./types";

export async function validateIsomerFile(engine: ChemEngine, key: string, file: IsomerFile): Promise<string[]> {
  const problems: string[] = [];
  const bad = (msg: string) => problems.push(`${key}: ${msg}`);
  if (file.formula !== key || canonicalFormula(file.formula) !== key) bad(`file says ${file.formula}`);
  const school = file.entries.filter((e) => e.school);
  const other = file.entries.filter((e) => !e.school);
  if (file.entries.length < 2 && file.total >= 2) bad("too few entries");
  if (file.total < 2) bad("a table needs at least two structures");
  if (file.total < file.entries.length || file.schoolTotal < school.length || file.schoolTotal > file.total) bad("inconsistent counts");
  if (school.length > CAPS.school || other.length > CAPS.other) bad("lists longer than the caps");
  if (file.entries.findIndex((e) => !e.school) >= 0 && file.entries.slice(file.entries.findIndex((e) => !e.school)).some((e) => e.school)) bad("school structures must come first");
  const seen = new Set<string>();
  for (const e of file.entries) {
    if (seen.has(e.smiles)) bad(`duplicate ${e.smiles}`);
    seen.add(e.smiles);
    try {
      const g = await engine.fromSmiles(e.smiles);
      if ((await engine.toSmiles(g)) !== e.smiles) bad(`${e.smiles} is not canonical`);
      if (engine.formula(g) !== key) bad(`${e.smiles} has formula ${engine.formula(g)}`);
      const issues = schoolIssues(g);
      const stored = [...(e.issues ?? [])].sort().join();
      if ((issues.length === 0) !== e.school || [...issues].sort().join() !== stored) bad(`${e.smiles}: school flags are out of date`);
      const info = await describeMolecule(engine, g);
      if (info.groups.join() !== e.groups.join() || info.ring !== e.ring || info.branched !== e.branched || info.skeleton !== e.skeleton) bad(`${e.smiles}: classification is out of date`);
      const known = DATABASE.find((d) => d.smiles === e.smiles);
      if (known && e.name?.en !== known.names.en[0]) bad(`${e.smiles}: name should be "${known.names.en[0]}"`);
      if (!known && e.name) bad(`${e.smiles}: only database molecules have names`);
    } catch (err) {
      bad(`${e.smiles}: ${(err as Error).message}`);
    }
  }
  // MAYGEN must have found every molecule we know, and it must be listed.
  for (const d of DATABASE) if (canonicalFormula(d.formula) === key && !seen.has(d.smiles)) bad(`database molecule ${d.id} (${d.smiles}) is missing`);
  return problems;
}

export async function validateIsomerTables(engine: ChemEngine): Promise<{ problems: string[]; tables: number }> {
  const problems: string[] = [];
  const keys = Object.keys(ISOMER_LOADERS);
  for (const key of keys) problems.push(...(await validateIsomerFile(engine, key, await ISOMER_LOADERS[key]())));
  return { problems, tables: keys.length };
}
