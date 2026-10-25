// The exam side of the drawing: what the student version shows in place of the atoms and bonds the teacher masked,
// and how the masks reach the school representations made by the generator's engine (app/_molecule).
// Pure functions (no React), unit-tested.
//
// A masked atom (`hidden`) is written as its replacement text in the student version: "?" unless the teacher chose
// another, and an empty dashed box when the text is empty. A masked bond is a dashed grey line, or nothing when its
// replacement is empty. Everything else about them is still drawn: a bond keeps ending where the masked atom is.
import type { MolGraph, MoleculeEdits } from "../../_molecule/model";
import type { AtomNode, BondEdge, MoleculeGraph } from "./types";

export const DEFAULT_ATOM_MASK = "?";

/** The teacher's and the student's view of a drawing. */
export type StudioView = "teacher" | "student";

/** An automatic hydrogen of a masked atom goes with it: the student sees "?" and no hydrogens around it. */
export const isOmittedHydrogen = (a: AtomNode) => a.hidden && a.auto === true && a.element === "H";

/** What the student version draws for an atom. "mask" with an empty text is an empty dashed box. */
export type AtomShow = { kind: "normal" } | { kind: "omit" } | { kind: "mask"; text: string };

export function atomInStudentView(a: AtomNode): AtomShow {
  if (!a.hidden) return { kind: "normal" };
  if (isOmittedHydrogen(a)) return { kind: "omit" };
  return { kind: "mask", text: a.mask ?? DEFAULT_ATOM_MASK };
}

/** What the student version draws for a bond: itself, nothing, or a dashed grey line ("missing"). */
export type BondShow = { kind: "normal" } | { kind: "omit" } | { kind: "missing" };

export function bondInStudentView(b: BondEdge, source: AtomNode | undefined, target: AtomNode | undefined): BondShow {
  if (!source || !target || isOmittedHydrogen(source) || isOmittedHydrogen(target)) return { kind: "omit" };
  if (!b.hidden) return { kind: "normal" };
  return b.mask === "" ? { kind: "omit" } : { kind: "missing" };
}

/** How many atoms and bonds are masked (the automatic hydrogens that go with a masked atom do not count). */
export function maskedCount(graph: MoleculeGraph): number {
  return graph.atoms.filter((a) => a.hidden && !isOmittedHydrogen(a)).length + graph.bonds.filter((b) => b.hidden).length;
}

// ---- the school representations ----

/** The atoms and bonds of the engine's graph (ids "a1", "b1"…) that stand for those of the drawing. */
export type EngineMap = { atoms: Map<string, string>; bonds: Map<string, string> };

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Which atom of the engine is which atom of the drawing. The engine reads the drawing as a molfile, keeps the heavy
 * atoms in their order and puts its own hydrogens (and the ones it re-adds) after them, so: the heavy atoms are
 * matched in order, and the hydrogens of each heavy atom in order too. If the two do not have the same heavy atoms
 * nothing is matched (a mask is then not applied, never applied to the wrong atom).
 */
