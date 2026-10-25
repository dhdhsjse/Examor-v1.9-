// Pure chemistry helpers on a MolGraph (no engine, no DOM).
import type { MolAtom, MolBond, MolGraph } from "./model";

export const ELEMENTS = new Set(
  ("H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pt Au Hg Pb Bi U").split(" "),
);

// Outer-shell electrons (main groups).
const VALENCE_ELECTRONS: Record<string, number> = {
  H: 1, He: 2, Li: 1, Be: 2, B: 3, C: 4, N: 5, O: 6, F: 7, Ne: 8, Na: 1, Mg: 2, Al: 3, Si: 4, P: 5, S: 6, Cl: 7, Ar: 8,
  K: 1, Ca: 2, Ge: 4, As: 5, Se: 6, Br: 7, Kr: 8, I: 7, Xe: 8,
};

// Usual valences (numbers of bonds) of the neutral atom.
const USUAL_VALENCE: Record<string, number[]> = {
  H: [1], B: [3], C: [4], N: [3, 5], O: [2], F: [1], Si: [4], P: [3, 5], S: [2, 4, 6], Cl: [1, 3, 5, 7], Br: [1, 3, 5, 7], I: [1, 3, 5, 7],
  Li: [1], Na: [1], K: [1], Mg: [2], Ca: [2], Al: [3], He: [0], Ne: [0], Ar: [0],
};

// Second-row elements in order: a charged atom behaves like its isoelectronic neighbour (N+ like C, O- like F).
const SECOND_ROW = ["B", "C", "N", "O", "F"];

export const isHydrogen = (a: MolAtom) => a.element === "H";

export function bondOrderSum(g: MolGraph, atomId: string): number {
  let n = 0;
  for (const b of g.bonds) if (b.a === atomId || b.b === atomId) n += b.order;
  return n;
}

export function neighbors(g: MolGraph, atomId: string): { atom: MolAtom; bond: MolBond }[] {
  const byId = new Map(g.atoms.map((a) => [a.id, a]));
  const out: { atom: MolAtom; bond: MolBond }[] = [];
  for (const b of g.bonds) {
    const other = b.a === atomId ? b.b : b.b === atomId ? b.a : null;
    const atom = other ? byId.get(other) : undefined;
    if (atom) out.push({ atom, bond: b });
  }
  return out;
}

// Lone pairs = (valence electrons − charge − bonding electrons) / 2. Rounded down: a radical's odd electron is not a pair.
export function lonePairsFor(element: string, charge: number, bonds: number): number {
  const ve = VALENCE_ELECTRONS[element];
  if (ve === undefined) return 0;
  return Math.max(0, Math.floor((ve - charge - bonds) / 2));
}

export function withLonePairs(g: MolGraph): MolGraph {
  return { ...g, atoms: g.atoms.map((a) => ({ ...a, lonePairs: lonePairsFor(a.element, a.charge, bondOrderSum(g, a.id)) })) };
}

// Usual valences of an element with a charge (a charged atom behaves like its isoelectronic neighbour).
export function allowedValences(element: string, charge: number): number[] {
  let el = element;
  const i = SECOND_ROW.indexOf(el);
  if (i >= 0 && charge !== 0) el = SECOND_ROW[i - charge] ?? el;
  return USUAL_VALENCE[el] ?? [];
}

export function valence(g: MolGraph, atomId: string): { used: number; allowed: number[] } {
  const a = g.atoms.find((x) => x.id === atomId);
  if (!a) return { used: 0, allowed: [] };
  return { used: bondOrderSum(g, atomId), allowed: allowedValences(a.element, a.charge) };
}

// Hill order: C first, then H, then the rest alphabetically; without carbon everything is alphabetical.
export function hillFormula(counts: Record<string, number>): string {
  const sub = (el: string) => (counts[el] ? el + (counts[el] > 1 ? counts[el] : "") : "");
  const rest = Object.keys(counts).filter((e) => counts[e] > 0 && !(counts.C && (e === "C" || e === "H")));
  rest.sort();
  return (counts.C ? sub("C") + sub("H") : "") + rest.map(sub).join("");
}

