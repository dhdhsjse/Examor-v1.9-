// What is selected in the drawing Studio, and what can be done with a selection. Pure functions (no React):
// each returns a new graph or selection and never changes its argument; unit-tested.
import { newId } from "../id";
import { removeAtomAndHydrogens } from "./graphOps";
import { MAX_PAIRS, lonePairCounts } from "./lonePairs";
import { PERIODIC_TABLE } from "./periodicTable";
import type { AtomNode, BondEdge, BondType, CanvasAnnotation, MoleculeGraph } from "./types";

/** Atoms, bonds and texts / arrows, by id. A selection may hold any mix of them. */
export type Selection = { atoms: string[]; bonds: string[]; notes: string[] };
export type SelectionKind = keyof Selection;

export const EMPTY_SELECTION: Selection = { atoms: [], bonds: [], notes: [] };
export const isEmpty = (s: Selection) => s.atoms.length + s.bonds.length + s.notes.length === 0;
export const countOf = (s: Selection) => s.atoms.length + s.bonds.length + s.notes.length;
export const has = (s: Selection, kind: SelectionKind, id: string) => s[kind].includes(id);

export const only = (kind: SelectionKind, id: string): Selection => ({ ...EMPTY_SELECTION, [kind]: [id] });

/** Adds the thing if it is not selected, removes it if it is (Shift + click). */
export function toggle(s: Selection, kind: SelectionKind, id: string): Selection {
  return { ...s, [kind]: has(s, kind, id) ? s[kind].filter((x) => x !== id) : [...s[kind], id] };
}

export function union(a: Selection, b: Selection): Selection {
  const merge = (x: string[], y: string[]) => [...new Set([...x, ...y])];
  return { atoms: merge(a.atoms, b.atoms), bonds: merge(a.bonds, b.bonds), notes: merge(a.notes, b.notes) };
}

/** The selection without what is no longer in the drawing (deleted, or a hydrogen that is no longer needed). */
export function prune(s: Selection, graph: MoleculeGraph): Selection {
  const atoms = new Set(graph.atoms.map((a) => a.id));
  const bonds = new Set(graph.bonds.map((b) => b.id));
  const notes = new Set(graph.annotations.map((n) => n.id));
  const next = { atoms: s.atoms.filter((id) => atoms.has(id)), bonds: s.bonds.filter((id) => bonds.has(id)), notes: s.notes.filter((id) => notes.has(id)) };
  const same = next.atoms.length === s.atoms.length && next.bonds.length === s.bonds.length && next.notes.length === s.notes.length;
  return same ? s : next;
}

export const selectAll = (graph: MoleculeGraph): Selection => ({ atoms: graph.atoms.map((a) => a.id), bonds: graph.bonds.map((b) => b.id), notes: graph.annotations.map((n) => n.id) });

export type Rect = { x0: number; y0: number; x1: number; y1: number };

