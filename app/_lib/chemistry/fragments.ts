// Functional groups (-OH, -COOH…) as small graphs that attach to an atom of the drawing. Pure functions.
//
// A fragment lists only its heavy atoms: the hydrogens (the H of -OH, of -NH2, of the CHO carbon…) are made
// by the auto-valence engine once the group is in place, like the hydrogens of everything else.
import { newId } from "../id";
import { BOND_LENGTH } from "./bondGeometry";
import { makeAtom, removeAtom } from "./graphOps";
import type { AtomNode, BondEdge, BondType, MoleculeGraph } from "./types";
import { freeDirections, pointAt } from "./valence";

export type FragmentId = "oh" | "cooh" | "nh2" | "cho" | "ch3";

export type Fragment = {
  id: FragmentId;
  /** The group as it is written, typed plainly (see chemText.ts): "COOH", "NH2". */
  label: string;
  /**
   * Atoms in bond lengths. Atom 0 is the one that bonds to the molecule: it is at (0, 0), and the molecule is
   * to its left (at (-1, 0)); the other bonds of the group go to its right.
   */
  atoms: { element: string; x: number; y: number }[];
  bonds: { from: number; to: number; type: BondType }[];
};

const H = Math.sqrt(3) / 2; // a bond at 60° to the axis

export const FRAGMENTS: Readonly<Record<FragmentId, Fragment>> = {
  oh: { id: "oh", label: "OH", atoms: [{ element: "O", x: 0, y: 0 }], bonds: [] },
  cooh: {
    id: "cooh",
    label: "COOH",
    atoms: [
      { element: "C", x: 0, y: 0 },
      { element: "O", x: 0.5, y: -H },
      { element: "O", x: 0.5, y: H },
    ],
    bonds: [
      { from: 0, to: 1, type: "double" },
      { from: 0, to: 2, type: "single" },
    ],
  },
  nh2: { id: "nh2", label: "NH2", atoms: [{ element: "N", x: 0, y: 0 }], bonds: [] },
  cho: {
    id: "cho",
    label: "CHO",
    atoms: [
      { element: "C", x: 0, y: 0 },
      { element: "O", x: 0.5, y: -H },
    ],
    bonds: [{ from: 0, to: 1, type: "double" }],
  },
  ch3: { id: "ch3", label: "CH3", atoms: [{ element: "C", x: 0, y: 0 }], bonds: [] },
};

/** The groups in the order of the toolbar. */
export const FRAGMENT_IDS: readonly FragmentId[] = ["oh", "cooh", "nh2", "cho", "ch3"];

const round2 = (v: number) => Math.round(v * 100) / 100;

// The atoms and bonds of a fragment with its first atom at (rootX, rootY), turned by `angle` (and mirrored if `flip`).
function build(fragment: Fragment, rootX: number, rootY: number, angle: number, flip: boolean): { atoms: AtomNode[]; bonds: BondEdge[] } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const atoms = fragment.atoms.map((a) => {
    const ly = flip ? -a.y : a.y;
    return makeAtom(a.element, round2(rootX + BOND_LENGTH * (a.x * cos - ly * sin)), round2(rootY + BOND_LENGTH * (a.x * sin + ly * cos)));
  });
  const bonds: BondEdge[] = fragment.bonds.map((b) => ({ id: newId(), sourceId: atoms[b.from].id, targetId: atoms[b.to].id, type: b.type, hidden: false }));
  return { atoms, bonds };
}

const neighbours = (graph: MoleculeGraph, id: string): AtomNode[] =>
  graph.bonds.flatMap((b) => (b.sourceId === id ? [b.targetId] : b.targetId === id ? [b.sourceId] : [])).flatMap((n) => graph.atoms.find((a) => a.id === n) ?? []);

