import { describe, expect, it } from "vitest";
import { testEngine } from "../../../_molecule/__tests__/helpers";
import { ATOM_RADIUS, BOND_LENGTH, DIRECTED_BONDS, NON_COVALENT_BONDS, bondDrawing } from "../bondGeometry";
import { drawingOnEngine } from "../engineGraph";
import { OVERLAP_DISTANCE, drawingIssues, issueAtoms } from "../issues";
import { MAX_PAIRS, autoLonePairs, lonePairCounts, lonePairMarks, pairShape, valenceElectrons } from "../lonePairs";
import { moleculesOf } from "../formula";
import { drawingToMolfile } from "../molfile";
import { makeRepresentation } from "../representation";
import { setPairs, setPairsHidden, stepPairs } from "../selection";
import { renderDrawingSvg } from "../svg";
import type { AtomNode, BondEdge, BondType, MoleculeGraph } from "../types";
import { bondOrder, recalculateHydrogens } from "../valence";

const atom = (id: string, element: string, x: number, y: number, extra: Partial<AtomNode> = {}): AtomNode => ({ id, element, x, y, charge: 0, hidden: false, ...extra });
const bond = (id: string, sourceId: string, targetId: string, type: BondType = "single", extra: Partial<BondEdge> = {}): BondEdge => ({ id, sourceId, targetId, type, hidden: false, ...extra });
const graph = (atoms: AtomNode[], bonds: BondEdge[] = [], extra: Partial<MoleculeGraph> = {}): MoleculeGraph => ({ atoms, bonds, annotations: [], hydrogens: "manual", ...extra });
const A = { x: 0, y: 0 };
const B = { x: BOND_LENGTH, y: 0 };
const ALL: BondType[] = ["single", "double", "triple", "quadruple", "aromatic", "partial", "shared", "wedge", "dash", "wedge-open", "bold", "wavy", "dative", "ionic", "hydrogen"];

describe("the library of bonds", () => {
  it("draws every type between two atoms, inside the part left by the atom symbols", () => {
    for (const type of ALL) {
      const d = bondDrawing(A, B, type);
      const xs = [...d.lines.flatMap((l) => [l.x1, l.x2]), ...(d.polygon ?? []).filter((_, i) => i % 2 === 0), ...(d.parts ?? []).flatMap((p) => (p.kind === "line" ? [p.seg.x1, p.seg.x2] : p.points.filter((_, i) => i % 2 === 0)))];
      expect(xs.length, type).toBeGreaterThan(0);
      expect(Math.min(...xs), type).toBeGreaterThanOrEqual(ATOM_RADIUS - 1e-6);
      expect(Math.max(...xs), type).toBeLessThanOrEqual(BOND_LENGTH - ATOM_RADIUS + 1e-6);
    }
  });

  it("draws nothing for two atoms on the same spot, whatever the bond", () => {
    for (const type of ALL) expect(bondDrawing(A, A, type)).toEqual({ lines: [], polygon: null });
  });

  it("gives a quadruple bond four lines, an aromatic one a line and a dashed one, a partial one only a dashed line", () => {
    expect(bondDrawing(A, B, "quadruple").lines).toHaveLength(4);
    const aromatic = bondDrawing(A, B, "aromatic");
    expect(aromatic.lines).toHaveLength(1);
    expect(aromatic.parts).toEqual([expect.objectContaining({ kind: "line", dash: [4, 3] })]);
    const partial = bondDrawing(A, B, "partial");
    expect(partial.lines).toHaveLength(0);
    expect(partial.parts?.[0]).toMatchObject({ kind: "line", dash: [5, 4] });
  });

  it("ends a dative bond in an arrow head at the acceptor", () => {
    const d = bondDrawing(A, B, "dative");
    const head = d.parts?.find((p) => p.kind === "head");
    expect(head).toBeTruthy();
    if (head?.kind === "head") expect(head.points.slice(0, 2)).toEqual([B.x - ATOM_RADIUS, 0]); // the tip is where the bond ends
  });

  it("makes the open wedge an outline, the bold bond a thick line, the wavy bond a zigzag around the axis", () => {
    expect(bondDrawing(A, B, "wedge-open").parts?.[0].kind).toBe("outline");
    const bold = bondDrawing(A, B, "bold").parts?.[0];
    expect(bold?.kind === "line" && (bold.width ?? 0) > 3).toBe(true);
    const wavy = bondDrawing(A, B, "wavy").parts?.[0];
    expect(wavy?.kind).toBe("polyline");
    if (wavy?.kind === "polyline") {
      const ys = wavy.points.filter((_, i) => i % 2 === 1);
      expect(Math.max(...ys)).toBeGreaterThan(1);
      expect(Math.min(...ys)).toBeLessThan(-1);
    }
  });

  it("knows which bonds have a direction and which are not covalent", () => {
    expect(DIRECTED_BONDS).toEqual(["wedge", "dash", "wedge-open", "dative"]);
    expect(NON_COVALENT_BONDS).toEqual(["dative", "ionic", "hydrogen"]);
  });

  it("counts what each uses of the valence", () => {
    expect(ALL.map(bondOrder)).toEqual([1, 2, 3, 4, 1.5, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0]);
  });

  it("adds the hydrogens an aromatic ring leaves: benzene drawn with aromatic bonds has one on each carbon", () => {
    const r = 50;
    const ring = Array.from({ length: 6 }, (_, i) => atom(`c${i}`, "C", r * Math.cos((i * Math.PI) / 3), r * Math.sin((i * Math.PI) / 3)));
    const g = recalculateHydrogens(graph(ring, ring.map((_, i) => bond(`b${i}`, `c${i}`, `c${(i + 1) % 6}`, "aromatic")), { hydrogens: "auto" }));
    expect(g.atoms.filter((a) => a.element === "H")).toHaveLength(6);
  });

  it("does not let a bond that is not covalent take a hydrogen's place", () => {
    for (const type of NON_COVALENT_BONDS) {
      const g = recalculateHydrogens(graph([atom("n", "N", 0, 0), atom("b", "B", 50, 0)], [bond("x", "n", "b", type)], { hydrogens: "auto" }));
      expect(g.atoms.filter((a) => a.id.startsWith("n~")), type).toHaveLength(3); // NH3 as if alone
    }
  });

  it("leaves a hydrogen bond out of the molecule, and keeps an ionic one in it", () => {
    const two = (type: BondType) => moleculesOf(graph([atom("a", "O", 0, 0), atom("b", "H", 60, 0)], [bond("x", "a", "b", type)])).length;
    expect(two("hydrogen")).toBe(2);
    expect(two("ionic")).toBe(1);
  });
});

