import { createRequire } from "node:module";
import type { MainModule } from "@rdkit/rdkit";
import { createRdkitEngine } from "../engine/rdkitEngine";
import type { ChemEngine } from "../engine/ChemEngine";
import { defaultRenderOptions, emptyEdits } from "../model";
import type { MoleculeBlockData, Representation } from "../model";

const require = createRequire(import.meta.url);
let engine: ChemEngine | null = null;

// RDKit loaded the Node way (tests only; the app loads it from /public/rdkit).
export function testEngine(): ChemEngine {
  engine ??= createRdkitEngine(() => (require("@rdkit/rdkit") as () => Promise<MainModule>)());
  return engine;
}

export async function blockFor(smiles: string, representation: Representation = "structural", over: Partial<MoleculeBlockData> = {}): Promise<MoleculeBlockData> {
  const e = testEngine();
  const graph = await e.fromSmiles(smiles);
  return {
    schema: 1,
    source: { kind: "smiles", input: smiles },
    smiles: await e.toSmiles(graph),
    graph,
    representation,
    options: defaultRenderOptions("en"),
    edits: emptyEdits(),
    exerciseMode: "answer",
    ...over,
  };
}

// The fixtures of the spec (section 16).
export const FIXTURES: Record<string, string> = {
  methane: "C",
  ethane: "CC",
  ethene: "C=C",
  ethyne: "C#C",
  water: "O",
  ammonia: "N",
  co2: "O=C=O",
  hcl: "Cl",
  ethanol: "CCO",
  aceticAcid: "CC(=O)O",
  benzene: "c1ccccc1",
  propanone: "CC(=O)C",
  ethanal: "CC=O",
  methylMethanoate: "COC=O",
};
