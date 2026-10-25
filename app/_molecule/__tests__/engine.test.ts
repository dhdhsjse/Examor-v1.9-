import { describe, expect, it } from "vitest";
import { formula, lonePairsFor, perceiveRings, valence } from "../chem";
import { parseMolfile, writeMolfile } from "../engine/molfile";
import { FIXTURES, testEngine } from "./helpers";

const e = testEngine();

describe("engine", () => {
  it("parses acetic acid with explicit hydrogens", async () => {
    const g = await e.fromSmiles("CC(=O)O");
    expect(g.atoms).toHaveLength(8);
    expect(g.atoms.filter((a) => a.element === "H")).toHaveLength(4);
    expect(g.bonds).toHaveLength(7);
    expect(g.bonds.filter((b) => b.order === 2)).toHaveLength(1);
    expect(e.formula(g)).toBe("C2H4O2");
  });

  it("gives Hill formulas for the fixtures", async () => {
    const expected: Record<string, string> = {
      methane: "CH4", ethane: "C2H6", ethene: "C2H4", ethyne: "C2H2", water: "H2O", ammonia: "H3N", co2: "CO2", hcl: "ClH",
      ethanol: "C2H6O", aceticAcid: "C2H4O2", benzene: "C6H6", propanone: "C3H6O", ethanal: "C2H4O", methylMethanoate: "C2H4O2",
    };
    for (const [name, smi] of Object.entries(FIXTURES)) expect(e.formula(await e.fromSmiles(smi)), name).toBe(expected[name]);
  });

  it("rejects invalid SMILES", async () => {
    await expect(e.fromSmiles("C(C")).rejects.toThrow(/Invalid SMILES/);
  });

  it("round-trips through a molfile and canonical SMILES", async () => {
    const g = await e.fromSmiles("CC(=O)O");
    const back = parseMolfile(writeMolfile(g));
    expect(back.atoms).toHaveLength(g.atoms.length);
    expect(back.bonds.map((b) => b.order)).toEqual(g.bonds.map((b) => b.order));
    expect(await e.toSmiles(g)).toBe("CC(=O)O");
    expect(await e.toSmiles(await e.fromSmiles("OC(C)=O"))).toBe("CC(=O)O");
  });

  it("keeps charges", async () => {
    const g = await e.fromSmiles("C[N+](C)(C)C");
    expect(g.atoms.find((a) => a.element === "N")?.charge).toBe(1);
    expect(await e.toSmiles(g)).toBe("C[N+](C)(C)C");
  });

  it("computes lone pairs (spec table)", async () => {
    const lp = async (smi: string, el: string) => (await e.fromSmiles(smi)).atoms.filter((a) => a.element === el).map((a) => a.lonePairs);
    expect(await lp("O", "O")).toEqual([2]);
    expect(await lp("N", "N")).toEqual([1]);
    expect(await lp("O=C=O", "O")).toEqual([2, 2]);
    expect(await lp("CC(=O)O", "O")).toEqual([2, 2]);
    expect(await lp("Cl", "Cl")).toEqual([3]);
    expect(lonePairsFor("O", -1, 1)).toBe(3);
    expect(lonePairsFor("N", 1, 4)).toBe(0);
  });

  it("checks valence", async () => {
    const g = await e.fromSmiles("CC(=O)O");
    const carbonyl = g.atoms[1];
    expect(valence(g, carbonyl.id)).toEqual({ used: 4, allowed: [4] });
    const nplus = await e.fromSmiles("C[N+](C)(C)C");
    expect(valence(nplus, nplus.atoms.find((a) => a.element === "N")!.id).allowed).toEqual([4]);
  });

  it("finds rings", async () => {
    expect(perceiveRings(await e.fromSmiles("CC(=O)O"))).toHaveLength(0);
    const benzene = perceiveRings(await e.fromSmiles("c1ccccc1"));
    expect(benzene).toHaveLength(1);
    expect(benzene[0]).toHaveLength(6);
    expect(formula(await e.fromSmiles("c1ccccc1"))).toBe("C6H6");
  });
});
