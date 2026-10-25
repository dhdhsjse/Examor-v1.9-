// CI check of the molecule database and the isomer tables: npm run check:molecules
import { createRequire } from "node:module";
import type { MainModule } from "@rdkit/rdkit";
import { createRdkitEngine } from "../app/_molecule/engine/rdkitEngine";
import { DATABASE } from "../app/_molecule/resolve/database";
import { validateIsomerTables } from "../app/_molecule/isomers/validate";
import { validateDatabase } from "../app/_molecule/resolve/validate";

const require = createRequire(import.meta.url);
const engine = createRdkitEngine(() => (require("@rdkit/rdkit") as () => Promise<MainModule>)());

const problems = await validateDatabase(engine);
if (problems.length) {
  console.error(`molecules.json: ${problems.length} problem(s)\n` + problems.map((p) => "  - " + p).join("\n"));
  process.exit(1);
}
const unreviewed = DATABASE.filter((e) => !e.reviewed).length;
console.log(`molecules.json OK: ${DATABASE.length} entries (${unreviewed} not yet reviewed by a teacher)`);

const iso = await validateIsomerTables(engine);
if (iso.problems.length) {
  console.error(`isomer tables: ${iso.problems.length} problem(s)\n` + iso.problems.slice(0, 40).map((p) => "  - " + p).join("\n"));
  process.exit(1);
}
console.log(`isomer tables OK: ${iso.tables} formulas`);
