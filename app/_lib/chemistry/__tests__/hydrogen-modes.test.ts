import { describe, expect, it } from "vitest";
import { moleculesOf, formulaText } from "../formula";
import { drawingBounds } from "../geometry";
import { hydrogenLabels, labelParts } from "../hydrogenLabel";
import { renderDrawingSvg } from "../svg";
import type { AtomNode, BondType, MoleculeGraph } from "../types";
import { applyHydrogenMode, changeHydrogenMode, fillHydrogens, hydrogenModeOf, implicitHydrogens, overValenced, recalculateHydrogens } from "../valence";

const atom = (id: string, element: string, x: number, y: number, extra: Partial<AtomNode> = {}): AtomNode => ({ id, element, x, y, charge: 0, hidden: false, ...extra });
const graph = (atoms: AtomNode[], bonds: [string, string, BondType?][] = [], hydrogens?: MoleculeGraph["hydrogens"]): MoleculeGraph => ({
  atoms,
  bonds: bonds.map(([a, b, type], i) => ({ id: `b${i}`, sourceId: a, targetId: b, type: type ?? "single", hidden: false })),
  annotations: [],
  ...(hydrogens ? { hydrogens } : {}),
});
const hydrogens = (g: MoleculeGraph) => g.atoms.filter((a) => a.element === "H").length;

describe("hydrogen modes", () => {
  it("leaves a manual drawing as the teacher drew it: a lone carbon gets no hydrogens", () => {
    const g = graph([atom("c", "C", 0, 0)], [], "manual");
    expect(applyHydrogenMode(g)).toBe(g);
  });

  it("remakes the hydrogens in auto mode", () => {
    expect(hydrogens(applyHydrogenMode(graph([atom("c", "C", 0, 0)], [], "auto")))).toBe(4);
  });

  it("leaves labels mode alone too", () => {
    const g = graph([atom("c", "C", 0, 0)], [], "labels");
    expect(applyHydrogenMode(g)).toBe(g);
  });

  it("reads a drawing without the field: auto if the engine made hydrogens in it, else manual", () => {
    expect(hydrogenModeOf(graph([atom("c", "C", 0, 0)]))).toBe("manual");
    expect(hydrogenModeOf(recalculateHydrogens(graph([atom("c", "C", 0, 0)])))).toBe("auto");
    expect(hydrogenModeOf(graph([atom("c", "C", 0, 0)], [], "labels"))).toBe("labels");
  });

  it("makes bonds freely in manual mode, hydrogens included", () => {
    const g = applyHydrogenMode(graph([atom("c", "C", 0, 0), atom("h", "H", 50, 0)], [["c", "h"]], "manual"));
    expect(g.atoms).toHaveLength(2);
    expect(g.bonds).toHaveLength(1);
  });
});

describe("changing the mode", () => {
  const methane = () => changeHydrogenMode(graph([atom("c", "C", 0, 0)], [], "manual"), "auto");

  it("to auto adds the hydrogens at once", () => {
    const g = methane();
    expect(g.hydrogens).toBe("auto");
    expect(hydrogens(g)).toBe(4);
  });

  it("from auto to manual keeps the hydrogens as ordinary atoms that are no longer managed", () => {
    const g = changeHydrogenMode(methane(), "manual");
    expect(g.hydrogens).toBe("manual");
    expect(hydrogens(g)).toBe(4);
    expect(g.atoms.some((a) => a.auto)).toBe(false);
    expect(applyHydrogenMode(g)).toBe(g); // and the engine leaves them alone
  });

  it("from auto to labels drops the hydrogens and their bonds: the labels say the same", () => {
    const g = changeHydrogenMode(methane(), "labels");
    expect(g.atoms.map((a) => a.id)).toEqual(["c"]);
    expect(g.bonds).toEqual([]);
  });

  it("is the same graph when the mode does not change", () => {
    const g = graph([atom("c", "C", 0, 0)], [], "manual");
    expect(changeHydrogenMode(g, "manual")).toBe(g);
  });

  it("adds the missing hydrogens once, as atoms of the teacher's", () => {
    const g = fillHydrogens(graph([atom("c", "C", 0, 0), atom("o", "O", 50, 0)], [["c", "o", "double"]], "manual"));
    expect(hydrogens(g)).toBe(2); // CH2=O
    expect(g.hydrogens).toBe("manual");
    expect(applyHydrogenMode(g)).toBe(g);
    expect(g.atoms.some((a) => a.auto)).toBe(false);
  });
});

