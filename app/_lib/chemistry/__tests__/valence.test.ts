import { describe, expect, it } from "vitest";
import { BOND_LENGTH } from "../bondGeometry";
import { addAtom, addBondedAtom, claimAtom, connectAtoms, cycleBond, makeAtom, moveAtom, planBond, removeAtom, removeAtomAndHydrogens, removeBond, setBondType } from "../graphOps";
import { SAMPLE_MOLECULES } from "../samples";
import type { AtomNode, BondType, MoleculeGraph } from "../types";
import { bondOrder, freeDirections, getSnappedAngle, pointAt, recalculateHydrogens } from "../valence";

const deg = (rad: number) => (rad * 180) / Math.PI;
const norm = (d: number) => ((d % 360) + 360) % 360;
const EMPTY: MoleculeGraph = { atoms: [], bonds: [], annotations: [] };
const L = BOND_LENGTH;

const atom = (id: string, element: string, x: number, y: number, extra: Partial<AtomNode> = {}): AtomNode => ({ id, element, x, y, charge: 0, hidden: false, ...extra });
const withBond = (g: MoleculeGraph, id: string, a: string, b: string, type: BondType = "single"): MoleculeGraph => ({ ...g, bonds: [...g.bonds, { id, sourceId: a, targetId: b, type, hidden: false }], annotations: [] });
const count = (g: MoleculeGraph, el: string) => g.atoms.filter((a) => a.element === el).length;
const hydrogensOf = (g: MoleculeGraph, id: string) => g.bonds.filter((b) => b.sourceId === id && g.atoms.find((a) => a.id === b.targetId)?.element === "H").length;
const formula = (g: MoleculeGraph) => Object.fromEntries([...new Set(g.atoms.map((a) => a.element))].sort().map((e) => [e, count(g, e)]));

// A molecule from a list of heavy atoms and bonds, hydrogens filled in by the engine.
function build(atoms: [string, string, number, number][], bonds: [string, string, BondType?][]): MoleculeGraph {
  let g: MoleculeGraph = { atoms: atoms.map(([id, el, x, y]) => atom(id, el, x, y)), bonds: [], annotations: [] };
  bonds.forEach(([a, b, t], i) => (g = withBond(g, `b${i}`, a, b, t)));
  return recalculateHydrogens(g);
}

// The smallest distance between two atoms of a drawing.
function closest(g: MoleculeGraph) {
  let min = Infinity;
  for (let i = 0; i < g.atoms.length; i++) for (let j = i + 1; j < g.atoms.length; j++) min = Math.min(min, Math.hypot(g.atoms[i].x - g.atoms[j].x, g.atoms[i].y - g.atoms[j].y));
  return min;
}

describe("bond angles", () => {
  const snap = (dx: number, dy: number) => deg(getSnappedAngle(0, 0, dx, dy));

  it("snaps to the nearest 30°", () => {
    expect(snap(100, 0)).toBeCloseTo(0);
    expect(snap(100, 10)).toBeCloseTo(0); // 5.7°
    expect(snap(100, 40)).toBeCloseTo(30); // 21.8°
    expect(snap(100, 100)).toBeCloseTo(60); // 45°: exactly between 30° and 60°, rounds up
  });

  it("rounds a half step up and keeps exact multiples", () => {
    expect(snap(0, 100)).toBeCloseTo(90);
    expect(snap(-100, 0)).toBeCloseTo(180);
    expect(snap(0, -100)).toBeCloseTo(-90);
    expect(snap(100 * Math.cos(Math.PI / 3), 100 * Math.sin(Math.PI / 3))).toBeCloseTo(60);
    expect(snap(100 * Math.cos(-Math.PI / 6), 100 * Math.sin(-Math.PI / 6))).toBeCloseTo(-30);
  });

  it("measures from the start point", () => {
    expect(deg(getSnappedAngle(50, 50, 50, 150))).toBeCloseTo(90);
  });

  it("puts a new atom one bond length away", () => {
    const p = pointAt(10, 20, Math.PI / 3);
    expect(Math.hypot(p.x - 10, p.y - 20)).toBeCloseTo(L, 1);
    expect(pointAt(0, 0, 0)).toEqual({ x: L, y: 0 });
  });

  it("counts the valence a bond uses", () => {
    expect(["single", "double", "triple", "wedge", "dash"].map((t) => bondOrder(t as BondType))).toEqual([1, 2, 3, 1, 1]);
  });
});

