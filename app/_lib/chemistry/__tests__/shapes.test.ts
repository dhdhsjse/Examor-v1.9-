import { describe, expect, it } from "vitest";
import { BOND_LENGTH } from "../bondGeometry";
import { chemSegments, layoutChemText } from "../chemText";
import { FRAGMENTS, FRAGMENT_IDS, attachFragment, freeAngle, placeFragment } from "../fragments";
import { ARROW_DEFAULT_WIDTH, ARROW_MIN_WIDTH, drawingBounds, generateRing, ringRadius } from "../geometry";
import { addAnnotationTo, addAtom, connectedAtomIds, makeAnnotation, makeAtom, moveAtom, placeRing, removeAnnotation, removeAtom, translateAtoms, updateAnnotation } from "../graphOps";
import { PERIODIC_TABLE } from "../periodicTable";
import type { AtomNode, MoleculeGraph } from "../types";
import { recalculateHydrogens } from "../valence";

const L = BOND_LENGTH;
const EMPTY: MoleculeGraph = { atoms: [], bonds: [], annotations: [] };
const deg = (rad: number) => (rad * 180) / Math.PI;

const count = (g: MoleculeGraph, el: string) => g.atoms.filter((a) => a.element === el).length;
const formula = (g: MoleculeGraph) => Object.fromEntries([...new Set(g.atoms.map((a) => a.element))].sort().map((e) => [e, count(g, e)]));
function closest(g: MoleculeGraph) {
  let min = Infinity;
  for (let i = 0; i < g.atoms.length; i++) for (let j = i + 1; j < g.atoms.length; j++) min = Math.min(min, Math.hypot(g.atoms[i].x - g.atoms[j].x, g.atoms[i].y - g.atoms[j].y));
  return min;
}
const lone = (element = "C", x = 0, y = 0): MoleculeGraph => recalculateHydrogens({ ...EMPTY, atoms: [{ ...makeAtom(element, x, y), id: "c" }] });
const withGroup = (g: MoleculeGraph, id: keyof typeof FRAGMENTS, target: string) => recalculateHydrogens(attachFragment(g, FRAGMENTS[id], target));
const byId = (g: MoleculeGraph, id: string) => g.atoms.find((a) => a.id === id)!;
const angleBetween = (a: AtomNode, b: AtomNode, c: AtomNode) => {
  // the angle at b between a and c, in degrees
  const u = Math.atan2(a.y - b.y, a.x - b.x);
  const v = Math.atan2(c.y - b.y, c.x - b.x);
  const d = Math.abs(deg(u - v)) % 360;
  return d > 180 ? 360 - d : d;
};