describe("lone pairs", () => {
  const count = (element: string, charge: number, bonds: number) => autoLonePairs(element, charge, bonds);

  it("works them out from the valence: water 2, ammonia 1, hydrogen chloride 3", () => {
    expect(count("O", 0, 2)).toBe(2);
    expect(count("N", 0, 3)).toBe(1);
    expect(count("Cl", 0, 1)).toBe(3);
    expect(count("C", 0, 4)).toBe(0);
  });

  it("takes an atom as complete: a bare oxygen has its two hydrogens' worth of bonds", () => {
    expect(count("O", 0, 0)).toBe(2);
    expect(count("N", 0, 1)).toBe(1);
  });

  it("follows the charge: hydroxide 3, hydronium 1, ammonium 0, chloride 4, a carbanion 1, a metal ion 0", () => {
    expect(count("O", -1, 1)).toBe(3);
    expect(count("O", 1, 3)).toBe(1);
    expect(count("N", 1, 4)).toBe(0);
    expect(count("Cl", -1, 0)).toBe(4);
    expect(count("C", -1, 3)).toBe(1);
    expect(count("Na", 1, 0)).toBe(0);
    expect(count("Mg", 2, 0)).toBe(0);
    expect(count("H", -1, 0)).toBe(1);
  });

  it("counts a double bond twice: the oxygen of C=O keeps two pairs, sulfur of SO2 one", () => {
    expect(count("O", 0, 2)).toBe(2);
    expect(count("S", 0, 4)).toBe(1);
  });

  it("gives a transition metal none, and knows the electrons of the others", () => {
    expect(valenceElectrons("Fe")).toBe(0);
    expect(valenceElectrons("O")).toBe(6);
    expect(valenceElectrons("Na")).toBe(1);
    expect(valenceElectrons("He")).toBe(2);
    expect(valenceElectrons("Xe")).toBe(8);
  });

  it("uses the teacher's count before the one the valence leaves", () => {
    const g = graph([atom("o", "O", 0, 0, { pairs: 3 }), atom("n", "N", 50, 0)]);
    expect(lonePairCounts(g).get("o")).toBe(3);
    expect(lonePairCounts(g).get("n")).toBe(1);
  });

  it("steps, sets and hides them, between 0 and the most there can be, and switches the pairs on", () => {
    const g = graph([atom("o", "O", 0, 0)]);
    const more = stepPairs(g, ["o"], 1);
    expect(more.atoms[0].pairs).toBe(3);
    expect(more.lonePairs).toBe("dots");
    expect(stepPairs(graph([atom("o", "O", 0, 0, { pairs: MAX_PAIRS })]), ["o"], 1).atoms[0].pairs).toBe(MAX_PAIRS);
    expect(stepPairs(graph([atom("o", "O", 0, 0, { pairs: 0 })]), ["o"], -1).atoms[0].pairs).toBe(0);
    expect(setPairs(more, ["o"], undefined).atoms[0]).not.toHaveProperty("pairs");
    expect(setPairsHidden(g, ["o"], true).atoms[0].pairsHidden).toBe(true);
    expect(setPairsHidden(setPairsHidden(g, ["o"], true), ["o"], false).atoms[0]).not.toHaveProperty("pairsHidden");
    expect(setPairsHidden(g, ["o"], false)).toBe(g);
  });

  it("writes nothing unless the mode asks for pairs, then puts them in the free sectors between the bonds", () => {
    const water = graph([atom("o", "O", 0, 0), atom("h1", "H", -43, 25), atom("h2", "H", 43, 25)], [bond("a", "o", "h1"), bond("b", "o", "h2")]);
    expect(lonePairMarks(water)).toEqual([]);
    const marks = lonePairMarks({ ...water, lonePairs: "dots" });
    expect(marks).toHaveLength(2);
    for (const m of marks) expect(Math.sin((m.angle * Math.PI) / 180)).toBeLessThan(0); // above the oxygen: the bonds point down
  });

  it("draws a pair as two dots a little apart, or as a bar", () => {
    const dots = pairShape(270, "dots");
    expect("dots" in dots && dots.dots).toHaveLength(2);
    const bar = pairShape(0, "lines");
    expect("bar" in bar && Math.abs(bar.bar.x1 - bar.bar.x2)).toBeLessThan(1e-9); // across the direction away from the atom
  });

  it("is in the picture for the page, and not for a student when the teacher hid it", () => {
    const g = graph([atom("o", "O", 0, 0, { pairsHidden: true }), atom("n", "N", 120, 0)], [], { lonePairs: "dots" });
    const key = renderDrawingSvg(g)!.svg;
    const student = renderDrawingSvg(g, { student: true })!.svg;
    const dots = (svg: string) => (svg.match(/<circle/g) ?? []).length;
    expect(dots(key)).toBe(6); // two pairs of oxygen and one of nitrogen
    expect(dots(student)).toBe(2); // only the nitrogen's
    expect(dots(renderDrawingSvg({ ...g, lonePairs: "off" })!.svg)).toBe(0);
    expect(renderDrawingSvg({ ...g, lonePairs: "lines" })!.svg).toContain('stroke-linecap="round"');
  });
});

