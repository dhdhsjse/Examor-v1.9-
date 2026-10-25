import { describe, expect, it } from "vitest";
import { renderMolecule } from "../render";
import { skeletalLabel } from "../render/skeletalLabels";
import { FIXTURES, blockFor, testEngine } from "./helpers";

const e = testEngine();
const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;
const texts = (svg: string) => [...svg.matchAll(/<text[^>]*>(.*?)<\/text>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
const sk = (smiles: string) => blockFor(smiles, "skeletal");

describe("skeletal formula: what is written", () => {
  it("carbons are bare vertices and hydrogens are only inside hetero labels (ethanol)", async () => {
    const svg = renderMolecule(await sk("CCO")).svg;
    expect(texts(svg)).toEqual(["OH"]);
    expect(count(svg, /data-atom-id=/g)).toBe(3); // C, C, O: no hydrogen atoms are drawn
    expect(count(svg, /data-bond-id=/g)).toBe(2); // the O–H and C–H bonds are not drawn
  });

  it("acetic acid: =O and OH, two carbon vertices", async () => {
    const svg = renderMolecule(await sk("CC(=O)O")).svg;
    expect(texts(svg).sort()).toEqual(["O", "OH"].sort());
    expect(count(svg, /data-atom-id=/g)).toBe(4);
    expect(count(svg, /data-bond-id=/g)).toBe(3);
  });

  it("the hydrogens are written away from the bond (HO– on the left, –OH on the right)", async () => {
    const b = await sk("CCO");
    const g = b.graph;
    const pos = new Map(g.atoms.map((a) => [a.id, { x: a.sx!, y: a.sy! }]));
    const o = g.atoms.find((a) => a.element === "O")!;
    const label = skeletalLabel(g, o, pos)!;
    // the carbon next to the O is to its left in this depiction -> the H goes to the right
    const c = g.atoms[1];
    const leftOf = pos.get(c.id)!.x < pos.get(o.id)!.x;
    expect(label.side).toBe(leftOf ? 1 : -1);
    const moved = new Map(pos);
    moved.set(c.id, { x: pos.get(o.id)!.x + (leftOf ? 1 : -1), y: pos.get(o.id)!.y });
    expect(skeletalLabel(g, o, moved)!.side).toBe(leftOf ? -1 : 1);
  });

  it("NH2, SH, HO–OH and the label of a molecule with one heavy atom", async () => {
    expect(texts(renderMolecule(await sk("CN")).svg)[0]).toMatch(/^(H2N|NH2)$/);
    expect(texts(renderMolecule(await sk("CS")).svg)[0]).toMatch(/^(HS|SH)$/);
    expect(texts(renderMolecule(await sk("OO")).svg).sort()).toEqual(["HO", "OH"]);
    expect(texts(renderMolecule(await sk("O")).svg)).toEqual(["H2O"]);
    expect(texts(renderMolecule(await sk("N")).svg)).toEqual(["NH3"]);
    expect(texts(renderMolecule(await sk("C")).svg)).toEqual(["CH4"]);
    expect(texts(renderMolecule(await sk("Cl")).svg)).toEqual(["HCl"]);
  });

  it("a carbon is written when it is charged, alone, or has two double bonds (CO2)", async () => {
    expect(texts(renderMolecule(await sk("O=C=O")).svg).sort()).toEqual(["C", "O", "O"]);
    expect(texts(renderMolecule(await sk("C[N+](C)(C)C")).svg)).toEqual(["N+"]);
  });

  it("alkanes are only lines: butane zigzags, isobutane has a branch", async () => {
    const butane = await sk("CCCC");
    const svg = renderMolecule(butane).svg;
    expect(texts(svg)).toEqual([]);
    expect(count(svg, /data-bond-id=/g)).toBe(3);
    const ys = butane.graph.atoms.filter((a) => a.element === "C").map((a) => a.sy!);
    expect(new Set(ys.map((y) => y.toFixed(2))).size).toBe(2); // up, down, up, down: a zigzag, not a straight line
    expect(texts(renderMolecule(await sk("CC(C)C")).svg)).toEqual([]);
  });
});

describe("skeletal formula: bonds and rings", () => {
  it("double and triple bonds are parallel lines", async () => {
    expect(count(renderMolecule(await sk("C=C")).svg, /<line x1/g)).toBe(2 + 1); // two lines + the click target
    expect(count(renderMolecule(await sk("C#C")).svg, /<line x1/g)).toBe(3 + 1);
  });

  it("benzene: a hexagon of six vertices with an inner line for each of the three double bonds", async () => {
    const svg = renderMolecule(await sk("c1ccccc1")).svg;
    expect(texts(svg)).toEqual([]);
    expect(count(svg, /data-atom-id=/g)).toBe(6);
    expect(count(svg, /data-bond-id=/g)).toBe(6);
    // 6 bond lines + 3 inner lines + 6 click targets
    expect(count(svg, /<line x1/g)).toBe(6 + 3 + 6);
  });

  it("a ring with a substituent: phenol and toluene", async () => {
    expect(texts(renderMolecule(await sk("Oc1ccccc1")).svg)).toHaveLength(1);
    expect(texts(renderMolecule(await sk("Cc1ccccc1")).svg)).toEqual([]);
  });
});

describe("skeletal formula: the student version, the editor, the layout", () => {
  it("a hidden hetero atom leaves a stub; a blank one a box; a teacher's text replaces the label", async () => {
    const base = await sk("CC(=O)O");
    const [, , o3, o4] = base.graph.atoms;
    const hidden = { ...base, exerciseMode: "student" as const, edits: { ...base.edits, atoms: { [o4.id]: { vis: "hidden" as const } } } };
    expect(texts(renderMolecule(hidden).svg)).toEqual(["O"]);
    expect(count(renderMolecule(hidden).svg, /data-bond-id=/g)).toBe(3); // the C–O bond stays as a stub
    const blank = { ...hidden, edits: { ...base.edits, atoms: { [o3.id]: { vis: "blank" as const } } } };
    expect(renderMolecule(blank).svg).toContain('fill="#fff"');
    const relabelled = { ...hidden, edits: { ...base.edits, atoms: { [o4.id]: { label: "?" } } } };
    expect(texts(renderMolecule(relabelled).svg).sort()).toEqual(["?", "O"]);
  });

  it("the answer key ignores every hiding edit", async () => {
    const base = await sk("CC(=O)O");
    const edits = { ...base.edits, atoms: { [base.graph.atoms[3].id]: { vis: "hidden" as const } } };
    expect(renderMolecule({ ...base, exerciseMode: "answer", edits }).svg).toBe(renderMolecule(base).svg);
  });

  it("the editor view keeps every atom selectable, hidden ones faded", async () => {
    const base = await sk("CC(=O)O");
    const edits = { ...base.edits, atoms: { [base.graph.atoms[3].id]: { vis: "hidden" as const } } };
    const ghost = renderMolecule({ ...base, exerciseMode: "student", edits }, { ghost: true }).svg;
    expect(count(ghost, /data-atom-id=/g)).toBe(4);
    expect(count(ghost, /data-vis="hidden"/g)).toBe(1);
  });

  it("has its own layout: moves made on the structural drawing do not apply", async () => {
    const b = await sk("CCO");
    const moved = { ...b, edits: { ...b.edits, atoms: { [b.graph.atoms[2].id]: { x: 9, y: 9 } } } };
    expect(renderMolecule(moved).svg).toBe(renderMolecule(b).svg);
  });

  it("falls back to the first depiction for older documents (no skeletal coordinates)", async () => {
    const b = await sk("CC(=O)O");
    const old = { ...b, graph: { ...b.graph, atoms: b.graph.atoms.map(({ sx, sy, ...rest }) => (void sx, void sy, rest)) } };
    const r = renderMolecule(old);
    expect(r.warning).toBeUndefined();
    expect(texts(r.svg).sort()).toEqual(["O", "OH"].sort());
  });

  it("the engine gives every heavy atom of a molecule from SMILES a skeletal position (hydrogens have none)", async () => {
    const g = await e.fromSmiles("CC(=O)O");
    expect(g.atoms.filter((a) => a.element !== "H").every((a) => typeof a.sx === "number" && typeof a.sy === "number")).toBe(true);
    expect(g.atoms.filter((a) => a.element === "H").every((a) => a.sx === undefined)).toBe(true);
  });
});

describe("golden skeletal drawings", () => {
  for (const [name, smi] of Object.entries(FIXTURES)) {
    it(name, async () => {
      expect(renderMolecule(await sk(smi)).svg).toMatchSnapshot();
    });
  }
});