export function mapToEngine(graph: MoleculeGraph, mol: MolGraph): EngineMap {
  const map: EngineMap = { atoms: new Map(), bonds: new Map() };
  const heavyDrawn = graph.atoms.filter((a) => a.element !== "H");
  const heavyEngine = mol.atoms.filter((a) => a.element !== "H");
  if (heavyDrawn.length !== heavyEngine.length) return map;
  heavyDrawn.forEach((a, i) => map.atoms.set(a.id, heavyEngine[i].id));

  const hydrogensOn = <T>(items: T[], idOf: (t: T) => string, neighbours: (id: string) => string[]) => {
    const out = new Map<string, string[]>();
    for (const item of items) {
      const host = neighbours(idOf(item))[0];
      if (host) out.set(host, [...(out.get(host) ?? []), idOf(item)]);
    }
    return out;
  };
  const drawnById = new Map(graph.atoms.map((a) => [a.id, a]));
  const drawnHost = (id: string) => graph.bonds.flatMap((b) => (b.sourceId === id ? [b.targetId] : b.targetId === id ? [b.sourceId] : [])).filter((n) => drawnById.get(n)?.element !== "H");
  const engineById = new Map(mol.atoms.map((a) => [a.id, a]));
  const engineHost = (id: string) => mol.bonds.flatMap((b) => (b.a === id ? [b.b] : b.b === id ? [b.a] : [])).filter((n) => engineById.get(n)?.element !== "H");
  const drawnH = hydrogensOn(graph.atoms.filter((a) => a.element === "H"), (a) => a.id, drawnHost);
  const engineH = hydrogensOn(mol.atoms.filter((a) => a.element === "H"), (a) => a.id, engineHost);
  for (const [host, drawn] of drawnH) {
    const theirs = engineH.get(map.atoms.get(host) ?? "") ?? [];
    drawn.slice(0, theirs.length).forEach((id, i) => map.atoms.set(id, theirs[i]));
  }

  const engineBond = new Map(mol.bonds.map((b) => [pairKey(b.a, b.b), b.id]));
  for (const b of graph.bonds) {
    const s = map.atoms.get(b.sourceId);
    const t = map.atoms.get(b.targetId);
    const id = s && t ? engineBond.get(pairKey(s, t)) : undefined;
    if (id) map.bonds.set(b.id, id);
  }
  return map;
}

/**
 * The visibility edits that make the engine's student version of a representation show the masks of the drawing:
 * a masked atom is its replacement text (an empty box if that is empty) and takes its lone pairs with it; a masked
 * bond is dashed (or gone). The hydrogens the engine added to a masked atom (the drawing did not have them) go with it,
 * like the automatic ones of the drawing: they would show what the atom is. The graph itself is never changed.
 */
export function engineEdits(graph: MoleculeGraph, mol: MolGraph, base: MoleculeEdits): MoleculeEdits {
  const map = mapToEngine(graph, mol);
  const engineAtoms = new Map(mol.atoms.map((a) => [a.id, a]));
  const edits: MoleculeEdits = { ...base, atoms: { ...base.atoms }, bonds: { ...base.bonds }, lonePairs: { ...base.lonePairs } };
  for (const a of graph.atoms) {
    const id = map.atoms.get(a.id);
    if (id && a.pairsHidden) edits.lonePairs[id] = Array.from({ length: a.pairs ?? engineAtoms.get(id)?.lonePairs ?? 0 }, () => false); // the students draw them
    if (!id || !a.hidden) continue;
    const show = atomInStudentView(a);
    if (show.kind === "omit") edits.atoms[id] = { vis: "hidden" };
    else if (show.kind === "mask" && show.text === "") edits.atoms[id] = { vis: "blank" };
    else if (show.kind === "mask") {
      edits.atoms[id] = { vis: "shown", label: show.text };
      edits.lonePairs[id] = Array.from({ length: engineAtoms.get(id)?.lonePairs ?? 0 }, () => false);
    }
  }
  for (const b of graph.bonds) {
    const id = map.bonds.get(b.id);
    if (!id || !b.hidden) continue;
    edits.bonds[id] = { vis: b.mask === "" ? "hidden" : "blank" };
  }
  const drawn = new Set(map.atoms.values());
  const masked = new Set(graph.atoms.filter((a) => a.hidden && !isOmittedHydrogen(a)).map((a) => map.atoms.get(a.id)));
  for (const b of mol.bonds) {
    const [host, h] = engineAtoms.get(b.a)?.element === "H" ? [b.b, b.a] : [b.a, b.b];
    if (engineAtoms.get(h)?.element !== "H" || drawn.has(h) || !masked.has(host)) continue;
    edits.atoms[h] = { vis: "hidden" };
    edits.bonds[b.id] = { vis: "hidden" };
  }
  return edits;
}
