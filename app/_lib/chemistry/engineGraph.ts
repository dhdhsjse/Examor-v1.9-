// What the drawing has that the engine's graph does not: the bonds of the library that are only a way of drawing, the bonds
// that are not covalent, and the lone pairs the teacher wrote. Put on the engine's graph after the engine has read the drawing, so
// that every representation (developed, skeletal, Lewis, Cram) draws them. Pure functions (no React), unit-tested.
import type { BondStyle, MolAtom, MolBond, MolGraph, OverlayBond } from "../../_molecule/model";
import { NON_COVALENT_BONDS } from "./bondGeometry";
import { mapToEngine, type EngineMap } from "./masking";
import type { BondType, MoleculeGraph } from "./types";
import { freeDirections } from "./valence";

const STYLE: Partial<Record<BondType, BondStyle>> = {
  quadruple: "quadruple",
  aromatic: "aromatic",
  partial: "partial",
  shared: "shared",
  "wedge-open": "wedge-open",
  bold: "bold",
  wavy: "wavy",
};

/**
 * The engine adds the hydrogens the drawing leaves implicit but gives them no place (they are all at the origin): the structural
 * drawings lay everything out themselves, but a drawing that keeps the sketch's own layout (pieces that are not bonded to each
 * other, a sketch the engine could not read) needs them where they belong: one bond length from their atom, in the free space
 * between its bonds. The hydrogens that were drawn keep their place.
 */
export function placeHydrogens(atoms: MolAtom[], bonds: MolBond[], drawn: ReadonlySet<string>): MolAtom[] {
  const byId = new Map(atoms.map((a) => [a.id, a]));
  const around = new Map<string, string[]>(); // the neighbours of each atom
  for (const b of bonds) {
    around.set(b.a, [...(around.get(b.a) ?? []), b.b]);
    around.set(b.b, [...(around.get(b.b) ?? []), b.a]);
  }
  const moved = new Map<string, MolAtom>();
  for (const host of atoms) {
    if (host.element === "H") continue;
    const added = (around.get(host.id) ?? []).filter((id) => byId.get(id)?.element === "H" && !drawn.has(id));
    if (!added.length) continue;
    const taken = (around.get(host.id) ?? []).filter((id) => !added.includes(id)).map((id) => Math.atan2(byId.get(id)!.y - host.y, byId.get(id)!.x - host.x));
    freeDirections(taken, added.length).forEach((angle, i) => moved.set(added[i], { ...byId.get(added[i])!, x: Math.round((host.x + Math.cos(angle)) * 1000) / 1000, y: Math.round((host.y + Math.sin(angle)) * 1000) / 1000 }));
  }
  return atoms.map((a) => moved.get(a.id) ?? a);
}

export type EngineDrawing = { graph: MolGraph; overlay: OverlayBond[]; map: EngineMap };

/**
 * The engine's graph with the drawing's bond styles, wedges and hashes (the narrow end at the atom the drawing started
 * from), lone pairs, and the bonds that are not covalent as `overlay`. A bond or an atom that cannot be matched is left as the
 * engine made it: nothing is ever put on the wrong one.
 */
export function drawingOnEngine(graph: MoleculeGraph, mol: MolGraph): EngineDrawing {
  const map = mapToEngine(graph, mol);
  const bonds: MolBond[] = mol.bonds.map((b) => ({ ...b }));
  const byId = new Map(bonds.map((b) => [b.id, b]));
  const overlay: OverlayBond[] = [];
  for (const d of graph.bonds) {
    const a = map.atoms.get(d.sourceId);
    const c = map.atoms.get(d.targetId);
    if (!a || !c) continue;
    if (NON_COVALENT_BONDS.includes(d.type)) {
      overlay.push({ id: d.id, a, b: c, style: d.type as OverlayBond["style"] });
      continue;
    }
    const engineId = map.bonds.get(d.id);
    const bond = engineId ? byId.get(engineId) : undefined;
    if (!bond) continue;
    const style = STYLE[d.type];
    if (style) bond.style = style;
    if (d.type === "wedge" || d.type === "dash") bond.stereo = d.type;
    if ((d.type === "wedge" || d.type === "dash" || d.type === "wedge-open") && bond.a !== a) [bond.a, bond.b] = [bond.b, bond.a]; // narrow end at `a`
  }
  const explicit = new Map(graph.atoms.flatMap((a) => (a.pairs !== undefined && map.atoms.has(a.id) ? [[map.atoms.get(a.id)!, a.pairs] as const] : [])));
  const atoms = placeHydrogens(
    mol.atoms.map((a) => (explicit.has(a.id) ? { ...a, lonePairs: explicit.get(a.id)! } : a)),
    bonds,
    new Set(map.atoms.values()),
  );
  return { graph: { ...mol, atoms, bonds }, overlay, map };
}
