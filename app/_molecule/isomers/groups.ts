// Functional groups, rings and branching of a molecule, read from its graph (explicit hydrogens).
// Pure TypeScript: it works on any molecule of the Studio, including an edited one.
import { neighbors, perceiveRings } from "../chem";
import type { MolAtom, MolGraph } from "../model";
import { GROUP_ORDER, type GroupId, type IsomerInfo } from "./types";

const HALOGENS = new Set(["F", "Cl", "Br", "I"]);

// Atoms of benzene-like rings: six carbons with three double bonds.
export function aromaticAtoms(g: MolGraph): Set<string> {
  const out = new Set<string>();
  const byId = new Map(g.atoms.map((a) => [a.id, a]));
  for (const ring of perceiveRings(g)) {
    if (ring.length !== 6 || !ring.every((id) => byId.get(id)?.element === "C")) continue;
    const inRing = new Set(ring);
    const orders = g.bonds.filter((b) => inRing.has(b.a) && inRing.has(b.b)).reduce((s, b) => s + b.order, 0);
    if (orders === 9) ring.forEach((id) => out.add(id));
  }
  return out;
}

export function functionalGroups(g: MolGraph): GroupId[] {
  const found = new Set<GroupId>();
  const arom = aromaticAtoms(g);
  const nb = (id: string) => neighbors(g, id);
  const hasH = (id: string) => nb(id).some((n) => n.atom.element === "H");
  const isSp3C = (a: MolAtom) => a.element === "C" && nb(a.id).every((n) => n.bond.order === 1);
  const carbonLike = (a: MolAtom) => isSp3C(a) || arom.has(a.id); // a carbon an alcohol / ether / amine can hang on

  for (const a of g.atoms) {
    const around = nb(a.id);
    if (a.element === "C") {
      const dblO = around.find((n) => n.atom.element === "O" && n.bond.order === 2);
      if (dblO) {
        const rest = around.filter((n) => n !== dblO);
        const o = rest.find((n) => n.atom.element === "O" && n.bond.order === 1);
        const n = rest.find((x) => x.atom.element === "N" && x.bond.order === 1);
        if (o) {
          if (hasH(o.atom.id)) found.add("carboxylic-acid");
          else if (nb(o.atom.id).some((x) => x.atom.id !== a.id && x.atom.element === "C")) found.add("ester");
        } else if (n) found.add("amide");
        else if (rest.some((x) => x.atom.element === "H")) found.add("aldehyde");
        else if (rest.filter((x) => x.atom.element === "C").length === 2) found.add("ketone");
      }
      for (const x of around) {
        if (x.bond.order === 3 && x.atom.element === "C") found.add("alkyne");
        if (x.bond.order === 3 && x.atom.element === "N") found.add("nitrile");
        if (x.bond.order === 2 && x.atom.element === "C" && a.id < x.atom.id && !(arom.has(a.id) && arom.has(x.atom.id))) found.add("alkene");
        if (HALOGENS.has(x.atom.element) && x.bond.order === 1) found.add("halide");
      }
    } else if (a.element === "O" && around.every((n) => n.bond.order === 1)) {
      const heavy = around.filter((n) => n.atom.element !== "H");
      if (hasH(a.id) && heavy.length === 1) {
        const c = heavy[0].atom;
        if (arom.has(c.id)) found.add("phenol");
        else if (isSp3C(c)) found.add("alcohol");
      } else if (heavy.length === 2 && heavy.every((n) => n.atom.element === "C" && carbonLike(n.atom))) found.add("ether");
    } else if (a.element === "N" && a.charge === 0 && around.every((n) => n.bond.order === 1)) {
      const carbons = around.filter((n) => n.atom.element === "C");
      const amide = carbons.some((n) => nb(n.atom.id).some((x) => x.atom.element === "O" && x.bond.order === 2));
      if (carbons.length && !amide && carbons.some((n) => carbonLike(n.atom))) found.add("amine");
    }
  }

  const rings = perceiveRings(g);
  if (arom.size) found.add("aromatic");
  const byId = new Map(g.atoms.map((a) => [a.id, a]));
  const saturatedCarbonRing = rings.some((r) => r.every((id) => byId.get(id)?.element === "C" && !arom.has(id) && isSp3C(byId.get(id)!)));
  if (saturatedCarbonRing) found.add("cycloalkane");
  const onlyCH = g.atoms.every((a) => a.element === "C" || a.element === "H");
  if (!rings.length && onlyCH && g.bonds.every((b) => b.order === 1)) found.add("alkane");

  const ordered = GROUP_ORDER.filter((id) => found.has(id));
  return ordered.length ? ordered : ["other"];
}

export function ringSizes(g: MolGraph): number[] {
  return perceiveRings(g).map((r) => r.length);
}

// A carbon chain with a branch point (a carbon with three or more carbon neighbours). Rings are not "branched chains".
export function isBranched(g: MolGraph): boolean {
  if (perceiveRings(g).length) return false;
  return g.atoms.some((a) => a.element === "C" && neighbors(g, a.id).filter((n) => n.atom.element === "C").length >= 3);
}

export function groupsAndShape(g: MolGraph): Omit<IsomerInfo, "skeleton"> {
  return { groups: functionalGroups(g), ring: perceiveRings(g).length > 0, branched: isBranched(g) };
}
