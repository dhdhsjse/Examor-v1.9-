import { describe, expect, it } from "vitest";
import { elementOrder, formulaSegments, formulaText, molarMass, moleculesOf } from "../formula";
import { addAnnotationTo, addAtom, makeAnnotation, makeAtom, placeRing } from "../graphOps";
import { SAMPLE_MOLECULES } from "../samples";
import {
  EMPTY_SELECTION,
  copySelection,
  countOf,
  deleteSelection,
  isEmpty,
  only,
  pasteClipboard,
  prune,
  reverseBonds,
  selectAll,
  selectInRect,
  setBondTypes,
  setCharge,
  setElement,
  toggle,
  translateGroup,
  union,
} from "../selection";
import type { AtomNode, MoleculeGraph } from "../types";
import { effectiveValence, recalculateHydrogens } from "../valence";

const EMPTY: MoleculeGraph = { atoms: [], bonds: [], annotations: [] };
const atom = (id: string, element: string, x: number, y: number, extra: Partial<AtomNode> = {}): AtomNode => ({ ...makeAtom(element, x, y), id, ...extra });
const acetic = () => SAMPLE_MOLECULES.find((s) => s.id === "acetic-acid")!.graph;
const count = (g: MoleculeGraph, el: string) => g.atoms.filter((a) => a.element === el).length;
const lone = (element: string, charge = 0) => recalculateHydrogens({ ...EMPTY, atoms: [atom("x", element, 0, 0, { charge })] });
const hydrogensOn = (g: MoleculeGraph, id: string) => g.bonds.filter((b) => b.sourceId === id && g.atoms.find((a) => a.id === b.targetId)?.element === "H").length;
const formulaOf = (g: MoleculeGraph) => moleculesOf(g).map((m) => formulaText(m.counts, m.charge));

describe("charges and valence", () => {
  it("moves the valence by the charge, as chemistry does", () => {
    const cases: [string, number, number][] = [
      ["N", 0, 3], ["N", 1, 4], ["N", -1, 2], ["N", -5, 0],
      ["O", 0, 2], ["O", 1, 3], ["O", -1, 1],
      ["Cl", 0, 1], ["Cl", 1, 2], ["Cl", -1, 0],
      ["C", 0, 4], ["C", 1, 3], ["C", -1, 3], ["C", 2, 2],
      ["B", 0, 3], ["B", -1, 4], ["B", 1, 2],
      ["Na", 1, 0], ["Ca", 2, 0], ["Fe", 3, 0], ["Xx", 0, 0],
    ];
    for (const [el, q, v] of cases) expect(effectiveValence(el, q), `${el}${q}`).toBe(v);
  });

  it("makes the hydrogens of the famous ions", () => {
    expect(hydrogensOn(lone("N", 1), "x")).toBe(4); // NH4+
    expect(hydrogensOn(lone("O", 1), "x")).toBe(3); // H3O+
    expect(hydrogensOn(lone("O", -1), "x")).toBe(1); // OH-
    expect(hydrogensOn(lone("N", -1), "x")).toBe(2); // NH2-
    expect(hydrogensOn(lone("B", -1), "x")).toBe(4); // BH4-
    expect(hydrogensOn(lone("C", 1), "x")).toBe(3); // CH3+
    expect(hydrogensOn(lone("C", -1), "x")).toBe(3); // CH3-
  });

  it("gives none to a halide ion or a metal ion", () => {
    expect(count(lone("Cl", -1), "H")).toBe(0);
    expect(count(lone("Na", 1), "H")).toBe(0);
    expect(count(lone("Ca", 2), "H")).toBe(0);
  });

  it("turns ammonia into ammonium when the nitrogen gets a charge (the hydrogens are remade)", () => {
    const ammonia = lone("N");
    expect(hydrogensOn(ammonia, "x")).toBe(3);
    const ammonium = recalculateHydrogens(setCharge(ammonia, ["x"], 1));
    expect(hydrogensOn(ammonium, "x")).toBe(4);
    expect(formulaOf(ammonium)).toEqual(["NH4+"]);
    expect(formulaOf(recalculateHydrogens(setCharge(ammonium, ["x"], 0)))).toEqual(["NH3"]);
  });
});

