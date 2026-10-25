// Lone pairs (unshared pairs, non-bonding electrons) of the drawing: how many each atom has, where they are written
// around it, and how a pair is drawn (two dots, or a bar). Pure functions (no React), shared by the canvas and the
// picture for the page, unit-tested.
//
// An atom's count is the one the teacher set (`AtomNode.pairs`), else the one its valence leaves: the electrons it has,
// minus its charge, minus the ones its bonds use (an atom is taken as complete: a bare oxygen counts its two hydrogens).
//
// Where a pair goes is automatic (the free space between the bonds) unless the teacher put it by hand: `AtomNode.pairDirs`
// holds the directions of those. A pair put by hand is one of the atom's pairs, not an extra one (water's oxygen has two,
// however many of them are placed), and the others spread over what is left. The direction is relative to the atom, so
// a pair goes where its atom goes.
import { lonePairAngles } from "../../_molecule/render/lonePairs";
import { NON_COVALENT_BONDS } from "./bondGeometry";
import { hydrogenLabels } from "./hydrogenLabel";
import { PERIODIC_TABLE, tableCell } from "./periodicTable";
import type { AtomNode, LonePairMode, MoleculeGraph } from "./types";
import { bondOrder, effectiveValence } from "./valence";

/** The most pairs an atom is given by hand (a halide ion has four). */
export const MAX_PAIRS = 4;
/** How far from the atom the middle of a pair is, in drawing units. */
export const PAIR_DISTANCE = 19;
/** The least angle (degrees) between a pair put by hand and a bond, the hydrogens beside the atom, or another pair. */
export const PAIR_GAP = 30;
/** A click this close (degrees) to a pair is a click on that pair: it takes it away. */
export const PAIR_REACH = 22;
const DOT_SPREAD = 2.7;
const DOT_RADIUS = 1.9;
const BAR_HALF = 4.5;

const norm = (a: number) => ((a % 360) + 360) % 360;
/** The angle between two directions, 0 to 180. */
export const apart = (a: number, b: number) => {
  const d = Math.abs(norm(a) - norm(b));
  return Math.min(d, 360 - d);
};
const round1 = (a: number) => Math.round(a * 10) / 10;

/** The electrons an atom has in its outer shell: 0 for a transition metal, which has no pairs in a school drawing. */
export function valenceElectrons(element: string): number {
  const data = PERIODIC_TABLE[element];
  if (!data) return 0;
  if (data.atomicNumber === 2) return 2; // helium
  const { row, col } = tableCell(data.atomicNumber);
  if (row >= 9) return 0; // the f-block
  if (col <= 2) return col;
  if (col >= 13) return col - 10;
  return 0;
}

/** The pairs an atom is left with once its bonds are made: (electrons − charge − electrons used by bonds) ÷ 2. */
export function autoLonePairs(element: string, charge: number, bondSum: number): number {
  const ve = valenceElectrons(element);
  if (ve === 0) return 0;
  const complete = element === "H" && charge < 0 ? 0 : effectiveValence(element, charge);
  return Math.max(0, Math.floor((ve - charge - Math.max(bondSum, complete)) / 2 + 1e-9));
}

/** The sum of the bond orders of every atom (the bonds that use no valence count for nothing). */
function covalentSums(graph: MoleculeGraph): Map<string, number> {
  const sums = new Map<string, number>();
  for (const b of graph.bonds) {
    if (NON_COVALENT_BONDS.includes(b.type)) continue;
    const order = bondOrder(b.type);
    sums.set(b.sourceId, (sums.get(b.sourceId) ?? 0) + order);
    sums.set(b.targetId, (sums.get(b.targetId) ?? 0) + order);
  }
  return sums;
}

/** The lone pairs of every atom: the teacher's count, else the one its valence leaves (never fewer than the ones put by hand). */
export function lonePairCounts(graph: MoleculeGraph): Map<string, number> {
  const sums = covalentSums(graph);
  return new Map(graph.atoms.map((a) => [a.id, Math.max(a.pairs ?? autoLonePairs(a.element, a.charge, sums.get(a.id) ?? 0), a.pairDirs?.length ?? 0)]));
}

/** One lone pair to draw: whose, which one of them, the direction (degrees, screen angles, y down) it lies in, and whether the teacher put it there. */
export type PairMark = { atomId: string; index: number; angle: number; pinned: boolean };

