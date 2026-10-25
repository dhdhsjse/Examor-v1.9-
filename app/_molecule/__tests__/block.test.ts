import { describe, expect, it } from "vitest";
import { buildBlock } from "../block";
import { writeMolfile } from "../engine/molfile";
import { resolve } from "../resolve/resolve";
import { renderMolecule } from "../render";
import { testEngine } from "./helpers";

const engine = testEngine();

describe("block data", () => {
  it("builds the data stored in the page from a candidate", async () => {
    const { candidates } = await resolve("acide éthanoïque", { lang: "fr", engine });
    const b = await buildBlock(engine, candidates[0], { kind: "name", input: "acide éthanoïque", lang: "fr" }, "fr");
    expect(b.schema).toBe(1);
    expect(b.smiles).toBe("CC(=O)O");
    expect(b.graph.atoms).toHaveLength(8);
    expect(b.exerciseMode).toBe("answer");
    expect(b.options.layout).toBe("school");
    expect(b.options.monochrome).toBe(true);
    expect(b.options.lang).toBe("fr");
  });

  it("survives being saved as JSON and reopened (no lookup needed): same drawing", async () => {
    const { candidates } = await resolve("C2H4O2", { lang: "en", engine });
    const b = await buildBlock(engine, candidates[0], { kind: "formula", input: "C2H4O2" }, "en");
    const reopened = JSON.parse(JSON.stringify(b));
    expect(renderMolecule(reopened).svg).toBe(renderMolecule(b).svg);
  });

  it("builds from a molfile", async () => {
    const g = await engine.fromSmiles("CCO");
    const { candidates } = await resolve(writeMolfile(g), { lang: "en", engine });
    const b = await buildBlock(engine, candidates[0], { kind: "molfile", input: "" }, "en");
    expect(b.smiles).toBe("CCO");
  });
});