describe("formulas", () => {
  const f = (counts: Record<string, number>, charge = 0) => formulaText(counts, charge);

  it("writes organic molecules in the Hill order", () => {
    expect(f({ H: 4, C: 1 })).toBe("CH4");
    expect(f({ O: 1, H: 6, C: 2 })).toBe("C2H6O");
    expect(f({ O: 6, C: 6, H: 12 })).toBe("C6H12O6");
    expect(f({ O: 2, C: 1 })).toBe("CO2");
    expect(f({ Cl: 4, C: 1 })).toBe("CCl4");
    expect(f({ N: 1, C: 1, H: 1 })).toBe("CHN");
    expect(f({ O: 2, N: 4, C: 8, H: 10 })).toBe("C8H10N4O2");
  });

  it("writes hydrides and acids as school books do", () => {
    expect(f({ H: 3, N: 1 })).toBe("NH3");
    expect(f({ H: 3, P: 1 })).toBe("PH3");
    expect(f({ H: 4, Si: 1 })).toBe("SiH4");
    expect(f({ H: 3, B: 1 })).toBe("BH3");
    expect(f({ H: 2, O: 1 })).toBe("H2O");
    expect(f({ H: 2, S: 1 })).toBe("H2S");
    expect(f({ H: 1, Cl: 1 })).toBe("HCl");
    expect(f({ H: 1, F: 1 })).toBe("HF");
    expect(f({ O: 4, S: 1, H: 2 })).toBe("H2SO4");
    expect(f({ O: 3, N: 1, H: 1 })).toBe("HNO3");
    expect(f({ O: 4, P: 1, H: 3 })).toBe("H3PO4");
    expect(f({ Cl: 1, N: 1, H: 4 })).toBe("NH4Cl");
    expect(f({ H: 2, O: 1 }, 0)).toBe("H2O");
    expect(f({ H: 3, O: 1 }, 1)).toBe("H3O+");
  });

  it("writes salts and hydroxides metal first", () => {
    expect(f({ Cl: 1, Na: 1 })).toBe("NaCl");
    expect(f({ Cl: 2, Mg: 1 })).toBe("MgCl2");
    expect(f({ O: 3, Al: 2 })).toBe("Al2O3");
    expect(f({ H: 1, Na: 1 })).toBe("NaH");
    expect(f({ H: 2, Ca: 1 })).toBe("CaH2");
    expect(f({ O: 4, S: 1, Na: 2 })).toBe("Na2SO4");
    expect(f({ H: 1, O: 1, Na: 1 })).toBe("NaOH");
  });

  it("puts the charge after it, as a superscript", () => {
    expect(f({ H: 4, N: 1 }, 1)).toBe("NH4+");
    expect(f({ H: 1, O: 1 }, -1)).toBe("OH−");
    expect(f({ O: 4, S: 1 }, -2)).toBe("SO4" + "2−");
    const segments = formulaSegments({ H: 4, N: 1 }, 1);
    expect(segments).toEqual([{ text: "N", kind: "normal" }, { text: "H", kind: "normal" }, { text: "4", kind: "sub" }, { text: "+", kind: "sup" }]);
  });

  it("orders the elements without changing the counts", () => {
    expect(elementOrder({ C: 2, H: 6, O: 1 })).toEqual(["C", "H", "O"]);
    expect(elementOrder({ H: 0, C: 1 })).toEqual(["C"]);
  });

  it("gives the molar mass in g/mol", () => {
    expect(molarMass({ H: 2, O: 1 })).toBeCloseTo(18.015, 2);
    expect(molarMass({ C: 2, H: 4, O: 2 })).toBeCloseTo(60.052, 2);
    expect(molarMass({ Xx: 5 })).toBe(0);
  });
});

