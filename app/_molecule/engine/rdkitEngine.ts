// RDKit.js implementation of ChemEngine. Only types are imported from the package: the module itself
// is loaded by the `load` function the caller passes (a <script> tag in the app, require in tests).
import type { MainModule, Mol } from "@rdkit/rdkit";
import { formula, perceiveRings, valence } from "../chem";
import type { MolGraph } from "../model";
import type { ChemEngine } from "./ChemEngine";
import { parseMolfile, writeMolfile } from "./molfile";

export function createRdkitEngine(load: () => Promise<MainModule>): ChemEngine {
  let rd: MainModule | null = null;
  let loading: Promise<void> | null = null;

  const mod = (): MainModule => {
    if (!rd) throw new Error("Chemistry engine not initialised");
    return rd;
  };

  // Parse, run `fn`, and always free the WASM memory.
  const withMol = <T>(input: string, what: string, fn: (m: Mol) => T): T => {
    const m = mod().get_mol(input);
    if (!m || !m.is_valid()) {
      m?.delete();
      throw new Error(`Invalid ${what}`);
    }
    try {
      return fn(m);
    } finally {
      m.delete();
    }
  };

  // Heavy-atom molecule -> molfile with explicit hydrogens, plus the depiction WITHOUT hydrogens for the skeletal
  // formula (with hydrogens in the way the chains come out straight). Hydrogens are added after the heavy atoms,
  // so atom i of one block is atom i of the other.
  const explicitH = (m: Mol): MolGraph => {
    const g = parseMolfile(m.add_hs());
    try {
      const heavy = parseMolfile(m.get_molblock());
      if (heavy.atoms.length <= g.atoms.length) heavy.atoms.forEach((a, i) => ((g.atoms[i].sx = a.x), (g.atoms[i].sy = a.y)));
    } catch {
      // no second depiction: the skeletal formula falls back to the first one
    }
    return g;
  };

  return {
    init() {
      loading ??= load().then((m) => {
        rd = m;
      });
      return loading;
    },
    async fromSmiles(smiles) {
      await this.init();
      return withMol(smiles.trim(), "SMILES", explicitH);
    },
    async fromMolfile(molfile) {
      await this.init();
      return withMol(molfile, "molfile", explicitH);
    },
    async toSmiles(g) {
      await this.init();
      return withMol(writeMolfile(g), "structure", (m) => {
        const bare = mod().get_mol(m.remove_hs());
        if (!bare) throw new Error("Invalid structure");
        try {
          // H2 has nothing but hydrogens: keep them.
          return bare.get_num_atoms() === 0 ? m.get_smiles() : bare.get_smiles();
        } finally {
          bare.delete();
        }
      });
    },
    formula,
    valence,
    perceiveRings,
  };
}
