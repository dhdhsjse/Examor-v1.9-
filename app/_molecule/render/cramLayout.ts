// Cram (perspective) layout. Bonds in the plane of the page are plain lines, bonds towards the viewer are
// solid wedges, bonds away are hashed wedges. The templates are FIXED (school drawings), not derived from RDKit's
// stereochemistry, which is about chiral centres:
//
//   tetrahedral AX4  two bonds in the plane, one wedge, one hash
//   pyramidal  AX3E  one in the plane, one wedge, one hash (the lone pair takes the free side)
//   AX3 / AX2 / AX2E / AX2E2 are planar: no wedges
//
// Angles are screen angles in degrees (0 = east, 90 = down). A template lists the angles of the neighbours
// once the "anchor" bond (the main chain, or the bond to the parent) lies at 0°.
import { hasRings, neighbors } from "../chem";
import type { MolGraph } from "../model";
import { skeleton } from "./chain";

type Pos = Map<string, { x: number; y: number }>;

export interface CramStereo {
  type: "wedge" | "dash";
  from: string; // the Cram centre: the narrow end
}

export interface CramLayout {
  pos: Pos; // bond units
  stereo: Map<string, CramStereo>; // by bond id
  overlaps: number; // atoms drawn closer than OVERLAP bond lengths (0 = clean)
}

export type CramProblem = "ring" | "pieces";

interface Slot {
  angle: number;
  kind: "plane" | "wedge" | "dash";
}
const plane = (angle: number): Slot => ({ angle, kind: "plane" });
const wedgeSlot = (angle: number): Slot => ({ angle, kind: "wedge" });
const dashSlot = (angle: number): Slot => ({ angle, kind: "dash" });

const isTetrahedral = (X: number, E: number) => X === 4 && E === 0;
const isPyramidal = (X: number, E: number) => X === 3 && E === 1;

// The slots of the neighbours around an atom with X neighbours and E lone pairs. With an anchor the slots
// are for the other X − 1 neighbours (the anchor is at 0°); without one they are absolute and cover all X.
export function templateFor(X: number, E: number, wedge: boolean, hasAnchor: boolean): Slot[] {
  if (wedge && isTetrahedral(X, E)) return hasAnchor ? [plane(250.5), wedgeSlot(105), dashSlot(160)] : [plane(215.25), plane(324.75), wedgeSlot(55), dashSlot(125)];
  if (wedge && isPyramidal(X, E)) return hasAnchor ? [wedgeSlot(125), dashSlot(195)] : [plane(150), wedgeSlot(90), dashSlot(30)];
  switch (X) {
    case 0:
      return [];
    case 1:
      return hasAnchor ? [] : [plane(0)];
    case 2: {
      const bent = E === 1 ? 120 : E === 2 ? 104.5 : 180; // the angle between the two bonds
      return hasAnchor ? [plane(bent)] : [plane(90 + bent / 2), plane(90 - bent / 2)];
    }
    case 3:
      return hasAnchor ? [plane(120), plane(240)] : [plane(270), plane(30), plane(150)];
    case 4:
      return hasAnchor ? [plane(180), plane(90), plane(270)] : [plane(0), plane(90), plane(180), plane(270)];
    default: {
      const n = hasAnchor ? X - 1 : X;
      return Array.from({ length: n }, (_, k) => plane(((hasAnchor ? k + 1 : k) * 360) / X));
    }
  }
}

// Two labels closer than this (in bond lengths) touch.
const OVERLAP = 0.75;

const dir = (deg: number) => ({ x: Math.cos((deg * Math.PI) / 180), y: Math.sin((deg * Math.PI) / 180) });

// The atoms a teacher is most likely to want in perspective: the first tetrahedral or pyramidal atom in reading order.
export function defaultCramCenters(g: MolGraph): string[] {
  if (hasRings(g)) return [];
  const sk = skeleton(g);
  const order = sk ? [...sk.chain, ...g.atoms.map((a) => a.id).filter((id) => !sk.chain.includes(id))] : g.atoms.map((a) => a.id);
  for (const id of order) {
    const a = g.atoms.find((x) => x.id === id)!;
    if (a.element === "H") continue;
    const X = neighbors(g, id).length;
    if (isTetrahedral(X, a.lonePairs) || isPyramidal(X, a.lonePairs)) return [id];
  }
  return [];
}

