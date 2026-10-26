import { describe, expect, it } from "vitest";
import { COALESCE_MS, canRedoStudio, canUndoStudio, editStudioHistory, isStudioDirty, redoStudioHistory, startStudioHistory, undoStudioHistory } from "../../studioHistory";
import { GRID, HALF_LENGTH, axisOf, endsOf, extendPath, junctionPoints, lastAxis, moveEndpoint, normRotation, onPath, orthogonalPath, outwardOf, simplifyPath, snap, snapTarget, terminalsOf, translatePath } from "../geometry";
import { addComponent, addWire, moveComponent, moveWire, newComponent, newWire, placeAt, removeComponent, removeWire, resizeArea, rotateComponent, updateComponent } from "../ops";
import { buildCircuitScene, contentBounds } from "../scene";
import { COMPONENT_SPECS, COMPONENT_TYPES, drawComponent } from "../symbols";
import { renderCircuitSvg } from "../svg";
import { DEFAULT_CIRCUIT_CONFIG, type CircuitComponent, type CircuitConfig } from "../types";

const C = DEFAULT_CIRCUIT_CONFIG;
const comp = (extra: Partial<CircuitComponent> = {}): CircuitComponent => ({ id: "r", type: "resistor", x: 200, y: 200, rotation: 0, label: "R", value: "", ...extra });
const circuit = (components: CircuitComponent[] = [], wires: { id: string; points: number[] }[] = []): CircuitConfig => ({ ...C, components, wires });

describe("the grid and the terminals", () => {
  it("snaps to the 20 px grid, with no negative zero", () => {
    expect(snap(29)).toBe(20);
    expect(snap(31)).toBe(40);
    expect(Object.is(snap(-3), 0)).toBe(true);
    expect(GRID).toBe(20);
  });

  it("puts the terminals two cells from the middle, on the grid, along the axis", () => {
    expect(terminalsOf(comp())).toEqual([{ x: 160, y: 200 }, { x: 240, y: 200 }]);
    expect(terminalsOf(comp({ rotation: 90 }))).toEqual([{ x: 200, y: 160 }, { x: 200, y: 240 }]);
    expect(terminalsOf(comp({ rotation: 180 }))).toEqual([{ x: 240, y: 200 }, { x: 160, y: 200 }]);
    expect(terminalsOf(comp({ rotation: 270 }))[0]).toEqual({ x: 200, y: 240 });
    for (const rotation of [0, 90, 180, 270]) for (const t of terminalsOf(comp({ rotation }))) expect([t.x % GRID, t.y % GRID]).toEqual([0, 0]);
    expect(HALF_LENGTH).toBe(40);
  });

  it("turns a rotation into a quarter turn and knows where a wire leaves a terminal", () => {
    expect(normRotation(450)).toBe(90);
    expect(normRotation(-90)).toBe(270);
    expect(axisOf(90)).toEqual({ x: 0, y: 1 });
    expect(outwardOf(comp(), 0)).toEqual({ x: -1, y: 0 });
    expect(outwardOf(comp(), 1)).toEqual({ x: 1, y: 0 });
    expect(outwardOf(comp({ rotation: 90 }), 0)).toEqual({ x: 0, y: -1 });
  });
});

