import { describe, expect, it } from "vitest";
import { availableRepresentations, renderMolecule } from "../render";
import { schoolLayout } from "../render/schoolLayout";
import { FIXTURES, blockFor, testEngine } from "./helpers";

const e = testEngine();
const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;

describe("renderers", () => {
  it("are registered: molecular, semi-structural, structural, skeletal, lewis, cram", () => {
    expect(availableRepresentations()).toEqual(["molecular", "semi-structural", "structural", "skeletal", "lewis", "cram"]);
  });

  it("molecular formula uses real subscripts", async () => {
    const r = renderMolecule(await blockFor("CC(=O)O", "molecular"));
    expect(r.svg).toContain(">C</tspan>");
    expect(r.svg).toMatch(/font-size="[\d.]+"[^>]*>2<\/tspan>/);
    expect(r.width).toBeGreaterThan(40);
  });

  it("structural shows every atom and every hydrogen (acetic acid)", async () => {
    const r = renderMolecule(await blockFor("CC(=O)O"));
    expect(count(r.svg, /data-atom-id=/g)).toBe(8);
    expect(count(r.svg, /data-bond-id=/g)).toBe(7);
    expect(count(r.svg, />H<\/tspan>/g)).toBe(4);
    expect(r.warning).toBeUndefined();
  });

  it("draws a double bond as two parallel lines", async () => {
    const r = renderMolecule(await blockFor("C=C"));
    const dbl = r.svg.match(/<g data-bond-id="[^"]+" stroke="#000"[^>]*>(?:<line[^>]*\/>){2}<line[^>]*data-hit/g);
    expect(dbl).toHaveLength(1);
  });

  it("the school layout puts acetic acid on the grid like the exercise figure", async () => {
    const b = await blockFor("CC(=O)O");
    const pos = schoolLayout(b.graph)!;
    const at = (i: number) => pos.get(b.graph.atoms[i].id)!;
    const [c1, c2, o3, o4] = [at(0), at(1), at(2), at(3)];
    expect(c2.x - c1.x).toBe(1); // chain runs left to right
    expect(c1.y).toBe(c2.y);
    expect(o3).toEqual({ x: c2.x, y: c2.y - 1 }); // carbonyl O straight up
    expect(o4).toEqual({ x: c2.x + 1, y: c2.y }); // OH to the right
    const gridded = [...pos.values()].every((p) => Number.isInteger(p.x) && Number.isInteger(p.y));
    expect(gridded).toBe(true);
    expect(new Set([...pos.values()].map((p) => `${p.x},${p.y}`)).size).toBe(8); // nothing overlaps
  });

  it("falls back to the engine layout, and says so, for rings", async () => {
    const r = renderMolecule(await blockFor("c1ccccc1"));
    expect(r.warning).toBe("school-layout-unavailable");
    expect(count(r.svg, /data-atom-id=/g)).toBe(12);
  });

  it("auto layout never reports a fallback", async () => {
    const b = await blockFor("CC(=O)O");
    b.options.layout = "auto";
    expect(renderMolecule(b).warning).toBeUndefined();
  });

  it("every fixture renders in every representation without an error", async () => {
    for (const [name, smi] of Object.entries(FIXTURES)) {
      for (const rep of availableRepresentations()) {
        const r = renderMolecule(await blockFor(smi, rep));
        expect(r.warning === "render-error", `${name}/${rep}`).toBe(false);
        expect(r.svg.startsWith("<svg"), `${name}/${rep}`).toBe(true);
      }
    }
  });

  it("an unregistered representation says so instead of drawing", async () => {
    const r = renderMolecule(await blockFor("C", "ball-and-stick" as never)); // a representation that does not exist yet
    expect(r.warning).toBe("not-available");
  });
});

