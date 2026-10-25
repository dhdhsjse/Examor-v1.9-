// Hard-coded molecules used to check the drawing engine until the drawing tools exist.
import { BOND_LENGTH } from "./bondGeometry";
import type { AtomNode, BondEdge, BondType, MoleculeGraph } from "./types";

export type SampleMolecule = { id: string; name: { fr: string; en: string }; graph: MoleculeGraph };

const atom = (id: string, element: string, x: number, y: number): AtomNode => ({ id, element, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, charge: 0, hidden: false });
const bond = (id: string, sourceId: string, targetId: string, type: BondType = "single"): BondEdge => ({ id, sourceId, targetId, type, hidden: false });

const L = BOND_LENGTH;
const COS30 = Math.cos(Math.PI / 6);

// CH3–COOH, every atom and bond drawn (hydrogens included).
function aceticAcid(): MoleculeGraph {
  const dx = L * COS30; // 30° bonds
  const dy = L / 2;
  return {
    atoms: [
      atom("a1", "C", -dx, dy), // CH3
      atom("a2", "C", 0, 0), // carboxyl carbon
      atom("a3", "O", 0, -L), // C=O
      atom("a4", "O", dx, dy), // O–H
      atom("a5", "H", dx * 2, 0), // the acidic hydrogen
      atom("a6", "H", -dx, dy - L),
      atom("a7", "H", -dx, dy + L),
      atom("a8", "H", -dx - L, dy),
    ],
    bonds: [
      bond("b1", "a1", "a2"),
      bond("b2", "a2", "a3", "double"),
      bond("b3", "a2", "a4"),
      bond("b4", "a4", "a5"),
      bond("b5", "a1", "a6"),
      bond("b6", "a1", "a7"),
      bond("b7", "a1", "a8"),
    ],
    annotations: [],
  };
}

// Caffeine, C8H10N4O2, heavy atoms only: a hexagon and a pentagon sharing the C4–C5 bond.
function caffeine(): MoleculeGraph {
  const onCircle = (cx: number, cy: number, r: number, deg: number) => ({ x: cx + r * Math.cos((deg * Math.PI) / 180), y: cy - r * Math.sin((deg * Math.PI) / 180) });
  const out = (p: { x: number; y: number }, deg: number) => onCircle(p.x, p.y, L, deg); // one bond further

  // Six-membered ring, centre (0, 0): C5 upper right, then C6, N1, C2, N3 and C4 lower right.
  const c5 = onCircle(0, 0, L, 30);
  const c6 = onCircle(0, 0, L, 90);
  const n1 = onCircle(0, 0, L, 150);
  const c2 = onCircle(0, 0, L, 210);
  const n3 = onCircle(0, 0, L, 270);
  const c4 = onCircle(0, 0, L, 330);
  // Five-membered ring on the right: its centre is one apothem beyond the shared bond.
  const apothem = L / (2 * Math.tan(Math.PI / 5));
  const radius = L / (2 * Math.sin(Math.PI / 5));
  const cx = c5.x + apothem;
  const n7 = onCircle(cx, 0, radius, 72);
  const c8 = onCircle(cx, 0, radius, 0);
  const n9 = onCircle(cx, 0, radius, -72);

  const o2 = out(c2, 210);
  const o6 = out(c6, 90);
  const me1 = out(n1, 150);
  const me3 = out(n3, 270);
  const me7 = out(n7, 72);

  return {
    atoms: [
      atom("n1", "N", n1.x, n1.y),
      atom("c2", "C", c2.x, c2.y),
      atom("n3", "N", n3.x, n3.y),
      atom("c4", "C", c4.x, c4.y),
      atom("c5", "C", c5.x, c5.y),
      atom("c6", "C", c6.x, c6.y),
      atom("n7", "N", n7.x, n7.y),
      atom("c8", "C", c8.x, c8.y),
      atom("n9", "N", n9.x, n9.y),
      atom("o2", "O", o2.x, o2.y),
      atom("o6", "O", o6.x, o6.y),
      atom("m1", "C", me1.x, me1.y),
      atom("m3", "C", me3.x, me3.y),
      atom("m7", "C", me7.x, me7.y),
    ],
    bonds: [
      bond("b1", "n1", "c2"),
      bond("b2", "c2", "n3"),
      bond("b3", "n3", "c4"),
      bond("b4", "c4", "c5", "double"),
      bond("b5", "c5", "c6"),
      bond("b6", "c6", "n1"),
      bond("b7", "c5", "n7"),
      bond("b8", "n7", "c8"),
      bond("b9", "c8", "n9", "double"),
      bond("b10", "n9", "c4"),
      bond("b11", "c2", "o2", "double"),
      bond("b12", "c6", "o6", "double"),
      bond("b13", "n1", "m1"),
      bond("b14", "n3", "m3"),
      bond("b15", "n7", "m7"),
    ],
    annotations: [],
  };
}

export const SAMPLE_MOLECULES: readonly SampleMolecule[] = [
  { id: "acetic-acid", name: { fr: "Acide éthanoïque", en: "Ethanoic acid" }, graph: aceticAcid() },
  { id: "caffeine", name: { fr: "Caféine", en: "Caffeine" }, graph: caffeine() },
];
