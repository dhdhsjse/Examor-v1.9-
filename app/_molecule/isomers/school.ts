// The school filter: structures a teacher would not show a pupil. MAYGEN makes no assumption about stability,
// so it also produces peroxides, three- and four-membered rings, enols, hydrates, cumulated double bonds…
import { neighbors } from "../chem";
import type { MolGraph } from "../model";
import { aromaticAtoms, ringSizes } from "./groups";
import type { SchoolIssue } from "./types";

const ISSUE_ORDER: SchoolIssue[] = ["small-ring", "peroxide", "cumulated", "enol", "gem-diol"];

export function schoolIssues(g: MolGraph): SchoolIssue[] {
  const issues = new Set<SchoolIssue>();
  const hasCarbon = g.atoms.some((a) => a.element === "C");
  const arom = aromaticAtoms(g);
  if (ringSizes(g).some((s) => s === 3 || s === 4)) issues.add("small-ring");
  for (const b of g.bonds) {
    const A = g.atoms.find((a) => a.id === b.a)!;
    const B = g.atoms.find((a) => a.id === b.b)!;
    if (A.element === "O" && B.element === "O" && hasCarbon) issues.add("peroxide"); // H2O2 has its own entry
  }
  for (const a of g.atoms) {
    if (a.element !== "C") continue;
    const around = neighbors(g, a.id);
    const doubles = around.filter((n) => n.bond.order === 2);
    // C=C=C, C=C=O (ketene), C=C=N…; but not O=C=O
    if (doubles.length === 2 && doubles.some((n) => n.atom.element === "C" || n.atom.element === "N")) issues.add("cumulated");
    // enol: C=C–O–H (a phenol is not an enol: its ring bonds are aromatic)
    if (doubles.some((n) => n.atom.element === "C" && !(arom.has(a.id) && arom.has(n.atom.id)))) {
      for (const n of around) {
        if (n.atom.element === "O" && n.bond.order === 1 && neighbors(g, n.atom.id).some((x) => x.atom.element === "H")) issues.add("enol");
      }
    }
    // gem-diol: two O–H on one sp3 carbon
    const ohs = around.filter((n) => n.atom.element === "O" && neighbors(g, n.atom.id).some((x) => x.atom.element === "H"));
    if (around.every((n) => n.bond.order === 1) && ohs.length >= 2) issues.add("gem-diol");
  }
  // A fixed order: it must not depend on the order the atoms were read in.
  return ISSUE_ORDER.filter((i) => issues.has(i));
}