describe("rings", () => {
  it("a hexagon: six carbons on a circle of one bond length, one corner up, sides one bond length", () => {
    const { atoms, bonds } = generateRing(100, 200, 6, false);
    expect(atoms).toHaveLength(6);
    expect(bonds).toHaveLength(6);
    for (const a of atoms) expect(Math.hypot(a.x - 100, a.y - 200)).toBeCloseTo(L, 1);
    expect(atoms[0]).toMatchObject({ x: 100, y: 150 });
    for (const b of bonds) {
      const s = atoms.find((a) => a.id === b.sourceId)!;
      const t = atoms.find((a) => a.id === b.targetId)!;
      expect(Math.hypot(s.x - t.x, s.y - t.y)).toBeCloseTo(L, 1);
    }
    expect(atoms.every((a) => a.element === "C" && a.charge === 0 && !a.hidden)).toBe(true);
  });

  it("a pentagon has sides of one bond length: its circle is smaller than the bond length (the directive's formula was not)", () => {
    expect(ringRadius(5)).toBeCloseTo(L / (2 * Math.sin(Math.PI / 5)));
    expect(ringRadius(5)).toBeLessThan(L);
    expect(ringRadius(6)).toBeCloseTo(L);
    const { atoms, bonds } = generateRing(0, 0, 5, false);
    for (const b of bonds) {
      const s = atoms.find((a) => a.id === b.sourceId)!;
      const t = atoms.find((a) => a.id === b.targetId)!;
      expect(Math.hypot(s.x - t.x, s.y - t.y)).toBeCloseTo(L, 1);
    }
  });

  it("benzene alternates double and single bonds: three doubles, never two on one carbon", () => {
    const { atoms, bonds } = generateRing(0, 0, 6, true);
    expect(bonds.map((b) => b.type)).toEqual(["double", "single", "double", "single", "double", "single"]);
    for (const a of atoms) expect(bonds.filter((b) => b.type === "double" && (b.sourceId === a.id || b.targetId === a.id))).toHaveLength(1);
  });

  it("an odd ring cannot alternate: it stays single-bonded", () => {
    expect(generateRing(0, 0, 5, true).bonds.every((b) => b.type === "single")).toBe(true);
  });

  it("makes nothing for fewer than three sides", () => {
    expect(generateRing(0, 0, 2, false)).toEqual({ atoms: [], bonds: [] });
    expect(generateRing(0, 0, 5.5, false)).toEqual({ atoms: [], bonds: [] });
  });

  it("gives every ring atom its own id", () => {
    const ids = generateRing(0, 0, 6, false).atoms.map((a) => a.id);
    expect(new Set(ids).size).toBe(6);
    expect(new Set([...ids, ...generateRing(0, 0, 6, false).atoms.map((a) => a.id)]).size).toBe(12);
  });

  const placed = (sides: number, aromatic: boolean) => recalculateHydrogens(placeRing(EMPTY, { sides, isAromatic: aromatic }, 0, 0));

  it("the hydrogens fill the ring: C6H12, C6H6 (benzene) and C5H10", () => {
    expect(formula(placed(6, false))).toEqual({ C: 6, H: 12 });
    expect(formula(placed(6, true))).toEqual({ C: 6, H: 6 });
    expect(formula(placed(5, false))).toEqual({ C: 5, H: 10 });
  });

  it("all hydrogens are outside the ring and nothing is on top of anything", () => {
    for (const [sides, aromatic] of [[6, false], [6, true], [5, false]] as const) {
      const g = placed(sides, aromatic);
      for (const h of g.atoms.filter((a) => a.element === "H")) expect(Math.hypot(h.x, h.y)).toBeGreaterThan(ringRadius(sides) + L * 0.7);
      expect(closest(g)).toBeGreaterThan(L * 0.95); // a regular drawing: every neighbouring pair is one bond length apart
    }
  });

  it("can be placed more than once (ids never clash)", () => {
    let g = placeRing(EMPTY, { sides: 6, isAromatic: true }, 0, 0);
    g = placeRing(g, { sides: 6, isAromatic: true }, 300, 0);
    g = recalculateHydrogens(g);
    expect(new Set(g.atoms.map((a) => a.id)).size).toBe(g.atoms.length);
    expect(formula(g)).toEqual({ C: 12, H: 12 });
  });

  it("a whole ring moves together and its bonds are unchanged", () => {
    const g = placeRing(EMPTY, { sides: 6, isAromatic: true }, 0, 0);
    const ids = connectedAtomIds(g, g.atoms[2].id);
    expect(ids.size).toBe(6);
    const moved = translateAtoms(g, ids, 40, -10);
    expect(moved.bonds).toBe(g.bonds);
    moved.atoms.forEach((a, i) => {
      expect(a.x).toBeCloseTo(g.atoms[i].x + 40);
      expect(a.y).toBeCloseTo(g.atoms[i].y - 10);
    });
  });
});

