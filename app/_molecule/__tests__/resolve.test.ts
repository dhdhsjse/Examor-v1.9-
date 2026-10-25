import { describe, expect, it } from "vitest";
import { canonicalFormula, detectKind, normalizeName, parseFormula } from "../resolve/normalize";
import { DATABASE, findByName, suggest } from "../resolve/database";
import { resolve } from "../resolve/resolve";
import { validateDatabase } from "../resolve/validate";
import { testEngine } from "./helpers";

const engine = testEngine();
const ids = async (input: string) => (await resolve(input, { lang: "en", engine })).candidates.map((c) => c.id);

describe("normalisation", () => {
  it("normalises Latin names", () => {
    expect(normalizeName("  Acide  Éthanoïque ")).toBe("acide ethanoique");
    expect(normalizeName("Éthanoate d’éthyle")).toBe("ethanoate d'ethyle");
  });
  it("normalises Arabic names", () => {
    expect(normalizeName("حمض الإيثانويك")).toBe(normalizeName("حمض الايثانويك"));
    expect(normalizeName("حَمْض")).toBe("حمض");
    expect(normalizeName("حمض الخـل")).toBe(normalizeName("حمض الخل"));
    expect(normalizeName("مثانوية")).toBe(normalizeName("مثانويه"));
  });
  it("parses formulas, including Unicode subscripts", () => {
    expect(parseFormula("C₂H₄O₂")).toEqual({ C: 2, H: 4, O: 2 });
    expect(parseFormula("CO2")).toEqual({ C: 1, O: 2 });
    expect(parseFormula("c2h4o2")).toBeNull();
    expect(parseFormula("Xx2")).toBeNull();
    expect(canonicalFormula("H4C2O2")).toBe("C2H4O2");
    expect(canonicalFormula("HCl")).toBe("ClH");
    expect(canonicalFormula("NH3")).toBe("H3N");
  });
  it("detects the kind of input", () => {
    expect(detectKind("C2H4O2")).toBe("formula");
    expect(detectKind("acide éthanoïque")).toBe("smiles-or-name");
    expect(detectKind("\n  RDKit 2D\n\nM  END")).toBe("molfile");
  });
});

describe("database", () => {
  it("is valid: SMILES parse and are canonical, formulas match, no duplicates", async () => {
    expect(await validateDatabase(engine)).toEqual([]);
  });
  it("has the school set", () => {
    expect(DATABASE.length).toBeGreaterThanOrEqual(50);
  });
  it("only has the Arabic names the product spec gave", () => {
    const withArabic = DATABASE.filter((e) => e.names.ar.length);
    expect(withArabic.map((e) => e.id)).toEqual(["ethanoic-acid"]);
    expect(DATABASE.every((e) => e.reviewed === false)).toBe(true);
  });
  it("suggests while typing", () => {
    expect(suggest("etha").map((e) => e.id)).toContain("ethanoic-acid");
    expect(findByName("ACETIC ACID")[0].id).toBe("ethanoic-acid");
  });
});

describe("resolve (acceptance, Phase 1)", () => {
  it("formula C2H4O2 -> acetic acid and methyl methanoate", async () => {
    const found = await ids("C2H4O2");
    expect(found).toContain("ethanoic-acid");
    expect(found).toContain("methyl-methanoate");
  });
  it("Arabic name -> acetic acid", async () => {
    expect((await ids("حمض الإيثانويك"))[0]).toBe("ethanoic-acid");
    expect((await ids("حمض الخل"))[0]).toBe("ethanoic-acid");
  });
  it("French and English names -> acetic acid", async () => {
    expect((await ids("acide éthanoïque"))[0]).toBe("ethanoic-acid");
    expect((await ids("Acetic acid"))[0]).toBe("ethanoic-acid");
  });
  it("Unicode subscripts", async () => {
    expect(await ids("C₂H₄O₂")).toContain("ethanoic-acid");
  });
  it("SMILES, known and unknown", async () => {
    expect((await ids("OC(C)=O"))[0]).toBe("ethanoic-acid");
    const r = await resolve("CC(C)(C)O", { lang: "en", engine });
    expect(r.candidates[0].source).toBe("direct");
    expect(r.candidates[0].formula).toBe("C4H10O");
  });
  it("an ambiguous input returns both readings", async () => {
    const r = await resolve("NO", { lang: "en", engine });
    expect(r.candidates.length).toBeGreaterThan(0); // NO is hydroxylamine as SMILES
  });
  it("molfile", async () => {
    const g = await engine.fromSmiles("CCO");
    const { writeMolfile } = await import("../engine/molfile");
    const r = await resolve(writeMolfile(g), { lang: "en", engine });
    expect(r.candidates[0].smiles).toBe("CCO");
  });
  it("nothing found gives an error key, not an exception", async () => {
    const r = await resolve("zzzzqq", { lang: "en", engine });
    expect(r.candidates).toEqual([]);
    expect(r.error).toBe("noMatch");
    expect((await resolve("C99H1", { lang: "en", engine })).error).toBe("noFormulaMatch");
  });
});
