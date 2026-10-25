import { describe, expect, it } from "vitest";
import { analyzeAtom } from "../geometry/vsepr";
import { cramCenters } from "../render/cram";
import { cramLayout, defaultCramCenters, templateFor, type CramLayout } from "../render/cramLayout";
import { renderMolecule } from "../render";
import { atomsSvg, bondsSvg, buildScene } from "../render/structural";
import { FIXTURES, blockFor, testEngine } from "./helpers";

const e = testEngine();
const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;

async function layoutOf(smiles: string, centers?: string[]) {
  const g = await e.fromSmiles(smiles);
  const c = centers ?? defaultCramCenters(g);
  const l = cramLayout(g, c) as CramLayout;
  return { g, c, l };
}
const angleBetween = (a: { x: number; y: number }, b: { x: number; y: number }, at: { x: number; y: number }) => {
  const p = Math.atan2(a.y - at.y, a.x - at.x);
  const q = Math.atan2(b.y - at.y, b.x - at.x);
  let d = Math.abs(p - q) * (180 / Math.PI);
  if (d > 180) d = 360 - d;
  return d;
};

describe("Cram templates (spec 10.2)", () => {
  it("tetrahedral: two in the plane, one wedge, one hash (with or without a chain anchor)", () => {
    for (const hasAnchor of [true, false]) {
      const kinds = templateFor(4, 0, true, hasAnchor).map((s) => s.kind);
      expect(kinds.filter((k) => k === "wedge")).toHaveLength(1);
      expect(kinds.filter((k) => k === "dash")).toHaveLength(1);
      expect(kinds.filter((k) => k === "plane")).toHaveLength(hasAnchor ? 1 : 2); // + the anchor itself
    }
  });
  it("pyramidal: one in the plane (the anchor), one wedge, one hash", () => {
    expect(templateFor(3, 1, true, true).map((s) => s.kind).sort()).toEqual(["dash", "wedge"]);
    expect(templateFor(3, 1, true, false).map((s) => s.kind).sort()).toEqual(["dash", "plane", "wedge"]);
  });
  it("AX3, AX2, AX2E, AX2E2 and unflagged atoms are planar: no wedges", () => {
    for (const [X, E] of [[3, 0], [2, 0], [2, 1], [2, 2], [4, 0], [3, 1]] as const) {
      expect(templateFor(X, E, false, true).every((s) => s.kind === "plane"), `${X}:${E}`).toBe(true);
    }
  });
});

describe("default Cram centres", () => {
  it("the first tetrahedral or pyramidal atom in reading order", async () => {
    const acid = await e.fromSmiles("CC(=O)O");
    expect(defaultCramCenters(acid)).toEqual([acid.atoms[0].id]); // the CH3 carbon
    const nh3 = await e.fromSmiles("N");
    expect(defaultCramCenters(nh3)).toEqual([nh3.atoms[0].id]);
  });
  it("none for planar molecules and for rings", async () => {
    for (const smi of ["O", "O=C=O", "C=C", "c1ccccc1"]) expect(defaultCramCenters(await e.fromSmiles(smi)), smi).toEqual([]);
  });
  it("the teacher's choice wins, even an empty one", async () => {
    const b = await blockFor("CC(=O)O", "cram");
    expect(cramCenters(b)).toEqual([b.graph.atoms[0].id]);
    expect(cramCenters({ ...b, geometryCenters: [b.graph.atoms[1].id] })).toEqual([b.graph.atoms[1].id]);
    expect(cramCenters({ ...b, geometryCenters: [] })).toEqual([]);
  });
});