describe("molecules as groups of atoms", () => {
  const two = (): MoleculeGraph => {
    let g = placeRing(EMPTY, { sides: 6, isAromatic: false }, 0, 0);
    g = placeRing(g, { sides: 5, isAromatic: false }, 500, 0);
    return g;
  };

  it("finds the atoms of one molecule only", () => {
    const g = two();
    expect(connectedAtomIds(g, g.atoms[0].id).size).toBe(6);
    expect(connectedAtomIds(g, g.atoms[7].id).size).toBe(5);
    expect(connectedAtomIds(g, "nope").size).toBe(0);
  });

  it("includes the hydrogens (they are bonded)", () => {
    const g = recalculateHydrogens(two());
    expect(connectedAtomIds(g, g.atoms[0].id).size).toBe(18);
  });

  it("moves the chosen atoms and nothing else, without changing the graph it is given", () => {
    const g = two();
    const ids = connectedAtomIds(g, g.atoms[0].id);
    const moved = translateAtoms(g, ids, 10, 20);
    expect(moved.atoms.slice(6)).toEqual(g.atoms.slice(6));
    expect(g.atoms[0].x).toBeCloseTo(0);
    expect(translateAtoms(g, ids, 0, 0)).toBe(g);
    expect(translateAtoms(g, new Set(), 5, 5)).toBe(g);
  });
});