describe("free directions", () => {
  it("gives nothing for no bond", () => {
    expect(freeDirections([0], 0)).toEqual([]);
  });

  it("draws an atom with no bond the usual way", () => {
    expect(freeDirections([], 4).map((a) => norm(deg(a)))).toEqual([0, 90, 180, 270].map((d) => expect.closeTo(d)));
    expect(freeDirections([], 1).map(deg)).toEqual([0]);
    expect(freeDirections([], 3).map((a) => norm(deg(a))).sort((p, q) => p - q)).toEqual([90, 210, 330].map((d) => expect.closeTo(d)));
    expect(freeDirections([], 2).map((a) => norm(deg(a))).sort((p, q) => p - q)).toEqual([30, 150].map((d) => expect.closeTo(d)));
  });

  it("spreads three bonds around one existing bond as a cross", () => {
    const out = freeDirections([0], 3).map((a) => norm(deg(a))).sort((p, q) => p - q);
    expect(out).toEqual([90, 180, 270].map((d) => expect.closeTo(d)));
  });

  it("puts the two hydrogens of a zigzag carbon outside the bend, centred, 60° apart", () => {
    // bonds going down-right (30°) and down-left (150°): the hydrogens go up, 30° either side of straight up (270°)
    const out = freeDirections([(30 * Math.PI) / 180, (150 * Math.PI) / 180], 2).map((a) => norm(deg(a))).sort((p, q) => p - q);
    expect(out).toEqual([240, 300].map((d) => expect.closeTo(d)));
  });

  it("keeps the even spread where no bond bounds the gap: an NH2 on a chain end is a Y, a CH3 a cross", () => {
    const y = freeDirections([0], 2).map((a) => norm(deg(a))).sort((p, q) => p - q);
    expect(y).toEqual([120, 240].map((d) => expect.closeTo(d)));
    const cross = freeDirections([0], 3).map((a) => norm(deg(a))).sort((p, q) => p - q);
    expect(cross).toEqual([90, 180, 270].map((d) => expect.closeTo(d)));
  });

  it("goes in the middle of the widest gap", () => {
    // three bonds at 0°, 120°, 200°: the widest gap is 200° → 360°
    const [only] = freeDirections([0, (120 * Math.PI) / 180, (200 * Math.PI) / 180], 1);
    expect(norm(deg(only))).toBeCloseTo(280);
  });

  it("puts both hydrogens of a ring carbon outside the ring, whatever the rounding of the corners (a tie, once)", () => {
    // neighbours 120° apart (the ring), and the same turned by a hair either way
    for (const jitter of [-0.0009, 0, 0.0009]) {
      const taken = [(30 * Math.PI) / 180, (150 * Math.PI) / 180 + jitter];
      const out = freeDirections(taken, 2).map((a) => norm(deg(a)));
      for (const d of out) expect(d).toBeGreaterThan(150); // none in the 30°–150° gap, which is the inside
      for (const d of out) expect(d).toBeLessThan(390);
      expect(out.every((d) => d > 150 || d < 30)).toBe(true);
    }
  });

  it("does not care in which order or turn the bonds are given", () => {
    const a = freeDirections([-Math.PI / 2, Math.PI / 6], 2).map((x) => norm(deg(x))).sort((p, q) => p - q);
    const b = freeDirections([Math.PI / 6, (3 * Math.PI) / 2], 2).map((x) => norm(deg(x))).sort((p, q) => p - q);
    expect(a).toEqual(b.map((d) => expect.closeTo(d)));
  });
});