describe("orthogonal paths", () => {
  it("is one corner at most: horizontal first, or vertical first", () => {
    expect(orthogonalPath({ x: 0, y: 0 }, { x: 60, y: 40 }, "h")).toEqual([0, 0, 60, 0, 60, 40]);
    expect(orthogonalPath({ x: 0, y: 0 }, { x: 60, y: 40 }, "v")).toEqual([0, 0, 0, 40, 60, 40]);
    expect(orthogonalPath({ x: 0, y: 0 }, { x: 60, y: 0 }, "v")).toEqual([0, 0, 60, 0]); // (straight: no corner)
    expect(orthogonalPath({ x: 20, y: 20 }, { x: 20, y: 20 })).toEqual([20, 20]);
  });

  it("drops repeated points and corners that are not corners", () => {
    expect(simplifyPath([0, 0, 0, 0, 20, 0, 40, 0, 40, 20])).toEqual([0, 0, 40, 0, 40, 20]);
    expect(simplifyPath([0, 0, 0, 40, 0, 20])).toEqual([0, 0, 0, 20]); // (it turns back on itself: the middle point is on the line)
  });

  it("carries a path on from its end, the new leg starting along the axis given", () => {
    expect(extendPath([0, 0, 40, 0], { x: 40, y: 60 }, "v")).toEqual([0, 0, 40, 0, 40, 60]);
    expect(extendPath([0, 0, 40, 0], { x: 80, y: 60 }, "v")).toEqual([0, 0, 40, 0, 40, 60, 80, 60]);
    expect(extendPath([], { x: 5, y: 5 }, "h")).toEqual([5, 5]);
    expect(lastAxis([0, 0, 40, 0])).toBe("h");
    expect(lastAxis([0, 0, 0, 40])).toBe("v");
    expect(lastAxis([0, 0])).toBeNull();
  });

  it("stays orthogonal when an end moves, whatever the number of corners", () => {
    // an L (horizontal then vertical): the first point moves up: the corner follows vertically
    expect(moveEndpoint([0, 100, 100, 100, 100, 200], 0, { x: 0, y: 60 })).toEqual([0, 60, 100, 60, 100, 200]);
    // the first point moves sideways along the first segment: just longer
    expect(moveEndpoint([0, 100, 100, 100, 100, 200], 0, { x: -40, y: 100 })).toEqual([-40, 100, 100, 100, 100, 200]);
    // the last end moves: the corner before it follows
    expect(moveEndpoint([0, 100, 100, 100, 100, 200], 1, { x: 140, y: 200 })).toEqual([0, 100, 140, 100, 140, 200]);
    // a straight wire whose end leaves the line gets a corner, the leg at the moved end keeping its direction
    expect(moveEndpoint([0, 0, 100, 0], 1, { x: 100, y: 40 })).toEqual([0, 0, 0, 40, 100, 40]); // (it still arrives horizontally)
    expect(moveEndpoint([0, 0, 100, 0], 0, { x: 0, y: 40 })).toEqual([0, 40, 100, 40, 100, 0]); // (it still leaves horizontally)
    // every segment of the result is horizontal or vertical
    const out = moveEndpoint([0, 100, 100, 100, 100, 200, 200, 200, 200, 300], 0, { x: 20, y: 40 });
    for (let i = 2; i < out.length; i += 2) expect(out[i] === out[i - 2] || out[i + 1] === out[i - 1]).toBe(true);
  });

  it("knows what is on a path, and where wires are connected", () => {
    expect(onPath([0, 0, 100, 0, 100, 100], { x: 50, y: 0 })).toBe(true);
    expect(onPath([0, 0, 100, 0, 100, 100], { x: 100, y: 60 })).toBe(true);
    expect(onPath([0, 0, 100, 0, 100, 100], { x: 50, y: 20 })).toBe(false);
    const wires = [{ id: "a", points: [0, 0, 100, 0] }, { id: "b", points: [50, 0, 50, 80] }, { id: "c", points: [200, 0, 300, 0] }];
    expect(junctionPoints({ components: [], wires })).toEqual([{ x: 50, y: 0 }]); // (the end of b is on a)
    // two wires ending at one point are just a longer wire; three ends are a node
    expect(junctionPoints({ components: [], wires: [{ id: "a", points: [0, 0, 40, 0] }, { id: "b", points: [40, 0, 80, 0] }] })).toEqual([]);
    expect(junctionPoints({ components: [], wires: [{ id: "a", points: [0, 0, 40, 0] }, { id: "b", points: [40, 0, 80, 0] }, { id: "c", points: [40, 0, 40, 60] }] })).toEqual([{ x: 40, y: 0 }]);
    // two wires on a terminal and a third: a node on the component too
    const r = comp({ x: 100, y: 100 });
    const around = [{ id: "a", points: [60, 100, 60, 40] }, { id: "b", points: [60, 100, 0, 100] }];
    expect(junctionPoints({ components: [r], wires: around })).toEqual([{ x: 60, y: 100 }]);
  });

  it("translates a path", () => {
    expect(translatePath([0, 0, 40, 0], 20, -20)).toEqual([20, -20, 60, -20]);
  });
});