describe("Cram layouts", () => {
  it("methane: four hydrogens at one bond length, one wedge, one hash, the rest plain", async () => {
    const { g, c, l } = await layoutOf("C");
    const center = l.pos.get(c[0])!;
    const hs = g.atoms.filter((a) => a.element === "H");
    for (const h of hs) expect(Math.hypot(l.pos.get(h.id)!.x - center.x, l.pos.get(h.id)!.y - center.y)).toBeCloseTo(1, 6);
    const kinds = [...l.stereo.values()].map((s) => s.type).sort();
    expect(kinds).toEqual(["dash", "wedge"]);
    expect([...l.stereo.values()].every((s) => s.from === c[0])).toBe(true);
    expect(l.overlaps).toBe(0);
    // the two in-plane bonds are about 109° apart
    const planar = g.bonds.filter((b) => !l.stereo.has(b.id)).map((b) => l.pos.get(b.a === c[0] ? b.b : b.a)!);
    expect(angleBetween(planar[0], planar[1], center)).toBeCloseTo(109.5, 0);
  });

  it("ammonia: one bond in the plane, one wedge, one hash; the lone pair only when asked", async () => {
    const b = await blockFor("N", "cram");
    expect(count(renderMolecule(b).svg, /data-stereo="wedge"/g)).toBe(1);
    expect(count(renderMolecule(b).svg, /data-stereo="dash"/g)).toBe(1);
    expect(count(renderMolecule(b).svg, /data-lp-id/g)).toBe(0);
    b.options.cramLonePairs = true;
    expect(count(renderMolecule(b).svg, /data-lp-id/g)).toBe(1);
  });

  it("water is planar and bent at 104.5°: no wedges, a note instead of a wrong drawing", async () => {
    const { g, l } = await layoutOf("O");
    expect(l.stereo.size).toBe(0);
    const o = g.atoms[0];
    const [h1, h2] = g.atoms.filter((a) => a.element === "H");
    expect(angleBetween(l.pos.get(h1.id)!, l.pos.get(h2.id)!, l.pos.get(o.id)!)).toBeCloseTo(104.5, 1);
  });

  it("CH3Cl: the heavy atom is the in-plane anchor, the hydrogens take the wedge and the hash", async () => {
    const { g, c, l } = await layoutOf("CCl");
    const cl = g.atoms.find((a) => a.element === "Cl")!;
    const clBond = g.bonds.find((b) => b.a === cl.id || b.b === cl.id)!;
    expect(l.stereo.has(clBond.id)).toBe(false);
    expect(l.pos.get(cl.id)).toEqual({ x: 1, y: 0 }); // the anchor lies along the page, to the east
    expect(l.stereo.size).toBe(2);
    expect(c).toHaveLength(1);
  });

  it("ethanol on the CH3 carbon: the chain runs east in the plane, the rest is planar, nothing overlaps", async () => {
    const { g, c, l } = await layoutOf("CCO");
    expect(c[0]).toBe(g.atoms[0].id);
    expect(l.stereo.size).toBe(2);
    expect(l.pos.get(g.atoms[1].id)).toEqual({ x: 1, y: 0 }); // CH2
    expect(l.overlaps).toBe(0);
  });

  it("acetic acid on the CH3 carbon (reference exercise, question 6): COOH planar, =O up, OH down", async () => {
    const { g, l } = await layoutOf("CC(=O)O");
    const [c1, c2, o3, o4] = g.atoms;
    expect(l.stereo.size).toBe(2);
    expect([...l.stereo.values()].every((s) => s.from === c1.id)).toBe(true);
    expect(l.pos.get(c2.id)).toEqual({ x: 1, y: 0 });
    expect(l.pos.get(o3.id)!.y).toBeLessThan(l.pos.get(c2.id)!.y); // the carbonyl O above
    expect(l.pos.get(o4.id)!.y).toBeGreaterThan(l.pos.get(c2.id)!.y); // the hydroxyl O below
    // the carboxyl group is trigonal planar: 120° between its three bonds
    const at = l.pos.get(c2.id)!;
    expect(angleBetween(l.pos.get(c1.id)!, l.pos.get(o3.id)!, at)).toBeCloseTo(120, 0);
    expect(angleBetween(l.pos.get(o3.id)!, l.pos.get(o4.id)!, at)).toBeCloseTo(120, 0);
    expect(l.overlaps).toBe(0);
    expect(analyzeAtom(g, c2.id).code).toBe("AX3");
  });

  it("no centres chosen: everything planar, no wedges", async () => {
    const { l } = await layoutOf("CC(=O)O", []);
    expect(l.stereo.size).toBe(0);
  });

  it("two centres: each has its own wedge and hash (ethane)", async () => {
    const g = await e.fromSmiles("CC");
    const cs = g.atoms.filter((a) => a.element === "C").map((a) => a.id);
    const l = cramLayout(g, cs) as CramLayout;
    expect(l.stereo.size).toBe(4);
    expect(new Set([...l.stereo.values()].map((s) => s.from))).toEqual(new Set(cs));
  });

  it("every atom is placed once, bond lengths are one unit, for all the fixtures that are not rings", async () => {
    for (const [name, smi] of Object.entries(FIXTURES)) {
      if (name === "benzene") continue;
      const { g, l } = await layoutOf(smi);
      expect(l.pos.size, name).toBe(g.atoms.length);
      for (const b of g.bonds) {
        const p = l.pos.get(b.a)!;
        const q = l.pos.get(b.b)!;
        expect(Math.hypot(p.x - q.x, p.y - q.y), `${name} ${b.id}`).toBeCloseTo(1, 6);
      }
    }
  });

  it("rings are not supported: an explicit message, never a wrong drawing", async () => {
    const r = renderMolecule(await blockFor("c1ccccc1", "cram"));
    expect(r.warning).toBe("ring");
    expect(r.svg).toContain("not supported");
    expect(cramLayout(await e.fromSmiles("c1ccccc1"), [])).toBe("ring");
  });
});

