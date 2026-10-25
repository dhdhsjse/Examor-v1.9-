import { describe, expect, it } from "vitest";
import { formula, octetIssues } from "../chem";
import { canRedo, canUndo, commit, createHistory, redo, undo } from "../edit/history";
import { addBond, addHydrogen, graphWarnings, moveAtoms, removeAtoms, removeBonds, replaceElement, setAtomVis, setBondOrder, setBondVis, setDisplayOrder, setHideAllHydrogens, setLabel, setLonePairsVisible } from "../edit/ops";
import { allHydrogens, allLonePairs, bondsOfAtoms, emptySelection, hydrogensOfAtoms, lonePairsOfAtoms, pick, prune } from "../edit/select";
import { renderMolecule } from "../render";
import { blockFor, testEngine } from "./helpers";

const e = testEngine();
const f = (b: { graph: Parameters<typeof formula>[0] }) => formula(b.graph);

describe("visibility edits (the graph never changes)", () => {
  it("hide / blank / show atoms and bonds, without touching the original", async () => {
    const b = await blockFor("CC(=O)O");
    const frozen = JSON.stringify(b);
    const o3 = b.graph.atoms[2].id;
    const hidden = setAtomVis(b, [o3], "hidden");
    expect(hidden.edits.atoms[o3]).toEqual({ vis: "hidden" });
    expect(hidden.graph).toBe(b.graph);
    expect(JSON.stringify(b)).toBe(frozen);
    expect(setAtomVis(hidden, [o3], "blank").edits.atoms[o3].vis).toBe("blank");
    expect(setAtomVis(hidden, [o3], "shown").edits.atoms).toEqual({});
    const bond = b.graph.bonds[0].id;
    expect(setBondVis(b, [bond], "hidden").edits.bonds[bond].vis).toBe("hidden");
    expect(setBondVis(setBondVis(b, [bond], "blank"), [bond], "shown").edits.bonds).toEqual({});
  });

  it("labels, display-only bond order, hide all hydrogens, moves keep other edits", async () => {
    let b = await blockFor("CC(=O)O");
    const o3 = b.graph.atoms[2].id;
    const dbl = b.graph.bonds.find((x) => x.order === 2)!.id;
    b = setAtomVis(b, [o3], "blank");
    b = setLabel(b, [o3], "?");
    expect(b.edits.atoms[o3]).toEqual({ vis: "blank", label: "?" });
    b = setLabel(b, [o3], "");
    expect(b.edits.atoms[o3].label).toBe(""); // an empty box is a label too
    b = setLabel(b, [o3], undefined);
    expect(b.edits.atoms[o3]).toEqual({ vis: "blank" });
    b = setDisplayOrder(b, [dbl], 1);
    expect(b.edits.bonds[dbl].orderOverride).toBe(1);
    expect(b.graph.bonds.find((x) => x.id === dbl)!.order).toBe(2); // chemistry unchanged
    expect(setDisplayOrder(b, [dbl], undefined).edits.bonds).toEqual({});
    expect(setHideAllHydrogens(b, true).edits.hideAllHydrogens).toBe(true);
    expect(setHideAllHydrogens(setHideAllHydrogens(b, true), false).edits.hideAllHydrogens).toBeUndefined();
    const moved = moveAtoms(b, { [o3]: { x: 3.123456, y: -1 } });
    expect(moved.edits.atoms[o3]).toMatchObject({ vis: "blank", x: 3.123, y: -1 });
  });

  it("lone pairs are hidden one by one", async () => {
    const b = await blockFor("O");
    const o = b.graph.atoms[0].id;
    const one = setLonePairsVisible(b, [`${o}:1`], false);
    expect(one.edits.lonePairs[o]).toEqual([true, false]);
    const both = setLonePairsVisible(one, [`${o}:0`], false);
    expect(both.edits.lonePairs[o]).toEqual([false, false]);
    expect(setLonePairsVisible(both, [`${o}:0`, `${o}:1`], true).edits.lonePairs).toEqual({}); // all shown again: nothing to remember
  });
});

