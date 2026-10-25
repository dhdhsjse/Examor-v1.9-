// Edit operations on a molecule block. All of them are pure: they return a new block and never change the
// one they get. Two kinds:
//   - visibility edits (hide / blank / label / position / lone pairs): only `edits` changes, the graph stays,
//     so the answer key can always be rebuilt;
//   - structural edits (remove, replace element, bond order, add H / bond): the graph changes. They never
//     refuse: unusual valences come back as warnings (the teacher's intent wins).
import { allowedValences, bondOrderSum, neighbors, withLonePairs } from "../chem";
import type { MolAtom, MolBond, MolGraph, MoleculeBlockData, MoleculeEdits, Visibility } from "../model";
import { lonePairAngles } from "../render/lonePairs";

export interface Warning {
  atomId: string;
  kind: "valence";
  used: number;
  allowed: number[];
}

// Atoms whose number of bonds is not usual for their element (reported, never blocked).
export function graphWarnings(g: MolGraph): Warning[] {
  const out: Warning[] = [];
  for (const a of g.atoms) {
    const allowed = allowedValences(a.element, a.charge);
    if (!allowed.length) continue;
    const used = bondOrderSum(g, a.id);
    if (!allowed.includes(used)) out.push({ atomId: a.id, kind: "valence", used, allowed });
  }
  return out;
}

const withEdits = (b: MoleculeBlockData, edits: MoleculeEdits): MoleculeBlockData => ({ ...b, edits });
const withGraph = (b: MoleculeBlockData, graph: MolGraph, edits: MoleculeEdits = b.edits): MoleculeBlockData => ({ ...b, graph: withLonePairs(graph), edits });

// ---------------------------------------------------------------- visibility edits

export function setAtomVis(b: MoleculeBlockData, ids: string[], vis: Visibility): MoleculeBlockData {
  const atoms = { ...b.edits.atoms };
  for (const id of ids) {
    const { vis: _old, ...rest } = atoms[id] ?? {};
    void _old;
    if (vis === "shown") {
      if (Object.keys(rest).length) atoms[id] = rest;
      else delete atoms[id];
    } else atoms[id] = { ...rest, vis };
  }
  return withEdits(b, { ...b.edits, atoms });
}

export function setBondVis(b: MoleculeBlockData, ids: string[], vis: Visibility): MoleculeBlockData {
  const bonds = { ...b.edits.bonds };
  for (const id of ids) {
    const { vis: _old, ...rest } = bonds[id] ?? {};
    void _old;
    if (vis === "shown") {
      if (Object.keys(rest).length) bonds[id] = rest;
      else delete bonds[id];
    } else bonds[id] = { ...rest, vis };
  }
  return withEdits(b, { ...b.edits, bonds });
}

// Text shown instead of the element ("?" or "" for an empty box); undefined = back to the element.
export function setLabel(b: MoleculeBlockData, ids: string[], label: string | undefined): MoleculeBlockData {
  const atoms = { ...b.edits.atoms };
  for (const id of ids) {
    const { label: _old, ...rest } = atoms[id] ?? {};
    void _old;
    if (label === undefined) {
      if (Object.keys(rest).length) atoms[id] = rest;
      else delete atoms[id];
    } else atoms[id] = { ...rest, label };
  }
  return withEdits(b, { ...b.edits, atoms });
}

// Display-only bond order (a single line where chemistry says double); undefined = the real order.
export function setDisplayOrder(b: MoleculeBlockData, ids: string[], order: 1 | 2 | 3 | undefined): MoleculeBlockData {
  const bonds = { ...b.edits.bonds };
  for (const id of ids) {
    const { orderOverride: _old, ...rest } = bonds[id] ?? {};
    void _old;
    if (order === undefined) {
      if (Object.keys(rest).length) bonds[id] = rest;
      else delete bonds[id];
    } else bonds[id] = { ...rest, orderOverride: order };
  }
  return withEdits(b, { ...b.edits, bonds });
}

export function moveAtoms(b: MoleculeBlockData, to: Record<string, { x: number; y: number }>): MoleculeBlockData {
  const atoms = { ...b.edits.atoms };
  for (const [id, p] of Object.entries(to)) atoms[id] = { ...atoms[id], x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 };
  return withEdits(b, { ...b.edits, atoms });
}

