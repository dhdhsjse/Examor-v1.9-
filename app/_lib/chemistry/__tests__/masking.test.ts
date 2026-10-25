import { describe, expect, it } from "vitest";
import { testEngine } from "../../../_molecule/__tests__/helpers";
import { defaultRenderOptions, emptyEdits } from "../../../_molecule/model";
import type { MoleculeBlockData, Representation } from "../../../_molecule/model";
import { renderMolecule } from "../../../_molecule/render";
import { atomInStudentView, bondInStudentView, engineEdits, mapToEngine, maskedCount } from "../masking";
import { drawingToMolfile } from "../molfile";
import { setMaskText, setMasked } from "../selection";
import { renderDrawingSvg } from "../svg";
import type { AtomNode, BondEdge, BondType, MoleculeGraph } from "../types";

const atom = (id: string, element: string, x: number, y: number, extra: Partial<AtomNode> = {}): AtomNode => ({ id, element, x, y, charge: 0, hidden: false, ...extra });
const bond = (id: string, sourceId: string, targetId: string, type: BondType = "single", extra: Partial<BondEdge> = {}): BondEdge => ({ id, sourceId, targetId, type, hidden: false, ...extra });
const text = (svg: string) => [...svg.matchAll(/<text\b[^>]*>(.*?)<\/text>/g)].map((m) => m[1].replace(/<[^>]+>/g, "")).join(" ");

// Ethanol drawn by hand: C–C–O, no hydrogens.
const ethanol = (): MoleculeGraph => ({ atoms: [atom("c1", "C", 0, 0), atom("c2", "C", 43, 25), atom("o", "O", 86, 0)], bonds: [bond("b1", "c1", "c2"), bond("b2", "c2", "o")], annotations: [], hydrogens: "manual" });
// The same with every hydrogen drawn, and the hydrogens listed BEFORE the heavy atoms (the engine puts its own last).
const ethanolWithH = (): MoleculeGraph => {
  const h = (id: string, x: number, y: number) => atom(id, "H", x, y);
  return {
    atoms: [h("h1", -20, 40), h("h2", -40, -20), h("h3", 0, -50), h("h4", 20, 70), h("h5", 60, 70), h("h6", 120, 40), atom("c1", "C", 0, 0), atom("c2", "C", 43, 25), atom("o", "O", 86, 0)],
    bonds: [bond("a", "c1", "c2"), bond("b", "c2", "o"), bond("c", "c1", "h1"), bond("d", "c1", "h2"), bond("e", "c1", "h3"), bond("f", "c2", "h4"), bond("g", "c2", "h5"), bond("h", "o", "h6")],
    annotations: [],
    hydrogens: "manual",
  };
};

describe("masking a selection", () => {
  it("masks and unmasks atoms and bonds, and forgets the replacement on unmasking", () => {
    const g = setMasked(ethanol(), { atoms: ["o"], bonds: ["b2"] }, true);
    expect(g.atoms.find((a) => a.id === "o")!.hidden).toBe(true);
    expect(g.bonds.find((b) => b.id === "b2")!.hidden).toBe(true);
    expect(maskedCount(g)).toBe(2);
    const typed = setMaskText(g, { atoms: ["o"], bonds: [] }, "X");
    expect(typed.atoms.find((a) => a.id === "o")!.mask).toBe("X");
    const back = setMasked(typed, { atoms: ["o"], bonds: [] }, false);
    expect(back.atoms.find((a) => a.id === "o")).toEqual(atom("o", "O", 86, 0));
  });

  it("changes nothing (the same graph) when nothing changes", () => {
    const g = ethanol();
    expect(setMasked(g, { atoms: ["o"], bonds: [] }, false)).toBe(g);
    expect(setMaskText(g, { atoms: ["o"], bonds: [] }, "?")).toBe(g); // an atom that is not masked has no replacement to set
  });

  it("limits the replacement text", () => {
    const g = setMaskText(setMasked(ethanol(), { atoms: ["o"], bonds: [] }, true), { atoms: ["o"], bonds: [] }, "x".repeat(40));
    expect(g.atoms.find((a) => a.id === "o")!.mask).toHaveLength(12);
  });
});