describe("structural edits", () => {
  it("removes an atom with its hydrogens and warns about the valence it leaves", async () => {
    const b = await blockFor("CC(=O)O");
    const oh = b.graph.atoms[3].id; // the hydroxyl O (its H goes too)
    const out = removeAtoms(b, [oh]);
    expect(f(out)).toBe("C2H3O");
    expect(out.graph.atoms).toHaveLength(6);
    const warn = graphWarnings(out.graph);
    expect(warn.map((w) => w.atomId)).toEqual([b.graph.atoms[1].id]); // the carbonyl carbon now has 3 bonds
    expect(octetIssues(out.graph).length).toBeGreaterThan(0);
    expect(f(b)).toBe("C2H4O2"); // the original is untouched
  });

  it("never reuses an id after a deletion", async () => {
    const b = await blockFor("CCO");
    const lastId = b.graph.atoms[b.graph.atoms.length - 1].id;
    const smaller = removeAtoms(b, [lastId]);
    const host = smaller.graph.atoms[2].id;
    const again = addHydrogen(smaller, host);
    const ids = again.graph.atoms.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(lastId);
  });

  it("removing a bond may split the molecule (allowed, with warnings)", async () => {
    const b = await blockFor("CC");
    const cc = b.graph.bonds.find((x) => b.graph.atoms.find((a) => a.id === x.a)!.element === "C" && b.graph.atoms.find((a) => a.id === x.b)!.element === "C")!;
    const out = removeBonds(b, [cc.id]);
    expect(out.graph.bonds).toHaveLength(b.graph.bonds.length - 1);
    expect(graphWarnings(out.graph)).toHaveLength(2);
  });

  it("replaces an element and gives it the hydrogens it needs (CH3 -> NH2)", async () => {
    const b = await blockFor("CC");
    const out = replaceElement(b, b.graph.atoms[0].id, "N");
    expect(f(out)).toBe("CH5N");
    expect(graphWarnings(out.graph)).toEqual([]);
    expect(out.graph.atoms.find((a) => a.id === b.graph.atoms[0].id)!.lonePairs).toBe(1);
    expect(replaceElement(b, b.graph.atoms[2].id, "N")).toBe(b); // not to or from hydrogen
  });

  it("changes the real bond order and the hydrogens follow (ethane -> ethene -> ethyne)", async () => {
    const b = await blockFor("CC");
    const cc = b.graph.bonds.find((x) => b.graph.atoms.find((a) => a.id === x.a)!.element === "C" && b.graph.atoms.find((a) => a.id === x.b)!.element === "C")!;
    const ene = setBondOrder(b, cc.id, 2);
    expect(f(ene)).toBe("C2H4");
    const yne = setBondOrder(ene, cc.id, 3);
    expect(f(yne)).toBe("C2H2");
    expect(await e.toSmiles(yne.graph)).toBe("C#C");
    expect(f(setBondOrder(yne, cc.id, 1))).toBe("C2H6");
  });

  it("a carbonyl turned into a single bond becomes a diol", async () => {
    const b = await blockFor("CC(=O)O");
    const out = setBondOrder(b, b.graph.bonds.find((x) => x.order === 2)!.id, 1);
    expect(f(out)).toBe("C2H6O2");
  });

  it("adds a hydrogen (warning: unusual valence) and a bond between two atoms", async () => {
    const b = await blockFor("O");
    const o = b.graph.atoms[0].id;
    const h3 = addHydrogen(b, o);
    expect(f(h3)).toBe("H3O");
    expect(graphWarnings(h3.graph)).toHaveLength(1);
    const two = await blockFor("CC");
    const [c1, c2] = two.graph.atoms;
    expect(addBond(two, c1.id, c2.id)).toBe(two); // already bonded
    const hs = two.graph.atoms.filter((a) => a.element === "H");
    const joined = addBond(two, hs[0].id, hs[hs.length - 1].id);
    expect(joined.graph.bonds).toHaveLength(two.graph.bonds.length + 1);
  });

  it("cleans the edits of what no longer exists", async () => {
    let b = await blockFor("CC(=O)O");
    const o3 = b.graph.atoms[2].id;
    b = setLabel(setAtomVis(b, [o3], "hidden"), [o3], "?");
    b = setLonePairsVisible(b, [`${o3}:0`], false);
    const out = removeAtoms(b, [o3]);
    expect(out.edits.atoms[o3]).toBeUndefined();
    expect(out.edits.lonePairs[o3]).toBeUndefined();
  });

  it("lone pairs are recomputed after a structural edit (water + H = hydronium)", async () => {
    const b = await blockFor("O");
    expect(b.graph.atoms[0].lonePairs).toBe(2);
    expect(addHydrogen(b, b.graph.atoms[0].id).graph.atoms[0].lonePairs).toBe(1);
  });

  it("an edited molecule still renders, with new hydrogens placed apart from the old ones", async () => {
    const base = await blockFor("CC");
    const b = { ...base, options: { ...base.options, layout: "auto" as const } };
    const out = replaceElement(b, b.graph.atoms[0].id, "O");
    expect(renderMolecule(out).warning).toBeUndefined();
    const pts = out.graph.atoms.map((a) => `${a.x.toFixed(2)},${a.y.toFixed(2)}`);
    expect(new Set(pts).size).toBe(pts.length);
  });
});