/** The directions (degrees) an atom's bonds leave it in, and the side of the hydrogens a label writes beside it. */
function bondDirections(graph: MoleculeGraph, atom: AtomNode, byId: Map<string, AtomNode>, labels: ReturnType<typeof hydrogenLabels>): number[] {
  const taken: number[] = [];
  for (const b of graph.bonds) {
    const other = b.sourceId === atom.id ? byId.get(b.targetId) : b.targetId === atom.id ? byId.get(b.sourceId) : undefined;
    if (other) taken.push((Math.atan2(other.y - atom.y, other.x - atom.x) * 180) / Math.PI);
  }
  const label = labels.get(atom.id);
  if (label) taken.push(label.side === 1 ? 0 : 180); // (the hydrogens written beside the atom)
  taken.push(...(atom.dots ?? [])); // (the single electrons put by hand: electrons.ts)
  return taken;
}

/**
 * Where the lone pairs of the atoms are written: the ones the teacher put are where they put them, the others in the free
 * sectors between the bonds and those (the same rule as the Lewis representation), away from the hydrogens a label writes beside
 * the atom. Nothing unless the mode draws them.
 */
export function lonePairMarks(graph: MoleculeGraph, mode: LonePairMode = graph.lonePairs ?? "off"): PairMark[] {
  if (mode === "off") return [];
  const counts = lonePairCounts(graph);
  const labels = hydrogenLabels(graph);
  const byId = new Map(graph.atoms.map((a) => [a.id, a]));
  const marks: PairMark[] = [];
  for (const atom of graph.atoms) {
    const n = counts.get(atom.id) ?? 0;
    if (n <= 0) continue;
    const pins = (atom.pairDirs ?? []).slice(0, n);
    pins.forEach((angle, index) => marks.push({ atomId: atom.id, index, angle: norm(angle), pinned: true }));
    const taken = [...bondDirections(graph, atom, byId, labels), ...pins];
    lonePairAngles(taken, n - pins.length).forEach((angle, i) => marks.push({ atomId: atom.id, index: pins.length + i, angle, pinned: false }));
  }
  return marks;
}

/** How a pair is drawn, relative to the atom: two dots, or a bar across the direction. */
export type PairShape = { dots: { x: number; y: number; r: number }[] } | { bar: { x1: number; y1: number; x2: number; y2: number } };