describe("what the student version shows", () => {
  it("writes ? for a masked atom unless the teacher chose another text, and an empty box for an empty one", () => {
    expect(atomInStudentView(atom("a", "O", 0, 0))).toEqual({ kind: "normal" });
    expect(atomInStudentView(atom("a", "O", 0, 0, { hidden: true }))).toEqual({ kind: "mask", text: "?" });
    expect(atomInStudentView(atom("a", "O", 0, 0, { hidden: true, mask: "___" }))).toEqual({ kind: "mask", text: "___" });
    expect(atomInStudentView(atom("a", "O", 0, 0, { hidden: true, mask: "" }))).toEqual({ kind: "mask", text: "" });
  });

  it("takes the automatic hydrogens of a masked atom away with it", () => {
    expect(atomInStudentView(atom("h", "H", 0, 0, { hidden: true, auto: true }))).toEqual({ kind: "omit" });
    expect(atomInStudentView(atom("h", "H", 0, 0, { hidden: true }))).toEqual({ kind: "mask", text: "?" }); // the teacher's own hydrogen is masked like any atom
  });

  it("draws a masked bond as a dashed line, or nothing", () => {
    const [a, b] = [atom("a", "C", 0, 0), atom("b", "C", 50, 0)];
    expect(bondInStudentView(bond("x", "a", "b"), a, b)).toEqual({ kind: "normal" });
    expect(bondInStudentView(bond("x", "a", "b", "single", { hidden: true }), a, b)).toEqual({ kind: "missing" });
    expect(bondInStudentView(bond("x", "a", "b", "single", { hidden: true, mask: "" }), a, b)).toEqual({ kind: "omit" });
    expect(bondInStudentView(bond("x", "a", "b"), a, undefined)).toEqual({ kind: "omit" }); // a bond to a missing atom is never drawn
  });

  it("keeps a bond to a masked atom: only the bonds the teacher masked are hidden", () => {
    const [a, b] = [atom("a", "C", 0, 0), atom("b", "O", 50, 0, { hidden: true })];
    expect(bondInStudentView(bond("x", "a", "b"), a, b)).toEqual({ kind: "normal" });
  });
});

describe("the student picture", () => {
  const masked = () => setMasked(ethanol(), { atoms: ["o"], bonds: ["b1"] }, true);

  it("is the answer key unless asked for the student version", () => {
    const key = renderDrawingSvg(masked())!.svg;
    expect(text(key)).toContain("O");
    expect(key).not.toContain("stroke-dasharray");
  });

  it("replaces the masked atom and bond, and does not give the symbol away", () => {
    const svg = renderDrawingSvg(masked(), { student: true })!.svg;
    expect(text(svg)).toContain("?");
    expect(text(svg)).not.toContain("O");
    expect(svg).toContain('stroke="#9ca3af"'); // the masked bond is a dashed grey line
    expect(svg).toContain('stroke-dasharray="5 4"');
  });

  it("writes the teacher's text, or an empty dashed box, or leaves a masked bond out", () => {
    const g = setMaskText(masked(), { atoms: ["o"], bonds: ["b1"] }, "___");
    expect(text(renderDrawingSvg(g, { student: true })!.svg)).toContain("___");
    const blank = setMaskText(masked(), { atoms: ["o"], bonds: ["b1"] }, "");
    const svg = renderDrawingSvg(blank, { student: true })!.svg;
    expect(svg).toContain("<rect");
    expect(svg).not.toContain("#9ca3af"); // an empty replacement leaves the bond out altogether
  });

  it("does not write the hydrogens of a masked atom in the labels mode", () => {
    const g = setMasked({ ...ethanol(), hydrogens: "labels" }, { atoms: ["o"], bonds: [] }, true);
    expect(text(renderDrawingSvg(g)!.svg)).toContain("H"); // the answer key has OH
    const student = text(renderDrawingSvg(g, { student: true })!.svg);
    expect(student).toContain("?");
    expect(student).not.toContain("O");
    expect(student.match(/H/g)).toHaveLength(2); // only the carbons' own CH3 and CH2: the OH of the masked atom is gone
  });
});

