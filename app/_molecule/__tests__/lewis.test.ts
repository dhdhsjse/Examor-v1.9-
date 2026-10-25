import { describe, expect, it } from "vitest";
import { octetIssues } from "../chem";
import { lonePairAngles } from "../render/lonePairs";
import { lonePairId, lonePairShown } from "../render/lewis";
import { renderMolecule } from "../render";
import { blockFor, testEngine } from "./helpers";

const e = testEngine();
const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;
const lewisOf = (smiles: string) => blockFor(smiles, "lewis");

describe("lone pair placement", () => {
  it("one bond: the two pairs sit at ±120° from it (carbonyl O)", () => {
    const a = lonePairAngles([90], 2).sort((x, y) => x - y);
    expect(a).toEqual([210, 330]);
  });
  it("two opposite bonds: one pair in each free sector (water drawn H–O–H)", () => {
    expect(lonePairAngles([0, 180], 2).sort((x, y) => x - y)).toEqual([90, 270]);
  });
  it("HCl: three pairs 90° apart, none on the bond", () => {
    const a = lonePairAngles([180], 3).sort((x, y) => x - y);
    expect(a).toEqual([0, 90, 270]); // the bond points at 180°
  });
  it("no bonds: spread evenly; no pairs: nothing", () => {
    expect(lonePairAngles([], 4)).toHaveLength(4);
    expect(lonePairAngles([0], 0)).toEqual([]);
  });
});

describe("Lewis renderer", () => {
  it("acetic acid: carbonyl O and hydroxyl O have two pairs each", async () => {
    const b = await lewisOf("CC(=O)O");
    const r = renderMolecule(b);
    expect(count(r.svg, /data-lp-id=/g)).toBe(4);
    const [, , o3, o4] = b.graph.atoms;
    for (const o of [o3, o4]) for (const i of [0, 1]) expect(r.svg).toContain(`data-lp-id="${lonePairId(o.id, i)}"`);
    expect(r.svg).not.toContain("data-lp-id=\"a1:"); // carbons have none
  });
  it("dots by default, lines on request", async () => {
    const b = await lewisOf("O");
    expect(renderMolecule(b).svg).toContain("<circle class=\"lp\"");
    b.options.lonePairStyle = "lines";
    const lines = renderMolecule(b).svg;
    expect(lines).toContain("<line class=\"lp\"");
    expect(lines).not.toContain("<circle class=\"lp\"");
  });
  it("lone pairs per the spec table: H2O 2, NH3 1, CO2 2+2, HCl 3", async () => {
    expect(count(renderMolecule(await lewisOf("O")).svg, /data-lp-id=/g)).toBe(2);
    expect(count(renderMolecule(await lewisOf("N")).svg, /data-lp-id=/g)).toBe(1);
    expect(count(renderMolecule(await lewisOf("O=C=O")).svg, /data-lp-id=/g)).toBe(4);
    expect(count(renderMolecule(await lewisOf("Cl")).svg, /data-lp-id=/g)).toBe(3);
  });
  it("each pair can be hidden alone (student version); the answer key shows them all", async () => {
    const base = await lewisOf("CC(=O)O");
    const o3 = base.graph.atoms[2];
    const student = { ...base, exerciseMode: "student" as const, edits: { ...base.edits, lonePairs: { [o3.id]: [true, false] } } };
    expect(lonePairShown(student, o3.id, 0)).toBe(true);
    expect(lonePairShown(student, o3.id, 1)).toBe(false);
    expect(count(renderMolecule(student).svg, /data-lp-id=/g)).toBe(3);
    // the editor (ghost) view still draws the hidden pair, faded, so it can be selected again
    const ghost = renderMolecule(student, { ghost: true }).svg;
    expect(count(ghost, /data-lp-id=/g)).toBe(4);
    expect(ghost).toContain('data-vis="hidden"');
    expect(count(renderMolecule({ ...student, exerciseMode: "answer" }).svg, /data-lp-id=/g)).toBe(4);
  });
  it("a hidden atom takes its lone pairs with it", async () => {
    const base = await lewisOf("CC(=O)O");
    const o3 = base.graph.atoms[2];
    const student = { ...base, exerciseMode: "student" as const, edits: { ...base.edits, atoms: { [o3.id]: { vis: "hidden" as const } } } };
    expect(count(renderMolecule(student).svg, /data-lp-id=/g)).toBe(2);
  });
  it("formal charges are drawn in circles", async () => {
    const r = renderMolecule(await lewisOf("C[N+](C)(C)C"));
    expect(r.svg).toContain("data-charge-of");
    expect(r.svg).toContain(">+</text>");
  });
  it("the editor view of a normal molecule equals the final drawing, apart from nothing being faded", async () => {
    const b = await lewisOf("CC(=O)O");
    expect(renderMolecule(b, { ghost: true }).svg).toBe(renderMolecule(b).svg);
  });
});

describe("octet check", () => {
  it("is happy with the usual molecules", async () => {
    for (const smi of ["O", "N", "C", "CC(=O)O", "O=C=O", "Cl", "C=C", "C#C", "O=S=O"]) expect(octetIssues(await e.fromSmiles(smi)), smi).toEqual([]);
  });
  it("reports an incomplete octet (BF3) and a radical (NO)", async () => {
    expect(octetIssues(await e.fromSmiles("FB(F)F")).map((i) => i.electrons)).toEqual([6]);
    expect(octetIssues(await e.fromSmiles("[N]=O")).length).toBeGreaterThan(0);
  });
});

describe("blank atoms in the Lewis student version", () => {
  it("a blank atom takes its lone pairs and charge with it, like a hidden one", async () => {
    const base = await lewisOf("CC(=O)O");
    const o3 = base.graph.atoms[2];
    const student = { ...base, exerciseMode: "student" as const, edits: { ...base.edits, atoms: { [o3.id]: { vis: "blank" as const } } } };
    expect(count(renderMolecule(student).svg, /data-lp-id=/g)).toBe(2); // only the hydroxyl O's pairs remain
  });
});
