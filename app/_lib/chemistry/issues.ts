// What may be wrong in a sketch. The Studio never refuses a drawing: it only marks the atoms involved with a small "!"
// and says why when asked. Pure functions (no React), unit-tested.
import { PERIODIC_TABLE } from "./periodicTable";
import { lonePairCounts, valenceElectrons } from "./lonePairs";
import { bondOrder, effectiveValence, overValenced } from "./valence";
import { NON_COVALENT_BONDS } from "./bondGeometry";
import type { MoleculeGraph } from "./types";

/** Two atoms closer than this are on top of each other. */
export const OVERLAP_DISTANCE = 8;

/** What is wrong, with the numbers the message needs (the words are in the interface: see strings.ts). */
export type Issue =
  | { kind: "valence"; atomId: string; element: string; bonds: number; usual: number }
  | { kind: "octet"; atomId: string; element: string; electrons: number }
  | { kind: "overlap"; atomId: string; other: string };

/** Everything that looks wrong in the drawing, atom by atom. A drawing with issues is still a drawing. */
export function drawingIssues(graph: MoleculeGraph): Issue[] {
  const issues: Issue[] = [];
  const sums = new Map<string, number>();
  for (const b of graph.bonds) {
    if (NON_COVALENT_BONDS.includes(b.type)) continue;
    sums.set(b.sourceId, (sums.get(b.sourceId) ?? 0) + bondOrder(b.type));
    sums.set(b.targetId, (sums.get(b.targetId) ?? 0) + bondOrder(b.type));
  }
  const over = overValenced(graph);
  const pairs = lonePairCounts(graph);
  for (const a of graph.atoms) {
    if (over.has(a.id)) issues.push({ kind: "valence", atomId: a.id, element: a.element, bonds: sums.get(a.id) ?? 0, usual: effectiveValence(a.element, a.charge) });
    // more than the electrons its shell holds: eight (two for hydrogen and helium); the elements below the second period can hold more
    const data = PERIODIC_TABLE[a.element];
    const period2 = !!data && data.atomicNumber <= 10;
    const electrons = 2 * (pairs.get(a.id) ?? 0) + 2 * (sums.get(a.id) ?? 0) + (a.dots?.length ?? 0);
    if (period2 && valenceElectrons(a.element) > 0 && electrons > (data.atomicNumber <= 2 ? 2 : 8) && !over.has(a.id)) issues.push({ kind: "octet", atomId: a.id, element: a.element, electrons });
  }
  for (let i = 0; i < graph.atoms.length; i++) {
    for (let j = i + 1; j < graph.atoms.length; j++) {
      const p = graph.atoms[i];
      const q = graph.atoms[j];
      if (Math.hypot(p.x - q.x, p.y - q.y) < OVERLAP_DISTANCE) issues.push({ kind: "overlap", atomId: p.id, other: q.id });
    }
  }
  return issues;
}

/** The atoms that have at least one issue (the overlap marks both atoms). */
export function issueAtoms(issues: readonly Issue[]): Set<string> {
  const out = new Set<string>();
  for (const i of issues) {
    out.add(i.atomId);
    if (i.kind === "overlap") out.add(i.other);
  }
  return out;
}