describe("snapping a wire point", () => {
  const c = circuit([comp({ x: 100, y: 100 })], [{ id: "w", points: [200, 0, 200, 200] }]);

  it("goes to a terminal that is close, whatever the grid says, and says which way a wire leaves it", () => {
    const t = snapTarget(c, { x: 66, y: 94 });
    expect(t).toEqual({ point: { x: 60, y: 100 }, connects: true, outward: { x: -1, y: 0 } });
  });

  it("goes to a wire that is close, else to the grid", () => {
    expect(snapTarget(c, { x: 203, y: 118 })).toEqual({ point: { x: 200, y: 120 }, connects: true });
    expect(snapTarget(c, { x: 123, y: 38 })).toEqual({ point: { x: 120, y: 40 }, connects: false });
    expect(snapTarget(c, { x: 203, y: 118 }, "w").connects).toBe(false); // (not onto the wire being drawn)
  });
});

describe("placing and moving components", () => {
  it("snaps a new one to the grid and keeps its terminals on the paper", () => {
    expect(newComponent(C, "resistor", 213, 187, 0, "x")).toMatchObject({ x: 220, y: 180, rotation: 0, label: "R", value: "" });
    expect(newComponent(C, "resistor", -50, 5, 0, "x")).toMatchObject({ x: 40, y: 0 }); // (flat: 40 from the left edge)
    expect(newComponent(C, "resistor", 5, 10, 90, "x")).toMatchObject({ x: 0, y: 40 }); // (standing: 40 from the top)
    expect(placeAt(C, 0, 9999, 9999)).toEqual({ x: 760, y: 600 });
    expect(COMPONENT_SPECS.battery.label).toBe("E");
    expect(newComponent(C, "capacitor", 100, 100, 0, "x").label).toBe("C");
    expect(newComponent(C, "inductor", 100, 100, 0, "x").label).toBe("L");
  });

  it("carries the wires on its terminals along when it moves, and leaves the others", () => {
    const r = comp({ x: 200, y: 200 });
    const c = circuit([r], [{ id: "left", points: [100, 200, 160, 200] }, { id: "right", points: [240, 200, 240, 120, 320, 120] }, { id: "far", points: [0, 0, 20, 0] }]);
    const moved = moveComponent(c, "r", 200, 260);
    expect(moved.components[0]).toMatchObject({ x: 200, y: 260 });
    // the left wire (horizontal, its end moved down) gets a corner, the leg at the moved end staying horizontal
    expect(moved.wires[0].points).toEqual([100, 200, 100, 260, 160, 260]);
    expect(endsOf(moved.wires[0])[1]).toEqual({ x: 160, y: 260 });
    // the right wire's first end moved down: its first leg (vertical) is longer
    expect(moved.wires[1].points).toEqual([240, 260, 240, 120, 320, 120]);
    expect(moved.wires[2]).toBe(c.wires[2]);
    expect(moveComponent(c, "r", 203, 197)).toBe(c); // (the same grid point: no change)
    expect(moveComponent(c, "nope", 0, 0)).toBe(c);
  });

  it("turns by quarter turns, the wires on its terminals turning with it", () => {
    const c = circuit([comp()], [{ id: "left", points: [100, 200, 160, 200] }, { id: "right", points: [240, 200, 300, 200] }]);
    const turned = rotateComponent(c, "r");
    expect(turned.components[0].rotation).toBe(90);
    expect(endsOf(turned.wires[0])[1]).toEqual({ x: 200, y: 160 }); // (the first terminal is now above)
    expect(endsOf(turned.wires[1])[0]).toEqual({ x: 200, y: 240 });
    for (const w of turned.wires) for (let i = 2; i < w.points.length; i += 2) expect(w.points[i] === w.points[i - 2] || w.points[i + 1] === w.points[i - 1]).toBe(true);
    expect(rotateComponent(rotateComponent(rotateComponent(rotateComponent(c, "r"), "r"), "r"), "r").components[0].rotation).toBe(0);
    expect(rotateComponent(c, "r", -90).components[0].rotation).toBe(270);
    expect(rotateComponent(c, "nope")).toBe(c);
  });

  it("is pushed back inside the paper when a turn would put a terminal outside it", () => {
    const edge = circuit([comp({ x: 40, y: 0 })]);
    expect(rotateComponent(edge, "r").components[0]).toMatchObject({ x: 40, y: 40, rotation: 90 });
  });

  it("changes its label, value and switch, and goes away without taking its wires", () => {
    const c = circuit([comp({ type: "switch" })], [{ id: "w", points: [100, 200, 160, 200] }]);
    expect(updateComponent(c, "r", { label: "K1", value: "5 A", closed: true }).components[0]).toMatchObject({ label: "K1", value: "5 A", closed: true });
    const gone = removeComponent(c, "r");
    expect(gone.components).toEqual([]);
    expect(gone.wires).toHaveLength(1);
  });

  it("adds and removes a component with its id", () => {
    const added = addComponent(C, newComponent(C, "lamp", 100, 100, 0, "L1"));
    expect(added.components.map((x) => x.id)).toEqual(["L1"]);
  });
});