describe("masks in the school representations", () => {
  async function block(graph: MoleculeGraph, representation: Representation, view: "answer" | "student") {
    const engine = testEngine();
    const molfile = drawingToMolfile(graph);
    const mol = await engine.fromMolfile(molfile);
    const b: MoleculeBlockData = { schema: 1, source: { kind: "molfile", input: molfile }, smiles: await engine.toSmiles(mol), graph: mol, representation, options: defaultRenderOptions("en"), edits: engineEdits(graph, mol, emptyEdits()), exerciseMode: view };
    return { mol, block: b };
  }

  it("matches the atoms of the drawing with the engine's, even with the drawn hydrogens in front", async () => {
    const g = ethanolWithH();
    const mol = await testEngine().fromMolfile(drawingToMolfile(g));
    const map = mapToEngine(g, mol);
    expect(map.atoms.size).toBe(g.atoms.length);
    for (const a of g.atoms) expect(mol.atoms.find((m) => m.id === map.atoms.get(a.id))?.element).toBe(a.element);
    // each drawn hydrogen is a hydrogen on the same heavy atom
    const host = (id: string) => g.bonds.flatMap((b) => (b.sourceId === id ? [b.targetId] : b.targetId === id ? [b.sourceId] : []))[0];
    const engineHost = (id: string) => mol.bonds.flatMap((b) => (b.a === id ? [b.b] : b.b === id ? [b.a] : []))[0];
    for (const a of g.atoms.filter((x) => x.element === "H")) expect(engineHost(map.atoms.get(a.id)!)).toBe(map.atoms.get(host(a.id)));
    expect(map.bonds.size).toBe(g.bonds.length);
  });

  it("applies no mask rather than a wrong one when the engine's heavy atoms are not the drawing's", async () => {
    const g = ethanol();
    const mol = await testEngine().fromMolfile(drawingToMolfile({ ...g, atoms: g.atoms.slice(0, 2), bonds: g.bonds.slice(0, 1) }));
    expect(mapToEngine(g, mol).atoms.size).toBe(0);
  });

  it("shows the student a ? in the skeletal formula, and not the symbol", async () => {
    const g = setMasked(ethanol(), { atoms: ["o"], bonds: [] }, true);
    const key = text(renderMolecule((await block(g, "skeletal", "answer")).block).svg);
    expect(key).toContain("O");
    const student = text(renderMolecule((await block(g, "skeletal", "student")).block).svg);
    expect(student).toContain("?");
    expect(student).not.toContain("O");
  });

  it("takes the lone pairs of a masked atom away in the Lewis structure", async () => {
    const g = setMasked(ethanol(), { atoms: ["o"], bonds: [] }, true);
    const dots = (svg: string) => (svg.match(/<circle/g) ?? []).length;
    const key = dots(renderMolecule((await block(g, "lewis", "answer")).block).svg);
    const student = dots(renderMolecule((await block(g, "lewis", "student")).block).svg);
    expect(student).toBeLessThan(key);
  });

  it("takes the hydrogens the engine added to a masked atom away with it, and keeps the others", async () => {
    const g = setMasked(ethanol(), { atoms: ["o"], bonds: [] }, true);
    const { mol, block: b } = await block(g, "structural", "student");
    const hOnO = mol.bonds.filter((x) => [x.a, x.b].includes("a3") && [x.a, x.b].some((id) => mol.atoms.find((a) => a.id === id)?.element === "H"));
    expect(hOnO).toHaveLength(1);
    for (const bond of hOnO) expect(b.edits.bonds[bond.id]).toEqual({ vis: "hidden" });
    expect(Object.values(b.edits.atoms).filter((e) => e.vis === "hidden")).toHaveLength(1); // the carbons' hydrogens stay
    const svg = renderMolecule(b).svg;
    expect(text(svg)).toContain("?");
    expect(text(svg).match(/H/g)).toHaveLength(5); // CH3 and CH2 only
  });

  it("dashes a masked bond, and draws the teacher's view with what is masked faded", async () => {
    const g = setMasked(ethanol(), { atoms: [], bonds: ["b2"] }, true);
    const student = renderMolecule((await block(g, "structural", "student")).block).svg;
    expect(student).toContain("stroke-dasharray");
    const teacher = renderMolecule((await block(g, "structural", "answer")).block, { ghost: true }).svg;
    expect(teacher).toContain('data-vis="blank"');
  });

  it("makes a skeletal formula without the C and H labels of the carbons (Topologique)", async () => {
    const svg = renderMolecule((await block(ethanol(), "skeletal", "answer")).block).svg;
    expect(text(svg)).not.toContain("C");
    expect(text(svg)).toContain("OH");
  });
});
