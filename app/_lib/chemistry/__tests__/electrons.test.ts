import { describe, expect, it } from "vitest";
import { BOND_LENGTH } from "../bondGeometry";
import { MAX_ELECTRONS, electronClick, electronMarks, placeElectron, removeElectron, removeElectronNear } from "../electrons";
import { lonePairCounts, lonePairMarks } from "../lonePairs";
import { renderDrawingSvg } from "../svg";
import type { MoleculeGraph } from "../types";

// A methyl radical's carbon with a hydrogen to its right and one to its left.
const g0 = (): MoleculeGraph => ({
  atoms: [
    { id: "c", element: "C", x: 0, y: 0, charge: 0, hidden: false },
    { id: "h1", element: "H", x: BOND_LENGTH, y: 0, charge: 0, hidden: false },
    { id: "h2", element: "H", x: -BOND_LENGTH, y: 0, charge: 0, hidden: false },
  ],
  bonds: [
    { id: "b1", sourceId: "c", targetId: "h1", type: "single", hidden: false },
    { id: "b2", sourceId: "c", targetId: "h2", type: "single", hidden: false },
  ],
  annotations: [],
  hydrogens: "manual",
});
const dots = (g: MoleculeGraph) => g.atoms.find((a) => a.id === "c")!.dots;

describe("single electrons put by hand", () => {
  it("puts one dot towards the click, snapped to 45°, and keeps off the bonds", () => {
    expect(dots(placeElectron(g0(), "c", 262))).toEqual([270]);
    expect(dots(placeElectron(g0(), "c", 5))).toEqual([30]); // 0° is a bond
  });
  it("takes a dot away when the click is on it; Shift+click the nearest one", () => {
    const g = placeElectron(placeElectron(g0(), "c", 270), "c", 90);
    expect(dots(g)).toEqual([270, 90]);
    expect(electronClick(g, "c", 265)).toEqual({ kind: "remove", index: 0 });
    expect(dots(placeElectron(g, "c", 265))).toEqual([90]);
    expect(dots(removeElectronNear(g, "c", 100))).toEqual([270]);
    expect(dots(removeElectron(removeElectron(g, "c", 0), "c", 0))).toBeUndefined();
  });
  it("is at most four, and is not a lone pair", () => {
    let g = g0();
    for (const a of [270, 90, 225, 315]) g = placeElectron(g, "c", a);
    expect(electronMarks(g)).toHaveLength(MAX_ELECTRONS);
    expect(electronClick(g, "c", 45)).toBeNull();
    expect(lonePairCounts(g).get("c")).toBe(0);
  });
  it("makes the lone pairs move out of its way", () => {
    const g = { ...placeElectron(g0(), "c", 90), lonePairs: "dots" as const, atoms: g0().atoms.map((a) => (a.id === "c" ? { ...a, pairs: 1, dots: [90] } : a)) };
    expect(lonePairMarks(g)[0].angle).toBe(270);
  });
  it("is in the picture, and hidden from the students with the atom's pairs", () => {
    const g = placeElectron(g0(), "c", 270);
    expect(renderDrawingSvg(g)!.svg).toContain("<circle");
    const hidden = { ...g, atoms: g.atoms.map((a) => (a.id === "c" ? { ...a, pairsHidden: true } : a)) };
    expect(renderDrawingSvg(hidden, { student: true })!.svg).not.toContain("<circle");
  });
});
