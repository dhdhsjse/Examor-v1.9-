// What the buttons and shortcuts of the Studio do to "the selection" (atoms, bonds, lone pairs together).
import type { MoleculeBlockData, MoleculeEdits, Visibility } from "../model";
import { removeAtoms, removeBonds, setAtomVis, setBondVis, setLonePairsVisible } from "./ops";
import type { Selection } from "./select";

// Show / blank / hide everything selected. A lone pair has no "blank": it is shown or hidden.
export function applyVisibility(b: MoleculeBlockData, sel: Selection, vis: Visibility): MoleculeBlockData {
  let n = b;
  if (sel.atoms.length) n = setAtomVis(n, sel.atoms, vis);
  if (sel.bonds.length) n = setBondVis(n, sel.bonds, vis);
  if (sel.lonePairs.length) n = setLonePairsVisible(n, sel.lonePairs, vis === "shown");
  return n;
}

// Structural removal of the selected bonds and atoms (lone pairs cannot be removed, only hidden).
export function removeSelected(b: MoleculeBlockData, sel: Selection): MoleculeBlockData {
  let n = b;
  if (sel.bonds.length) n = removeBonds(n, sel.bonds);
  if (sel.atoms.length) n = removeAtoms(n, sel.atoms);
  return n;
}

// Has the teacher hidden, blanked or relabelled anything? (Then the answer key and the student version differ.)
export function hasVisibilityEdits(e: MoleculeEdits): boolean {
  return (
    !!e.hideAllHydrogens ||
    Object.values(e.atoms).some((a) => a.vis || a.label !== undefined) ||
    Object.values(e.bonds).some((b) => b.vis || b.orderOverride) ||
    Object.keys(e.lonePairs).length > 0
  );
}

// How many parts the student version hides, blanks, relabels or draws differently (shown to the teacher as "N parts changed").
export function changedParts(b: MoleculeBlockData): number {
  const e = b.edits;
  const atoms = Object.values(e.atoms).filter((a) => a.vis || a.label !== undefined).length;
  const bonds = Object.values(e.bonds).filter((x) => x.vis || x.orderOverride).length;
  const pairs = Object.values(e.lonePairs).reduce((n, row) => n + row.filter((v) => v === false).length, 0);
  const hydrogens = e.hideAllHydrogens ? b.graph.atoms.filter((a) => a.element === "H" && !e.atoms[a.id]?.vis).length : 0;
  return atoms + bonds + pairs + hydrogens;
}