describe("functional groups", () => {
  it("are well formed: first atom at the origin, valid bonds, known elements, listed for the toolbar", () => {
    expect([...FRAGMENT_IDS].sort()).toEqual(Object.keys(FRAGMENTS).sort());
    for (const f of Object.values(FRAGMENTS)) {
      expect(f.atoms[0]).toMatchObject({ x: 0, y: 0 });
      for (const a of f.atoms) expect(PERIODIC_TABLE[a.element]).toBeDefined();
      for (const b of f.bonds) {
        expect(f.atoms[b.from]).toBeDefined();
        expect(f.atoms[b.to]).toBeDefined();
      }
      expect(f.label.length).toBeGreaterThan(1);
    }
  });

  it("-OH on a carbon makes methanol", () => {
    const g = withGroup(lone(), "oh", "c");
    expect(formula(g)).toEqual({ C: 1, H: 4, O: 1 });
    const o = g.atoms.find((a) => a.element === "O")!;
    expect(Math.hypot(o.x, o.y)).toBeCloseTo(L, 1);
    expect(g.bonds.some((b) => [b.sourceId, b.targetId].includes("c") && [b.sourceId, b.targetId].includes(o.id) && b.type === "single")).toBe(true);
  });

  it("the other groups make the molecules they should", () => {
    expect(formula(withGroup(lone(), "nh2", "c"))).toEqual({ C: 1, H: 5, N: 1 }); // methylamine
    expect(formula(withGroup(lone(), "cho", "c"))).toEqual({ C: 2, H: 4, O: 1 }); // ethanal
    expect(formula(withGroup(lone(), "cooh", "c"))).toEqual({ C: 2, H: 4, O: 2 }); // ethanoic acid
    expect(formula(withGroup(lone(), "ch3", "c"))).toEqual({ C: 2, H: 6 }); // ethane
  });

  it("-COOH has a C=O and a C-OH, and the hydrogen is on the single-bonded oxygen", () => {
    const g = withGroup(lone(), "cooh", "c");
    const carboxyl = g.atoms.find((a) => a.element === "C" && a.id !== "c")!;
    const bondsOf = g.bonds.filter((b) => [b.sourceId, b.targetId].includes(carboxyl.id));
    const toO = bondsOf.map((b) => ({ type: b.type, o: byId(g, b.sourceId === carboxyl.id ? b.targetId : b.sourceId) })).filter((x) => x.o.element === "O");
    expect(toO.map((x) => x.type).sort()).toEqual(["double", "single"]);
    const hOn = (id: string) => g.bonds.filter((b) => b.sourceId === id && byId(g, b.targetId).element === "H").length;
    expect(hOn(toO.find((x) => x.type === "single")!.o.id)).toBe(1);
    expect(hOn(toO.find((x) => x.type === "double")!.o.id)).toBe(0);
  });

  it("groups are not drawn on top of anything", () => {
    for (const id of FRAGMENT_IDS) expect(closest(withGroup(lone(), id, "c")), id).toBeGreaterThan(L * 0.55);
  });

  it("clicking a hydrogen replaces it, in exactly that hydrogen's place", () => {
    const g = lone();
    const h = g.atoms.find((a) => a.element === "H" && a.y < -L * 0.9)!; // the one straight up
    const next = withGroup(g, "oh", h.id);
    expect(formula(next)).toEqual({ C: 1, H: 4, O: 1 });
    const o = next.atoms.find((a) => a.element === "O")!;
    expect(o.x).toBeCloseTo(h.x, 1);
    expect(o.y).toBeCloseTo(h.y, 1);
  });

  it("replaces a hydrogen that was drawn by hand too (not only automatic ones)", () => {
    const acetic = recalculateHydrogens({ atoms: [makeAtom("C", 0, 0), makeAtom("H", 0, -L)].map((a, i) => ({ ...a, id: ["c", "h"][i] })), bonds: [{ id: "b", sourceId: "c", targetId: "h", type: "single", hidden: false }], annotations: [] });
    const next = withGroup(acetic, "oh", "h");
    expect(next.atoms.find((a) => a.id === "h")).toBeUndefined();
    const o = next.atoms.find((a) => a.element === "O")!;
    expect(o.x).toBeCloseTo(0, 1);
    expect(o.y).toBeCloseTo(-L, 1);
    expect(formula(next)).toEqual({ C: 1, H: 4, O: 1 });
  });

  it("a substituent on a ring carbon points straight out of the ring (benzoic acid)", () => {
    const ring = recalculateHydrogens(placeRing(EMPTY, { sides: 6, isAromatic: true }, 0, 0));
    const top = ring.atoms.find((a) => a.element === "C" && Math.abs(a.x) < 0.5 && a.y < 0)!;
    const g = withGroup(ring, "cooh", top.id);
    expect(formula(g)).toEqual({ C: 7, H: 6, O: 2 });
    const carboxyl = g.atoms.find((a) => a.element === "C" && !ring.atoms.some((r) => r.id === a.id))!;
    expect(carboxyl.x).toBeCloseTo(0, 0);
    expect(carboxyl.y).toBeCloseTo(top.y - L, 0);
    expect(closest(g)).toBeGreaterThan(L * 0.55);
  });

  it("a chain made of methyl groups zigzags at 120° and does not fold back on itself", () => {
    let g = lone();
    let last = "c";
    for (let i = 0; i < 4; i++) {
      const before = new Set(g.atoms.map((a) => a.id));
      g = withGroup(g, "ch3", last);
      last = g.atoms.find((a) => !before.has(a.id) && a.element === "C")!.id;
    }
    const carbons = g.atoms.filter((a) => a.element === "C");
    expect(carbons).toHaveLength(5);
    expect(formula(g)).toEqual({ C: 5, H: 12 }); // pentane
    for (let i = 1; i < carbons.length - 1; i++) expect(angleBetween(carbons[i - 1], carbons[i], carbons[i + 1])).toBeCloseTo(120, 0);
    expect(closest(g)).toBeGreaterThan(L * 0.7); // the hydrogens along a zigzag are the closest things, ≈ 37 units
  });

  it("takes the side that has room", () => {
    // a first bond from the carbon to the west; a blocker where the upper bend would put the next atom
    const base = recalculateHydrogens({ atoms: [{ ...makeAtom("C", 0, 0), id: "c" }, { ...makeAtom("C", -L, 0), id: "w" }], bonds: [{ id: "b", sourceId: "c", targetId: "w", type: "single", hidden: false }], annotations: [] });
    const upper = base.atoms.length; // (the angle the +120° bend would take)
    expect(upper).toBeGreaterThan(0);
    const angle = freeAngle(base, "c");
    const blockerAt = { x: L * Math.cos(angle), y: L * Math.sin(angle) };
    const blocked = recalculateHydrogens(addAtom(base, { ...makeAtom("Cl", blockerAt.x, blockerAt.y), id: "block" }));
    const free = freeAngle(blocked, "c");
    expect(Math.abs(Math.sin((free - angle) / 2))).toBeGreaterThan(0.5); // went to the other side
  });

  it("puts a single oxygen where there is room (-CHO beside a blocker)", () => {
    const base = lone();
    const blockedUp = recalculateHydrogens(addAtom(base, { ...makeAtom("Cl", L + L / 2, -L * (Math.sqrt(3) / 2)), id: "block", auto: false }));
    const g = withGroup(blockedUp, "cho", "c");
    const o = g.atoms.find((a) => a.element === "O")!;
    expect(o.y).toBeGreaterThan(0);
  });

  it("does nothing for an atom that is not there, or a hydrogen without exactly one bond", () => {
    const g = lone();
    expect(attachFragment(g, FRAGMENTS.oh, "nope")).toBe(g);
    const loose = addAtom(EMPTY, { ...makeAtom("H", 0, 0), id: "h" });
    expect(attachFragment(loose, FRAGMENTS.oh, "h")).toBe(loose);
  });

  it("a group can be placed on its own: its first atom exactly where it is put", () => {
    const g = recalculateHydrogens(placeFragment(EMPTY, FRAGMENTS.cooh, 100, 60));
    expect(formula(g)).toEqual({ C: 1, H: 2, O: 2 }); // methanoic acid
    const carbon = g.atoms.find((a) => a.element === "C")!;
    expect(carbon).toMatchObject({ x: 100, y: 60 });
  });
});