describe("the molecules of a drawing", () => {
  it("finds acetic acid as one molecule: C2H4O2", () => {
    const [m, ...rest] = moleculesOf(acetic());
    expect(rest).toHaveLength(0);
    expect(m.atomIds).toHaveLength(8);
    expect(formulaText(m.counts, m.charge)).toBe("C2H4O2");
    expect(m.mass).toBeCloseTo(60.05, 1);
  });

  it("separates what is not bonded", () => {
    let g = recalculateHydrogens(placeRing(EMPTY, { sides: 6, isAromatic: true }, 0, 0));
    g = recalculateHydrogens(addAtom(g, atom("w", "O", 400, 0)));
    expect(formulaOf(g)).toEqual(["C6H6", "H2O"]);
  });

  it("counts the charge of a molecule", () => {
    const [m] = moleculesOf(lone("N", 1));
    expect(m.charge).toBe(1);
    expect(m.counts).toEqual({ N: 1, H: 4 });
  });

  it("is nothing for an empty drawing", () => {
    expect(moleculesOf(EMPTY)).toEqual([]);
  });

  it("copes with a bond to an atom that is not there", () => {
    const g: MoleculeGraph = { ...EMPTY, atoms: [atom("a", "C", 0, 0)], bonds: [{ id: "b", sourceId: "a", targetId: "gone", type: "single", hidden: false }] };
    expect(moleculesOf(g)).toHaveLength(1);
  });
});

describe("selecting", () => {
  it("selects one thing, adds with Shift, takes away with Shift", () => {
    let s = only("atoms", "a");
    expect(countOf(s)).toBe(1);
    s = toggle(s, "atoms", "b");
    s = toggle(s, "bonds", "x");
    expect(s).toEqual({ atoms: ["a", "b"], bonds: ["x"], notes: [] });
    s = toggle(s, "atoms", "a");
    expect(s.atoms).toEqual(["b"]);
    expect(isEmpty(EMPTY_SELECTION)).toBe(true);
    expect(isEmpty(s)).toBe(false);
  });

  it("joins two selections without repeating", () => {
    expect(union({ atoms: ["a", "b"], bonds: [], notes: [] }, { atoms: ["b", "c"], bonds: ["x"], notes: ["n"] })).toEqual({ atoms: ["a", "b", "c"], bonds: ["x"], notes: ["n"] });
  });

  it("forgets what is gone, and keeps the same object when nothing is", () => {
    const g = acetic();
    const s = { atoms: ["a1", "ghost"], bonds: ["b1", "ghost"], notes: ["ghost"] };
    expect(prune(s, g)).toEqual({ atoms: ["a1"], bonds: ["b1"], notes: [] });
    const fine = only("atoms", "a1");
    expect(prune(fine, g)).toBe(fine);
  });

  it("selects everything", () => {
    const g = addAnnotationTo(acetic(), makeAnnotation("text", 0, 0));
    const s = selectAll(g);
    expect([s.atoms.length, s.bonds.length, s.notes.length]).toEqual([8, 7, 1]);
  });

  it("a rubber band takes the atoms and texts inside, and the bonds between two of those atoms", () => {
    const g = addAnnotationTo(acetic(), { ...makeAnnotation("text", 200, 200), text: "far" });
    // acetic acid: a2 (0,0), a3 (0,-50), a4 (43.3,25), a1 (-43.3,25)
    const s = selectInRect(g, { x0: -10, y0: -60, x1: 60, y1: 40 });
    expect(s.atoms.sort()).toEqual(["a2", "a3", "a4"]);
    expect(s.bonds.sort()).toEqual(["b2", "b3"]); // a2=a3 and a2-a4; not a4-a5 (a5 is outside)
    expect(s.notes).toEqual([]);
    expect(selectInRect(g, { x0: 190, y0: 190, x1: 210, y1: 210 }).notes).toHaveLength(1);
  });

  it("does not care from which corner the band was drawn", () => {
    const g = acetic();
    expect(selectInRect(g, { x0: 60, y0: 40, x1: -10, y1: -60 }).atoms.sort()).toEqual(["a2", "a3", "a4"]);
  });
});

