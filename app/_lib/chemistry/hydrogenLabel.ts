// The hydrogens of the "labels" mode, written next to the atom instead of drawn as atoms: CH3, OH, H3C.
// Pure functions (no React), shared by the canvas and the SVG of the exam page so both place them alike.
import { hydrogenModeOf, implicitHydrogens } from "./valence";
import type { MoleculeGraph } from "./types";

export const LABEL_H_SIZE = 20; // the "H" is as big as the symbol
export const LABEL_SUB_SIZE = 13;
/** How far from the atom the label reaches, for the box around a drawing. */
export const LABEL_REACH = 36;

export type HydrogenLabel = { count: number; /** 1: written to the right of the symbol, -1: to the left. */ side: 1 | -1 };
/** One piece of a label: its text, the middle of it relative to the atom, and its size. */
export type LabelPart = { text: string; x: number; y: number; size: number };

/** The labels of a drawing, by atom id: empty unless it is in "labels" mode. */
export function hydrogenLabels(graph: MoleculeGraph): Map<string, HydrogenLabel> {
  const out = new Map<string, HydrogenLabel>();
  if (hydrogenModeOf(graph) !== "labels") return out;
  const byId = new Map(graph.atoms.map((a) => [a.id, a]));
  for (const [id, count] of implicitHydrogens(graph)) {
    const atom = byId.get(id)!;
    // the label goes to the side the bonds leave free: –OH, but the same group read from the left is HO–
    let pull = 0;
    for (const b of graph.bonds) {
      const other = b.sourceId === id ? byId.get(b.targetId) : b.targetId === id ? byId.get(b.sourceId) : undefined;
      if (other) pull += other.x - atom.x;
    }
    out.set(id, { count, side: pull > 1 ? -1 : 1 });
  }
  return out;
}

/** CH3 is the symbol, then "H", then a subscript 3; on the left side the order is mirrored (H3C). */
export function labelParts({ count, side }: HydrogenLabel): LabelPart[] {
  const sub = count > 1 ? [{ text: String(count), size: LABEL_SUB_SIZE }] : [];
  if (side === 1) {
    return [
      { text: "H", x: 15, y: 0, size: LABEL_H_SIZE },
      ...sub.map((s) => ({ ...s, x: 26, y: 6 })),
    ];
  }
  return [
    { text: "H", x: sub.length ? -24 : -15, y: 0, size: LABEL_H_SIZE },
    ...sub.map((s) => ({ ...s, x: -13, y: 6 })),
  ];
}
