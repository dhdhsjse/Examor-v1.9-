// Single electrons (one dot: a radical's unpaired electron, or a Lewis drawing that is written electron by electron),
// put by hand beside an atom. They are not lone pairs: they do not change the atom's pair count and are written whatever
// the lone pair mode is. The direction is relative to the atom (`AtomNode.dots`, degrees), so a dot goes where its atom goes.
// Pairs and dots keep out of each other's way (lonePairs.ts). Pure functions (no React), unit-tested.
import { PAIR_DISTANCE, PAIR_REACH, apart, blockedDirections, freePairAngle } from "./lonePairs";
import type { AtomNode, MoleculeGraph } from "./types";

/** The most single electrons an atom is given by hand. */
export const MAX_ELECTRONS = 4;
export const ELECTRON_RADIUS = 2.2;

/** One single electron to draw: whose, which one of them, and the direction (degrees, screen angles). */
export type ElectronMark = { atomId: string; index: number; angle: number };

export function electronMarks(graph: MoleculeGraph): ElectronMark[] {
  return graph.atoms.flatMap((a) => (a.dots ?? []).map((angle, index) => ({ atomId: a.id, index, angle })));
}

/** Where a single electron is drawn, relative to its atom. */
export function electronPosition(angle: number): { x: number; y: number; r: number } {
  const rad = (angle * Math.PI) / 180;
  return { x: Math.cos(rad) * PAIR_DISTANCE, y: Math.sin(rad) * PAIR_DISTANCE, r: ELECTRON_RADIUS };
}

/** What a click beside an atom (towards `wanted`, degrees) does with the electron tool: puts a dot there, takes the dot there away, or nothing (no room). */
export type ElectronClick = { kind: "add"; angle: number } | { kind: "remove"; index: number } | null;

export function electronClick(graph: MoleculeGraph, atomId: string, wanted: number): ElectronClick {
  const atom = graph.atoms.find((a) => a.id === atomId);
  if (!atom) return null;
  const nearest = (atom.dots ?? []).map((angle, index) => ({ index, gap: apart(angle, wanted) })).sort((a, b) => a.gap - b.gap)[0];
  if (nearest && nearest.gap <= PAIR_REACH) return { kind: "remove", index: nearest.index };
  if ((atom.dots?.length ?? 0) >= MAX_ELECTRONS) return null;
  const angle = freePairAngle(blockedDirections(graph, atom), wanted);
  return angle === null ? null : { kind: "add", angle };
}

const withDots = (graph: MoleculeGraph, atomId: string, dots: number[]): MoleculeGraph => ({
  ...graph,
  atoms: graph.atoms.map((a) => {
    if (a.id !== atomId) return a;
    const next: AtomNode = { ...a };
    if (dots.length) next.dots = dots;
    else delete next.dots;
    return next;
  }),
});

/** A click beside the atom: puts a single electron towards `wanted`, or takes away the one that is there. */
export function placeElectron(graph: MoleculeGraph, atomId: string, wanted: number): MoleculeGraph {
  const click = electronClick(graph, atomId, wanted);
  const atom = graph.atoms.find((a) => a.id === atomId);
  if (!click || !atom) return graph;
  return click.kind === "add" ? withDots(graph, atomId, [...(atom.dots ?? []), click.angle]) : removeElectron(graph, atomId, click.index);
}

export function removeElectron(graph: MoleculeGraph, atomId: string, index: number): MoleculeGraph {
  const atom = graph.atoms.find((a) => a.id === atomId);
  if (!atom?.dots || index < 0 || index >= atom.dots.length) return graph;
  return withDots(graph, atomId, atom.dots.filter((_, i) => i !== index));
}

/** Takes away the single electron of the atom nearest to the direction `wanted` (Shift+click). */
export function removeElectronNear(graph: MoleculeGraph, atomId: string, wanted: number): MoleculeGraph {
  const dots = graph.atoms.find((a) => a.id === atomId)?.dots ?? [];
  if (!dots.length) return graph;
  const index = dots.map((angle, i) => ({ i, gap: apart(angle, wanted) })).sort((a, b) => a.gap - b.gap)[0].i;
  return removeElectron(graph, atomId, index);
}
