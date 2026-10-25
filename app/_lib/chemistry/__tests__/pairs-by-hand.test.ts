import { describe, expect, it } from "vitest";
import { BOND_LENGTH } from "../bondGeometry";
import { MAX_PAIRS, PAIR_GAP, freePairAngle, lonePairCounts, lonePairMarks, movePair, pairClick, pinPairs, placePair, removePair, removePairNear } from "../lonePairs";
import { setPairs, stepPairs } from "../selection";
import type { AtomNode, BondEdge, MoleculeGraph } from "../types";

const atom = (id: string, element: string, x: number, y: number, extra: Partial<AtomNode> = {}): AtomNode => ({ id, element, x, y, charge: 0, hidden: false, ...extra });
const bond = (id: string, sourceId: string, targetId: string): BondEdge => ({ id, sourceId, targetId, type: "single", hidden: false });
// Water drawn straight: the oxygen with a hydrogen to its right (0°) and one to its left (180°). Its two pairs are above and below
// (90° and 270°, screen angles: y points down).
const water = (extra: Partial<MoleculeGraph> = {}, oxygenExtra: Partial<AtomNode> = {}): MoleculeGraph => ({
  atoms: [atom("o", "O", 0, 0, oxygenExtra), atom("h1", "H", BOND_LENGTH, 0), atom("h2", "H", -BOND_LENGTH, 0)],
  bonds: [bond("b1", "o", "h1"), bond("b2", "o", "h2")],
  annotations: [],
  hydrogens: "manual",
  ...extra,
});
const marksOf = (g: MoleculeGraph, id = "o") => lonePairMarks(g, "dots").filter((m) => m.atomId === id);
const oxygen = (g: MoleculeGraph) => g.atoms.find((a) => a.id === "o")!;