// Lone pair ids are "atomId:index". `visible` false hides them in the student version.
export function setLonePairsVisible(b: MoleculeBlockData, pairs: string[], visible: boolean): MoleculeBlockData {
  const lonePairs = { ...b.edits.lonePairs };
  for (const key of pairs) {
    const at = key.lastIndexOf(":");
    const atomId = key.slice(0, at);
    const index = Number(key.slice(at + 1));
    const count = b.graph.atoms.find((a) => a.id === atomId)?.lonePairs ?? 0;
    const row = Array.from({ length: count }, (_, i) => lonePairs[atomId]?.[i] !== false);
    row[index] = visible;
    if (row.every(Boolean)) delete lonePairs[atomId];
    else lonePairs[atomId] = row;
  }
  return withEdits(b, { ...b.edits, lonePairs });
}

export const setHideAllHydrogens = (b: MoleculeBlockData, on: boolean): MoleculeBlockData => withEdits(b, { ...b.edits, hideAllHydrogens: on || undefined });

// ---------------------------------------------------------------- structural edits

// Ids are never reused: the graph keeps counters, and every removal records them before anything goes.
const nextAtomNumber = (g: MolGraph) => Math.max(g.nextAtom ?? 0, 1, ...g.atoms.map((a) => (Number(a.id.slice(1)) || 0) + 1));
const nextBondNumber = (g: MolGraph) => Math.max(g.nextBond ?? 0, 1, ...g.bonds.map((x) => (Number(x.id.slice(1)) || 0) + 1));

function newAtomId(g: MolGraph): [string, MolGraph] {
  const n = nextAtomNumber(g);
  return [`a${n}`, { ...g, nextAtom: n + 1 }];
}
function newBondId(g: MolGraph): [string, MolGraph] {
  const n = nextBondNumber(g);
  return [`b${n}`, { ...g, nextBond: n + 1 }];
}

const hydrogensOf = (g: MolGraph, id: string) => neighbors(g, id).filter((n) => n.atom.element === "H" && neighbors(g, n.atom.id).length === 1);

// A free spot for a new hydrogen: in the biggest gap between the atom's bonds, one bond length away.
function hydrogenSpot(g: MolGraph, host: MolAtom): { x: number; y: number } {
  const angles = neighbors(g, host.id).map((n) => (Math.atan2(n.atom.y - host.y, n.atom.x - host.x) * 180) / Math.PI);
  const [deg] = lonePairAngles(angles, 1);
  const rad = (deg * Math.PI) / 180;
  return { x: Math.round((host.x + Math.cos(rad)) * 1000) / 1000, y: Math.round((host.y + Math.sin(rad)) * 1000) / 1000 };
}

function addHydrogenTo(g: MolGraph, hostId: string): MolGraph {
  const host = g.atoms.find((a) => a.id === hostId);
  if (!host) return g;
  const [aid, g1] = newAtomId(g);
  const [bid, g2] = newBondId(g1);
  const spot = hydrogenSpot(g2, host);
  return { ...g2, atoms: [...g2.atoms, { id: aid, element: "H", charge: 0, x: spot.x, y: spot.y, lonePairs: 0 }], bonds: [...g2.bonds, { id: bid, a: hostId, b: aid, order: 1 }] };
}

function dropAtoms(g: MolGraph, ids: Set<string>): MolGraph {
  return { ...g, nextAtom: nextAtomNumber(g), nextBond: nextBondNumber(g), atoms: g.atoms.filter((a) => !ids.has(a.id)), bonds: g.bonds.filter((x) => !ids.has(x.a) && !ids.has(x.b)) };
}

// The number of hydrogens an atom needs to reach the smallest usual valence that fits its other bonds
// (C with one C–C bond -> 3 H; N with two bonds -> 1 H). Adds or removes hydrogens; no change for an
// element without usual valences or when the atom is already over its largest one.
export function rebalanceHydrogens(g: MolGraph, ids: string[]): MolGraph {
  let out = g;
  for (const id of ids) {
    const atom = out.atoms.find((a) => a.id === id);
    if (!atom || atom.element === "H") continue;
    const allowed = allowedValences(atom.element, atom.charge);
    if (!allowed.length) continue;
    const hs = hydrogensOf(out, id);
    const heavySum = bondOrderSum(out, id) - hs.length; // each H is a single bond
    const target = allowed.slice().sort((p, q) => p - q).find((v) => v >= heavySum);
    if (target === undefined) continue;
    const want = target - heavySum;
    if (hs.length > want) out = dropAtoms(out, new Set(hs.slice(want).map((h) => h.atom.id)));
    for (let i = hydrogensOf(out, id).length; i < want; i++) out = addHydrogenTo(out, id);
  }
  return out;
}