describe("student version and answer key (7.7)", () => {
  it("hidden atoms leave stubs, blank atoms a box, answer mode ignores both", async () => {
    const answer = await blockFor("CC(=O)O");
    const o = answer.graph.atoms[2]; // carbonyl O
    const h = answer.graph.atoms.find((a) => a.element === "H")!;
    const student = { ...answer, exerciseMode: "student" as const, edits: { ...answer.edits, atoms: { [o.id]: { vis: "blank" as const }, [h.id]: { vis: "hidden" as const } } } };
    const key = { ...student, exerciseMode: "answer" as const };

    const s = renderMolecule(student).svg;
    expect(s).toContain('fill="#fff"'); // the blank O is a box (dashed by default)
    expect(s).toContain('stroke-dasharray="4 3"');
    expect(s).toContain(`data-bond-id`); // its bond is still there
    expect(count(s, /data-atom-id=/g)).toBe(7); // the hidden H is not drawn
    expect(count(s, /data-bond-id=/g)).toBe(7); // …but its bond remains, as a stub

    const k = renderMolecule(key);
    expect(count(k.svg, /data-atom-id=/g)).toBe(8);
    expect(k.svg).not.toContain('fill="#fff"');
    expect(k.svg).toBe(renderMolecule(await blockFor("CC(=O)O")).svg); // identical to the untouched answer
  });

  it("hideAllHydrogens hides every H, a hidden bond disappears, a blank bond is dashed", async () => {
    const base = await blockFor("CC(=O)O");
    const b = { ...base, exerciseMode: "student" as const, edits: { ...base.edits, hideAllHydrogens: true, bonds: { [base.graph.bonds[1].id]: { vis: "blank" as const }, [base.graph.bonds[2].id]: { vis: "hidden" as const } } } };
    const svg = renderMolecule(b).svg;
    expect(count(svg, />H<\/tspan>/g)).toBe(0);
    expect(count(svg, /stroke-dasharray="5 4"/g)).toBe(1);
    expect(count(svg, /data-bond-id=/g)).toBe(6 - 0); // 7 bonds, one hidden
  });

  it("label overrides and display-only bond order", async () => {
    const base = await blockFor("CC(=O)O");
    const o = base.graph.atoms[2];
    const dbl = base.graph.bonds.find((x) => x.order === 2)!;
    const b = { ...base, exerciseMode: "student" as const, edits: { ...base.edits, atoms: { [o.id]: { label: "?" } }, bonds: { [dbl.id]: { orderOverride: 1 as const } } } };
    const svg = renderMolecule(b).svg;
    expect(svg).toContain(">?</tspan>");
    expect(renderMolecule(base).svg).toContain(">O</tspan>");
  });

  it("the editor (ghost) view shows what the student version hides, faded, even while inserting as answer key", async () => {
    const base = await blockFor("CC(=O)O");
    const o3 = base.graph.atoms[2].id;
    const block = { ...base, exerciseMode: "answer" as const, edits: { ...base.edits, atoms: { [o3]: { vis: "hidden" as const } } } };
    const ghost = renderMolecule(block, { ghost: true }).svg;
    expect(count(ghost, /data-atom-id=/g)).toBe(8);
    expect(count(ghost, /data-vis="hidden"/g)).toBe(1);
    expect(count(renderMolecule(block).svg, /data-vis=/g)).toBe(0); // the real drawing has no fades
  });

  it("showHydrogens: none removes them, hetero-and-terminal keeps H on O and on CH3", async () => {
    const b = await blockFor("CCO");
    b.options.showHydrogens = "none";
    expect(count(renderMolecule(b).svg, /data-atom-id=/g)).toBe(3);
    b.options.showHydrogens = "hetero-and-terminal";
    const n = count(renderMolecule(b).svg, /data-atom-id=/g);
    expect(n).toBeGreaterThan(3);
    expect(n).toBeLessThan(9);
  });
});

describe("golden SVGs", () => {
  for (const [name, smi] of Object.entries(FIXTURES)) {
    it(`${name}`, async () => {
      const out: Record<string, string> = {};
      // The Phase 1 representations, pinned: adding renderers must not change their drawings.
      for (const rep of ["molecular", "semi-structural", "structural"] as const) out[rep] = renderMolecule(await blockFor(smi, rep)).svg;
      expect(out).toMatchSnapshot();
    });
  }
  for (const [name, smi] of Object.entries(FIXTURES)) {
    it(`lewis ${name}`, async () => {
      expect(renderMolecule(await blockFor(smi, "lewis")).svg).toMatchSnapshot();
    });
  }
  it("engine and renderers are deterministic", async () => {
    const a = renderMolecule(await blockFor("CC(=O)O")).svg;
    const g = await e.fromSmiles("CC(=O)O");
    expect(g.atoms).toHaveLength(8);
    expect(renderMolecule(await blockFor("CC(=O)O")).svg).toBe(a);
  });
});