describe("a sketch with something odd is still a sketch", () => {
  const five = () => {
    const atoms = [atom("c", "C", 0, 0), ...[0, 1, 2, 3, 4].map((i) => atom(`x${i}`, "Cl", 60 * Math.cos((i * 2 * Math.PI) / 5), 60 * Math.sin((i * 2 * Math.PI) / 5)))];
    return graph(atoms, [0, 1, 2, 3, 4].map((i) => bond(`b${i}`, "c", `x${i}`)));
  };

  it("marks a carbon with five bonds, and says how many and how many it usually has", () => {
    const issues = drawingIssues(five());
    expect(issues).toEqual([{ kind: "valence", atomId: "c", element: "C", bonds: 5, usual: 4 }]);
    expect([...issueAtoms(issues)]).toEqual(["c"]);
  });

  it("marks atoms on top of each other, and more electrons than a shell holds", () => {
    const stacked = graph([atom("a", "C", 0, 0), atom("b", "C", OVERLAP_DISTANCE - 1, 0)]);
    expect(drawingIssues(stacked)).toEqual([{ kind: "overlap", atomId: "a", other: "b" }]);
    expect(issueAtoms(drawingIssues(stacked))).toEqual(new Set(["a", "b"]));
    const octet = graph([atom("n", "N", 0, 0, { pairs: 4 })]);
    expect(drawingIssues(octet).some((i) => i.kind === "octet")).toBe(false); // 4 pairs = 8 electrons: fine
    expect(drawingIssues(graph([atom("n", "N", 0, 0, { pairs: 4 }), atom("h", "H", 50, 0)], [bond("x", "n", "h")])).some((i) => i.kind === "octet")).toBe(true); // 8 + 2
  });

  it("has nothing to say about a sound molecule, whatever the bonds", () => {
    const water = graph([atom("o", "O", 0, 0), atom("h1", "H", -43, 25), atom("h2", "H", 43, 25)], [bond("a", "o", "h1"), bond("b", "o", "h2", "wavy")], { lonePairs: "dots" });
    expect(drawingIssues(water)).toEqual([]);
    expect(drawingIssues(graph([atom("n", "N", 0, 0), atom("b", "B", 50, 0)], [bond("x", "n", "b", "dative")]))).toEqual([]);
  });

  it("is still shown in the representations, as drawn, with a note", async () => {
    const made = await makeRepresentation(five(), "structural", "teacher", "en", testEngine());
    expect(made.notes).toContain("unchecked");
    expect(made.svg).toContain("<svg");
    expect((made.svg.match(/data-atom-id/g) ?? []).length).toBe(6);
  });

  it("has no note when the engine can read the drawing", async () => {
    const water = graph([atom("o", "O", 0, 0), atom("h1", "H", -43, 25), atom("h2", "H", 43, 25)], [bond("a", "o", "h1"), bond("b", "o", "h2")]);
    expect((await makeRepresentation(water, "structural", "teacher", "en", testEngine())).notes).toEqual([]);
  });
});

