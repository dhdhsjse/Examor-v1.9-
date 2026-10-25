// Angles for new bonds, and the auto-valence engine: every atom is given the hydrogens its valence still
// needs, as real atoms placed in the free space around it. Pure functions (no React), unit-tested.
//
// Angles are in radians as Math.atan2(dy, dx) gives them on the screen (y grows downwards).
import { BOND_LENGTH, NON_COVALENT_BONDS } from "./bondGeometry";
import { PERIODIC_TABLE, tableCell } from "./periodicTable";
import type { AtomNode, BondEdge, BondType, HydrogenMode, MoleculeGraph } from "./types";

const STEP = Math.PI / 6; // bonds are drawn at multiples of 30°
const TAU = 2 * Math.PI;
const EPS = 1e-9;
const PAIR_SPREAD = TAU / 6; // 60°
const BOUNDED_GAP = (3 * Math.PI) / 2; // a gap of up to 270° has a bond on each side; the 360° of a single bond has not
const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * How many valence electrons a bond uses: 1, 2, 3 or 4 (the stereo bonds, bold, wavy and partial are single, an aromatic
 * one is one and a half). The bonds that are not covalent use none: a dative bond only shares a pair the donor already has,
 * and ionic and hydrogen bonds are attractions.
 */
export const bondOrder = (type: BondType): number => (type === "double" ? 2 : type === "triple" ? 3 : type === "quadruple" ? 4 : type === "aromatic" ? 1.5 : NON_COVALENT_BONDS.includes(type) ? 0 : 1);

/**
 * How many bonds an atom of `element` with this charge makes: its usual valence, moved by the charge.
 * - Groups 15–17 (N, O, F…): the charge adds to it. NH4+ has 4 bonds, H3O+ 3, OH− 1, NH2− 2, Cl− none.
 * - Group 14 (C, Si): a charge of either sign takes one off: CH3+ and CH3− have 3.
 * - Group 13 (B): a negative charge adds one (BH4−), a positive one takes one off.
 * - Metals and noble gases have none, charged or not (Na+, Ca2+: no hydrogens).
 */
export function effectiveValence(element: string, charge: number): number {
  const data = PERIODIC_TABLE[element];
  if (!data || data.valence === 0) return 0;
  const group = tableCell(data.atomicNumber).col;
  if (group === 13) return Math.max(0, data.valence - charge);
  if (group === 14) return Math.max(0, data.valence - Math.abs(charge));
  if (group >= 15) return Math.max(0, data.valence + charge);
  return data.valence;
}

/** The angle from (startX, startY) to (currentX, currentY), snapped to the nearest 30°. */
export function getSnappedAngle(startX: number, startY: number, currentX: number, currentY: number): number {
  const angle = Math.atan2(currentY - startY, currentX - startX);
  return Math.round(angle / STEP) * STEP;
}

/** The point `length` away from (x, y) in direction `angle`. */
export const pointAt = (x: number, y: number, angle: number, length: number = BOND_LENGTH) => ({
  x: round2(x + length * Math.cos(angle)),
  y: round2(y + length * Math.sin(angle)),
});

// Where the hydrogens of an atom with no bond go: methane as a cross, ammonia and water as the usual drawings.
const ALONE: Record<number, number[]> = {
  1: [0],
  2: [30, 150],
  3: [90, 210, 330],
  4: [0, 90, 180, 270],
};

/**
 * Directions for `n` new bonds around an atom whose bonds already go in the directions `taken`.
 * The free space is the gaps between the existing bonds; each new bond goes in the gap that, with it, leaves
 * the widest angles, and the bonds of one gap are spread evenly in it.
 * So CH3 at the end of a chain is a cross, and CH2 in a zigzag has both hydrogens outside the bend.
 */