describe("editing a selection", () => {
  it("deletes atoms with their bonds and the hydrogens that hung on them", () => {
    const g = acetic();
    const next = deleteSelection(g, { atoms: ["a1"], bonds: [], notes: [] }); // the methyl: carbon + 3 hydrogens
    expect(next.atoms.map((a) => a.id).sort()).toEqual(["a2", "a3", "a4", "a5"]);
  });

  it("deletes atoms, bonds and texts in one go, and two atoms that share a bond", () => {
    let g = acetic();
    g = addAnnotationTo(g, makeAnnotation("arrow", 0, 100));
    const noteId = g.annotations[0].id;
    const next = deleteSelection(g, { atoms: ["a2", "a3"], bonds: ["b5"], notes: [noteId] });
    expect(next.annotations).toEqual([]);
    expect(next.atoms.some((a) => a.id === "a2" || a.id === "a3")).toBe(false);
    expect(next.bonds.some((b) => b.id === "b5")).toBe(false);
    expect(next.bonds.every((b) => next.atoms.some((a) => a.id === b.sourceId) && next.atoms.some((a) => a.id === b.targetId))).toBe(true);
  });

  it("deleting nothing gives the same graph back", () => {
    const g = acetic();
    expect(deleteSelection(g, EMPTY_SELECTION)).toBe(g);
  });

  it("changes the element of atoms, and makes the hydrogens fit (OH → SH)", () => {
    const g = acetic();
    const next = recalculateHydrogens(setElement(g, ["a4"], "S"));
    expect(next.atoms.find((a) => a.id === "a4")?.element).toBe("S");
    expect(count(next, "S")).toBe(1);
    expect(g.atoms.find((a) => a.id === "a4")?.element).toBe("O");
  });

  it("replaces an automatic hydrogen by another element, which then stays (CH4 → CH3Cl)", () => {
    const g = lone("C");
    const h = g.atoms.find((a) => a.auto)!;
    const next = recalculateHydrogens(setElement(g, [h.id], "Cl"));
    expect(count(next, "Cl")).toBe(1);
    expect(count(next, "H")).toBe(3);
    expect(next.atoms.find((a) => a.id === h.id)).toMatchObject({ element: "Cl", auto: false });
    expect(formulaOf(next)).toEqual(["CH3Cl"]);
  });

  it("ignores an unknown element, no change, or no atoms", () => {
    const g = acetic();
    expect(setElement(g, ["a1"], "Xx")).toBe(g);
    expect(setElement(g, ["a1"], "C")).toBe(g);
    expect(setElement(g, [], "N")).toBe(g);
  });

  it("charges atoms, within −4 and +4", () => {
    const g = lone("N");
    expect(setCharge(g, ["x"], 2).atoms.find((a) => a.id === "x")?.charge).toBe(2);
    expect(setCharge(g, ["x"], 9).atoms.find((a) => a.id === "x")?.charge).toBe(4);
    expect(setCharge(g, ["x"], -9).atoms.find((a) => a.id === "x")?.charge).toBe(-4);
    expect(setCharge(g, ["x"], 0)).toBe(g);
  });

  it("changes the type of several bonds at once, and turns them round", () => {
    const g = acetic();
    const next = setBondTypes(g, ["b1", "b3"], "wedge");
    expect(next.bonds.filter((b) => b.type === "wedge").map((b) => b.id).sort()).toEqual(["b1", "b3"]);
    expect(setBondTypes(g, ["b2"], "double")).toBe(g); // it already is
    const turned = reverseBonds(g, ["b1"]);
    expect(turned.bonds.find((b) => b.id === "b1")).toMatchObject({ sourceId: "a2", targetId: "a1" });
    expect(reverseBonds(g, ["nope"])).toBe(g);
  });

  it("moves atoms and texts together", () => {
    let g = acetic();
    g = addAnnotationTo(g, { ...makeAnnotation("text", 10, 10), text: "x" });
    const note = g.annotations[0].id;
    const next = translateGroup(g, new Set(["a1", "a2"]), new Set([note]), 5, -7);
    expect(next.atoms.find((a) => a.id === "a2")).toMatchObject({ x: 5, y: -7 });
    expect(next.atoms.find((a) => a.id === "a3")).toMatchObject({ x: 0, y: -50 });
    expect(next.annotations[0]).toMatchObject({ x: 15, y: 3 });
    expect(translateGroup(g, new Set(), new Set(), 5, 5)).toBe(g);
    expect(translateGroup(g, new Set(["a1"]), new Set(), 0, 0)).toBe(g);
  });
});

