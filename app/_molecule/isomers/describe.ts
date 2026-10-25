// What the isomer gallery needs to know about a molecule, and how two isomers relate.
import type { ChemEngine } from "../engine/ChemEngine";
import type { MolGraph } from "../model";
import { groupsAndShape } from "./groups";
import type { IsomerInfo, Relation } from "./types";

// Canonical SMILES of the carbon skeleton: only the carbons, every bond single. Two isomers with the same
// skeleton and the same groups differ only by where the group (or the multiple bond) is: position isomers.
export async function skeletonSmiles(engine: ChemEngine, g: MolGraph): Promise<string> {
  const carbons = g.atoms.filter((a) => a.element === "C");
  if (!carbons.length) return "";
  const ids = new Set(carbons.map((a) => a.id));
  const skeleton: MolGraph = {
    atoms: carbons.map((a) => ({ ...a, charge: 0, lonePairs: 0 })),
    bonds: g.bonds.filter((b) => ids.has(b.a) && ids.has(b.b)).map((b) => ({ ...b, order: 1 as const, stereo: "none" as const })),
  };
  return engine.toSmiles(skeleton);
}

export async function describeMolecule(engine: ChemEngine, g: MolGraph): Promise<IsomerInfo> {
  return { ...groupsAndShape(g), skeleton: await skeletonSmiles(engine, g) };
}

const sameGroups = (a: IsomerInfo, b: IsomerInfo) => a.groups.length === b.groups.length && a.groups.every((x) => b.groups.includes(x));

// School isomerism: a different functional group = function isomers; the same groups on a different carbon
// skeleton = chain isomers; the same skeleton = position isomers.
export function relation(current: IsomerInfo & { smiles: string }, other: IsomerInfo & { smiles: string }): Relation {
  if (current.smiles === other.smiles) return "same";
  if (!sameGroups(current, other)) return "function";
  return current.skeleton === other.skeleton ? "position" : "chain";
}