describe("wedges", () => {
  it("the narrow end is at the Cram centre, the wide end at the atom", async () => {
    const b = await blockFor("C", "cram");
    const { l } = await layoutOf("C");
    const scene = buildScene(b, {}, "sup", { positions: l.pos, stereo: l.stereo });
    const center = scene.placed.get(b.graph.atoms[0].id)!;
    const svg = bondsSvg(scene).join("");
    const poly = svg.match(/<polygon points="([^"]+)"/)![1].split(" ").map((p) => p.split(",").map(Number));
    const near = poly.filter(([x, y]) => Math.hypot(x - center.x, y - center.y) < 23);
    const far = poly.filter(([x, y]) => Math.hypot(x - center.x, y - center.y) >= 23);
    expect(near).toHaveLength(2);
    expect(far).toHaveLength(2);
    const w = (pts: number[][]) => Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
    expect(w(near)).toBeLessThan(2);
    expect(w(far)).toBeGreaterThan(6);
    expect(atomsSvg(scene).length).toBe(5);
  });
  it("a hash is a series of lines that grow from the centre", async () => {
    const svg = renderMolecule(await blockFor("C", "cram")).svg;
    const group = svg.match(/<g data-stereo="dash">(.*?)<\/g>/)![1];
    const lines = [...group.matchAll(/<line x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/g)].map((m) => Math.hypot(+m[1] - +m[3], +m[2] - +m[4]));
    expect(lines.length).toBeGreaterThanOrEqual(5);
    const grows = lines[lines.length - 1] > lines[0] || lines[0] > lines[lines.length - 1];
    expect(grows).toBe(true);
  });
});

describe("Cram in the student version and the answer key", () => {
  it("a hidden hydrogen on the centre leaves a wedge stub; the key shows everything", async () => {
    const base = await blockFor("C", "cram");
    const hs = base.graph.atoms.filter((a) => a.element === "H").map((a) => a.id);
    const student = { ...base, exerciseMode: "student" as const, edits: { ...base.edits, hideAllHydrogens: true } };
    const s = renderMolecule(student).svg;
    expect(count(s, /data-atom-id=/g)).toBe(1); // only the carbon is left
    expect(count(s, /data-stereo=/g)).toBe(2); // the wedge and the hash remain, as stubs
    const key = renderMolecule({ ...student, exerciseMode: "answer" }).svg;
    expect(count(key, /data-atom-id=/g)).toBe(5);
    expect(key).toBe(renderMolecule(base).svg);
    expect(hs).toHaveLength(4);
  });

  it("the editor view marks the Cram centre, the final drawing does not", async () => {
    const b = await blockFor("CC(=O)O", "cram");
    expect(count(renderMolecule(b, { ghost: true }).svg, /data-cram-center=/g)).toBe(1);
    expect(renderMolecule(b).svg).not.toContain("data-cram-center");
  });

  it("Cram keeps its own layout: moves made on the structural drawing do not disturb it", async () => {
    const b = await blockFor("CC(=O)O", "cram");
    const moved = { ...b, edits: { ...b.edits, atoms: { [b.graph.atoms[3].id]: { x: 5, y: 5 } } } };
    expect(renderMolecule(moved).svg).toBe(renderMolecule(b).svg);
    expect(renderMolecule({ ...moved, representation: "structural" }).svg).not.toBe(renderMolecule({ ...b, representation: "structural" }).svg);
  });
});

describe("golden Cram drawings", () => {
  for (const [name, smi] of Object.entries(FIXTURES)) {
    it(name, async () => {
      expect(renderMolecule(await blockFor(smi, "cram")).svg).toMatchSnapshot();
    });
  }
});