describe("auto-valence: an atom alone", () => {
  const alone = (element: string) => recalculateHydrogens(addAtom(EMPTY, atom("x", element, 100, 100)));

  it("gives carbon four hydrogens, one bond length away and a quarter turn apart", () => {
    const g = alone("C");
    expect(count(g, "H")).toBe(4);
    expect(g.bonds).toHaveLength(4);
    for (const h of g.atoms.filter((a) => a.element === "H")) {
      expect(Math.hypot(h.x - 100, h.y - 100)).toBeCloseTo(L, 1);
      expect(h.auto).toBe(true);
    }
    const hs = g.atoms.filter((a) => a.element === "H");
    for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) expect(Math.hypot(hs[i].x - hs[j].x, hs[i].y - hs[j].y)).toBeGreaterThan(L * 1.4); // a cross: L√2 between neighbours
    expect(closest(g)).toBeCloseTo(L, 1);
  });

  it("gives each element the hydrogens of its valence", () => {
    expect(count(alone("O"), "H")).toBe(2);
    expect(count(alone("N"), "H")).toBe(3);
    expect(count(alone("Cl"), "H")).toBe(1);
    expect(count(alone("S"), "H")).toBe(2);
    expect(count(alone("P"), "H")).toBe(3);
    expect(count(alone("Si"), "H")).toBe(4);
  });

  it("gives none to hydrogen itself, to metals (no NaH, CaH2) or noble gases, or to an unknown symbol", () => {
    for (const el of ["Fe", "Na", "K", "Mg", "Ca", "Al", "Sn", "Pb", "Ne", "Xx"]) expect(alone(el).atoms.filter((a) => a.element === "H").length, el).toBe(0);
    expect(alone("H").atoms).toHaveLength(1);
    expect(alone("Fe").bonds).toHaveLength(0);
  });

  it("does not change the graph it is given", () => {
    const g = addAtom(EMPTY, atom("x", "C", 0, 0));
    const copy = structuredClone(g);
    recalculateHydrogens(g);
    expect(g).toEqual(copy);
  });
});

describe("auto-valence: bonds use up hydrogens", () => {
  const twoCarbons = (type: BondType) => build([["a", "C", 0, 0], ["b", "C", L, 0]], [["a", "b", type]]);

  it("a single bond to a carbon leaves CH3 (ethane)", () => {
    const g = twoCarbons("single");
    expect(formula(g)).toEqual({ C: 2, H: 6 });
    expect(hydrogensOf(g, "a")).toBe(3);
    expect(hydrogensOf(g, "b")).toBe(3);
  });

  it("a double bond leaves CH2 (ethene) and a triple bond CH (ethyne)", () => {
    expect(formula(twoCarbons("double"))).toEqual({ C: 2, H: 4 });
    expect(formula(twoCarbons("triple"))).toEqual({ C: 2, H: 2 });
  });

  it("changing the order of a bond changes the hydrogens: single → double → triple → single", () => {
    let g = twoCarbons("single");
    const id = g.bonds.find((b) => !b.sourceId.includes("~"))!.id;
    const seen: number[] = [];
    for (let i = 0; i < 3; i++) {
      g = recalculateHydrogens(cycleBond(g, id));
      seen.push(count(g, "H"));
    }
    expect(seen).toEqual([4, 2, 6]);
  });

  it("drawing a bond from an isolated carbon takes one hydrogen from it (the criterion: CH4 → CH3)", () => {
    let g = recalculateHydrogens(addAtom(EMPTY, atom("c", "C", 0, 0)));
    expect(hydrogensOf(g, "c")).toBe(4);
    g = recalculateHydrogens(addBondedAtom(g, "c", "C", L, 0, "single"));
    expect(hydrogensOf(g, "c")).toBe(3);
  });

  it("builds water, ammonia and hydrogen chloride from lone atoms and one bond", () => {
    expect(formula(build([["o", "O", 0, 0]], []))).toEqual({ H: 2, O: 1 });
    expect(formula(build([["n", "N", 0, 0]], []))).toEqual({ H: 3, N: 1 });
    expect(formula(build([["c", "Cl", 0, 0]], []))).toEqual({ Cl: 1, H: 1 });
    expect(formula(build([["c", "C", 0, 0], ["o", "O", L, 0]], [["c", "o", "double"]]))).toEqual({ C: 1, H: 2, O: 1 }); // methanal
  });

  it("makes a ring: six carbons with alternating bonds are C6H6, every hydrogen outside the ring", () => {
    const ring = Array.from({ length: 6 }, (_, i) => [`r${i}`, "C", L * Math.cos((i * Math.PI) / 3), L * Math.sin((i * Math.PI) / 3)] as [string, string, number, number]);
    const g = build(ring, ring.map((_, i) => [`r${i}`, `r${(i + 1) % 6}`, i % 2 ? "single" : "double"] as [string, string, BondType]));
    expect(formula(g)).toEqual({ C: 6, H: 6 });
    for (const h of g.atoms.filter((a) => a.element === "H")) expect(Math.hypot(h.x, h.y)).toBeCloseTo(2 * L, 0);
    expect(closest(g)).toBeGreaterThan(L * 0.95);
  });

  it("leaves more bonds than the valence alone: no negative count, no hydrogen", () => {
    const g = build([["c", "C", 0, 0], ["a", "O", L, 0], ["b", "O", -L, 0], ["d", "O", 0, L]], [["c", "a", "double"], ["c", "b", "double"], ["c", "d", "single"]]);
    expect(hydrogensOf(g, "c")).toBe(0);
  });
});

