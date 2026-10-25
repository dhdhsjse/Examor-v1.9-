import { describe, expect, it } from "vitest";
import { ATOM_RADIUS, BOND_LENGTH, DOUBLE_OFFSET, TRIPLE_OFFSET, bondDrawing, graphBounds } from "../bondGeometry";
import { COMMON_ELEMENTS, ELEMENTS, PERIODIC_TABLE, tableCell, textColor } from "../periodicTable";
import { SAMPLE_MOLECULES } from "../samples";
import type { BondType, MoleculeGraph } from "../types";

describe("periodic table", () => {
  it("has the 118 elements, numbered 1 to 118 without gaps", () => {
    expect(ELEMENTS).toHaveLength(118);
    expect(ELEMENTS.map((e) => e.atomicNumber)).toEqual(Array.from({ length: 118 }, (_, i) => i + 1));
    expect(Object.keys(PERIODIC_TABLE)).toHaveLength(118);
  });

  it("is keyed by symbol, with well-formed data", () => {
    for (const [key, e] of Object.entries(PERIODIC_TABLE)) {
      expect(e.symbol).toBe(key);
      expect(e.symbol).toMatch(/^[A-Z][a-z]?$/);
      expect(e.color).toMatch(/^#[0-9A-F]{6}$/);
      expect(e.name.length).toBeGreaterThan(1);
      expect(e.nameEn.length).toBeGreaterThan(1);
      expect(e.atomicMass).toBeGreaterThan(0);
      expect(Number.isInteger(e.valence) && e.valence >= 0 && e.valence <= 4).toBe(true);
    }
  });

  it("keeps the values of the spec for its ten listed elements", () => {
    const spec: Record<string, [number, number, string, number]> = {
      H: [1, 1.008, "#333333", 1],
      C: [6, 12.011, "#333333", 4],
      N: [7, 14.007, "#3050F8", 3],
      O: [8, 15.999, "#FF0D0D", 2],
      F: [9, 18.998, "#90E050", 1],
      P: [15, 30.974, "#FF8000", 3],
      S: [16, 32.065, "#FFFF30", 2],
      Cl: [17, 35.453, "#1FF01F", 1],
      Br: [35, 79.904, "#A62929", 1],
      I: [53, 126.904, "#940094", 1],
    };
    for (const [symbol, [z, mass, color, valence]] of Object.entries(spec)) {
      expect(PERIODIC_TABLE[symbol]).toMatchObject({ atomicNumber: z, atomicMass: mass, color, valence });
    }
  });

  it("lists the quick-access elements, all of them in the table", () => {
    expect(COMMON_ELEMENTS).toEqual(["C", "H", "O", "N", "S", "P", "Cl", "Br"]);
    for (const s of COMMON_ELEMENTS) expect(PERIODIC_TABLE[s]).toBeDefined();
  });

  it("places every element in its own cell of the 18-column table", () => {
    const seen = new Set<string>();
    for (const e of ELEMENTS) {
      const { row, col } = tableCell(e.atomicNumber);
      expect(row).toBeGreaterThanOrEqual(1);
      expect(row).toBeLessThanOrEqual(10);
      expect(col).toBeGreaterThanOrEqual(1);
      expect(col).toBeLessThanOrEqual(18);
      seen.add(`${row}:${col}`);
    }
    expect(seen.size).toBe(118);
  });

  it("puts well-known elements where the usual table has them", () => {
    const at = (s: string) => tableCell(PERIODIC_TABLE[s].atomicNumber);
    expect(at("H")).toEqual({ row: 1, col: 1 });
    expect(at("He")).toEqual({ row: 1, col: 18 });
    expect(at("Li")).toEqual({ row: 2, col: 1 });
    expect(at("B")).toEqual({ row: 2, col: 13 });
    expect(at("Ne")).toEqual({ row: 2, col: 18 });
    expect(at("Al")).toEqual({ row: 3, col: 13 });
    expect(at("Fe")).toEqual({ row: 4, col: 8 });
    expect(at("Br")).toEqual({ row: 4, col: 17 });
    expect(at("I")).toEqual({ row: 5, col: 17 });
    expect(at("Ba")).toEqual({ row: 6, col: 2 });
    expect(at("Hf")).toEqual({ row: 6, col: 4 });
    expect(at("Pb")).toEqual({ row: 6, col: 14 });
    expect(at("Fr")).toEqual({ row: 7, col: 1 });
    expect(at("Rf")).toEqual({ row: 7, col: 4 });
    expect(at("Og")).toEqual({ row: 7, col: 18 });
    expect(at("La")).toEqual({ row: 9, col: 3 });
    expect(at("Lu")).toEqual({ row: 9, col: 17 });
    expect(at("Ac")).toEqual({ row: 10, col: 3 });
    expect(at("Lr")).toEqual({ row: 10, col: 17 });
  });

  it("darkens only the colours that would vanish on white paper", () => {
    expect(textColor("#FF0D0D")).toBe("#FF0D0D");
    expect(textColor("#333333")).toBe("#333333");
    expect(textColor("#940094")).toBe("#940094");
    const sulfur = textColor("#FFFF30");
    expect(sulfur).not.toBe("#FFFF30");
    expect(sulfur).toMatch(/^#[0-9A-F]{6}$/);
    expect(textColor("#FFFFC7")).not.toBe("#FFFFC7");
  });
});

describe("bond drawing", () => {
  const a = { x: 0, y: 0 };
  const b = { x: 50, y: 0 };

  it("trims a single bond by the atom radius at both ends", () => {
    const { lines, polygon } = bondDrawing(a, b, "single");
    expect(polygon).toBeNull();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({ x1: ATOM_RADIUS, y1: 0, x2: 50 - ATOM_RADIUS, y2: 0 });
  });

  it("draws a double bond as two parallel lines on each side of the axis", () => {
    const { lines } = bondDrawing(a, b, "double");
    expect(lines).toHaveLength(2);
    const ys = lines.map((l) => l.y1).sort((p, q) => p - q);
    expect(ys[0]).toBeCloseTo(-DOUBLE_OFFSET);
    expect(ys[1]).toBeCloseTo(DOUBLE_OFFSET);
    for (const l of lines) {
      expect(l.y1).toBeCloseTo(l.y2); // parallel to the bond
      expect(l.x1).toBeCloseTo(ATOM_RADIUS);
      expect(l.x2).toBeCloseTo(50 - ATOM_RADIUS);
    }
  });

  it("draws a triple bond as three parallel lines, the middle one on the axis", () => {
    const { lines } = bondDrawing(a, b, "triple");
    expect(lines.map((l) => l.y1).sort((p, q) => p - q)).toEqual([-TRIPLE_OFFSET, 0, TRIPLE_OFFSET].map((v) => expect.closeTo(v)));
  });

  it("offsets perpendicular to the bond whatever its angle", () => {
    const tilted = { x: 30, y: 40 }; // length 50, 3-4-5 triangle
    const { lines } = bondDrawing(a, tilted, "double");
    const [p, q] = lines;
    // the two lines are parallel with the bond ...
    for (const l of lines) expect((l.x2 - l.x1) * 40 - (l.y2 - l.y1) * 30).toBeCloseTo(0);
    // ... and 2 × DOUBLE_OFFSET apart
    const gap = Math.hypot(p.x1 - q.x1, p.y1 - q.y1);
    expect(gap).toBeCloseTo(2 * DOUBLE_OFFSET);
    expect((p.x1 - q.x1) * 30 + (p.y1 - q.y1) * 40).toBeCloseTo(0); // gap ⟂ bond
  });

  it("does not depend on the direction in which the bond is read", () => {
    const forward = bondDrawing(a, b, "double").lines.map((l) => Math.min(l.x1, l.x2)).sort();
    const backward = bondDrawing(b, a, "double").lines.map((l) => Math.min(l.x1, l.x2)).sort();
    expect(backward).toEqual(forward);
  });

  it("draws a wedge as a triangle, narrow at the first atom", () => {
    const { lines, polygon } = bondDrawing(a, b, "wedge");
    expect(lines).toHaveLength(0);
    expect(polygon).toHaveLength(6);
    const [x0, y0, x1, y1, x2, y2] = polygon!;
    expect([x0, y0]).toEqual([ATOM_RADIUS, 0]);
    expect(x1).toBeCloseTo(50 - ATOM_RADIUS);
    expect(x2).toBeCloseTo(50 - ATOM_RADIUS);
    expect(Math.abs(y1 - y2)).toBeGreaterThan(4);
  });

  it("draws a hashed bond as strokes across the bond, longer towards the second atom", () => {
    const { lines, polygon } = bondDrawing(a, b, "dash");
    expect(polygon).toBeNull();
    expect(lines.length).toBeGreaterThanOrEqual(4);
    const widths = lines.map((l) => Math.abs(l.y2 - l.y1));
    expect(widths).toEqual([...widths].sort((p, q) => p - q));
    expect(widths[widths.length - 1]).toBeGreaterThan(widths[0]);
  });

  it("keeps something of a very short bond, and nothing of a zero-length one", () => {
    const short = bondDrawing(a, { x: 10, y: 0 }, "single").lines[0];
    expect(short.x2).toBeGreaterThan(short.x1);
    for (const t of ["single", "double", "triple", "wedge", "dash"] as BondType[]) {
      expect(bondDrawing(a, a, t)).toEqual({ lines: [], polygon: null });
    }
  });

  it("finds the box around a drawing", () => {
    expect(graphBounds([])).toBeNull();
    expect(graphBounds([{ x: 3, y: -2 }, { x: -1, y: 7 }, { x: 0, y: 0 }])).toEqual({ minX: -1, minY: -2, maxX: 3, maxY: 7 });
  });
});

const ORDER: Partial<Record<BondType, number>> = { single: 1, double: 2, triple: 3, wedge: 1, dash: 1 }; // (the samples use only these)

// Bonds of each atom, as a sum of bond orders.
function bondOrders(g: MoleculeGraph): Map<string, number> {
  const sums = new Map(g.atoms.map((x) => [x.id, 0]));
  for (const bd of g.bonds) {
    sums.set(bd.sourceId, (sums.get(bd.sourceId) ?? 0) + (ORDER[bd.type] ?? 1));
    sums.set(bd.targetId, (sums.get(bd.targetId) ?? 0) + (ORDER[bd.type] ?? 1));
  }
  return sums;
}

describe("sample molecules", () => {
  for (const sample of SAMPLE_MOLECULES) {
    describe(sample.name.en, () => {
      const g = sample.graph;
      const byId = new Map(g.atoms.map((x) => [x.id, x]));

      it("is a consistent graph: unique ids, known elements, bonds between existing atoms", () => {
        expect(byId.size).toBe(g.atoms.length);
        expect(new Set(g.bonds.map((x) => x.id)).size).toBe(g.bonds.length);
        for (const x of g.atoms) expect(PERIODIC_TABLE[x.element]).toBeDefined();
        for (const x of g.bonds) {
          expect(byId.has(x.sourceId)).toBe(true);
          expect(byId.has(x.targetId)).toBe(true);
          expect(x.sourceId).not.toBe(x.targetId);
        }
      });

      it("draws every bond one bond length long, and no two atoms on top of each other", () => {
        for (const x of g.bonds) {
          const s = byId.get(x.sourceId)!;
          const t = byId.get(x.targetId)!;
          expect(Math.hypot(s.x - t.x, s.y - t.y)).toBeCloseTo(BOND_LENGTH, 0);
        }
        for (let i = 0; i < g.atoms.length; i++) {
          for (let j = i + 1; j < g.atoms.length; j++) {
            expect(Math.hypot(g.atoms[i].x - g.atoms[j].x, g.atoms[i].y - g.atoms[j].y)).toBeGreaterThan(BOND_LENGTH * 0.9);
          }
        }
      });

      it("never exceeds the valence of an atom", () => {
        for (const [id, order] of bondOrders(g)) expect(order).toBeLessThanOrEqual(PERIODIC_TABLE[byId.get(id)!.element].valence);
      });
    });
  }

  it("acetic acid has C2H4O2 with every hydrogen drawn", () => {
    const g = SAMPLE_MOLECULES.find((s) => s.id === "acetic-acid")!.graph;
    const count = (el: string) => g.atoms.filter((x) => x.element === el).length;
    expect([count("C"), count("H"), count("O")]).toEqual([2, 4, 2]);
    for (const [id, order] of bondOrders(g)) expect(order).toBe(PERIODIC_TABLE[g.atoms.find((x) => x.id === id)!.element].valence);
    expect(g.bonds.filter((x) => x.type === "double")).toHaveLength(1);
  });

  it("caffeine has C8H10N4O2 once its hydrogens are filled in from the valences", () => {
    const g = SAMPLE_MOLECULES.find((s) => s.id === "caffeine")!.graph;
    const count = (el: string) => g.atoms.filter((x) => x.element === el).length;
    expect([count("C"), count("N"), count("O")]).toEqual([8, 4, 2]);
    let hydrogens = 0;
    const byId = new Map(g.atoms.map((x) => [x.id, x]));
    for (const [id, order] of bondOrders(g)) hydrogens += PERIODIC_TABLE[byId.get(id)!.element].valence - order;
    expect(hydrogens).toBe(10);
    expect(g.bonds.filter((x) => x.type === "double")).toHaveLength(4);
  });
});
