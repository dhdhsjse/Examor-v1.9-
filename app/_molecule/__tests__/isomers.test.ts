import { describe, expect, it } from "vitest";
import { parseFormula } from "../resolve/normalize";
import { DATABASE } from "../resolve/database";
import { resolve } from "../resolve/resolve";
import { describeMolecule, relation } from "../isomers/describe";
import { buildIsomerFile } from "../isomers/build";
import { isomerFormulas, schoolFamily } from "../isomers/formulas";
import { functionalGroups, isBranched } from "../isomers/groups";
import { hasIsomerTable, isomerFormulaList, loadIsomers } from "../isomers/load";
import { schoolIssues } from "../isomers/school";
import { GROUP_LABEL, ISSUE_LABEL, RELATION_LABEL, type GroupId } from "../isomers/types";
import { MOLECULE_AR, MOLECULE_FR } from "../strings";
import { testEngine } from "./helpers";

const e = testEngine();
const groups = async (smiles: string) => functionalGroups(await e.fromSmiles(smiles));
const issues = async (smiles: string) => schoolIssues(await e.fromSmiles(smiles));

describe("functional groups", () => {
  it("names the groups of typical molecules", async () => {
    const cases: Record<string, GroupId[]> = {
      CCO: ["alcohol"],
      CC: ["alkane"],
      "C=C": ["alkene"],
      "C#C": ["alkyne"],
      "CC=O": ["aldehyde"],
      "CC(C)=O": ["ketone"],
      "CC(=O)O": ["carboxylic-acid"],
      "COC=O": ["ester"],
      "CC(N)=O": ["amide"],
      CN: ["amine"],
      COC: ["ether"],
      CCCl: ["halide"],
      "CC#N": ["nitrile"],
      "O=CCO": ["alcohol", "aldehyde"],
      c1ccccc1: ["aromatic"],
      Cc1ccccc1: ["aromatic"],
      Oc1ccccc1: ["aromatic", "phenol"], // in the order of GROUP_ORDER
      C1CCCCC1: ["cycloalkane"],
      C1CO1: ["ether"],
    };
    for (const [smi, want] of Object.entries(cases)) expect(await groups(smi), smi).toEqual(want);
  });

  it("agrees with the tags of every carbon molecule of the database", async () => {
    const tagToGroup: Record<string, GroupId> = { alkane: "alkane", alkene: "alkene", alkyne: "alkyne", alcohol: "alcohol", aldehyde: "aldehyde", ketone: "ketone", "carboxylic-acid": "carboxylic-acid", ester: "ester", amine: "amine", amide: "amide", halogenoalkane: "halide", aromatic: "aromatic" };
    for (const d of DATABASE) {
      if (!parseFormula(d.formula)?.C) continue;
      const found = functionalGroups(await e.fromSmiles(d.smiles));
      for (const tag of d.tags) {
        const want = tagToGroup[tag];
        if (!want) continue;
        const ok = found.includes(want) || (tag === "alcohol" && found.includes("phenol"));
        expect(ok, `${d.id} is tagged ${tag}, found ${found.join(",")}`).toBe(true);
      }
    }
  });

  it("branched chains", async () => {
    expect(isBranched(await e.fromSmiles("CC(C)C"))).toBe(true);
    expect(isBranched(await e.fromSmiles("CCCC"))).toBe(false);
    expect(isBranched(await e.fromSmiles("CC(C)(C)C"))).toBe(true);
    expect(isBranched(await e.fromSmiles("Cc1ccccc1"))).toBe(false); // a ring is not a branched chain
  });
});

describe("school filter", () => {
  it("rejects what a school would not show", async () => {
    expect(await issues("C1CO1")).toEqual(["small-ring"]);
    expect(await issues("C1CCC1")).toEqual(["small-ring"]);
    expect(await issues("COO")).toEqual(["peroxide"]);
    expect(await issues("C=C=C")).toEqual(["cumulated"]);
    expect(await issues("C=C=O")).toEqual(["cumulated"]);
    expect(await issues("C=CO")).toEqual(["enol"]);
    expect(await issues("OC=CO")).toEqual(["enol"]);
    expect(await issues("CC(O)O")).toEqual(["gem-diol"]);
  });
  it("accepts the usual ones, hydrogen peroxide and carbon dioxide included", async () => {
    for (const smi of ["CC(=O)O", "COC=O", "O=CCO", "C1CCCC1", "C1CCCCC1", "c1ccccc1", "OO", "O=C=O", "CCOCC", "CC(C)=O"]) expect(await issues(smi), smi).toEqual([]);
  });
  it("lets every molecule of the database through", async () => {
    for (const d of DATABASE) expect(schoolIssues(await e.fromSmiles(d.smiles)), d.id).toEqual([]);
  });
});