export function formulaCounts(g: MolGraph): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of g.atoms) counts[a.element] = (counts[a.element] ?? 0) + 1;
  return counts;
}

export const formula = (g: MolGraph) => hillFormula(formulaCounts(g));

// Smallest ring through each non-tree bond (enough for school molecules).
export function perceiveRings(g: MolGraph): string[][] {
  const adj = new Map<string, string[]>();
  for (const a of g.atoms) adj.set(a.id, []);
  for (const b of g.bonds) {
    adj.get(b.a)?.push(b.b);
    adj.get(b.b)?.push(b.a);
  }
  const rings: string[][] = [];
  const seen = new Set<string>();
  for (const b of g.bonds) {
    // Shortest path from b.a to b.b that avoids the bond itself.
    const prev = new Map<string, string>([[b.a, ""]]);
    const queue = [b.a];
    for (let q = 0; q < queue.length && !prev.has(b.b); q++) {
      for (const n of adj.get(queue[q]) ?? []) {
        if (queue[q] === b.a && n === b.b) continue;
        if (!prev.has(n)) {
          prev.set(n, queue[q]);
          queue.push(n);
        }
      }
    }
    if (!prev.has(b.b)) continue;
    const ring: string[] = [];
    for (let at = b.b; at; at = prev.get(at) ?? "") ring.push(at);
    const key = [...ring].sort().join(",");
    if (!seen.has(key)) {
      seen.add(key);
      rings.push(ring);
    }
  }
  return rings;
}

export const hasRings = (g: MolGraph) => perceiveRings(g).length > 0;

// How a teacher writes the molecular formula: Hill order for carbon compounds (C2H4O2), conventional order
// otherwise (NH3, H2O, HCl, SO2) instead of the alphabetical Hill order (H3N, ClH, O2S).
const ELECTRONEGATIVITY: Record<string, number> = { H: 2.2, B: 2.04, C: 2.55, Si: 1.9, N: 3.04, P: 2.19, O: 3.44, S: 2.58, F: 3.98, Cl: 3.16, Br: 2.96, I: 2.66, Na: 0.93, K: 0.82, Mg: 1.31, Ca: 1.0, Al: 1.61 };
const H_AFTER = new Set(["B", "Si", "N", "P", "As", "Ge"]); // NH3, PH3, SiH4: the element first, then H

export function displayFromCounts(counts: Record<string, number>): string {
  if (counts.C) return hillFormula(counts);
  const sub = (el: string) => el + (counts[el] > 1 ? counts[el] : "");
  const others = Object.keys(counts).filter((e) => e !== "H");
  if (counts.H && others.length === 1) return H_AFTER.has(others[0]) ? sub(others[0]) + sub("H") : sub("H") + sub(others[0]);
  const order = Object.keys(counts).sort((a, b) => (ELECTRONEGATIVITY[a] ?? 9) - (ELECTRONEGATIVITY[b] ?? 9) || a.localeCompare(b));
  return order.map(sub).join("");
}

export const displayFormula = (g: MolGraph) => displayFromCounts(formulaCounts(g));

// Octet check (Lewis): every atom should have 8 electrons around it (2 for hydrogen). Elements beyond the
// second row may exceed 8 (SO2, PCl5): those are not reported, teachers draw them on purpose.
export interface OctetIssue {
  atomId: string;
  electrons: number;
  expected: number;
}

const EXPANDABLE = new Set(["P", "S", "Cl", "Br", "I", "Si", "As", "Se", "Xe"]);

export function octetIssues(g: MolGraph): OctetIssue[] {
  const out: OctetIssue[] = [];
  for (const a of g.atoms) {
    if (VALENCE_ELECTRONS[a.element] === undefined) continue;
    // electrons around the atom = its lone pairs (2 each) + the shared pairs (2 per bond order)
    const electrons = 2 * a.lonePairs + 2 * bondOrderSum(g, a.id);
    const expected = a.element === "H" ? 2 : 8;
    if (electrons === expected) continue;
    if (electrons > expected && EXPANDABLE.has(a.element)) continue;
    // an odd electron (radical) or a boron/beryllium-like deficiency is reported too
    out.push({ atomId: a.id, electrons, expected });
  }
  return out;
}
