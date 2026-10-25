import { describe, expect, it } from "vitest";
import { displayFormula } from "../chem";
import { semiText } from "../render/semiStructural";
import { blockFor, testEngine } from "./helpers";
import type { SemiStyle } from "../model";

const e = testEngine();
const semi = async (smiles: string, style: SemiStyle = "semi") => {
  const r = semiText(await e.fromSmiles(smiles), style);
  return "text" in r ? r.text : `!${r.warning}`;
};

describe("semi-structural formula", () => {
  it("acetic acid in the three styles (spec 7.2)", async () => {
    expect(await semi("CC(=O)O")).toBe("CH3–COOH");
    expect(await semi("CC(=O)O", "fully-condensed")).toBe("CH3COOH");
    expect(await semi("CC(=O)O", "semi-expanded")).toBe("CH3–C(=O)–OH");
  });
  it("alkanes, branched alkanes", async () => {
    expect(await semi("CC")).toBe("CH3–CH3");
    expect(await semi("CCCC")).toBe("CH3–CH2–CH2–CH3");
    expect(await semi("CC(C)C")).toBe("CH3–CH(CH3)–CH3");
    expect(await semi("CC(C)(C)C")).toBe("CH3–C(CH3)(CH3)–CH3");
    expect(await semi("CC(C)C", "fully-condensed")).toBe("CH3CH(CH3)CH3");
  });
  it("alkenes and alkynes", async () => {
    expect(await semi("C=C")).toBe("CH2=CH2");
    expect(await semi("C#C")).toBe("CH≡CH");
    expect(await semi("C=CC")).toBe("CH3–CH=CH2");
  });
  it("alcohols", async () => {
    expect(await semi("CCO")).toBe("CH3–CH2–OH");
    expect(await semi("CC(C)O")).toBe("CH3–CH(OH)–CH3");
    expect(await semi("CO")).toBe("CH3–OH");
  });
  it("aldehydes and ketones", async () => {
    expect(await semi("CC=O")).toBe("CH3–CHO");
    expect(await semi("CC(=O)C")).toBe("CH3–CO–CH3");
    expect(await semi("CC(=O)C", "semi-expanded")).toBe("CH3–C(=O)–CH3");
  });
  it("acids, esters, amides, amines", async () => {
    expect(await semi("CCC(=O)O")).toBe("CH3–CH2–COOH");
    expect(await semi("O=CO")).toBe("HCOOH");
    expect(await semi("COC=O")).toBe("HCOO–CH3");
    expect(await semi("CCOC(C)=O")).toBe("CH3–COO–CH2–CH3");
    expect(await semi("CC(N)=O")).toBe("CH3–CONH2");
    expect(await semi("CN")).toBe("CH3–NH2");
    expect(await semi("CCl")).toBe("CH3–Cl");
  });
  it("small inorganic molecules", async () => {
    expect(await semi("O")).toBe("H2O");
    expect(await semi("N")).toBe("NH3");
    expect(await semi("C")).toBe("CH4");
    expect(await semi("Cl")).toBe("HCl");
    expect(await semi("O=C=O")).toBe("O=C=O");
    expect(await semi("O=S=O")).toBe("O=S=O");
    expect(await semi("O=O")).toBe("O=O");
    expect(await semi("N#N")).toBe("N≡N");
    expect(await semi("OO")).toBe("HO–OH");
  });
  it("says so for rings instead of drawing something wrong", async () => {
    expect(await semi("c1ccccc1")).toBe("!ring");
  });
  it("conventional molecular formulas", async () => {
    const f = async (s: string) => displayFormula(await e.fromSmiles(s));
    expect(await f("CC(=O)O")).toBe("C2H4O2");
    expect(await f("N")).toBe("NH3");
    expect(await f("O")).toBe("H2O");
    expect(await f("Cl")).toBe("HCl");
    expect(await f("O=S=O")).toBe("SO2");
    expect(await f("O=C=O")).toBe("CO2");
    expect(await f("OO")).toBe("H2O2");
    expect(await f("[H][H]")).toBe("H2");
    expect((await blockFor("CC")).graph.atoms).toHaveLength(8);
  });
});
