// How simple a structure is for a school (lower = simpler): the order of the gallery.
import { neighbors } from "../chem";
import type { MolGraph } from "../model";
import { ringSizes } from "./groups";
import type { GroupId, IsomerInfo } from "./types";

const WEIGHT: Record<GroupId, number> = {
  alkane: 0,
  "carboxylic-acid": 0,
  alcohol: 1,
  aldehyde: 1,
  ketone: 1,
  ester: 1,
  amide: 1,
  amine: 1,
  halide: 1,
  alkene: 1,
  aromatic: 1,
  ether: 2,
  alkyne: 2,
  nitrile: 2,
  phenol: 2,
  cycloalkane: 3,
  other: 8,
};

export function simplicity(g: MolGraph, info: Pick<IsomerInfo, "groups">, school: boolean, smiles: string): number {
  const groups = info.groups.reduce((s, id) => s + WEIGHT[id], 0);
  const branchPoints = g.atoms.filter((a) => a.element === "C" && neighbors(g, a.id).filter((n) => n.atom.element === "C").length >= 3).length;
  return groups + 2 * branchPoints + 3 * ringSizes(g).length + (school ? 0 : 100) + smiles.length / 100;
}