// The atom itself and its automatic hydrogens: they are remade after the edit, so they do not count as in the way.
function ignorable(graph: MoleculeGraph, id: string): Set<string> {
  return new Set([id, ...neighbours(graph, id).filter((n) => n.element === "H" && n.auto).map((n) => n.id)]);
}

// How far the closest of `placed` is from the rest of the drawing.
function clearance(graph: MoleculeGraph, placed: AtomNode[], ignore: Set<string>): number {
  let min = Infinity;
  for (const p of placed) for (const a of graph.atoms) if (!ignore.has(a.id)) min = Math.min(min, Math.hypot(a.x - p.x, a.y - p.y));
  return min;
}

/**
 * The direction in which a new bond leaves an atom (radians). Automatic hydrogens do not count: they give way.
 * - no other bond: to the east;
 * - one other bond: bent by 120° from it, on the side with more room (a chain zigzags);
 * - more: in the middle of the widest gap (outwards from a ring carbon).
 */
export function freeAngle(graph: MoleculeGraph, atomId: string): number {
  const atom = graph.atoms.find((a) => a.id === atomId);
  if (!atom) return 0;
  const taken = neighbours(graph, atomId)
    .filter((n) => !(n.element === "H" && n.auto))
    .map((n) => Math.atan2(n.y - atom.y, n.x - atom.x));
  if (!taken.length) return 0;
  if (taken.length > 1) return freeDirections(taken, 1)[0];
  const ignore = ignorable(graph, atomId);
  const room = (angle: number) => {
    const end = pointAt(atom.x, atom.y, angle);
    return clearance(graph, [{ id: "probe", element: "C", x: end.x, y: end.y, charge: 0, hidden: false }], ignore);
  };
  const left = taken[0] + (2 * Math.PI) / 3;
  const right = taken[0] - (2 * Math.PI) / 3;
  return room(left) >= room(right) - 1e-6 ? left : right;
}

/**
 * Attaches a group to the atom `targetId`, then the caller remakes the hydrogens.
 * - On an atom: the group goes in its free direction (freeAngle).
 * - On a hydrogen (drawn or automatic): the group replaces it, in the very direction of that hydrogen.
 * The group is mirrored if that leaves more room. Unknown atom, or a hydrogen that is not bonded to one atom: same graph.
 */
export function attachFragment(graph: MoleculeGraph, fragment: Fragment, targetId: string): MoleculeGraph {
  const target = graph.atoms.find((a) => a.id === targetId);
  if (!target) return graph;

  let base = graph;
  let anchor = target;
  let angle: number;
  if (target.element === "H") {
    const parents = neighbours(graph, target.id);
    if (parents.length !== 1 || parents[0].element === "H") return graph;
    anchor = parents[0];
    angle = Math.atan2(target.y - anchor.y, target.x - anchor.x);
    base = removeAtom(graph, target.id);
  } else {
    angle = freeAngle(graph, target.id);
  }

  const root = pointAt(anchor.x, anchor.y, angle);
  const ignore = ignorable(base, anchor.id);
  const plain = build(fragment, root.x, root.y, angle, false);
  const mirrored = build(fragment, root.x, root.y, angle, true);
  const placed = fragment.atoms.length > 1 && clearance(base, mirrored.atoms, ignore) > clearance(base, plain.atoms, ignore) + 1e-6 ? mirrored : plain;
  const link: BondEdge = { id: newId(), sourceId: anchor.id, targetId: placed.atoms[0].id, type: "single", hidden: false };
  return { ...base, atoms: [...base.atoms, ...placed.atoms], bonds: [...base.bonds, link, ...placed.bonds] };
}

/** A group on its own, its first atom at (x, y) and the rest to the right of it. */
export function placeFragment(graph: MoleculeGraph, fragment: Fragment, x: number, y: number): MoleculeGraph {
  const placed = build(fragment, x, y, 0, false);
  return { ...graph, atoms: [...graph.atoms, ...placed.atoms], bonds: [...graph.bonds, ...placed.bonds] };
}