describe("the library and the lone pairs in the representations", () => {
  const ethanol = (type: BondType = "single", extra: Partial<MoleculeGraph> = {}): MoleculeGraph =>
    graph([atom("c1", "C", 0, 0), atom("c2", "C", 43, 25), atom("o", "O", 86, 0)], [bond("b1", "c1", "c2", type), bond("b2", "c2", "o")], extra);
  const svgOf = async (g: MoleculeGraph, rep: "structural" | "skeletal" | "lewis" | "cram") => (await makeRepresentation(g, rep, "teacher", "en", testEngine())).svg;

  it("draws the styled bonds on the structural and skeletal drawings", async () => {
    expect(await svgOf(ethanol("partial"), "structural")).toContain('<g stroke-dasharray="5 4">');
    expect(await svgOf(ethanol("bold"), "skeletal")).toContain('<g stroke-width="3.6">');
    expect(await svgOf(ethanol("wavy"), "structural")).toContain("<polyline");
    expect(await svgOf(ethanol("quadruple"), "structural")).toBeTruthy();
    expect(await svgOf(ethanol("aromatic"), "skeletal")).toContain('<g stroke-dasharray="4 3">');
    expect(await svgOf(ethanol("single"), "structural")).not.toContain("stroke-dasharray=\"5 4\"");
  });

  it("draws the wedges and hashes of the drawing, and the open wedge, narrow at the atom the bond started from", async () => {
    expect(await svgOf(ethanol("wedge"), "structural")).toContain('data-stereo="wedge"');
    expect(await svgOf(ethanol("dash"), "skeletal")).toContain('data-stereo="dash"');
    const open = await svgOf(ethanol("wedge-open"), "structural");
    expect(open).toContain('fill="#fff"');
    // reversing the bond turns the wedge round: its narrow end moves to the other atom
    const flipped = graph(ethanol().atoms, [bond("b1", "c2", "c1", "wedge"), bond("b2", "c2", "o")]);
    expect(await svgOf(flipped, "structural")).not.toBe(await svgOf(ethanol("wedge"), "structural"));
  });

  it("keeps the engine's own wedges for the Cram drawing: the drawing's are not added on top", async () => {
    const cram = await svgOf(ethanol("wedge"), "cram");
    expect((cram.match(/data-stereo="wedge"/g) ?? []).length).toBeLessThanOrEqual(3);
  });

  it("draws the bonds that are not covalent between their atoms, without making them part of the molecule", async () => {
    const water = graph([atom("o", "O", 0, 0), atom("h1", "H", -43, 25), atom("h2", "H", 43, 25), atom("n", "N", 200, 0)], [bond("a", "o", "h1"), bond("b", "o", "h2"), bond("x", "o", "n", "hydrogen")]);
    const made = await makeRepresentation(water, "structural", "teacher", "en", testEngine());
    expect(made.block.overlayBonds).toEqual([expect.objectContaining({ style: "hydrogen" })]);
    expect(made.block.graph.bonds.length).toBeLessThan(10); // no bond to the nitrogen in the graph
    expect(made.svg).toContain("data-overlay-bond");
    const dative = graph([atom("n", "N", 0, 0), atom("b", "B", 80, 0)], [bond("x", "n", "b", "dative")]);
    const d = await makeRepresentation(dative, "structural", "teacher", "en", testEngine());
    expect(d.block.overlayBonds?.[0]).toMatchObject({ style: "dative" });
    expect(d.svg).toContain("<polygon"); // the arrow head
  });

  it("puts the engine's graph back together right: the styles and the wedge are on the bonds of the drawing", async () => {
    const g = ethanol("wedge");
    const mol = await testEngine().fromMolfile(drawingToMolfile(g));
    const on = drawingOnEngine(g, mol);
    const bonds = on.graph.bonds.filter((b) => b.stereo === "wedge");
    expect(bonds).toHaveLength(1);
    expect(on.map.atoms.get("c1")).toBe(bonds[0].a); // narrow at the atom the bond started from
  });

  it("keeps the sketch's own layout when it is in several pieces, with the hydrogens the engine adds placed round their atoms", async () => {
    const pieces = graph([atom("o", "O", 0, 0), atom("c1", "C", 43, 25), atom("c2", "C", -43, 25), atom("far", "C", 300, 0)], [bond("a", "o", "c1"), bond("b", "o", "c2"), bond("x", "c1", "far", "dative")]);
    const made = await makeRepresentation(pieces, "structural", "teacher", "en", testEngine());
    expect(made.block.options.layout).toBe("auto");
    const g = made.block.graph;
    const hydrogens = g.atoms.filter((a) => a.element === "H");
    expect(hydrogens.length).toBeGreaterThan(5);
    // none is left at the origin with the others: each is one bond length from the atom it is bonded to
    for (const h of hydrogens) {
      const bondTo = g.bonds.find((b) => b.a === h.id || b.b === h.id)!;
      const host = g.atoms.find((a) => a.id === (bondTo.a === h.id ? bondTo.b : bondTo.a))!;
      expect(Math.hypot(h.x - host.x, h.y - host.y)).toBeCloseTo(1, 1);
    }
    const spots = new Set(hydrogens.map((h) => `${h.x},${h.y}`));
    expect(spots.size).toBe(hydrogens.length);
    // one molecule keeps the school layout
    expect((await makeRepresentation(ethanol(), "structural", "teacher", "en", testEngine())).block.options.layout).toBe("school");
  });

  it("writes the lone pairs on the structural and skeletal drawings when the drawing shows them", async () => {
    const dots = (svg: string) => (svg.match(/class="lp"/g) ?? []).length;
    expect(dots(await svgOf(ethanol("single", { lonePairs: "off" }), "structural"))).toBe(0);
    expect(dots(await svgOf(ethanol("single", { lonePairs: "dots" }), "structural"))).toBe(4); // the oxygen's two pairs, two dots each
    expect(dots(await svgOf(ethanol("single", { lonePairs: "dots" }), "skeletal"))).toBe(4);
    expect(dots(await svgOf(ethanol("single", { lonePairs: "lines" }), "structural"))).toBe(2); // two bars
    expect(dots(await svgOf(ethanol("single"), "lewis"))).toBe(4); // the Lewis structure always has them
  });

  it("takes the teacher's lone pair count into the Lewis structure, and hides it from the students when asked", async () => {
    const dots = (svg: string) => (svg.match(/class="lp"/g) ?? []).length;
    const three = graph(ethanol().atoms.map((a) => (a.id === "o" ? { ...a, pairs: 3 } : a)), ethanol().bonds);
    expect(dots(await svgOf(three, "lewis"))).toBe(6);
    const hidden = graph(ethanol().atoms.map((a) => (a.id === "o" ? { ...a, pairsHidden: true } : a)), ethanol().bonds);
    const student = await makeRepresentation(hidden, "lewis", "student", "en", testEngine());
    expect(dots(student.svg)).toBe(0);
    expect(dots((await makeRepresentation(hidden, "lewis", "teacher", "en", testEngine())).svg)).toBe(4); // (the teacher sees them faded)
  });
});

describe("the dot-line bond", () => {
  it("is a line with a dot (a filled shape) at each end, and a covalent single bond for valence", () => {
    const d = bondDrawing(A, B, "shared");
    expect(d.lines).toHaveLength(1);
    const dots = (d.parts ?? []).filter((p) => p.kind === "head");
    expect(dots).toHaveLength(2);
    expect(bondOrder("shared")).toBe(1);
    expect(NON_COVALENT_BONDS).not.toContain("shared");
  });
});
