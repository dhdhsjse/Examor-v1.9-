// Loads the isomer table of a formula (one lazy chunk per formula: nothing is read until it is asked for).
import { ISOMER_LOADERS } from "../data/isomers";
import { canonicalFormula } from "../resolve/normalize";
import type { IsomerFile } from "./types";

const cache = new Map<string, Promise<IsomerFile>>();

export const hasIsomerTable = (formula: string): boolean => {
  const f = canonicalFormula(formula);
  return !!f && f in ISOMER_LOADERS;
};

export const isomerFormulaList = (): string[] => Object.keys(ISOMER_LOADERS);

// null when the formula has no table (fewer than two structures, or outside the school families).
export async function loadIsomers(formula: string): Promise<IsomerFile | null> {
  const f = canonicalFormula(formula);
  const loader = f ? ISOMER_LOADERS[f] : undefined;
  if (!f || !loader) return null;
  let p = cache.get(f);
  if (!p) {
    p = loader();
    cache.set(f, p);
  }
  return p;
}
