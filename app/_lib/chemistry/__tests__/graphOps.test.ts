import { describe, expect, it } from "vitest";
import { addAtom, atomNear, makeAtom, moveAtom, removeAtom } from "../graphOps";
import { SAMPLE_MOLECULES } from "../samples";
import { GRID, snapToGrid, toWorld, zoomAt } from "../viewport";

const acetic = () => SAMPLE_MOLECULES.find((s) => s.id === "acetic-acid")!.graph;

describe("adding an atom", () => {
  it("makes a visible, uncharged atom with its own id", () => {
    const a = makeAtom("Fe", 40, -20);
    expect(a).toMatchObject({ element: "Fe", x: 40, y: -20, charge: 0, hidden: false });
    expect(a.id).not.toBe(makeAtom("Fe", 40, -20).id);
  });

  it("adds it to a new graph and leaves the old one alone", () => {
    const g = acetic();
    const atom = makeAtom("N", 200, 200);
    const next = addAtom(g, atom);
    expect(next.atoms).toHaveLength(g.atoms.length + 1);
    expect(next.atoms.at(-1)).toBe(atom);
    expect(next.bonds).toBe(g.bonds);
    expect(g.atoms).toHaveLength(8);
  });
});

describe("moving an atom", () => {
  it("changes only that atom, in a new graph", () => {
    const g = acetic();
    const next = moveAtom(g, "a2", 10, 20);
    expect(next.atoms.find((a) => a.id === "a2")).toMatchObject({ x: 10, y: 20, element: "C" });
    expect(next.atoms.filter((a) => a.id !== "a2")).toEqual(g.atoms.filter((a) => a.id !== "a2"));
    expect(g.atoms.find((a) => a.id === "a2")).toMatchObject({ x: 0, y: 0 });
  });

  it("keeps the bonds: they follow the atom because they are drawn from its coordinates", () => {
    const g = acetic();
    expect(moveAtom(g, "a2", 10, 20).bonds).toEqual(g.bonds);
  });

  it("ignores an unknown id", () => {
    const g = acetic();
    expect(moveAtom(g, "nope", 1, 1)).toBe(g);
  });
});

describe("removing an atom", () => {
  it("removes the atom and every bond that ends on it", () => {
    const g = acetic();
    const next = removeAtom(g, "a2"); // the carboxyl carbon: bonds to a1, a3 and a4
    expect(next.atoms.some((a) => a.id === "a2")).toBe(false);
    expect(next.bonds.map((b) => b.id).sort()).toEqual(["b4", "b5", "b6", "b7"]);
    for (const b of next.bonds) {
      expect(next.atoms.some((a) => a.id === b.sourceId)).toBe(true);
      expect(next.atoms.some((a) => a.id === b.targetId)).toBe(true);
    }
  });

  it("keeps the other atoms and bonds, and does not change the old graph", () => {
    const g = acetic();
    const next = removeAtom(g, "a5"); // the acidic hydrogen: one bond
    expect(next.atoms).toHaveLength(7);
    expect(next.bonds).toHaveLength(6);
    expect(g.atoms).toHaveLength(8);
    expect(g.bonds).toHaveLength(7);
  });

  it("ignores an unknown id", () => {
    const g = acetic();
    expect(removeAtom(g, "nope")).toBe(g);
  });
});

describe("finding an atom near a point", () => {
  it("finds the closest one within the radius", () => {
    expect(atomNear(acetic(), 3, -2, 10)?.id).toBe("a2");
    expect(atomNear(acetic(), 0, -45, 10)?.id).toBe("a3");
  });

  it("finds none when nothing is that close", () => {
    expect(atomNear(acetic(), 300, 300, 10)).toBeUndefined();
    expect(atomNear({ atoms: [], bonds: [], annotations: [] }, 0, 0, 10)).toBeUndefined();
  });
});

describe("from the mouse to the drawing", () => {
  it("turns a pixel of the screen area into a point of the drawing, at any zoom and pan", () => {
    const view = { x: 120, y: -40, scale: 2 };
    expect(toWorld(view, 120, -40)).toEqual({ x: 0, y: 0 });
    expect(toWorld(view, 320, 60)).toEqual({ x: 100, y: 50 });
  });

  it("is the inverse of the zoom: the point under the cursor stays the same point of the drawing", () => {
    const view = { x: 55, y: 80, scale: 1.3 };
    const before = toWorld(view, 400, 300);
    const after = toWorld(zoomAt(view, 400, 300, 1.7), 400, 300);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("snaps to the graph paper", () => {
    expect(GRID).toBe(20);
    expect(snapToGrid(29)).toBe(20);
    expect(snapToGrid(31)).toBe(40);
    expect(snapToGrid(-9)).toBe(0);
    expect(Object.is(snapToGrid(-4), 0)).toBe(true);
    expect(snapToGrid(-31)).toBe(-40);
    expect(snapToGrid(7, 10)).toBe(10);
  });
});