function cleanEdits(edits: MoleculeEdits, g: MolGraph, touched: string[] = []): MoleculeEdits {
  const atomIds = new Set(g.atoms.map((a) => a.id));
  const bondIds = new Set(g.bonds.map((x) => x.id));
  const pick = <T,>(rec: Record<string, T>, keep: Set<string>) => Object.fromEntries(Object.entries(rec).filter(([k]) => keep.has(k)));
  const lone = pick(edits.lonePairs, atomIds);
  for (const id of touched) delete lone[id]; // their lone pair count may have changed
  return { ...edits, atoms: pick(edits.atoms, atomIds), bonds: pick(edits.bonds, bondIds), lonePairs: lone };
}

// Removes atoms together with the hydrogens that hang only on them.
export function removeAtoms(b: MoleculeBlockData, ids: string[]): MoleculeBlockData {
  const gone = new Set(ids);
  for (const id of ids) for (const h of hydrogensOf(b.graph, id)) gone.add(h.atom.id);
  const g = dropAtoms(b.graph, gone);
  const hosts = b.graph.atoms.filter((a) => !gone.has(a.id) && neighbors(b.graph, a.id).some((n) => gone.has(n.atom.id))).map((a) => a.id);
  return withGraph(b, g, cleanEdits(b.edits, g, hosts));
}

export function removeBonds(b: MoleculeBlockData, ids: string[]): MoleculeBlockData {
  const gone = new Set(ids);
  const hosts = b.graph.bonds.filter((x) => gone.has(x.id)).flatMap((x) => [x.a, x.b]);
  const g = { ...b.graph, nextBond: nextBondNumber(b.graph), nextAtom: nextAtomNumber(b.graph), bonds: b.graph.bonds.filter((x) => !gone.has(x.id)) };
  return withGraph(b, g, cleanEdits(b.edits, g, hosts));
}

// Changes the element and gives the atom the hydrogens its new valence needs. (Not to or from hydrogen.)
export function replaceElement(b: MoleculeBlockData, id: string, element: string): MoleculeBlockData {
  const atom = b.graph.atoms.find((a) => a.id === id);
  if (!atom || atom.element === "H" || element === "H" || atom.element === element) return b;
  const g = { ...b.graph, atoms: b.graph.atoms.map((a) => (a.id === id ? { ...a, element } : a)) };
  const balanced = rebalanceHydrogens(g, [id]);
  return withGraph(b, balanced, cleanEdits(b.edits, balanced, [id]));
}

// A real change of the bond order; the hydrogens of both atoms follow (C–C -> C=C loses one H on each).
export function setBondOrder(b: MoleculeBlockData, bondId: string, order: 1 | 2 | 3): MoleculeBlockData {
  const bond = b.graph.bonds.find((x) => x.id === bondId);
  if (!bond || bond.order === order) return b;
  const g = { ...b.graph, bonds: b.graph.bonds.map((x) => (x.id === bondId ? { ...x, order } : x)) };
  const balanced = rebalanceHydrogens(g, [bond.a, bond.b]);
  return withGraph(b, balanced, cleanEdits(b.edits, balanced, [bond.a, bond.b]));
}

export function addHydrogen(b: MoleculeBlockData, hostId: string): MoleculeBlockData {
  const g = addHydrogenTo(b.graph, hostId);
  return withGraph(b, g, cleanEdits(b.edits, g, [hostId]));
}

// A bond between two atoms that are not bonded yet (minimal v1 addition; free drawing comes later).
export function addBond(b: MoleculeBlockData, a: string, c: string, order: 1 | 2 | 3 = 1): MoleculeBlockData {
  if (a === c || b.graph.bonds.some((x) => (x.a === a && x.b === c) || (x.a === c && x.b === a))) return b;
  const [id, g1] = newBondId(b.graph);
  const bond: MolBond = { id, a, b: c, order };
  const g = { ...g1, bonds: [...g1.bonds, bond] };
  return withGraph(b, g, cleanEdits(b.edits, g, [a, c]));
}
