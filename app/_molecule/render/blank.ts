// What is drawn for each atom and bond: shown, blank (a placeholder box) or hidden (a stub).
// The answer key (exerciseMode "answer") ignores every visibility edit.
import type { MolAtom, MolBond, MoleculeBlockData, Visibility } from "../model";

export function atomVis(block: MoleculeBlockData, atom: MolAtom): Visibility {
  if (block.exerciseMode === "answer") return "shown";
  const own = block.edits.atoms[atom.id]?.vis;
  if (own) return own;
  return atom.element === "H" && block.edits.hideAllHydrogens ? "hidden" : "shown";
}

export function bondVis(block: MoleculeBlockData, bond: MolBond): Visibility {
  if (block.exerciseMode === "answer") return "shown";
  return block.edits.bonds[bond.id]?.vis ?? "shown";
}

export function bondOrder(block: MoleculeBlockData, bond: MolBond): 1 | 2 | 3 {
  return block.exerciseMode === "answer" ? bond.order : (block.edits.bonds[bond.id]?.orderOverride ?? bond.order);
}

// A blank atom is a box unless the option says blanks look like hidden ones.
export const blankAsBox = (block: MoleculeBlockData) => block.options.blankStyle !== "stub";

export function atomLabel(block: MoleculeBlockData, atom: MolAtom): string {
  if (block.exerciseMode === "answer") return atom.element;
  return block.edits.atoms[atom.id]?.label ?? atom.element;
}