describe("how two isomers relate", () => {
  const rel = async (a: string, b: string) => {
    const ga = await e.fromSmiles(a);
    const gb = await e.fromSmiles(b);
    return relation({ ...(await describeMolecule(e, ga)), smiles: await e.toSmiles(ga) }, { ...(await describeMolecule(e, gb)), smiles: await e.toSmiles(gb) });
  };
  it("function: another functional group", async () => {
    expect(await rel("CC(=O)O", "COC=O")).toBe("function");
    expect(await rel("CCO", "COC")).toBe("function");
    expect(await rel("CCC=O", "CC(C)=O")).toBe("function");
  });
  it("position: the same group on the same carbon skeleton", async () => {
    expect(await rel("CCCO", "CC(C)O")).toBe("position");
    expect(await rel("CCCCO", "CCC(C)O")).toBe("position");
    expect(await rel("C=CCC", "CC=CC")).toBe("position");
  });
  it("chain: the same group on another skeleton", async () => {
    expect(await rel("CCCC", "CC(C)C")).toBe("chain");
    expect(await rel("CCCCO", "CC(C)CO")).toBe("chain");
  });
  it("the molecule itself", async () => {
    expect(await rel("CCO", "OCC")).toBe("same");
  });
});

// What MAYGEN printed for C2H4O2 (see scripts/gen-isomers.mts)
const MAYGEN_C2H4O2 = ["OC(O)=C", "OC=CO", "O=C(O)C", "OOC=C", "O=CCO", "OC1OC1", "O1OCC1", "O1COC1", "O1OC1C", "O=COC"];

describe("building a table (the rules of the generator)", () => {
  it("C2H4O2: three school structures, the known ones first, the rest explained", async () => {
    const f = await buildIsomerFile(e, "C2H4O2", MAYGEN_C2H4O2);
    expect(f.total).toBe(10);
    expect(f.schoolTotal).toBe(3);
    expect(f.entries.slice(0, 3).map((x) => x.smiles)).toEqual(["CC(=O)O", "COC=O", "O=CCO"]);
    expect(f.entries[0].name).toMatchObject({ en: "ethanoic acid", fr: "acide éthanoïque" });
    expect(f.entries[1].name?.fr).toBe("méthanoate de méthyle");
    expect(f.entries[2].name).toBeUndefined(); // names are never generated
    const rest = f.entries.slice(3);
    expect(rest).toHaveLength(7);
    expect(rest.every((x) => !x.school && x.issues?.length)).toBe(true);
  });
  it("removes duplicates (different spellings of one molecule) and wrong formulas, and ignores blank lines", async () => {
    const f = await buildIsomerFile(e, "C2H4O2", ["CC(=O)O", "OC(C)=O", "O=C(C)O", "", "  ", "CCO", "not a smiles(("]);
    expect(f.total).toBe(1);
  });
  it("caps the lists and still counts everything", async () => {
    const f = await buildIsomerFile(e, "C2H4O2", MAYGEN_C2H4O2, { school: 2, other: 3 });
    expect(f.entries).toHaveLength(5);
    expect(f.total).toBe(10);
    expect(f.schoolTotal).toBe(3);
    expect(f.entries.filter((x) => x.school)).toHaveLength(2);
  });
  it("C4H10O: four alcohols and three ethers", async () => {
    const f = await buildIsomerFile(e, "C4H10O", ["CCCCO", "CCC(C)O", "CC(C)CO", "CC(C)(C)O", "CCCOC", "CCOCC", "COC(C)C"]);
    expect(f.schoolTotal).toBe(7);
    const g = (id: GroupId) => f.entries.filter((x) => x.groups.includes(id)).length;
    expect([g("alcohol"), g("ether")]).toEqual([4, 3]);
  });
});

