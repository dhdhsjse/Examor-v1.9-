// The drawing as a V2000 molfile, so the generator's engine (app/_molecule) can read it. Pure functions (no React).
import { BOND_LENGTH, NON_COVALENT_BONDS } from "./bondGeometry";
import type { MoleculeGraph } from "./types";

const pad = (n: number | string, w: number) => String(n).padStart(w, " ");
const CHARGE_CODE: Record<number, number> = { 1: 3, 2: 2, 3: 1, 5: -1, 6: -2, 7: -3 };

// The engine adds the hydrogens the drawing leaves implicit, and the generator's renderers do the rest.
// Texts and arrows are not part of the molecule. The atoms keep the order of the drawing.
export function drawingToMolfile(graph: MoleculeGraph): string {
  const index = new Map(graph.atoms.map((a, i) => [a.id, i + 1]));
  // (a dative, ionic or hydrogen bond is not a bond of the molecule: the engine does not get it; see engineGraph.ts)
  const bonds = graph.bonds.filter((b) => index.has(b.sourceId) && index.has(b.targetId) && !NON_COVALENT_BONDS.includes(b.type));
  const out = ["", "  Examor", "", `${pad(graph.atoms.length, 3)}${pad(bonds.length, 3)}  0  0  0  0  0  0  0  0999 V2000`];
  for (const a of graph.atoms) {
    out.push(`${((a.x / BOND_LENGTH) * 1.5).toFixed(4).padStart(10)}${((-a.y / BOND_LENGTH) * 1.5).toFixed(4).padStart(10)}${"0.0000".padStart(10)} ${a.element.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0`);
  }
  for (const b of bonds) {
    // a quadruple bond is the engine's triple one (drawn with four lines afterwards); an aromatic one is type 4
    const order = b.type === "double" ? 2 : b.type === "triple" || b.type === "quadruple" ? 3 : b.type === "aromatic" ? 4 : 1;
    const stereo = b.type === "wedge" ? 1 : b.type === "dash" ? 6 : b.type === "wavy" ? 4 : 0;
    out.push(`${pad(index.get(b.sourceId) ?? 0, 3)}${pad(index.get(b.targetId) ?? 0, 3)}${pad(order, 3)}${pad(stereo, 3)}`);
  }
  const charged = graph.atoms.filter((a) => a.charge !== 0 && CHARGE_CODE[a.charge] !== undefined);
  for (let i = 0; i < charged.length; i += 8) {
    const part = charged.slice(i, i + 8);
    out.push(`M  CHG${pad(part.length, 3)}${part.map((a) => `${pad(index.get(a.id) ?? 0, 4)}${pad(a.charge, 4)}`).join("")}`);
  }
  out.push("M  END");
  return out.join("\n");
}
