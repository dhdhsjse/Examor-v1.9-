// What a drawing is made of: its molecules (the groups of bonded atoms), their formulas and molar masses.
// Pure functions (no React), unit-tested.
import type { ChemSegment } from "./chemText";
import { PERIODIC_TABLE, tableCell } from "./periodicTable";
import type { MoleculeGraph } from "./types";
import { hydrogenModeOf, implicitHydrogens } from "./valence";

export type Molecule = {
  /** The atoms of the molecule, in the order of the drawing. */
  atomIds: string[];
  /** How many atoms of each element, hydrogens included. */
  counts: Record<string, number>;
  /** The sum of the charges of its atoms. */
  charge: number;
  /** Molar mass in g/mol. */
  mass: number;
};

/** Molar mass of a set of atoms, in g/mol (an unknown symbol counts for nothing). */
export const molarMass = (counts: Record<string, number>) => Object.entries(counts).reduce((sum, [symbol, n]) => sum + (PERIODIC_TABLE[symbol]?.atomicMass ?? 0) * n, 0);

/**
 * The elements of a formula in the order they are written:
 * - with carbon, the Hill order: C, then H, then the others alphabetically (C2H6O, CH4, C6H12O6, CO2, CHN);
 * - without carbon, as school books write them: metals first (NaCl, MgCl2, Al2O3, NaH), then the elements of groups
 *   13–15, then hydrogen, then groups 16–17 with oxygen last: NH3, SiH4, H2O, H2S, HCl, H2SO4, NH4Cl. Hydrogen goes
 *   first when there is oxygen and no metal (the acids: HNO3, H3PO4, H2SO4) and after it with a metal (hydroxides: NaOH).
 * Ties are alphabetical. The hydroxide ion is OH−, not HO− (water is H2O): only the charge tells them apart.
 */
export function elementOrder(counts: Record<string, number>, charge = 0): string[] {
  const symbols = Object.keys(counts).filter((s) => counts[s] > 0);
  if (charge < 0 && symbols.length === 2 && symbols.includes("O") && symbols.includes("H")) return ["O", "H"];
  const alphabetical = [...symbols].sort((a, b) => a.localeCompare(b));
  if (symbols.includes("C")) return ["C", ...(symbols.includes("H") ? ["H"] : []), ...alphabetical.filter((s) => s !== "C" && s !== "H")];

  const group = (symbol: string) => tableCell(PERIODIC_TABLE[symbol]?.atomicNumber ?? 0).col;
  const isMetal = (symbol: string) => !!PERIODIC_TABLE[symbol] && PERIODIC_TABLE[symbol].valence === 0 && group(symbol) < 18;
  const hasMetal = symbols.some(isMetal);
  const hasOxygen = symbols.includes("O");
  const key = (symbol: string) => {
    if (isMetal(symbol)) return 0;
    if (symbol === "H") return hasOxygen ? (hasMetal ? 17.5 : -1) : 15.5;
    if (symbol === "O") return 16.9;
    return group(symbol);
  };
  return alphabetical.sort((a, b) => key(a) - key(b)); // (a stable sort: ties stay alphabetical)
}

/** A formula as pieces to draw: the elements, their numbers as subscripts, the charge as a superscript (NH₄⁺). */
export function formulaSegments(counts: Record<string, number>, charge = 0): ChemSegment[] {
  const out: ChemSegment[] = [];
  for (const symbol of elementOrder(counts, charge)) {
    out.push({ text: symbol, kind: "normal" });
    if (counts[symbol] > 1) out.push({ text: String(counts[symbol]), kind: "sub" });
  }
  if (charge) out.push({ text: `${Math.abs(charge) > 1 ? Math.abs(charge) : ""}${charge > 0 ? "+" : "−"}`, kind: "sup" });
  return out;
}

/** The formula as plain text ("C2H4O2", "NH4+"): for tests and for a title. */
export const formulaText = (counts: Record<string, number>, charge = 0) => formulaSegments(counts, charge).map((s) => s.text).join("");

/** The molecules of a drawing: its groups of bonded atoms, in the order of their first atom (the hydrogens of the "labels" mode count). */
export function moleculesOf(graph: MoleculeGraph): Molecule[] {
  const parent = new Map(graph.atoms.map((a) => [a.id, a.id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root); // (a short path next time)
    return root;
  };
  for (const b of graph.bonds) {
    if (!parent.has(b.sourceId) || !parent.has(b.targetId) || b.type === "hydrogen") continue;
    parent.set(find(b.sourceId), find(b.targetId));
  }
  const hydrogens = hydrogenModeOf(graph) === "labels" ? implicitHydrogens(graph) : new Map<string, number>();
  const groups = new Map<string, Molecule>();
  for (const a of graph.atoms) {
    const root = find(a.id);
    const m = groups.get(root) ?? { atomIds: [], counts: {}, charge: 0, mass: 0 };
    m.atomIds.push(a.id);
    m.counts[a.element] = (m.counts[a.element] ?? 0) + 1;
    if (hydrogens.has(a.id)) m.counts.H = (m.counts.H ?? 0) + hydrogens.get(a.id)!;
    m.charge += a.charge;
    groups.set(root, m);
  }
  return [...groups.values()].map((m) => ({ ...m, mass: molarMass(m.counts) }));
}