describe("texts and arrows", () => {
  it("makes an empty text and an arrow of the usual length", () => {
    expect(makeAnnotation("text", 20, 40)).toMatchObject({ type: "text", x: 20, y: 40, text: "" });
    expect(makeAnnotation("arrow", 0, 0)).toMatchObject({ type: "arrow", width: ARROW_DEFAULT_WIDTH, text: "" });
    expect(makeAnnotation("text", 0, 0).width).toBeUndefined();
    expect(makeAnnotation("text", 0, 0).id).not.toBe(makeAnnotation("text", 0, 0).id);
  });

  it("adds, changes and removes them in new graphs", () => {
    const note = makeAnnotation("text", 5, 5);
    const g = addAnnotationTo(EMPTY, note);
    expect(g.annotations).toEqual([note]);
    expect(EMPTY.annotations).toEqual([]);
    const edited = updateAnnotation(g, note.id, { text: "H2O", x: 9 });
    expect(edited.annotations[0]).toMatchObject({ text: "H2O", x: 9, y: 5, type: "text" });
    expect(g.annotations[0].text).toBe("");
    expect(removeAnnotation(edited, note.id).annotations).toEqual([]);
  });

  it("ignores an unknown id", () => {
    const g = addAnnotationTo(EMPTY, makeAnnotation("text", 0, 0));
    expect(updateAnnotation(g, "nope", { text: "x" })).toBe(g);
    expect(removeAnnotation(g, "nope")).toBe(g);
  });

  it("never lets an arrow get shorter than the minimum", () => {
    const arrow = makeAnnotation("arrow", 0, 0);
    const g = addAnnotationTo(EMPTY, arrow);
    expect(updateAnnotation(g, arrow.id, { width: 3 }).annotations[0].width).toBe(ARROW_MIN_WIDTH);
    expect(updateAnnotation(g, arrow.id, { width: 250 }).annotations[0].width).toBe(250);
  });

  it("survive every edit of the molecule (none of them rebuilds the graph without them)", () => {
    const note = makeAnnotation("arrow", 10, 10);
    let g = addAnnotationTo(EMPTY, note);
    g = addAtom(g, { ...makeAtom("C", 0, 0), id: "c" });
    g = recalculateHydrogens(g);
    expect(g.annotations).toEqual([note]);
    g = moveAtom(g, "c", 5, 5);
    expect(g.annotations).toEqual([note]);
    g = recalculateHydrogens(placeRing(g, { sides: 6, isAromatic: true }, 200, 0));
    expect(g.annotations).toEqual([note]);
    g = recalculateHydrogens(attachFragment(g, FRAGMENTS.oh, "c"));
    expect(g.annotations).toEqual([note]);
    g = removeAtom(g, "c");
    expect(g.annotations).toEqual([note]);
  });

  it("are inside the box of the drawing, so that 'fit' shows them", () => {
    expect(drawingBounds(EMPTY)).toBeNull();
    const g = addAnnotationTo(addAtom(EMPTY, { ...makeAtom("C", 0, 0), id: "c" }), { ...makeAnnotation("arrow", 300, 40), width: 120 });
    const b = drawingBounds(g)!;
    expect(b.minX).toBe(0);
    expect(b.maxX).toBe(420);
    expect(b.minY).toBeLessThan(40); // the label above the arrow
    expect(drawingBounds(addAnnotationTo(EMPTY, { ...makeAnnotation("text", 50, 50), text: "Hello" }))!.maxX).toBeGreaterThan(50);
  });
});