describe("lone pairs put by hand", () => {
  it("snaps a click beside the atom to 45° and puts one of the atom's pairs there", () => {
    const g = placePair(water(), "o", 232); // (the mouse is a bit past the lower left diagonal)
    expect(oxygen(g).pairDirs).toEqual([225]);
    expect(lonePairCounts(g).get("o")).toBe(2); // (a pair put by hand is one of the two, not a third)
    expect(oxygen(g).pairs).toBeUndefined();
    expect(marksOf(g).map((m) => [m.angle, m.pinned])).toEqual([
      [225, true],
      [90, false], // (the other one stays in the free space)
    ]);
  });

  it("writes the lone pairs if they were not written", () => {
    expect(water().lonePairs).toBeUndefined();
    expect(placePair(water(), "o", 225).lonePairs).toBe("dots");
    expect(placePair(water({ lonePairs: "lines" }), "o", 225).lonePairs).toBe("lines");
  });

  it("keeps a pair off the bonds: the nearest free direction when the snapped one is in the way", () => {
    expect(oxygen(placePair(water(), "o", 5)).pairDirs).toEqual([30]); // 0° is the bond to a hydrogen
    expect(freePairAngle([0], 5)).toBe(30);
    expect(freePairAngle([0, 180], 270)).toBe(270);
    expect(freePairAngle([0, 90, 180, 270], 45)).toBe(45); // 45° is 45° from each, enough
    expect(freePairAngle([0, 40, 80, 120, 160, 200, 240, 280, 320], 20)).toBeNull(); // no room at all (every gap is 40°, the middle is 20° from both sides)
    for (let wanted = 0; wanted < 360; wanted += 7) {
      const angle = freePairAngle([0, 180], wanted)!;
      for (const b of [0, 180]) expect(Math.min(Math.abs(angle - b), 360 - Math.abs(angle - b))).toBeGreaterThanOrEqual(PAIR_GAP);
    }
    // a pair that sits off the grid (it was dragged) blocks the diagonal beside it
    const dragged = water({}, { pairDirs: [300] });
    expect(pairClick(dragged, "o", 330)).toEqual({ kind: "add", angle: 330 });
  });

  it("takes a pair away when the click is on it, and then the atom has one pair fewer", () => {
    const placed = placePair(water(), "o", 225);
    expect(pairClick(placed, "o", 232)).toMatchObject({ kind: "remove" });
    const g = placePair(placed, "o", 232);
    expect(oxygen(g).pairDirs).toBeUndefined();
    expect(lonePairCounts(g).get("o")).toBe(1);
    // an automatic one too
    const auto = placePair(water({ lonePairs: "dots" }), "o", 85);
    expect(lonePairCounts(auto).get("o")).toBe(1);
    expect(marksOf(auto)).toHaveLength(1);
  });

  it("Shift+click takes away the nearest pair, wherever the click is", () => {
    const g = placePair(placePair(water(), "o", 225), "o", 135);
    expect(oxygen(g).pairDirs).toEqual([225, 135]);
    const less = removePairNear(g, "o", 300);
    expect(oxygen(less).pairDirs).toEqual([135]);
    expect(lonePairCounts(less).get("o")).toBe(1);
    expect(removePairNear(water(), "h1", 0)).toEqual(water()); // (a hydrogen has none)
  });

  it("gives a third pair when all of them are already placed, up to four", () => {
    let g = placePair(placePair(water(), "o", 225), "o", 135);
    expect(lonePairCounts(g).get("o")).toBe(2);
    g = placePair(g, "o", 315);
    expect(lonePairCounts(g).get("o")).toBe(3);
    expect(oxygen(g).pairs).toBe(3);
    g = placePair(g, "o", 45);
    expect(lonePairCounts(g).get("o")).toBe(MAX_PAIRS);
    expect(pairClick(g, "o", 90)).toBeNull(); // no fifth
    expect(placePair(g, "o", 90)).toBe(g);
  });

  it("moves a pair round its atom on a 15° grid and never onto a bond", () => {
    const g = placePair(water(), "o", 225);
    expect(oxygen(movePair(g, "o", 0, 100)).pairDirs).toEqual([105]);
    expect(oxygen(movePair(g, "o", 0, 175)).pairDirs).toEqual([150]); // 180° is a bond
    expect(movePair(g, "o", 0, 227)).toBe(g); // (same place: no step)
    expect(movePair(g, "o", 3, 100)).toBe(g); // (no such pair)
  });

  it("puts every pair where it is drawn, so that moving one leaves the others", () => {
    const g = pinPairs(water({ lonePairs: "dots" }), "o");
    expect(oxygen(g).pairDirs).toEqual([90, 270]);
    expect(marksOf(g).every((m) => m.pinned)).toBe(true);
    const moved = movePair(g, "o", 0, 45);
    expect(marksOf(moved).map((m) => m.angle)).toEqual([45, 270]);
    expect(pinPairs(g, "o")).toBe(g);
  });

  it("goes with the atom: the directions are relative to it", () => {
    const g = placePair(water(), "o", 225);
    const shifted = { ...g, atoms: g.atoms.map((a) => ({ ...a, x: a.x + 120, y: a.y - 40 })) };
    expect(marksOf(shifted)).toEqual(marksOf(g));
  });

  it("is forgotten by Automatic, trimmed by fewer pairs", () => {
    const g = placePair(placePair(water(), "o", 225), "o", 135);
    expect(oxygen(setPairs(g, ["o"], undefined)).pairDirs).toBeUndefined();
    expect(oxygen(setPairs(g, ["o"], undefined)).pairs).toBeUndefined();
    const fewer = stepPairs(g, ["o"], -1);
    expect(oxygen(fewer).pairs).toBe(1);
    expect(oxygen(fewer).pairDirs).toEqual([225]);
    expect(oxygen(stepPairs(fewer, ["o"], -1)).pairDirs).toBeUndefined();
    expect(oxygen(stepPairs(g, ["o"], 1)).pairDirs).toEqual([225, 135]); // (one more keeps what was placed)
  });

  it("takes a pair that was put by hand away by its mark", () => {
    const g = placePair(placePair(water(), "o", 225), "o", 135);
    const [first] = marksOf(g);
    expect(oxygen(removePair(g, "o", first)).pairDirs).toEqual([135]);
  });
});
