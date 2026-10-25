// Skeletal (line-angle) formula: which atoms get a label and what it says.
//   - a carbon is a bare vertex (nothing written), unless it is charged, alone, or has two double bonds (O=C=O);
//   - a hydrogen on a carbon is not drawn; a hydrogen on another atom is part of that atom's label: OH, NH2, SH;
//   - the hydrogens are written on the side AWAY from the bonds: CH3–CH2–OH, but HO–CH2… when the bond is on the left;
//   - a molecule with one heavy atom (CH4, H2O, NH3, HCl) is simply written as its formula.
import { displayFormula, neighbors } from "../chem";
import type { MolAtom, MolGraph } from "../model";

export interface SkeletalLabel {
  implicit: boolean; // a bare vertex
  symbol: string; // "O", "N", "CH4" (a whole formula for one-heavy-atom molecules)
  hCount: number; // hydrogens written next to the symbol
  side: 1 | -1; // 1: hydrogens to the right of the symbol, -1: to the left
}

// null = this atom is not drawn at all (a hydrogen that belongs to a heavier atom).
export function skeletalLabel(g: MolGraph, a: MolAtom, pos: Map<string, { x: number; y: number }>): SkeletalLabel | null {
  const heavyTotal = g.atoms.filter((x) => x.element !== "H").length;
  if (a.element === "H") return heavyTotal > 0 ? null : { implicit: false, symbol: "H", hCount: 0, side: 1 };
  if (heavyTotal === 1) return { implicit: false, symbol: displayFormula(g), hCount: 0, side: 1 };

  const around = neighbors(g, a.id);
  const heavy = around.filter((n) => n.atom.element !== "H");
  const hCount = around.length - heavy.length;
  if (a.element === "C") {
    const cumulated = around.filter((n) => n.bond.order === 2).length >= 2;
    if (a.charge === 0 && a.isotope === undefined && heavy.length >= 1 && !cumulated) return { implicit: true, symbol: "C", hCount: 0, side: 1 };
  }
  // Hydrogens go away from the bonds: if the neighbours are to the right of the atom, they are written on its left.
  const p = pos.get(a.id) ?? { x: a.x, y: a.y };
  const meanDx = heavy.reduce((s, n) => s + ((pos.get(n.atom.id) ?? n.atom).x - p.x), 0) / Math.max(1, heavy.length);
  return { implicit: false, symbol: a.element, hCount, side: meanDx > 0.05 ? -1 : 1 };
}
