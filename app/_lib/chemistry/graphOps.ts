// Edits of a MoleculeGraph as pure functions: each returns a new graph and never changes its argument,
// so the Studio's state hook stays thin and the rules are unit-tested.
import { newId } from "../id";
import { ATOM_HIT_RADIUS, ATOM_RADIUS, BOND_LENGTH, type Point } from "./bondGeometry";
import { ARROW_DEFAULT_WIDTH, ARROW_MIN_WIDTH, generateRing } from "./geometry";
import type { AtomNode, BondEdge, BondType, CanvasAnnotation, MoleculeGraph, RingSpec } from "./types";
import { getSnappedAngle, pointAt } from "./valence";

/** A new, visible, uncharged atom of `element` at (x, y). */
export const makeAtom = (element: string, x: number, y: number): AtomNode => ({ id: newId(), element, x, y, charge: 0, hidden: false });

export const addAtom = (graph: MoleculeGraph, atom: AtomNode): MoleculeGraph => ({ ...graph, atoms: [...graph.atoms, atom] });

/** Moves an atom; the bonds keep their ends (they are drawn from the atoms' coordinates). Unknown id: same graph. */
export function moveAtom(graph: MoleculeGraph, id: string, x: number, y: number): MoleculeGraph {
  if (!graph.atoms.some((a) => a.id === id)) return graph;
  return { ...graph, atoms: graph.atoms.map((a) => (a.id === id ? { ...a, x, y } : a)) };
}

/** Removes an atom and every bond that ends on it. Unknown id: same graph. */
export function removeAtom(graph: MoleculeGraph, id: string): MoleculeGraph {
  if (!graph.atoms.some((a) => a.id === id)) return graph;
  return { ...graph, atoms: graph.atoms.filter((a) => a.id !== id), bonds: graph.bonds.filter((b) => b.sourceId !== id && b.targetId !== id) };
}

/** The atom closest to (x, y) within `radius`, if any. */
export function atomNear(graph: MoleculeGraph, x: number, y: number, radius: number): AtomNode | undefined {
  let best: AtomNode | undefined;
  let bestDistance = radius;
  for (const a of graph.atoms) {
    const d = Math.hypot(a.x - x, a.y - y);
    if (d <= bestDistance) {
      best = a;
      bestDistance = d;
    }
  }
  return best;
}

/**
 * Removes an atom with its bonds, and the hydrogens that were attached to it and to nothing else
 * (CH4 minus its carbon leaves no four loose H). Unknown id: same graph.
 */
export function removeAtomAndHydrogens(graph: MoleculeGraph, id: string): MoleculeGraph {
  if (!graph.atoms.some((a) => a.id === id)) return graph;
  const degree = new Map<string, number>();
  for (const b of graph.bonds) for (const end of [b.sourceId, b.targetId]) degree.set(end, (degree.get(end) ?? 0) + 1);
  const byId = new Map(graph.atoms.map((a) => [a.id, a]));
  const loose = new Set<string>();
  for (const b of graph.bonds) {
    const other = b.sourceId === id ? b.targetId : b.targetId === id ? b.sourceId : null;
    if (other && byId.get(other)?.element === "H" && degree.get(other) === 1) loose.add(other);
  }
  let next = removeAtom(graph, id);
  for (const h of loose) next = removeAtom(next, h);
  return next;
}

const bondBetween = (graph: MoleculeGraph, a: string, b: string): BondEdge | undefined =>
  graph.bonds.find((x) => (x.sourceId === a && x.targetId === b) || (x.sourceId === b && x.targetId === a));

/**
 * Bonds two atoms. Two atoms never have two bonds: if they are already bonded the existing bond takes the
 * new type instead. Unknown ids, or an atom with itself: same graph.
 */
export function connectAtoms(graph: MoleculeGraph, sourceId: string, targetId: string, type: BondType): MoleculeGraph {
  if (sourceId === targetId) return graph;
  const known = (id: string) => graph.atoms.some((a) => a.id === id);
  if (!known(sourceId) || !known(targetId)) return graph;
  const existing = bondBetween(graph, sourceId, targetId);
  if (existing) return existing.type === type ? graph : setBondType(graph, existing.id, type);
  return { ...graph, bonds: [...graph.bonds, { id: newId(), sourceId, targetId, type, hidden: false }] };
}

/** A new atom at (x, y) bonded to an existing one (the end of a bond drawn into empty space). */
export function addBondedAtom(graph: MoleculeGraph, sourceId: string, element: string, x: number, y: number, type: BondType): MoleculeGraph {
  if (!graph.atoms.some((a) => a.id === sourceId)) return graph;
  const atom = makeAtom(element, x, y);
  return { ...graph, atoms: [...graph.atoms, atom], bonds: [...graph.bonds, { id: newId(), sourceId, targetId: atom.id, type, hidden: false }] };
}

export function setBondType(graph: MoleculeGraph, id: string, type: BondType): MoleculeGraph {
  const bond = graph.bonds.find((b) => b.id === id);
  if (!bond || bond.type === type) return graph;
  return { ...graph, bonds: graph.bonds.map((b) => (b.id === id ? { ...b, type } : b)) };
}

/** single → double → triple → single (a wedge or hash bond goes to single). */
export const nextBondType = (type: BondType): BondType => (type === "single" ? "double" : type === "double" ? "triple" : "single");