describe("implicit hydrogens and labels", () => {
  const ethanol = () => graph([atom("c1", "C", 0, 0), atom("c2", "C", 43, 25), atom("o", "O", 86, 0)], [["c1", "c2"], ["c2", "o"]], "labels");

  it("counts what each atom still misses", () => {
    expect([...implicitHydrogens(ethanol())]).toEqual([["c1", 3], ["c2", 2], ["o", 1]]);
  });

  it("puts a label on the side the bonds leave free", () => {
    const labels = hydrogenLabels(ethanol());
    expect(labels.get("c1")).toEqual({ count: 3, side: -1 }); // H3C– : its only bond goes right, so the hydrogens go left
    expect(labels.get("o")).toEqual({ count: 1, side: 1 }); // –OH
  });

  it("writes the hydrogens on the left when the only bond goes right", () => {
    const g = graph([atom("a", "C", 0, 0), atom("b", "C", 50, 0)], [["a", "b"]], "labels");
    expect(hydrogenLabels(g).get("a")?.side).toBe(-1);
    expect(hydrogenLabels(g).get("b")?.side).toBe(1);
  });

  it("makes no labels outside the labels mode", () => {
    expect(hydrogenLabels(graph([atom("c", "C", 0, 0)], [], "manual")).size).toBe(0);
    expect(hydrogenLabels(graph([atom("c", "C", 0, 0)], [], "auto")).size).toBe(0);
  });

  it("draws the H and the subscript in order, mirrored on the left", () => {
    expect(labelParts({ count: 3, side: 1 }).map((p) => p.text)).toEqual(["H", "3"]);
    expect(labelParts({ count: 1, side: 1 }).map((p) => p.text)).toEqual(["H"]);
    const left = labelParts({ count: 3, side: -1 });
    expect(left[0].x).toBeLessThan(left[1].x - 1); // H3C: the H is farthest from the symbol
    expect(left.every((p) => p.x < 0)).toBe(true);
  });

  it("counts the labelled hydrogens in the formula", () => {
    const [m] = moleculesOf(ethanol());
    expect(formulaText(m.counts, m.charge)).toBe("C2H6O");
  });

  it("writes the labels in the picture and makes room for them", () => {
    const g = graph([atom("c", "C", 0, 0)], [], "labels");
    const out = renderDrawingSvg(g)!;
    expect(out.svg).toContain(">H</text>");
    expect(out.svg).toContain(">4</text>");
    expect(drawingBounds(g)!.maxX).toBeGreaterThan(0);
    expect(renderDrawingSvg(graph([atom("c", "C", 0, 0)], [], "manual"))!.svg).not.toContain(">H</text>");
  });
});

describe("over-valence warning", () => {
  const star = (n: number) => graph([atom("c", "C", 0, 0), ...Array.from({ length: n }, (_, i) => atom(`h${i}`, "H", 50 + i * 10, i * 10))], Array.from({ length: n }, (_, i) => [`c`, `h${i}`] as [string, string]), "manual");

  it("flags a carbon with five bonds, not one with four", () => {
    expect(overValenced(star(4)).size).toBe(0);
    expect([...overValenced(star(5))]).toEqual(["c"]);
  });

  it("counts the bond order", () => {
    const g = graph([atom("c", "C", 0, 0), atom("o", "O", 50, 0), atom("h", "H", 0, 50)], [["c", "o", "triple"], ["c", "h"]]);
    expect([...overValenced(g)]).toEqual(["o"]); // C has 4 bonds, but O (valence 2) has a triple bond
  });

  it("does not flag the elements that can exceed it, nor metals", () => {
    const sulfur = graph([atom("s", "S", 0, 0), atom("o1", "O", 50, 0), atom("o2", "O", -50, 0), atom("o3", "O", 0, 50)], [["s", "o1", "double"], ["s", "o2", "double"], ["s", "o3", "double"]]);
    expect(overValenced(sulfur).has("s")).toBe(false);
    expect(overValenced(graph([atom("na", "Na", 0, 0), atom("cl", "Cl", 50, 0)], [["na", "cl"]])).size).toBe(0);
  });

  it("takes the charge into account (NH4+)", () => {
    const g = graph([atom("n", "N", 0, 0), ...[0, 1, 2, 3].map((i) => atom(`h${i}`, "H", 50 * i, 50))], [0, 1, 2, 3].map((i) => ["n", `h${i}`] as [string, string]));
    expect(overValenced(g).has("n")).toBe(true);
    g.atoms[0].charge = 1;
    expect(overValenced(g).has("n")).toBe(false);
  });
});
