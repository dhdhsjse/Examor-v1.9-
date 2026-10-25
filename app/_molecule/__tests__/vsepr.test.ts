import { describe, expect, it } from "vitest";
import { analyzeAtom, explainGeometry, GEOMETRY_NAMES, type GeometryId } from "../geometry/vsepr";
import { testEngine } from "./helpers";

const e = testEngine();

// AXE of the first atom of an element (or the n-th one) in a molecule
async function axe(smiles: string, element: string, nth = 0) {
  const g = await e.fromSmiles(smiles);
  const atom = g.atoms.filter((a) => a.element === element)[nth];
  return analyzeAtom(g, atom.id);
}

describe("VSEPR analysis (spec 10.1)", () => {
  it("acetic acid: the carboxyl carbon is AX3, trigonal planar, 120°", async () => {
    const a = await axe("CC(=O)O", "C", 1);
    expect([a.code, a.X, a.E, a.geometry, a.idealAngles]).toEqual(["AX3", 3, 0, "trigonal-planar", [120]]);
    expect(a.multipleBonds).toBe(1); // the C=O counts as one group
  });
  it("acetic acid: the CH3 carbon is AX4, tetrahedral, 109.5°", async () => {
    const a = await axe("CC(=O)O", "C", 0);
    expect([a.code, a.geometry, a.idealAngles]).toEqual(["AX4", "tetrahedral", [109.5]]);
  });
  it("water O is AX2E2 (bent 104.5°), ammonia N is AX3E (pyramidal), methane C is AX4", async () => {
    expect((await axe("O", "O")).code).toBe("AX2E2");
    expect(await axe("O", "O")).toMatchObject({ geometry: "bent", idealAngles: [104.5] });
    expect(await axe("N", "N")).toMatchObject({ code: "AX3E", geometry: "trigonal-pyramidal", idealAngles: [107] });
    expect((await axe("C", "C")).code).toBe("AX4");
  });
  it("CO2 carbon is AX2 (linear), each ethene carbon is AX3", async () => {
    expect(await axe("O=C=O", "C")).toMatchObject({ code: "AX2", geometry: "linear", idealAngles: [180] });
    expect((await axe("C=C", "C", 0)).code).toBe("AX3");
    expect((await axe("C=C", "C", 1)).code).toBe("AX3");
  });
  it("SO2 is bent (S has a lone pair), a hydrogen is a terminal atom", async () => {
    expect(await axe("O=S=O", "S")).toMatchObject({ code: "AX2E", geometry: "bent" });
    const hcl = await axe("Cl", "H");
    expect(hcl.geometry).toBe("terminal");
  });
  it("nitrite-like AX2E: SO2 written with a lone pair on S is bent", async () => {
    const g = await e.fromSmiles("[O-][S+]=O"); // charged form: S has a lone pair
    const s = g.atoms.find((a) => a.element === "S")!;
    expect(analyzeAtom(g, s.id)).toMatchObject({ X: 2, E: 1, code: "AX2E", geometry: "bent" });
  });
});

describe("explanations", () => {
  it("English, for the CH3 carbon of acetic acid", async () => {
    const a = await axe("CC(=O)O", "C", 0);
    expect(explainGeometry(a, "en")).toBe(
      "Around the carbon atom (the central atom) there are 4 bonded groups and no lone pair, so it is of type AX4: the geometry is tetrahedral, with bond angles of 109.5°.",
    );
  });
  it("French, for the carboxyl carbon (double bond counted once)", async () => {
    const a = await axe("CC(=O)O", "C", 1);
    const t = explainGeometry(a, "fr");
    expect(t).toContain("l'atome de carbone");
    expect(t).toContain("3 groupes liants");
    expect(t).toContain("une liaison double ou triple compte pour un seul groupe");
    expect(t).toContain("aucun doublet non liant");
    expect(t).toContain("AX3");
    expect(t).toContain("trigonale plane");
    expect(t).toContain("120°");
  });
  it("French elision and decimal comma", async () => {
    const t = explainGeometry(await axe("O", "O"), "fr");
    expect(t).toContain("l'atome d'oxygène");
    expect(t).toContain("2 doublets non liants");
    expect(t).toContain("d'environ 104,5°");
  });
  it("Arabic", async () => {
    const t = explainGeometry(await axe("CC(=O)O", "C", 1), "ar");
    expect(t).toContain("ذرة الكربون");
    expect(t).toContain("3 مجموعات رابطة");
    expect(t).toContain("AX3");
    expect(t).toContain("مثلثي مستوي");
    expect(t).toContain("120°");
    expect(explainGeometry(await axe("N", "N"), "ar")).toContain("زوج واحد غير رابط");
  });
  it("pyramidal and bent AX2E say the angle is approximate", async () => {
    expect(explainGeometry(await axe("N", "N"), "en")).toContain("about 107°");
    const g = await e.fromSmiles("[O-][S+]=O");
    const a = analyzeAtom(g, g.atoms.find((x) => x.element === "S")!.id);
    expect(explainGeometry(a, "en")).toContain("slightly less than 120°");
  });
  it("a terminal atom has no geometry to describe", async () => {
    const t = explainGeometry(await axe("Cl", "H"), "en");
    expect(t).toContain("end of the molecule");
  });
  it("every geometry has a name in the three languages", () => {
    for (const id of Object.keys(GEOMETRY_NAMES) as GeometryId[]) for (const l of ["ar", "fr", "en"] as const) expect(GEOMETRY_NAMES[id][l].length).toBeGreaterThan(0);
  });
});
