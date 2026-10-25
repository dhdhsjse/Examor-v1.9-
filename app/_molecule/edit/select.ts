// Selection in the Studio: atoms, bonds and lone pairs (ids "atomId:index"), and the quick selections.
import { neighbors } from "../chem";
import type { MolGraph } from "../model";

export interface Selection {
  atoms: string[];
  bonds: string[];
  lonePairs: string[];
}

export const emptySelection = (): Selection => ({ atoms: [], bonds: [], lonePairs: [] });

export type Kind = keyof Selection;

export const isEmpty = (s: Selection) => !s.atoms.length && !s.bonds.length && !s.lonePairs.length;
export const count = (s: Selection) => s.atoms.length + s.bonds.length + s.lonePairs.length;

// Click: replaces the selection. Shift-click: adds or removes that element.
export function pick(s: Selection, kind: Kind, id: string, additive: boolean): Selection {
  if (!additive) return { ...emptySelection(), [kind]: [id] };
  const has = s[kind].includes(id);
  return { ...s, [kind]: has ? s[kind].filter((x) => x !== id) : [...s[kind], id] };
}

export const allHydrogens = (g: MolGraph): Selection => ({ ...emptySelection(), atoms: g.atoms.filter((a) => a.element === "H").map((a) => a.id) });

export function allLonePairs(g: MolGraph): Selection {
  const ids: string[] = [];
  for (const a of g.atoms) for (let i = 0; i < a.lonePairs; i++) ids.push(`${a.id}:${i}`);
  return { ...emptySelection(), lonePairs: ids };
}

export const allBonds = (g: MolGraph): Selection => ({ ...emptySelection(), bonds: g.bonds.map((b) => b.id) });

// The bonds of the selected atoms.
export function bondsOfAtoms(g: MolGraph, atomIds: string[]): Selection {
  const ids = new Set<string>();
  for (const id of atomIds) for (const n of neighbors(g, id)) ids.add(n.bond.id);
  return { ...emptySelection(), bonds: [...ids] };
}

// The hydrogens bonded to the selected atoms.
export function hydrogensOfAtoms(g: MolGraph, atomIds: string[]): Selection {
  const ids = new Set<string>();
  for (const id of atomIds) for (const n of neighbors(g, id)) if (n.atom.element === "H") ids.add(n.atom.id);
  return { ...emptySelection(), atoms: [...ids] };
}

// The lone pairs of the selected atoms.
export function lonePairsOfAtoms(g: MolGraph, atomIds: string[]): Selection {
  const ids: string[] = [];
  for (const a of g.atoms) if (atomIds.includes(a.id)) for (let i = 0; i < a.lonePairs; i++) ids.push(`${a.id}:${i}`);
  return { ...emptySelection(), lonePairs: ids };
}

// Drop what no longer exists (after a structural edit or an undo).
export function prune(s: Selection, g: MolGraph): Selection {
  const atoms = new Set(g.atoms.map((a) => a.id));
  const bonds = new Set(g.bonds.map((b) => b.id));
  const pairs = new Set(allLonePairs(g).lonePairs);
  return { atoms: s.atoms.filter((x) => atoms.has(x)), bonds: s.bonds.filter((x) => bonds.has(x)), lonePairs: s.lonePairs.filter((x) => pairs.has(x)) };
}
