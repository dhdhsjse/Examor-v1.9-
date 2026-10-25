// Builds the data of a molecule block from a resolved candidate.
import type { ChemEngine } from "./engine/ChemEngine";
import { defaultRenderOptions, emptyEdits } from "./model";
import type { MoleculeBlockData, MoleculeSource, RenderOptions } from "./model";
import type { Candidate } from "./resolve/resolve";

export async function buildBlock(engine: ChemEngine, c: Candidate, source: MoleculeSource, lang: RenderOptions["lang"]): Promise<MoleculeBlockData> {
  const graph = c.molfile ? await engine.fromMolfile(c.molfile) : await engine.fromSmiles(c.smiles);
  return {
    schema: 1,
    source,
    smiles: await engine.toSmiles(graph),
    graph,
    representation: "structural",
    options: defaultRenderOptions(lang),
    edits: emptyEdits(),
    exerciseMode: "answer",
  };
}