export function freeDirections(taken: number[], n: number): number[] {
  if (n <= 0) return [];
  if (!taken.length) return ALONE[n]?.map((d) => (d * Math.PI) / 180) ?? Array.from({ length: n }, (_, i) => (i * TAU) / n);

  const starts = taken.map((a) => ((a % TAU) + TAU) % TAU).sort((p, q) => p - q);
  const sizes = starts.map((a, i) => (i + 1 < starts.length ? starts[i + 1] : starts[0] + TAU) - a);
  const counts = sizes.map(() => 0);
  for (let h = 0; h < n; h++) {
    let best = 0;
    // The gap that keeps the widest angle once it has one more bond: size ÷ (bonds in it + 2). (Size ÷ (bonds + 1),
    // the angle before, ties for a ring carbon, where half of the outside equals the inside, and whichever way rounding
    // broke the tie put a hydrogen inside the ring.)
    for (let i = 1; i < sizes.length; i++) {
      const score = sizes[i] / (counts[i] + 2);
      const bestScore = sizes[best] / (counts[best] + 2);
      // the roomiest gap; on a tie the bigger one
      if (score > bestScore + EPS || (Math.abs(score - bestScore) <= EPS && sizes[i] > sizes[best] + EPS)) best = i;
    }
    counts[best]++;
  }
  const out: number[] = [];
  sizes.forEach((size, i) => {
    const k = counts[i];
    // Evenly, centred in the gap. Two bonds in a gap that is between two other bonds (the hydrogens of a ring
    // or chain carbon) are kept at most 60° apart: spread 80° apart, those of neighbouring carbons crowd.
    const spacing = k === 2 && size <= BOUNDED_GAP ? Math.min(size / 3, PAIR_SPREAD) : size / (k + 1);
    for (let j = 0; j < k; j++) out.push(starts[i] + size / 2 + (j - (k - 1) / 2) * spacing);
  });
  return out;
}

const isAuto = (a: AtomNode) => a.element === "H" && a.auto === true;

/**
 * Gives every atom the hydrogens its valence still needs.
 *
 * 1. The hydrogens made by an earlier call are removed (with their bonds): they are recomputed from the
 *    current geometry, so they follow an atom that moved and vanish with an atom that was deleted.
 * 2. For each other atom, missing = valence − (sum of its bond orders): the valence of PERIODIC_TABLE moved by the
 *    charge (effectiveValence). Hydrogens
 *    that are not automatic (placed by hand, or drawn in a sample) count as bonds: they are never removed.
 * 3. The missing hydrogens are added as atoms (flagged `auto`) one bond length away, in the free space.
 *
 * Their ids are stable (`<atom id>~h0`, …), so the same drawing gives the same graph and a selection on
 * one survives the next edit. The argument is not changed.
 */
export function recalculateHydrogens(graph: MoleculeGraph): MoleculeGraph {
  const atoms = graph.atoms.filter((a) => !isAuto(a));
  const kept = new Set(atoms.map((a) => a.id));
  const bonds = graph.bonds.filter((b) => kept.has(b.sourceId) && kept.has(b.targetId));
  const byId = new Map(atoms.map((a) => [a.id, a]));
  const used = new Set(kept);

  const around = new Map<string, { angles: number[]; order: number }>();
  for (const b of bonds) {
    const s = byId.get(b.sourceId)!;
    const t = byId.get(b.targetId)!;
    const order = bondOrder(b.type);
    for (const [from, to] of [[s, t], [t, s]] as const) {
      const entry = around.get(from.id) ?? { angles: [], order: 0 };
      entry.angles.push(Math.atan2(to.y - from.y, to.x - from.x));
      entry.order += order;
      around.set(from.id, entry);
    }
  }

  const newAtoms: AtomNode[] = [];
  const newBonds: BondEdge[] = [];
  for (const a of atoms) {
    if (a.element === "H") continue;
    const entry = around.get(a.id) ?? { angles: [], order: 0 };
    const missing = Math.floor(effectiveValence(a.element, a.charge) - entry.order + 1e-9); // (an aromatic bond counts 1.5)
    if (missing <= 0) continue;
    let k = 0;
    for (const angle of freeDirections(entry.angles, missing)) {
      while (used.has(`${a.id}~h${k}`)) k++;
      const id = `${a.id}~h${k}`;
      used.add(id);
      const p = pointAt(a.x, a.y, angle);
      newAtoms.push({ id, element: "H", x: p.x, y: p.y, charge: 0, hidden: a.hidden, auto: true });
      newBonds.push({ id: `${id}~bond`, sourceId: a.id, targetId: id, type: "single", hidden: a.hidden });
    }
  }
  return { ...graph, atoms: [...atoms, ...newAtoms], bonds: [...bonds, ...newBonds] };
}