describe("chemistry text", () => {
  const segs = (raw: string) => chemSegments(raw).map((s) => `${s.kind === "normal" ? "" : s.kind + ":"}${s.text}`);

  it("writes digits after a letter as subscripts", () => {
    expect(segs("H2SO4")).toEqual(["H", "sub:2", "SO", "sub:4"]);
    expect(segs("Ac2O")).toEqual(["Ac", "sub:2", "O"]);
    expect(segs("C6H12O6")).toEqual(["C", "sub:6", "H", "sub:12", "O", "sub:6"]);
    expect(segs("CH3COOH")).toEqual(["CH", "sub:3", "COOH"]);
    expect(segs("(NH4)2SO4")).toEqual(["(NH", "sub:4", ")", "sub:2", "SO", "sub:4"]);
  });

  it("leaves other digits alone", () => {
    expect(segs("2 H2O")).toEqual(["2 H", "sub:2", "O"]);
    expect(segs("1,2-dibromo")).toEqual(["1,2-dibromo"]);
    expect(segs("cis-2-butene")).toEqual(["cis-2-butene"]);
  });

  it("writes a charge as a superscript, with a real minus sign", () => {
    expect(segs("H+")).toEqual(["H", "sup:+"]);
    expect(segs("OH-")).toEqual(["OH", "sup:−"]);
    expect(segs("Fe2+")).toEqual(["Fe", "sup:2+"]);
    expect(segs("SO42-")).toEqual(["SO", "sub:4", "sup:2−"]);
    expect(segs("Na+ + Cl-")).toEqual(["Na", "sup:+", " + Cl", "sup:−"]);
    expect(segs("H+/H2O")).toEqual(["H", "sup:+", "/H", "sub:2", "O"]);
  });

  it("leaves a plus, a minus or an arrow between things alone", () => {
    expect(segs("+")).toEqual(["+"]);
    expect(segs("A + B")).toEqual(["A + B"]);
    expect(segs("->")).toEqual(["->"]);
    expect(segs("CH3-CH3")).toEqual(["CH", "sub:3", "-CH", "sub:3"]);
    expect(segs("Δ")).toEqual(["Δ"]);
    expect(segs("")).toEqual([]);
  });

  it("joins neighbours of the same kind", () => {
    expect(chemSegments("abc").length).toBe(1);
  });

  it("lays the pieces out one after the other, subscripts lower and superscripts higher", () => {
    const measure = (text: string, size: number) => text.length * size * 0.5;
    const { items, width } = layoutChemText("H2O+", 20, measure);
    expect(items.map((i) => i.text)).toEqual(["H", "2", "O", "+"]);
    expect(items.map((i) => i.x)).toEqual([0, 10, 17, 27]);
    expect(width).toBeCloseTo(34);
    const [normal, sub, , sup] = items;
    expect(normal.y).toBe(0);
    expect(sub.y).toBeGreaterThan(sup.y);
    expect(sup.y).toBeLessThan(sub.y);
    expect(sub.fontSize).toBeLessThan(normal.fontSize);
    expect(sup.fontSize).toBe(sub.fontSize);
  });
});