describe("auto-valence: the hydrogens are remade, not piled up", () => {
  const propane = () =>
    build(
      [["a", "C", 0, 0], ["b", "C", L * Math.cos(Math.PI / 6), L * Math.sin(Math.PI / 6)], ["c", "C", 2 * L * Math.cos(Math.PI / 6), 0]],
      [["a", "b"], ["b", "c"]],
    );

  it("gives the same graph when run again", () => {
    const g = propane();
    expect(recalculateHydrogens(g)).toEqual(g);
    expect(recalculateHydrogens(recalculateHydrogens(g))).toEqual(g);
  });

  it("is C3H8, with no atoms on top of each other", () => {
    const g = propane();
    expect(formula(g)).toEqual({ C: 3, H: 8 });
    expect(closest(g)).toBeGreaterThan(L * 0.6);
    expect(new Set(g.atoms.map((a) => a.id)).size).toBe(g.atoms.length);
    expect(new Set(g.bonds.map((b) => b.id)).size).toBe(g.bonds.length);
  });

  it("moves the hydrogens with their atom, keeping their places around it", () => {
    const g = recalculateHydrogens(addAtom(EMPTY, atom("c", "C", 0, 0)));
    const moved = recalculateHydrogens(moveAtom(g, "c", 70, -30));
    const offsets = (x: MoleculeGraph) => x.atoms.filter((a) => a.element === "H").map((a) => `${Math.round(a.x - x.atoms.find((p) => p.id === "c")!.x)},${Math.round(a.y - x.atoms.find((p) => p.id === "c")!.y)}`).sort();
    expect(offsets(moved)).toEqual(offsets(g));
    expect(moved.atoms.find((a) => a.id === "c")).toMatchObject({ x: 70, y: -30 });
  });

  it("turns the hydrogens when a bond turns", () => {
    const at = (angle: number) => {
      const end = pointAt(0, 0, angle);
      return build([["a", "C", 0, 0], ["b", "C", end.x, end.y]], [["a", "b"]]);
    };
    const hOfA = (g: MoleculeGraph) => g.atoms.filter((x) => x.auto && x.id.startsWith("a~")).map((x) => norm(deg(Math.atan2(x.y, x.x)))).sort((p, q) => p - q);
    const east = hOfA(at(0));
    const south = hOfA(at(Math.PI / 2));
    expect(east).toEqual([90, 180, 270].map((d) => expect.closeTo(d, 0)));
    expect(south).toEqual([0, 90 + 90, 270].map((d) => expect.closeTo(d, 0)));
  });

  it("removes the hydrogens of a deleted atom", () => {
    const g = build([["c", "C", 0, 0]], []);
    const gone = recalculateHydrogens(removeAtomAndHydrogens(g, "c"));
    expect(gone).toEqual(EMPTY);
  });

  it("never touches a hydrogen that is not automatic, and counts it as a bond", () => {
    let g: MoleculeGraph = { atoms: [atom("c", "C", 0, 0), atom("h", "H", L, 0)], bonds: [], annotations: [] };
    g = withBond(g, "hb", "c", "h");
    g = recalculateHydrogens(g);
    expect(g.atoms.find((a) => a.id === "h")).toEqual(atom("h", "H", L, 0));
    expect(hydrogensOf(g, "c")).toBe(4); // the teacher's one + three of the engine's
    expect(g.atoms.filter((a) => a.auto)).toHaveLength(3);
    expect(g.atoms.filter((a) => a.auto).every((a) => Math.hypot(a.x - L, a.y) > L * 0.9)).toBe(true); // none on top of the teacher's
  });

  it("gives a hydrogen a new id rather than one that is taken", () => {
    let g: MoleculeGraph = { atoms: [atom("c", "C", 0, 0), atom("c~h0", "H", L, 0)], bonds: [], annotations: [] };
    g = recalculateHydrogens(withBond(g, "hb", "c", "c~h0"));
    expect(new Set(g.atoms.map((a) => a.id)).size).toBe(g.atoms.length);
    expect(g.atoms.find((a) => a.id === "c~h0")?.auto).toBeUndefined();
  });

  it("keeps a hydrogen the teacher took hold of where they put it", () => {
    let g = recalculateHydrogens(addAtom(EMPTY, atom("c", "C", 0, 0)));
    const id = g.atoms.find((a) => a.auto)!.id;
    g = claimAtom(g, id);
    g = moveAtom(g, id, 123, 45);
    g = recalculateHydrogens(g);
    expect(g.atoms.find((a) => a.id === id)).toMatchObject({ x: 123, y: 45, auto: false });
    expect(hydrogensOf(g, "c")).toBe(4);
    expect(g.atoms.filter((a) => a.auto)).toHaveLength(3);
  });

  it("makes the hydrogens of a hidden atom hidden too", () => {
    const g = recalculateHydrogens({ atoms: [atom("c", "C", 0, 0, { hidden: true })], bonds: [], annotations: [] });
    expect(g.atoms.every((a) => a.hidden)).toBe(true);
    expect(g.bonds.every((b) => b.hidden)).toBe(true);
  });

  it("drops a bond whose atom is gone", () => {
    const g = recalculateHydrogens({ atoms: [atom("c", "C", 0, 0)], bonds: [{ id: "x", sourceId: "c", targetId: "missing", type: "single", hidden: false }], annotations: [] });
    expect(g.bonds.every((b) => b.id !== "x")).toBe(true);
    expect(hydrogensOf(g, "c")).toBe(4);
  });
});