// ---- hydrogen modes ----

/**
 * The mode of a drawing. One made before the modes existed has no field: it is "auto" if it carries hydrogens
 * made by the engine (they keep being managed), else "manual".
 */
export const hydrogenModeOf = (graph: MoleculeGraph): HydrogenMode => graph.hydrogens ?? (graph.atoms.some(isAuto) ? "auto" : "manual");

/** What every edit ends with: in "auto" the hydrogens are remade, in the other modes the drawing is left as it is. */
export const applyHydrogenMode = (graph: MoleculeGraph): MoleculeGraph => (hydrogenModeOf(graph) === "auto" ? recalculateHydrogens(graph) : graph);

/**
 * Switches mode. From "auto" the hydrogens already drawn either stay as ordinary atoms ("manual"), or go because
 * the labels say the same thing ("labels"). To "auto" the missing ones are added at once.
 */
export function changeHydrogenMode(graph: MoleculeGraph, mode: HydrogenMode): MoleculeGraph {
  const from = hydrogenModeOf(graph);
  if (graph.hydrogens === mode) return graph;
  if (mode === "auto") return recalculateHydrogens({ ...graph, hydrogens: "auto" });
  if (from === "auto" && mode === "labels") {
    const kept = graph.atoms.filter((a) => !isAuto(a));
    const ids = new Set(kept.map((a) => a.id));
    return { ...graph, hydrogens: mode, atoms: kept, bonds: graph.bonds.filter((b) => ids.has(b.sourceId) && ids.has(b.targetId)) };
  }
  return { ...graph, hydrogens: mode, atoms: graph.atoms.map((a) => (isAuto(a) ? { ...a, auto: false } : a)) };
}

/** Adds the missing hydrogens once, as ordinary atoms (the mode stays "manual"): the teacher can move and delete them. */
export function fillHydrogens(graph: MoleculeGraph): MoleculeGraph {
  const filled = recalculateHydrogens(graph);
  return { ...filled, atoms: filled.atoms.map((a) => (isAuto(a) ? { ...a, auto: false } : a)) };
}

/** The sum of the bond orders of every atom. */
function bondOrders(graph: MoleculeGraph): Map<string, number> {
  const orders = new Map<string, number>();
  for (const b of graph.bonds) {
    const order = bondOrder(b.type);
    orders.set(b.sourceId, (orders.get(b.sourceId) ?? 0) + order);
    orders.set(b.targetId, (orders.get(b.targetId) ?? 0) + order);
  }
  return orders;
}

/** How many hydrogens each atom is missing (only the atoms that miss some). Hydrogens themselves never do. */
export function implicitHydrogens(graph: MoleculeGraph): Map<string, number> {
  const orders = bondOrders(graph);
  const out = new Map<string, number>();
  for (const a of graph.atoms) {
    if (a.element === "H") continue;
    const missing = Math.floor(effectiveValence(a.element, a.charge) - (orders.get(a.id) ?? 0) + 1e-9);
    if (missing > 0) out.set(a.id, missing);
  }
  return out;
}

/**
 * The atoms with more bonds than their usual valence allows (a pentavalent carbon). It is a warning, never a
 * block. Metals and noble gases have no usual valence, and the elements of period 3 and below in groups 15–17
 * (P, S, Cl…) can exceed theirs (SO2, PCl5, ClO4−), so none of these is reported.
 */
export function overValenced(graph: MoleculeGraph): Set<string> {
  const orders = bondOrders(graph);
  const out = new Set<string>();
  for (const a of graph.atoms) {
    const data = PERIODIC_TABLE[a.element];
    if (!data || data.valence === 0) continue;
    const cell = tableCell(data.atomicNumber);
    if (cell.row >= 3 && cell.col >= 15) continue;
    if ((orders.get(a.id) ?? 0) > effectiveValence(a.element, a.charge)) out.add(a.id);
  }
  return out;
}
