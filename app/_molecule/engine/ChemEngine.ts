import type { MolGraph } from "../model";

// What the Studio needs from a chemistry library. RDKit.js implements it today; another library can
// replace it without touching the renderers.
export interface ChemEngine {
  init(): Promise<void>; // loads the WASM once, lazily
  fromSmiles(smiles: string): Promise<MolGraph>; // explicit H, 2D coordinates
  fromMolfile(molfile: string): Promise<MolGraph>;
  toSmiles(g: MolGraph): Promise<string>; // canonical
  formula(g: MolGraph): string; // Hill order, e.g. "C2H4O2"
  valence(g: MolGraph, atomId: string): { used: number; allowed: number[] };
  perceiveRings(g: MolGraph): string[][];
}