describe("samples through the engine", () => {
  const sample = (id: string) => SAMPLE_MOLECULES.find((s) => s.id === id)!.graph;

  it("leaves acetic acid alone: its hydrogens are drawn, none are missing", () => {
    expect(recalculateHydrogens(sample("acetic-acid"))).toEqual(sample("acetic-acid"));
  });

  it("completes caffeine to C8H10N4O2", () => {
    const g = recalculateHydrogens(sample("caffeine"));
    expect(formula(g)).toEqual({ C: 8, H: 10, N: 4, O: 2 });
    expect(g.bonds).toHaveLength(15 + 10);
    expect(closest(g)).toBeGreaterThan(L * 0.6);
  });
});

describe("editing the graph", () => {
  const two = () => build([["a", "C", 0, 0], ["b", "C", L, 0]], []);

  it("bonds two atoms once, whichever way round", () => {
    const g = connectAtoms(EMPTY, "a", "b", "single");
    expect(g).toBe(EMPTY); // unknown atoms
    const base = { atoms: [atom("a", "C", 0, 0), atom("b", "C", L, 0)], bonds: [], annotations: [] };
    const one = connectAtoms(base, "a", "b", "single");
    expect(one.bonds).toHaveLength(1);
    expect(connectAtoms(one, "a", "b", "single")).toBe(one);
    expect(connectAtoms(one, "b", "a", "single")).toBe(one);
    expect(connectAtoms(one, "a", "a", "single")).toBe(one);
  });

  it("gives an existing bond the new type instead of adding a second one", () => {
    const base = { atoms: [atom("a", "C", 0, 0), atom("b", "C", L, 0)], bonds: [], annotations: [] };
    const one = connectAtoms(base, "a", "b", "single");
    const two2 = connectAtoms(one, "b", "a", "double");
    expect(two2.bonds).toHaveLength(1);
    expect(two2.bonds[0]).toMatchObject({ id: one.bonds[0].id, type: "double" });
  });

  it("adds an atom at the end of a bond", () => {
    const base = recalculateHydrogens({ atoms: [atom("a", "C", 0, 0)], bonds: [], annotations: [] });
    const g = addBondedAtom(base, "a", "C", L, 0, "double");
    const added = g.atoms.at(-1)!;
    expect(added).toMatchObject({ element: "C", x: L, y: 0 });
    expect(g.bonds.at(-1)).toMatchObject({ sourceId: "a", targetId: added.id, type: "double" });
    expect(addBondedAtom(base, "nope", "C", 1, 1, "single")).toBe(base);
  });

  it("cycles single → double → triple → single, and turns wedge and hash into single", () => {
    const base: MoleculeGraph = { atoms: [atom("a", "C", 0, 0), atom("b", "C", L, 0)], bonds: [{ id: "x", sourceId: "a", targetId: "b", type: "single" as BondType, hidden: false }], annotations: [] };
    const types: BondType[] = [];
    let g = base;
    for (let i = 0; i < 4; i++) {
      g = cycleBond(g, "x");
      types.push(g.bonds[0].type);
    }
    expect(types).toEqual(["double", "triple", "single", "double"]);
    expect(cycleBond(setBondType(base, "x", "wedge"), "x").bonds[0].type).toBe("single");
    expect(cycleBond(base, "nope")).toBe(base);
  });

  it("removes a bond and leaves the atoms", () => {
    const g = two();
    const id = g.bonds[0].id;
    const next = removeBond(g, id);
    expect(next.bonds).toHaveLength(g.bonds.length - 1);
    expect(next.atoms).toBe(g.atoms);
    expect(removeBond(g, "nope")).toBe(g);
  });

  it("deleting a carbon takes the hydrogens that hung on it, and only those", () => {
    const g = recalculateHydrogens({ atoms: [atom("a", "C", 0, 0), atom("b", "C", L, 0)], bonds: [{ id: "x", sourceId: "a", targetId: "b", type: "single", hidden: false }], annotations: [] });
    const next = recalculateHydrogens(removeAtomAndHydrogens(g, "a"));
    expect(next.atoms.filter((a) => !a.auto).map((a) => a.id)).toEqual(["b"]);
    expect(formula(next)).toEqual({ C: 1, H: 4 }); // what is left of the other carbon is methane again
  });

  it("deleting an atom takes its hand-drawn hydrogens too, but not a hydrogen with another bond", () => {
    const g = SAMPLE_MOLECULES.find((s) => s.id === "acetic-acid")!.graph;
    const noMethyl = removeAtomAndHydrogens(g, "a1"); // the CH3: carbon + 3 hydrogens
    expect(noMethyl.atoms.map((a) => a.id).sort()).toEqual(["a2", "a3", "a4", "a5"]);
    expect(removeAtomAndHydrogens(g, "nope")).toBe(g);
    // an H bonded to two atoms stays
    const bridge: MoleculeGraph = { atoms: [atom("c", "C", 0, 0), atom("d", "C", 2 * L, 0), atom("h", "H", L, 0)], bonds: [{ id: "1", sourceId: "c", targetId: "h", type: "single", hidden: false }, { id: "2", sourceId: "d", targetId: "h", type: "single", hidden: false }], annotations: [] };
    expect(removeAtomAndHydrogens(bridge, "c").atoms.map((a) => a.id)).toEqual(["d", "h"]);
  });

  it("the plain removal still removes only the atom and its bonds", () => {
    const g = SAMPLE_MOLECULES.find((s) => s.id === "acetic-acid")!.graph;
    expect(removeAtom(g, "a1").atoms).toHaveLength(7);
  });

  it("claims only automatic atoms", () => {
    const g = recalculateHydrogens({ atoms: [atom("c", "C", 0, 0)], bonds: [], annotations: [] });
    const auto = g.atoms.find((a) => a.auto)!;
    expect(claimAtom(g, auto.id).atoms.find((a) => a.id === auto.id)?.auto).toBe(false);
    expect(claimAtom(g, "c")).toBe(g);
    expect(claimAtom(g, "nope")).toBe(g);
    expect(makeAtom("C", 0, 0).auto).toBeUndefined();
  });
});

