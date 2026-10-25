// Copies RDKit.js (script + WASM) from node_modules to public/rdkit, so the app serves them itself and
// never loads anything from the network. Runs before `dev` and `build` (see package.json).
import { copyFileSync, mkdirSync } from "node:fs";

const from = new URL("../node_modules/@rdkit/rdkit/dist/", import.meta.url);
const to = new URL("../public/rdkit/", import.meta.url);
mkdirSync(to, { recursive: true });
for (const file of ["RDKit_minimal.js", "RDKit_minimal.wasm"]) copyFileSync(new URL(file, from), new URL(file, to));