describe("copy and paste", () => {
  const phenolish = () => {
    let g = recalculateHydrogens(placeRing(EMPTY, { sides: 6, isAromatic: true }, 0, 0));
    g = addAnnotationTo(g, { ...makeAnnotation("text", 100, 0), text: "H2O" });
    return g;
  };

  it("copies atoms, the bonds between them and the texts; not the automatic hydrogens", () => {
    const g = phenolish();
    const ring = g.atoms.filter((a) => !a.auto).map((a) => a.id);
    const clip = copySelection(g, { atoms: g.atoms.map((a) => a.id), bonds: [], notes: [g.annotations[0].id] })!;
    expect(clip.atoms.map((a) => a.id).sort()).toEqual([...ring].sort());
    expect(clip.bonds).toHaveLength(6);
    expect(clip.annotations).toHaveLength(1);
  });

  it("copies nothing when nothing can be copied", () => {
    expect(copySelection(phenolish(), EMPTY_SELECTION)).toBeNull();
    const g = lone("C");
    expect(copySelection(g, { atoms: g.atoms.filter((a) => a.auto).map((a) => a.id), bonds: [], notes: [] })).toBeNull();
  });

  it("pastes a copy moved by an offset, with new ids, and selects it", () => {
    const g = phenolish();
    const clip = copySelection(g, selectAll(g))!;
    const { graph, selection } = pasteClipboard(g, clip, 40, 40);
    expect(graph.atoms.length).toBe(g.atoms.length + clip.atoms.length);
    expect(new Set(graph.atoms.map((a) => a.id)).size).toBe(graph.atoms.length);
    expect(new Set(graph.bonds.map((b) => b.id)).size).toBe(graph.bonds.length);
    expect(selection.atoms).toHaveLength(clip.atoms.length);
    expect(selection.notes).toHaveLength(1);
    const first = graph.atoms.find((a) => a.id === selection.atoms[0])!;
    expect(first.x).toBeCloseTo(clip.atoms[0].x + 40);
    expect(first.y).toBeCloseTo(clip.atoms[0].y + 40);
    expect(graph.annotations[1]).toMatchObject({ x: 140, y: 40, text: "H2O" });
    for (const b of graph.bonds) {
      expect(graph.atoms.some((a) => a.id === b.sourceId)).toBe(true);
      expect(graph.atoms.some((a) => a.id === b.targetId)).toBe(true);
    }
  });

  it("a pasted ring gets its own hydrogens: two benzenes", () => {
    const g = phenolish();
    const { graph } = pasteClipboard(g, copySelection(g, selectAll(g))!, 200, 0);
    expect(formulaOf(recalculateHydrogens(graph))).toEqual(["C6H6", "C6H6"]);
  });

  it("can be pasted again, and the copy does not follow later changes of the drawing", () => {
    const g = acetic();
    const clip = copySelection(g, selectAll(g))!;
    const once = pasteClipboard(g, clip, 100, 0).graph;
    const twice = pasteClipboard(once, clip, 200, 0).graph;
    expect(twice.atoms).toHaveLength(24);
    expect(new Set(twice.atoms.map((a) => a.id)).size).toBe(24);
    expect(clip.atoms[0]).not.toBe(g.atoms[0]);
    expect(g.atoms).toHaveLength(8);
  });
});