describe("selection helpers", () => {
  it("click replaces, shift-click toggles", () => {
    let s = pick(emptySelection(), "atoms", "a1", false);
    s = pick(s, "atoms", "a2", true);
    expect(s.atoms).toEqual(["a1", "a2"]);
    expect(pick(s, "atoms", "a1", true).atoms).toEqual(["a2"]);
    expect(pick(s, "bonds", "b1", false)).toEqual({ atoms: [], bonds: ["b1"], lonePairs: [] });
  });

  it("select all hydrogens / lone pairs / bonds of an atom / hydrogens of an atom", async () => {
    const b = await blockFor("CC(=O)O");
    expect(allHydrogens(b.graph).atoms).toHaveLength(4);
    expect(allLonePairs(b.graph).lonePairs).toHaveLength(4);
    const c1 = b.graph.atoms[0].id;
    expect(bondsOfAtoms(b.graph, [c1]).bonds).toHaveLength(4);
    expect(hydrogensOfAtoms(b.graph, [c1]).atoms).toHaveLength(3);
    expect(lonePairsOfAtoms(b.graph, [b.graph.atoms[2].id]).lonePairs).toHaveLength(2);
  });

  it("prunes what a structural edit removed", async () => {
    const b = await blockFor("CC(=O)O");
    const sel = { atoms: [b.graph.atoms[3].id, b.graph.atoms[0].id], bonds: [], lonePairs: [`${b.graph.atoms[3].id}:0`] };
    const out = prune(sel, removeAtoms(b, [b.graph.atoms[3].id]).graph);
    expect(out).toEqual({ atoms: [b.graph.atoms[0].id], bonds: [], lonePairs: [] });
  });
});

describe("local history", () => {
  it("undo and redo", () => {
    let h = createHistory("a");
    h = commit(h, "b", undefined, 1000);
    h = commit(h, "c", undefined, 2000);
    expect([canUndo(h), canRedo(h)]).toEqual([true, false]);
    h = undo(h);
    expect(h.present).toBe("b");
    h = undo(undo(h));
    expect(h.present).toBe("a");
    expect(undo(h)).toBe(h);
    h = redo(h);
    expect(h.present).toBe("b");
    h = commit(h, "d", undefined, 3000); // a new edit drops the redo branch
    expect(canRedo(h)).toBe(false);
  });

  it("a drag is one step: same key, soon after", () => {
    let h = createHistory(0);
    for (let i = 1; i <= 20; i++) h = commit(h, i, "drag", 1000 + i * 16);
    expect(h.past).toEqual([0]);
    expect(h.present).toBe(20);
    h = commit(h, 21, "drag", 5000); // a pause: a new step
    expect(h.past).toEqual([0, 20]);
    h = commit(h, 22, "hide", 5100); // another kind of edit: a new step
    expect(h.past).toHaveLength(3);
    expect(undo(h).present).toBe(21);
  });

  it("committing the same value changes nothing", () => {
    const h = createHistory({ x: 1 });
    expect(commit(h, h.present)).toBe(h);
  });
});