describe("wires", () => {
  it("are kept orthogonal and need two different points", () => {
    expect(newWire([0, 0, 0, 0])).toBeNull();
    expect(newWire([20, 20])).toBeNull();
    expect(newWire([0, 0, 40, 0, 80, 0], "w")).toEqual({ id: "w", points: [0, 0, 80, 0] });
    expect(addWire(C, [0, 0], "w")).toBe(C);
    expect(addWire(C, [0, 0, 40, 0, 40, 20], "w").wires).toEqual([{ id: "w", points: [0, 0, 40, 0, 40, 20] }]);
  });

  it("move by whole cells, and go away", () => {
    const c = addWire(C, [0, 0, 40, 0], "w");
    expect(moveWire(c, "w", 29, -9).wires[0].points).toEqual([20, 0, 60, 0]);
    expect(moveWire(c, "w", 5, 5)).toBe(c);
    expect(removeWire(c, "w").wires).toEqual([]);
  });

  it("is connected to a component by being on its terminal: a wire dropped there follows it", () => {
    let c = circuit([comp()]);
    c = addWire(c, [100, 200, 160, 200], "w"); // ends on the first terminal
    const moved = moveComponent(c, "r", 260, 200);
    expect(endsOf(moved.wires[0])[1]).toEqual({ x: 220, y: 200 });
  });
});

describe("the drawing area", () => {
  it("is resized to whole cells", () => {
    expect(resizeArea(C, 810, 590)).toMatchObject({ width: 820, height: 600 });
    expect(resizeArea(C, 800, 600)).toBe(C);
  });
});

describe("the symbols", () => {
  it("draw every component with its leads reaching both terminals", () => {
    for (const type of COMPONENT_TYPES) {
      for (const rotation of [0, 90, 180, 270]) {
        const d = drawComponent(comp({ type, rotation, label: "", value: "" }));
        expect(d.shapes.length, type).toBeGreaterThan(1);
        const ends = d.shapes.flatMap((s) => (s.kind === "line" ? [{ x: s.points[0], y: s.points[1] }, { x: s.points[s.points.length - 2], y: s.points[s.points.length - 1] }] : []));
        for (const t of d.terminals) expect(ends.some((e) => Math.abs(e.x - t.x) < 1e-6 && Math.abs(e.y - t.y) < 1e-6), `${type} ${rotation}`).toBe(true);
      }
    }
  });

  it("has a box that is wide when the component lies and tall when it stands", () => {
    expect(drawComponent(comp()).bounds).toEqual({ x: 160, y: 178, width: 80, height: 44 });
    expect(drawComponent(comp({ rotation: 90 })).bounds).toEqual({ x: 178, y: 160, width: 44, height: 80 });
  });

  it("puts the label above and the value below a flat component, and to the right of a standing one", () => {
    const flat = drawComponent(comp({ label: "R", value: "10 kΩ" })).texts;
    expect(flat.map((t) => [t.text, t.y < 200 ? "above" : "below"])).toEqual([["R", "above"], ["10 kΩ", "below"]]);
    const standing = drawComponent(comp({ rotation: 90, label: "R", value: "10 kΩ" })).texts;
    expect(standing.every((t) => t.x > 200 && t.align === "start")).toBe(true);
    expect(drawComponent(comp({ label: "", value: "" })).texts).toEqual([]);
  });

  it("writes A or V in a meter and + by the long plate of a battery, upright whatever the turn", () => {
    expect(drawComponent(comp({ type: "ammeter", rotation: 90 })).texts[0]).toMatchObject({ text: "A", x: 200, y: 200 });
    expect(drawComponent(comp({ type: "voltmeter" })).texts[0].text).toBe("V");
    const plus = drawComponent(comp({ type: "battery" })).texts[0];
    expect(plus.text).toBe("+");
    expect(plus.x).toBeGreaterThan(200); // (on the positive side, the right of an unturned battery)
    expect(drawComponent(comp({ type: "battery", rotation: 180 })).texts[0].x).toBeLessThan(200);
  });

  it("draws a switch open (a slanted blade) or closed (a straight one)", () => {
    const blade = (closed: boolean) => {
      const shapes = drawComponent(comp({ type: "switch", closed })).shapes;
      const last = shapes[shapes.length - 1];
      return last.kind === "line" ? last.points : [];
    };
    expect(blade(true)[1]).toBe(blade(true)[3]); // (level)
    expect(blade(false)[1]).not.toBe(blade(false)[3]);
  });

  it("draws the French resistor, a rectangle", () => {
    const loops = drawComponent(comp()).shapes.filter((s) => s.kind === "loop");
    expect(loops).toHaveLength(1);
  });
});