export function cycleBond(graph: MoleculeGraph, id: string): MoleculeGraph {
  const bond = graph.bonds.find((b) => b.id === id);
  return bond ? setBondType(graph, id, nextBondType(bond.type)) : graph;
}

export function removeBond(graph: MoleculeGraph, id: string): MoleculeGraph {
  if (!graph.bonds.some((b) => b.id === id)) return graph;
  return { ...graph, bonds: graph.bonds.filter((b) => b.id !== id) };
}

/** An automatic hydrogen the teacher takes hold of becomes theirs: the engine no longer moves or remakes it. */
export function claimAtom(graph: MoleculeGraph, id: string): MoleculeGraph {
  const atom = graph.atoms.find((a) => a.id === id);
  if (!atom?.auto) return graph;
  return { ...graph, atoms: graph.atoms.map((a) => (a.id === id ? { ...a, auto: false } : a)) };
}

/** Where a bond dragged from an atom would end. */
export type BondPlan = {
  /** The end of the bond (the centre of the atom it lands on, or the place of a new atom). */
  end: Point;
  /** The existing atom the bond ends on; null = a new atom is made at `end`. */
  targetId: string | null;
};

/**
 * What a bond dragged from atom `sourceId` to the mouse at (x, y) does:
 * - the mouse is still on the source atom: nothing (null), it was a click;
 * - the mouse is on another atom: a bond to it;
 * - otherwise a new atom one bond length away, at the direction of the mouse snapped to 30°
 *   (and if an atom is already there, a bond to that one: no two atoms on top of each other).
 */
export function planBond(graph: MoleculeGraph, sourceId: string, x: number, y: number): BondPlan | null {
  const source = graph.atoms.find((a) => a.id === sourceId);
  if (!source || Math.hypot(x - source.x, y - source.y) < ATOM_HIT_RADIUS) return null;
  const hit = atomNear(graph, x, y, ATOM_HIT_RADIUS);
  if (hit && hit.id !== sourceId) return { end: { x: hit.x, y: hit.y }, targetId: hit.id };
  const end = pointAt(source.x, source.y, getSnappedAngle(source.x, source.y, x, y), BOND_LENGTH);
  const there = atomNear(graph, end.x, end.y, ATOM_RADIUS);
  return there && there.id !== sourceId ? { end: { x: there.x, y: there.y }, targetId: there.id } : { end, targetId: null };
}

/** A ring of carbons centred on (x, y) (benzene's bonds alternate). The hydrogens are made by recalculateHydrogens. */
export function placeRing(graph: MoleculeGraph, ring: RingSpec, x: number, y: number): MoleculeGraph {
  const { atoms, bonds } = generateRing(x, y, ring.sides, ring.isAromatic);
  return { ...graph, atoms: [...graph.atoms, ...atoms], bonds: [...graph.bonds, ...bonds] };
}

/** The atom and every atom reachable from it through bonds: the molecule it belongs to. */
export function connectedAtomIds(graph: MoleculeGraph, startId: string): Set<string> {
  const seen = new Set<string>();
  if (!graph.atoms.some((a) => a.id === startId)) return seen;
  const next = new Map<string, string[]>();
  for (const b of graph.bonds) {
    next.set(b.sourceId, [...(next.get(b.sourceId) ?? []), b.targetId]);
    next.set(b.targetId, [...(next.get(b.targetId) ?? []), b.sourceId]);
  }
  const todo = [startId];
  while (todo.length) {
    const id = todo.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    todo.push(...(next.get(id) ?? []));
  }
  return seen;
}

/** Moves some atoms by (dx, dy) together (a whole molecule or ring); the bonds follow. */
export function translateAtoms(graph: MoleculeGraph, ids: ReadonlySet<string>, dx: number, dy: number): MoleculeGraph {
  if (!ids.size || (dx === 0 && dy === 0)) return graph;
  return { ...graph, atoms: graph.atoms.map((a) => (ids.has(a.id) ? { ...a, x: a.x + dx, y: a.y + dy } : a)) };
}

/** A new text or arrow. A text starts empty (the Studio opens its editor at once); an arrow has a default length. */
export const makeAnnotation = (type: CanvasAnnotation["type"], x: number, y: number): CanvasAnnotation => ({
  id: newId(),
  type,
  x,
  y,
  text: "",
  width: type === "arrow" ? ARROW_DEFAULT_WIDTH : undefined,
});

export const addAnnotationTo = (graph: MoleculeGraph, note: CanvasAnnotation): MoleculeGraph => ({ ...graph, annotations: [...graph.annotations, note] });

/** Changes some fields of a text or arrow. An arrow never gets shorter than ARROW_MIN_WIDTH. Unknown id: same graph. */
export function updateAnnotation(graph: MoleculeGraph, id: string, patch: Partial<Omit<CanvasAnnotation, "id" | "type">>): MoleculeGraph {
  if (!graph.annotations.some((n) => n.id === id)) return graph;
  return {
    ...graph,
    annotations: graph.annotations.map((n) => {
      if (n.id !== id) return n;
      const next = { ...n, ...patch };
      if (next.type === "arrow") next.width = Math.max(ARROW_MIN_WIDTH, next.width ?? ARROW_DEFAULT_WIDTH);
      return next;
    }),
  };
}

export function removeAnnotation(graph: MoleculeGraph, id: string): MoleculeGraph {
  if (!graph.annotations.some((n) => n.id === id)) return graph;
  return { ...graph, annotations: graph.annotations.filter((n) => n.id !== id) };
}