/** What a rubber band drawn from one corner to the other takes: the atoms and texts inside, and the bonds between two such atoms. */
export function selectInRect(graph: MoleculeGraph, rect: Rect): Selection {
  const [x0, x1] = [Math.min(rect.x0, rect.x1), Math.max(rect.x0, rect.x1)];
  const [y0, y1] = [Math.min(rect.y0, rect.y1), Math.max(rect.y0, rect.y1)];
  const inside = (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const atoms = graph.atoms.filter((a) => inside(a.x, a.y)).map((a) => a.id);
  const taken = new Set(atoms);
  return {
    atoms,
    bonds: graph.bonds.filter((b) => taken.has(b.sourceId) && taken.has(b.targetId)).map((b) => b.id),
    notes: graph.annotations.filter((n) => inside(n.x, n.y)).map((n) => n.id),
  };
}

// ---- what can be done with a selection ----

/** Deletes what is selected: the atoms with their bonds and the hydrogens hanging on them alone, the bonds, the texts. */
export function deleteSelection(graph: MoleculeGraph, s: Selection): MoleculeGraph {
  let next = graph;
  if (s.bonds.length) {
    const gone = new Set(s.bonds);
    next = { ...next, bonds: next.bonds.filter((b) => !gone.has(b.id)) };
  }
  for (const id of s.atoms) next = removeAtomAndHydrogens(next, id); // (an id already gone with another atom: no change)
  if (s.notes.length) {
    const gone = new Set(s.notes);
    next = { ...next, annotations: next.annotations.filter((n) => !gone.has(n.id)) };
  }
  return next;
}

/**
 * Changes the element of atoms. An automatic hydrogen that is changed becomes the teacher's (so replacing a hydrogen
 * by a chlorine works: it is no longer remade as a hydrogen). An unknown symbol changes nothing.
 */
export function setElement(graph: MoleculeGraph, ids: readonly string[], element: string): MoleculeGraph {
  if (!PERIODIC_TABLE[element] || !ids.length) return graph;
  const set = new Set(ids);
  let changed = false;
  const atoms = graph.atoms.map((a) => {
    if (!set.has(a.id) || a.element === element) return a;
    changed = true;
    return { ...a, element, auto: false };
  });
  return changed ? { ...graph, atoms } : graph;
}

/** Gives atoms a number of lone pairs, or (undefined) the number their valence leaves. */
export function setPairs(graph: MoleculeGraph, ids: readonly string[], pairs: number | undefined): MoleculeGraph {
  const set = new Set(ids);
  const value = pairs === undefined ? undefined : Math.max(0, Math.min(MAX_PAIRS, Math.round(pairs)));
  let changed = false;
  const atoms = graph.atoms.map((a) => {
    const dirs = value === undefined ? undefined : a.pairDirs?.slice(0, value); // (automatic: the ones put by hand go too)
    if (!set.has(a.id) || (a.pairs === value && a.pairDirs?.length === dirs?.length && (value !== undefined || !a.pairDirs))) return a;
    changed = true;
    const next: AtomNode = { ...a };
    if (value === undefined) delete next.pairs;
    else next.pairs = value;
    if (dirs?.length) next.pairDirs = dirs;
    else delete next.pairDirs;
    return next;
  });
  return changed ? { ...graph, atoms } : graph;
}

/** One lone pair more (or fewer) on each atom, from the count it has now. The pairs are shown from then on. */
export function stepPairs(graph: MoleculeGraph, ids: readonly string[], delta: number): MoleculeGraph {
  const counts = lonePairCounts(graph);
  const set = new Set(ids);
  let changed = false;
  const atoms = graph.atoms.map((a) => {
    if (!set.has(a.id)) return a;
    const value = Math.max(0, Math.min(MAX_PAIRS, (counts.get(a.id) ?? 0) + delta));
    const dirs = a.pairDirs?.slice(0, value); // (one fewer: the last one put by hand goes first if all are)
    if (a.pairs === value && a.pairDirs?.length === dirs?.length) return a;
    changed = true;
    const next: AtomNode = { ...a, pairs: value };
    if (dirs?.length) next.pairDirs = dirs;
    else delete next.pairDirs;
    return next;
  });
  if (!changed) return graph;
  return { ...graph, atoms, lonePairs: graph.lonePairs && graph.lonePairs !== "off" ? graph.lonePairs : "dots" };
}

/** The student version does not draw the lone pairs of these atoms (the students complete them). */
export function setPairsHidden(graph: MoleculeGraph, ids: readonly string[], hidden: boolean): MoleculeGraph {
  const set = new Set(ids);
  let changed = false;
  const atoms = graph.atoms.map((a) => {
    if (!set.has(a.id) || !!a.pairsHidden === hidden) return a;
    changed = true;
    const next: AtomNode = { ...a };
    if (hidden) next.pairsHidden = true;
    else delete next.pairsHidden;
    return next;
  });
  return changed ? { ...graph, atoms } : graph;
}

/** The atoms and bonds a change is made to (the ids of a Selection). */
export type Targets = { atoms: readonly string[]; bonds: readonly string[] };

/** Masks or unmasks atoms and bonds: the student version hides them (see masking.ts). Unmasking forgets the replacement. */
export function setMasked(graph: MoleculeGraph, targets: Targets, hidden: boolean): MoleculeGraph {
  const atomIds = new Set(targets.atoms);
  const bondIds = new Set(targets.bonds);
  let changed = false;
  const atoms = graph.atoms.map((a) => {
    if (!atomIds.has(a.id) || a.hidden === hidden) return a;
    changed = true;
    const next = { ...a, hidden };
    delete next.mask; // (unmasking forgets what was written in its place)
    return next;
  });
  const bonds = graph.bonds.map((b) => {
    if (!bondIds.has(b.id) || b.hidden === hidden) return b;
    changed = true;
    const next = { ...b, hidden };
    delete next.mask; // (unmasking forgets what was written in its place)
    return next;
  });
  return changed ? { ...graph, atoms, bonds } : graph;
}

/** The longest replacement text of a masked atom. */
export const MAX_MASK = 12;

/** What the student version writes for masked atoms ("" = an empty box), or draws for masked bonds ("" = nothing; undefined = a dashed line). */
export function setMaskText(graph: MoleculeGraph, targets: Targets, text: string | undefined): MoleculeGraph {
  const value = text === undefined ? undefined : text.slice(0, MAX_MASK);
  const atomIds = new Set(targets.atoms);
  const bondIds = new Set(targets.bonds);
  let changed = false;
  const atoms = graph.atoms.map((a) => {
    if (!atomIds.has(a.id) || !a.hidden || a.mask === value) return a;
    changed = true;
    return { ...a, mask: value };
  });
  const bonds = graph.bonds.map((b) => {
    if (!bondIds.has(b.id) || !b.hidden || b.mask === value) return b;
    changed = true;
    return { ...b, mask: value };
  });
  return changed ? { ...graph, atoms, bonds } : graph;
}

export const MAX_CHARGE = 4;

/** Gives atoms a charge, between −4 and +4. */
export function setCharge(graph: MoleculeGraph, ids: readonly string[], charge: number): MoleculeGraph {
  const value = Math.max(-MAX_CHARGE, Math.min(MAX_CHARGE, Math.round(charge)));
  const set = new Set(ids);
  let changed = false;
  const atoms = graph.atoms.map((a) => {
    if (!set.has(a.id) || a.charge === value) return a;
    changed = true;
    return { ...a, charge: value };
  });
  return changed ? { ...graph, atoms } : graph;
}

export function setBondTypes(graph: MoleculeGraph, ids: readonly string[], type: BondType): MoleculeGraph {
  const set = new Set(ids);
  let changed = false;
  const bonds = graph.bonds.map((b) => {
    if (!set.has(b.id) || b.type === type) return b;
    changed = true;
    return { ...b, type };
  });
  return changed ? { ...graph, bonds } : graph;
}

/** Turns bonds round (the narrow end of a wedge is at the first atom). */
export function reverseBonds(graph: MoleculeGraph, ids: readonly string[]): MoleculeGraph {
  const set = new Set(ids);
  if (!graph.bonds.some((b) => set.has(b.id))) return graph;
  return { ...graph, bonds: graph.bonds.map((b) => (set.has(b.id) ? { ...b, sourceId: b.targetId, targetId: b.sourceId } : b)) };
}

/** Moves atoms and texts together by (dx, dy); the bonds follow. */
export function translateGroup(graph: MoleculeGraph, atomIds: ReadonlySet<string>, noteIds: ReadonlySet<string>, dx: number, dy: number): MoleculeGraph {
  if ((!atomIds.size && !noteIds.size) || (dx === 0 && dy === 0)) return graph;
  return {
    ...graph,
    atoms: atomIds.size ? graph.atoms.map((a) => (atomIds.has(a.id) ? { ...a, x: a.x + dx, y: a.y + dy } : a)) : graph.atoms,
    annotations: noteIds.size ? graph.annotations.map((n) => (noteIds.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)) : graph.annotations,
  };
}

// ---- copy and paste ----

export type Clipboard = { atoms: AtomNode[]; bonds: BondEdge[]; annotations: CanvasAnnotation[] };

/**
 * What is selected, ready to paste: the atoms (not the automatic hydrogens: they are remade), the bonds between
 * two copied atoms, the texts and arrows. Null when nothing can be copied.
 */
export function copySelection(graph: MoleculeGraph, s: Selection): Clipboard | null {
  const atoms = graph.atoms.filter((a) => s.atoms.includes(a.id) && !(a.element === "H" && a.auto));
  const taken = new Set(atoms.map((a) => a.id));
  const bonds = graph.bonds.filter((b) => taken.has(b.sourceId) && taken.has(b.targetId));
  const annotations = graph.annotations.filter((n) => s.notes.includes(n.id));
  if (!atoms.length && !annotations.length) return null;
  return structuredClone({ atoms, bonds, annotations });
}

/** Adds a copy of the clipboard, moved by (dx, dy), with new ids. Returns the graph and what was added (to select it). */
export function pasteClipboard(graph: MoleculeGraph, clip: Clipboard, dx: number, dy: number): { graph: MoleculeGraph; selection: Selection } {
  const ids = new Map(clip.atoms.map((a) => [a.id, newId()]));
  const atoms = clip.atoms.map((a) => ({ ...a, id: ids.get(a.id)!, x: a.x + dx, y: a.y + dy }));
  const bonds = clip.bonds.map((b) => ({ ...b, id: newId(), sourceId: ids.get(b.sourceId)!, targetId: ids.get(b.targetId)! }));
  const annotations = clip.annotations.map((n) => ({ ...n, id: newId(), x: n.x + dx, y: n.y + dy }));
  return {
    graph: { ...graph, atoms: [...graph.atoms, ...atoms], bonds: [...graph.bonds, ...bonds], annotations: [...graph.annotations, ...annotations] },
    selection: { atoms: atoms.map((a) => a.id), bonds: bonds.map((b) => b.id), notes: annotations.map((n) => n.id) },
  };
}