describe("the scene and the picture", () => {
  const full = circuit([comp({ label: "R", value: "10 kΩ" }), comp({ id: "e", type: "battery", x: 100, y: 120, rotation: 90, label: "E" })], [{ id: "w", points: [160, 200, 100, 200, 100, 160] }]);

  it("has every component, wire and junction", () => {
    const s = buildCircuitScene(full);
    expect(s.components.map((c) => c.id)).toEqual(["r", "e"]);
    expect(s.wires).toEqual([{ id: "w", points: [160, 200, 100, 200, 100, 160] }]);
    expect(s.junctions).toEqual([]);
  });

  it("is cropped to what is drawn, with a margin, and null when empty", () => {
    expect(renderCircuitSvg(C)).toBeNull();
    expect(contentBounds(buildCircuitScene(C))).toBeNull();
    const r = renderCircuitSvg(full)!;
    const box = contentBounds(buildCircuitScene(full))!;
    expect(r.width).toBeLessThan(C.width);
    expect(r.width).toBeGreaterThanOrEqual(box.maxX - box.minX);
    expect(r.svg).toContain("10 kΩ");
    expect(r.svg).toContain('data-type="battery"');
    expect(r.svg).toContain('data-wire="w"');
  });

  it("escapes the texts", () => {
    expect(renderCircuitSvg(circuit([comp({ label: "a<b & c" })]))!.svg).toContain("a&lt;b &amp; c");
  });
});

describe("undo and redo", () => {
  it("steps back and forward, merges a quick series of edits of one thing, and knows when it is back at the start", () => {
    let h = startStudioHistory(C);
    h = editStudioHistory(h, addComponent(C, newComponent(C, "lamp", 100, 100, 0, "a")), "add:a", 0);
    const c1 = h.present;
    h = editStudioHistory(h, moveComponent(c1, "a", 120, 100), "move:a", 100);
    h = editStudioHistory(h, moveComponent(h.present, "a", 140, 100), "move:a", 200);
    expect(h.past).toHaveLength(2); // (the two moves are one step)
    expect(isStudioDirty(h)).toBe(true);
    h = editStudioHistory(h, moveComponent(h.present, "a", 160, 100), "move:a", 200 + COALESCE_MS + 1);
    expect(h.past).toHaveLength(3);
    expect(undoStudioHistory(h).present.components[0].x).toBe(140);
    expect(canRedoStudio(undoStudioHistory(h))).toBe(true);
    expect(canUndoStudio(startStudioHistory(C))).toBe(false);
    expect(redoStudioHistory(undoStudioHistory(h)).present.components[0].x).toBe(160);
    expect(isStudioDirty(undoStudioHistory(undoStudioHistory(undoStudioHistory(h))))).toBe(false);
    expect(editStudioHistory(h, JSON.parse(JSON.stringify(h.present)), "x", 0)).toBe(h); // (the same document: no step)
  });
});
