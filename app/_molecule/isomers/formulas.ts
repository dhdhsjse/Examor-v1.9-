// Which formulas get an isomer table: every formula of the local database, plus the school families.
import { hillFormula } from "../chem";
import { DATABASE } from "../resolve/database";
import { canonicalFormula, parseFormula } from "../resolve/normalize";

// Carbon compounds with up to two O, one N and two Cl (the spec's school families). H follows from the degree
// of unsaturation d (double bonds and rings): H = 2C + 2 + N − Cl − 2d. The counts explode (C4H3Cl2NO alone has
// thousands of structures), so the family is kept to what a school meets: at most three heteroatoms (four for C1–C2),
// d ≤ 3 up to C3, d ≤ 2 up to C6, and C7–C8 only as compounds of C, H and O with d ≤ 1.
export function schoolFamily(): string[] {
  const out = new Set<string>();
  for (let c = 1; c <= 8; c++) {
    const big = c >= 7;
    for (let o = 0; o <= 2; o++) {
      for (let n = 0; n <= (big ? 0 : 1); n++) {
        for (let x = 0; x <= (big ? 0 : 2); x++) {
          if (o + n + x > (c <= 2 ? 4 : 3)) continue;
          const dMax = big ? 1 : c >= 4 ? 2 : 3;
          for (let d = 0; d <= dMax; d++) {
            const h = 2 * c + 2 + n - x - 2 * d;
            if (h < 1) continue;
            out.add(hillFormula({ C: c, H: h, ...(n ? { N: n } : {}), ...(o ? { O: o } : {}), ...(x ? { Cl: x } : {}) }));
          }
        }
      }
    }
  }
  return [...out];
}

export function isomerFormulas(): string[] {
  const out = new Set(schoolFamily());
  for (const e of DATABASE) {
    const f = canonicalFormula(e.formula);
    if (f && parseFormula(f)?.C) out.add(f); // inorganic molecules have no isomer table
  }
  return [...out].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}