export function cramLayout(g: MolGraph, centers: string[]): CramLayout | CramProblem {
  if (hasRings(g)) return "ring";
  const byId = new Map(g.atoms.map((a) => [a.id, a]));
  const centerSet = new Set(centers.filter((c) => byId.has(c)));

  const size = (id: string, from: string): number => 1 + neighbors(g, id).filter((n) => n.atom.id !== from).reduce((s, n) => s + size(n.atom.id, id), 0);

  // Biggest first: heavy atoms, double bonds, then the bigger part of the molecule.
  const ranked = (id: string, parent: string | null) =>
    neighbors(g, id)
      .filter((n) => n.atom.id !== parent)
      .map((n) => ({ ...n, size: size(n.atom.id, id) }))
      .sort((a, b) => Number(b.atom.element !== "H") - Number(a.atom.element !== "H") || b.bond.order - a.bond.order || b.size - a.size);

  const anchorOf = (root: string): string | null => {
    const all = ranked(root, null);
    if (!all.length) return null;
    const big = [...all].sort((a, b) => b.size - a.size)[0];
    if (big.size > 1) return big.atom.id;
    return all.find((n) => n.atom.element !== "H")?.atom.id ?? null; // a heavy atom on a plain centre (CH3Cl: Cl)
  };

  const sk = skeleton(g);
  const root = [...centerSet][0] ?? sk?.chain[0] ?? g.atoms.find((a) => a.element !== "H")?.id ?? g.atoms[0]?.id;
  if (!root) return "pieces";

  // flipW: wedge centres drawn flipped top to bottom; flipP: the planar atoms along the chain drawn the other way round.
  function build(flipW: boolean, flipP: boolean): CramLayout | null {
    const pos: Pos = new Map([[root, { x: 0, y: 0 }]]);
    const stereo = new Map<string, CramStereo>();

    const place = (node: string, parent: string | null, anchorAngle: number) => {
      const atom = byId.get(node)!;
      const X = neighbors(g, node).length;
      const E = atom.lonePairs;
      const wedge = centerSet.has(node) && (isTetrahedral(X, E) || isPyramidal(X, E));
      const anchorChild = parent ? null : anchorOf(node);
      const hasAnchor = !!parent || !!anchorChild;
      let slots = templateFor(X, E, wedge, hasAnchor);
      if ((wedge ? flipW : flipP) && hasAnchor) slots = slots.map((s) => ({ ...s, angle: 360 - s.angle }));
      const ordered = [...slots.filter((s) => s.kind === "plane"), ...slots.filter((s) => s.kind === "wedge"), ...slots.filter((s) => s.kind === "dash")];

      const at = pos.get(node)!;
      const put = (n: { atom: { id: string }; bond: { id: string } }, angle: number, kind: Slot["kind"]) => {
        const d = dir(angle);
        pos.set(n.atom.id, { x: at.x + d.x, y: at.y + d.y });
        if (kind !== "plane") stereo.set(n.bond.id, { type: kind, from: node });
        place(n.atom.id, node, angle + 180);
      };

      const kids = ranked(node, parent);
      const rest = anchorChild ? kids.filter((n) => n.atom.id !== anchorChild) : kids;
      if (anchorChild) put(kids.find((n) => n.atom.id === anchorChild)!, anchorAngle, "plane");
      rest.forEach((n, i) => {
        const slot = ordered[i];
        if (slot) put(n, anchorAngle + slot.angle, slot.kind);
        else put(n, anchorAngle + ((i + 1) * 360) / (rest.length + 1), "plane"); // more neighbours than slots: spread evenly
      });
    };
    place(root, null, 0);
    if (pos.size !== g.atoms.length) return null; // several pieces
    const pts = [...pos.values()];
    let overlaps = 0;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) < OVERLAP) overlaps++;
    return { pos, stereo, overlaps };
  }

  // The first drawing without overlaps; otherwise the one with the fewest.
  let best: CramLayout | null = null;
  for (const [flipW, flipP] of [[false, false], [true, false], [false, true], [true, true]]) {
    const l = build(flipW, flipP);
    if (!l) return "pieces";
    if (!best || l.overlaps < best.overlaps) best = l;
    if (best.overlaps === 0) break;
  }
  return best!;
}