describe("the shipped tables (acceptance, Phase 4)", () => {
  it("C2H4O2 shows acetic acid, methyl methanoate and hydroxyacetaldehyde on top under the school filter", async () => {
    const f = (await loadIsomers("C2H4O2"))!;
    expect(f.entries.filter((x) => x.school).slice(0, 3).map((x) => x.smiles)).toEqual(["CC(=O)O", "COC=O", "O=CCO"]);
    expect(f.schoolTotal).toBe(3);
  });
  it("C4H10 has two isomers, C4H10O alcohols and ethers", async () => {
    const butane = (await loadIsomers("C4H10"))!;
    expect(butane.total).toBe(2);
    expect(butane.entries.map((x) => x.smiles).sort()).toEqual(["CC(C)C", "CCCC"]);
    const c4h10o = (await loadIsomers("C4H10O"))!;
    expect(c4h10o.schoolTotal).toBe(7);
    expect(c4h10o.entries.filter((x) => x.groups.includes("alcohol"))).toHaveLength(4);
    expect(c4h10o.entries.filter((x) => x.groups.includes("ether"))).toHaveLength(3);
  });
  it("known counts of the alkanes (C5 3, C6 5, C7 9, C8 18)", async () => {
    for (const [f, n] of [["C5H12", 3], ["C6H14", 5], ["C7H16", 9], ["C8H18", 18]] as const) expect((await loadIsomers(f))!.total, f).toBe(n);
  });
  it("any spelling of the formula finds its table; unknown formulas have none", async () => {
    expect((await loadIsomers("C₂H₄O₂"))?.formula).toBe("C2H4O2");
    expect((await loadIsomers("H4C2O2"))?.formula).toBe("C2H4O2");
    expect(await loadIsomers("H2O")).toBeNull();
    expect(await loadIsomers("C99H1")).toBeNull();
    expect(hasIsomerTable("C4H10O")).toBe(true);
    expect(hasIsomerTable("CH4")).toBe(false); // one structure: nothing to browse
  });
  it("every carbon molecule of the database is in the table of its formula (MAYGEN found it, and it ranks first)", async () => {
    for (const d of DATABASE) {
      if (!hasIsomerTable(d.formula)) continue;
      const f = (await loadIsomers(d.formula))!;
      expect(f.entries.some((x) => x.smiles === d.smiles), `${d.id} in ${d.formula}`).toBe(true);
    }
  });
  it("has a table only for formulas of the list (and for most of them)", () => {
    const wanted = isomerFormulas();
    const have = isomerFormulaList();
    expect(have.length).toBeGreaterThan(150);
    expect(have.every((f) => wanted.includes(f))).toBe(true);
    expect(wanted.filter((f) => !have.includes(f)).length).toBeLessThan(40); // formulas with one structure or too many have none
  });
  it("phenol is not an enol, and the aromatic formulas of the database have tables", async () => {
    expect(await issues("Oc1ccccc1")).toEqual([]);
    expect(await issues("OC=CC")).toEqual(["enol"]);
    expect(hasIsomerTable("C6H6O")).toBe(true);
    const phenol = (await loadIsomers("C6H6O"))!.entries.find((x) => x.smiles === "Oc1ccccc1")!;
    expect(phenol.school).toBe(true);
  });
});

describe("the formula list", () => {
  it("has the database formulas and the school families, but no inorganic molecule", () => {
    const all = isomerFormulas();
    for (const f of ["C2H4O2", "C4H10", "C4H10O", "C6H12O2", "C8H18", "C3H6O", "C2H5Cl"]) expect(all, f).toContain(f);
    expect(all).not.toContain("H2O");
    expect(all).not.toContain("ClH"); // HCl has no carbon
    expect(all.every((f) => parseFormula(f)?.C)).toBe(true);
  });
  it("keeps the families small enough to generate", () => {
    for (const f of schoolFamily()) {
      const c = parseFormula(f)!;
      const hetero = (c.O ?? 0) + (c.N ?? 0) + (c.Cl ?? 0);
      expect(hetero, f).toBeLessThanOrEqual(c.C <= 2 ? 4 : 3);
      expect(c.O ?? 0, f).toBeLessThanOrEqual(2);
      expect(c.N ?? 0, f).toBeLessThanOrEqual(1);
      expect(c.Cl ?? 0, f).toBeLessThanOrEqual(2);
      expect(c.C, f).toBeLessThanOrEqual(8);
    }
  });
});

describe("isomers in the search results", () => {
  it("a formula lists the database molecules, then the school isomers of the table", async () => {
    const r = await resolve("C2H4O2", { lang: "en", engine: e });
    const ids = r.candidates.map((c) => c.id);
    expect(ids.slice(0, 2).sort()).toEqual(["ethanoic-acid", "methyl-methanoate"]);
    const third = r.candidates.find((c) => c.smiles === "O=CCO")!;
    expect(third.source).toBe("isomer-table");
    expect(third.names).toEqual({});
    expect(r.candidates.every((c) => c.smiles !== "C1CO1")).toBe(true); // nothing outside the school filter
  });
  it("a formula with many isomers is capped in the list (the gallery has them all)", async () => {
    const r = await resolve("C6H12O2", { lang: "en", engine: e });
    expect(r.candidates.length).toBeLessThanOrEqual(13);
    expect(r.candidates.filter((c) => c.source === "isomer-table").length).toBeGreaterThan(5);
  });
});

describe("translations of the isomer gallery", () => {
  it("every group, school issue and relation has a French and an Arabic name", () => {
    for (const key of [...Object.values(GROUP_LABEL), ...Object.values(ISSUE_LABEL), ...Object.values(RELATION_LABEL)]) {
      expect(MOLECULE_FR[key], `${key} (fr)`).toBeTruthy();
      expect(MOLECULE_AR[key], `${key} (ar)`).toBeTruthy();
    }
  });
});