describe("planning a bond dragged from an atom", () => {
  const g: MoleculeGraph = { atoms: [atom("a", "C", 0, 0), atom("b", "C", 200, 0), atom("c", "O", L * Math.cos(Math.PI / 6), -L * Math.sin(Math.PI / 6))], bonds: [], annotations: [] };

  it("does nothing while the mouse is still on the atom (it was a click)", () => {
    expect(planBond(g, "a", 0, 0)).toBeNull();
    expect(planBond(g, "a", 10, 8)).toBeNull();
    expect(planBond(g, "nope", 100, 100)).toBeNull();
  });

  it("bonds to the atom under the mouse, even if the mouse is a bit off its centre", () => {
    expect(planBond(g, "a", 200, 0)).toEqual({ end: { x: 200, y: 0 }, targetId: "b" });
    expect(planBond(g, "a", 190, 8)).toEqual({ end: { x: 200, y: 0 }, targetId: "b" });
  });

  it("makes a new atom one bond length away, in the direction of the mouse snapped to 30°", () => {
    const plan = planBond(g, "a", 100, 100 * Math.tan((100 * Math.PI) / 180 / 3.2))!; // about 17° below the x axis → 30°
    expect(plan.targetId).toBeNull();
    const angle = deg(Math.atan2(plan.end.y, plan.end.x));
    expect(angle).toBeCloseTo(30, 0);
    expect(Math.hypot(plan.end.x, plan.end.y)).toBeCloseTo(L, 0);
  });

  it("keeps the new atom one bond length away however far the mouse goes", () => {
    for (const [x, y] of [[300, 5], [-400, 20], [0, 900], [-50, -50]]) {
      const plan = planBond(g, "b", x, y)!;
      expect(Math.hypot(plan.end.x - 200, plan.end.y)).toBeCloseTo(L, 0);
      expect(norm(deg(Math.atan2(plan.end.y, plan.end.x - 200)) + 0.001) % 30).toBeLessThan(0.1);
    }
  });

  it("bonds to an atom that is already where the new one would go, instead of stacking two", () => {
    // the mouse is off to the right at 5° below the axis: snapped to 0°... the O is at -30°, so aim at it
    const plan = planBond(g, "a", 300 * Math.cos(-Math.PI / 7), 300 * Math.sin(-Math.PI / 7))!; // ≈ -25.7° → snaps to -30°
    expect(plan.targetId).toBe("c");
    expect(plan.end.x).toBeCloseTo(L * Math.cos(Math.PI / 6), 5);
  });
});