export function pairShape(angle: number, mode: Exclude<LonePairMode, "off">): PairShape {
  const rad = (angle * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const cx = ux * PAIR_DISTANCE;
  const cy = uy * PAIR_DISTANCE;
  const tx = -uy; // along the pair, across the direction away from the atom
  const ty = ux;
  if (mode === "dots") {
    return {
      dots: [
        { x: cx + tx * DOT_SPREAD, y: cy + ty * DOT_SPREAD, r: DOT_RADIUS },
        { x: cx - tx * DOT_SPREAD, y: cy - ty * DOT_SPREAD, r: DOT_RADIUS },
      ],
    };
  }
  return { bar: { x1: cx + tx * BAR_HALF, y1: cy + ty * BAR_HALF, x2: cx - tx * BAR_HALF, y2: cy - ty * BAR_HALF } };
}

/** The pairs of an atom, for the student version: none when the teacher hid them or masked the atom. */
export const pairsShownToStudents = (atom: AtomNode) => !atom.pairsHidden && !atom.hidden;

// ---- putting pairs by hand ----

/**
 * The direction a pair put near `wanted` (degrees) goes in: `wanted` snapped to the grid of `step` degrees, or, when a bond (or
 * another pair) is in the way, the nearest direction on a 15° grid that is free. null when there is none.
 */
export function freePairAngle(blocked: readonly number[], wanted: number, step = 45): number | null {
  const free = (a: number) => blocked.every((b) => apart(a, b) >= PAIR_GAP - 1e-9);
  const snapped = norm(Math.round(wanted / step) * step);
  if (free(snapped)) return snapped;
  let best: number | null = null;
  let bestGap = Infinity;
  for (let a = 0; a < 360; a += 15) {
    const gap = apart(a, wanted);
    if (free(a) && gap < bestGap) [best, bestGap] = [a, gap];
  }
  return best;
}

/** The directions a pair of this atom cannot take: its bonds, the label's hydrogens, and the pairs put by hand (except `except`, one of them). */
export function blockedDirections(graph: MoleculeGraph, atom: AtomNode, except?: number): number[] {
  const byId = new Map(graph.atoms.map((a) => [a.id, a]));
  const pins = (atom.pairDirs ?? []).filter((_, i) => i !== except);
  return [...bondDirections(graph, atom, byId, hydrogenLabels(graph)), ...pins];
}

/** What a click beside an atom (in the direction `wanted`, degrees) does: puts a pair there, takes the pair there away, or nothing (no room). */
export type PairClick = { kind: "add"; angle: number } | { kind: "remove"; mark: PairMark } | null;

export function pairClick(graph: MoleculeGraph, atomId: string, wanted: number): PairClick {
  const atom = graph.atoms.find((a) => a.id === atomId);
  if (!atom) return null;
  const nearest = lonePairMarks(graph, "dots")
    .filter((m) => m.atomId === atomId)
    .map((mark) => ({ mark, gap: apart(mark.angle, wanted) }))
    .sort((a, b) => a.gap - b.gap)[0];
  if (nearest && nearest.gap <= PAIR_REACH) return { kind: "remove", mark: nearest.mark };
  if ((lonePairCounts(graph).get(atomId) ?? 0) >= MAX_PAIRS && (atom.pairDirs?.length ?? 0) >= MAX_PAIRS) return null;
  const angle = freePairAngle(blockedDirections(graph, atom), wanted);
  return angle === null ? null : { kind: "add", angle };
}

const withAtom = (graph: MoleculeGraph, atomId: string, change: (a: AtomNode) => AtomNode): MoleculeGraph => ({ ...graph, atoms: graph.atoms.map((a) => (a.id === atomId ? change(a) : a)) });
const turnedOn = (graph: MoleculeGraph): MoleculeGraph => (graph.lonePairs && graph.lonePairs !== "off" ? graph : { ...graph, lonePairs: "dots" });

/** Gives the atom `dirs` as the pairs put by hand (none: all of its pairs are placed automatically again), and `count` pairs in all. */
function setDirs(a: AtomNode, dirs: number[], count: number | undefined): AtomNode {
  const next: AtomNode = { ...a };
  if (dirs.length) next.pairDirs = dirs;
  else delete next.pairDirs;
  if (count === undefined) delete next.pairs;
  else next.pairs = count;
  return next;
}

/**
 * A click beside the atom, towards `wanted` (degrees): puts one of its pairs there (a pair too many only if all of its pairs are
 * already placed), or takes away the one that is there. The lone pairs get written if they were not.
 */
export function placePair(graph: MoleculeGraph, atomId: string, wanted: number): MoleculeGraph {
  const click = pairClick(graph, atomId, wanted);
  const atom = graph.atoms.find((a) => a.id === atomId);
  if (!click || !atom) return graph;
  if (click.kind === "remove") return removePair(graph, atomId, click.mark);
  const count = lonePairCounts(graph).get(atomId) ?? 0;
  const dirs = [...(atom.pairDirs ?? []), click.angle];
  const total = Math.max(count, dirs.length);
  return turnedOn(withAtom(graph, atomId, (a) => setDirs(a, dirs, total === count && a.pairs === undefined ? undefined : total)));
}

/** Takes one pair away from its atom: the one given (put by hand or not). */
export function removePair(graph: MoleculeGraph, atomId: string, mark: PairMark): MoleculeGraph {
  const count = lonePairCounts(graph).get(atomId) ?? 0;
  if (count <= 0) return graph;
  return withAtom(graph, atomId, (a) => setDirs(a, mark.pinned ? (a.pairDirs ?? []).filter((_, i) => i !== mark.index) : (a.pairDirs ?? []), count - 1));
}

/** Takes away the pair of the atom that lies nearest to the direction `wanted` (Shift+click): whichever it is. */
export function removePairNear(graph: MoleculeGraph, atomId: string, wanted: number): MoleculeGraph {
  const nearest = lonePairMarks(graph, "dots")
    .filter((m) => m.atomId === atomId)
    .sort((a, b) => apart(a.angle, wanted) - apart(b.angle, wanted))[0];
  return nearest ? removePair(graph, atomId, nearest) : graph;
}

/** Puts every pair of the atom where it is drawn now, so that moving one of them leaves the others where they are. */
export function pinPairs(graph: MoleculeGraph, atomId: string): MoleculeGraph {
  const marks = lonePairMarks(graph, "dots").filter((m) => m.atomId === atomId);
  const atom = graph.atoms.find((a) => a.id === atomId);
  if (!atom || !marks.length || marks.every((m) => m.pinned)) return graph;
  return withAtom(graph, atomId, (a) => setDirs(a, marks.map((m) => round1(m.angle)), a.pairs));
}

/** Turns one of the pairs put by hand (the `index`th) towards `wanted` (degrees, on a 15° grid); a direction that is not free is not taken. */
export function movePair(graph: MoleculeGraph, atomId: string, index: number, wanted: number): MoleculeGraph {
  const atom = graph.atoms.find((a) => a.id === atomId);
  const dirs = atom?.pairDirs;
  if (!atom || !dirs || index < 0 || index >= dirs.length) return graph;
  const angle = freePairAngle(blockedDirections(graph, atom, index), wanted, 15);
  if (angle === null || apart(angle, dirs[index]) < 0.05) return graph;
  return withAtom(graph, atomId, (a) => ({ ...a, pairDirs: dirs.map((d, i) => (i === index ? angle : d)) }));
}
