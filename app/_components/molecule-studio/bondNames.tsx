"use client";

import type { BondType } from "@/app/_lib/chemistry/types";
import { useUi } from "@/app/_lib/uiLang";

/** The library of bonds, in the groups the toolbar shows them in. */
export const BOND_GROUPS: { id: "covalent" | "stereo" | "other"; types: BondType[] }[] = [
  { id: "covalent", types: ["single", "double", "triple", "quadruple", "aromatic", "partial", "shared"] },
  { id: "stereo", types: ["wedge", "dash", "wedge-open", "bold", "wavy"] },
  { id: "other", types: ["dative", "ionic", "hydrogen"] },
];
export const ALL_BOND_TYPES: BondType[] = BOND_GROUPS.flatMap((g) => g.types);

// The names of the bonds: a short one for a button, a full one for its tooltip and the Properties panel.
export function useBondNames(): { short: Record<BondType, string>; full: Record<BondType, string> } {
  const { t } = useUi();
  return {
    short: {
      single: t("Single"),
      double: t("Double"),
      triple: t("Triple"),
      quadruple: t("Quadruple"),
      aromatic: t("Aromatic"),
      partial: t("Partial"),
      shared: t("Dot-line"),
      wedge: t("Wedge"),
      dash: t("Hashed"),
      "wedge-open": t("Open wedge"),
      bold: t("Bold"),
      wavy: t("Wavy"),
      dative: t("Dative"),
      ionic: t("Ionic"),
      hydrogen: t("H bond"),
    },
    full: {
      single: t("Single bond"),
      double: t("Double bond"),
      triple: t("Triple bond"),
      quadruple: t("Quadruple bond"),
      aromatic: t("Aromatic bond (a line and a dashed one)"),
      partial: t("Partial bond (dashed)"),
      shared: t("Covalent bond drawn as a line with a dot at each end"),
      wedge: t("Wedge bond"),
      dash: t("Hashed bond"),
      "wedge-open": t("Open wedge bond"),
      bold: t("Bold bond (towards the viewer)"),
      wavy: t("Wavy bond (unknown direction)"),
      dative: t("Dative bond (an arrow from the donor)"),
      ionic: t("Ionic bond (dotted)"),
      hydrogen: t("Hydrogen bond (dashed)"),
    },
  };
}

export function useBondGroupNames(): Record<(typeof BOND_GROUPS)[number]["id"], string> {
  const { t } = useUi();
  return { covalent: t("Covalent"), stereo: t("Stereo"), other: t("Other bonds") };
}
