// Shapes of the drawing: rings, and the box around a whole drawing. Pure functions (no React).
import { newId } from "../id";
import { shapesBounds } from "../shapes";
import { BOND_LENGTH, graphBounds } from "./bondGeometry";
import { LABEL_REACH, hydrogenLabels } from "./hydrogenLabel";
import { PAIR_DISTANCE, lonePairMarks } from "./lonePairs";
import type { AtomNode, BondEdge, BondType, MoleculeGraph } from "./types";

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Size of a text annotation and of the conditions written over an arrow, in drawing units. */
export const TEXT_SIZE = 18;
export const LABEL_SIZE = 16;
/** Where the label of an arrow sits above its line, and how short an arrow may be made. */
export const LABEL_GAP = 8;
export const ARROW_MIN_WIDTH = 40;
export const ARROW_DEFAULT_WIDTH = 100;

/** Distance from the centre of a regular polygon to its corners, for a side of `bondLength`. */
export const ringRadius = (sides: number, bondLength: number = BOND_LENGTH) => bondLength / (2 * Math.sin(Math.PI / sides));

/**
 * A regular ring of carbons centred on (centerX, centerY), one corner pointing up, every side one bond length.
 * (The corners are `ringRadius` from the centre: that equals the bond length for a hexagon only.)
 * With `isAromatic` the bonds alternate double and single (a Kekulé benzene); that only fits a ring with
 * an even number of sides, so any other ring stays single-bonded. The hydrogens are not made here:
 * recalculateHydrogens gives each carbon the ones its two ring bonds leave.
 */
export function generateRing(centerX: number, centerY: number, sides: number, isAromatic: boolean, bondLength: number = BOND_LENGTH): { atoms: AtomNode[]; bonds: BondEdge[] } {
  if (!Number.isInteger(sides) || sides < 3) return { atoms: [], bonds: [] };
  const radius = ringRadius(sides, bondLength);
  const alternate = isAromatic && sides % 2 === 0;
  const atoms: AtomNode[] = Array.from({ length: sides }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    return { id: newId(), element: "C", x: round2(centerX + radius * Math.cos(angle)), y: round2(centerY + radius * Math.sin(angle)), charge: 0, hidden: false };
  });
  const bonds: BondEdge[] = atoms.map((a, i) => ({
    id: newId(),
    sourceId: a.id,
    targetId: atoms[(i + 1) % sides].id,
    type: (alternate && i % 2 === 0 ? "double" : "single") as BondType,
    hidden: false,
  }));
  return { atoms, bonds };
}

/** About how wide a text is (the real width is only known once it is drawn). */
export const estimateTextWidth = (text: string, fontSize: number) => Math.max(1, text.length) * fontSize * 0.6;

/** The box around everything drawn: atoms, texts and arrows (null for an empty drawing). */
export function drawingBounds(graph: MoleculeGraph) {
  const points = graph.atoms.map((a) => ({ x: a.x, y: a.y }));
  const placed = new Map(graph.atoms.map((a) => [a.id, a]));
  for (const m of lonePairMarks(graph)) {
    const a = placed.get(m.atomId)!;
    const reach = PAIR_DISTANCE + 6; // (a lone pair and the width of its dots)
    points.push({ x: a.x + reach * Math.cos((m.angle * Math.PI) / 180), y: a.y + reach * Math.sin((m.angle * Math.PI) / 180) });
  }
  for (const a of graph.atoms) for (const angle of a.dots ?? []) points.push({ x: a.x + (PAIR_DISTANCE + 6) * Math.cos((angle * Math.PI) / 180), y: a.y + (PAIR_DISTANCE + 6) * Math.sin((angle * Math.PI) / 180) });
  for (const [id, label] of hydrogenLabels(graph)) {
    const a = graph.atoms.find((x) => x.id === id)!;
    points.push({ x: a.x + label.side * LABEL_REACH, y: a.y }); // (only in "labels" mode)
  }
  for (const note of graph.annotations) {
    if (note.type === "arrow") {
      const width = note.width ?? ARROW_DEFAULT_WIDTH;
      const half = estimateTextWidth(note.text ?? "", LABEL_SIZE) / 2; // the conditions are centred on the arrow and may be longer than it
      points.push({ x: note.x, y: note.y - LABEL_SIZE - 2 * LABEL_GAP }, { x: note.x + width, y: note.y }, { x: note.x + width / 2 - half, y: note.y }, { x: note.x + width / 2 + half, y: note.y });
    } else {
      points.push({ x: note.x, y: note.y }, { x: note.x + estimateTextWidth(note.text ?? "", TEXT_SIZE), y: note.y + TEXT_SIZE * 1.3 });
    }
  }
  const shapes = shapesBounds(graph.shapes);
  if (shapes) points.push({ x: shapes.minX, y: shapes.minY }, { x: shapes.maxX, y: shapes.maxY });
  return graphBounds(points);
}
