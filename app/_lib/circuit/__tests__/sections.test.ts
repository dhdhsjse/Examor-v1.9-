import { describe, expect, it } from "vitest";
import { distanceAlong, pathLength, sectionAt, sectionStops, subPath } from "../geometry";
import { labelsNumbered, numberLabels, removeWireSection, unnumberLabels } from "../ops";
import { DEFAULT_CIRCUIT_CONFIG, type CircuitComponent, type CircuitConfig } from "../types";

const C = DEFAULT_CIRCUIT_CONFIG;
const comp = (extra: Partial<CircuitComponent> = {}): CircuitComponent => ({ id: "r", type: "resistor", x: 200, y: 200, rotation: 0, label: "R", value: "", ...extra });
const circuit = (components: CircuitComponent[] = [], wires: { id: string; points: number[] }[] = []): CircuitConfig => ({ ...C, components, wires });

// an L: 100 to the right, then 60 down
const L = [0, 0, 100, 0, 100, 60];

describe("walking along a wire", () => {
  it("measures it", () => {
    expect(pathLength(L)).toBe(160);
    expect(pathLength([0, 0])).toBe(0);
  });

  it("finds how far along it a point is", () => {
    expect(distanceAlong(L, { x: 40, y: 5 })).toBe(40);
    expect(distanceAlong(L, { x: 104, y: 30 })).toBe(130);
    expect(distanceAlong(L, { x: -20, y: 0 })).toBe(0);
  });

  it("cuts a part of it, corners kept", () => {
    expect(subPath(L, 40, 130)).toEqual([40, 0, 100, 0, 100, 30]);
    expect(subPath(L, 0, 100)).toEqual([0, 0, 100, 0]);
    expect(subPath(L, 100, 160)).toEqual([100, 0, 100, 60]);
  });
});

describe("the sections of a wire", () => {
  it("are between its ends and corners", () => {
    const c = circuit([], [{ id: "w", points: L }]);
    expect(sectionStops(c, c.wires[0])).toEqual([0, 100, 160]);
    expect(sectionAt(c, c.wires[0], { x: 30, y: 2 })).toEqual({ a: 0, b: 100 });
    expect(sectionAt(c, c.wires[0], { x: 100, y: 50 })).toEqual({ a: 100, b: 160 });
  });

  it("are cut where another wire or a terminal joins it", () => {
    const c = circuit([comp({ x: 240, y: 0, rotation: 90 })], [
      { id: "w", points: [0, 0, 300, 0] },
      { id: "t", points: [100, 0, 100, 80] }, // (a T: its end on the first wire)
    ]);
    // the resistor stands at x = 240: its terminal (240, -40) is off the wire, (240, 40) too; only the T cuts the wire
    expect(sectionStops(c, c.wires[0])).toEqual([0, 100, 300]);
    const d = circuit([comp({ x: 240, y: 40, rotation: 90 })], c.wires);
    expect(sectionStops(d, d.wires[0])).toEqual([0, 100, 240, 300]);
  });
});

describe("removing a section of a wire", () => {
  it("in the middle leaves two wires, the first one keeping the id", () => {
    const c = circuit([], [{ id: "w", points: [0, 0, 300, 0] }]);
    const next = removeWireSection(c, "w", { a: 100, b: 200 }, "w2");
    expect(next.wires).toEqual([
      { id: "w", points: [0, 0, 100, 0] },
      { id: "w2", points: [200, 0, 300, 0] },
    ]);
  });

  it("at an end shortens the wire", () => {
    const c = circuit([], [{ id: "w", points: L }]);
    expect(removeWireSection(c, "w", { a: 100, b: 160 }).wires).toEqual([{ id: "w", points: [0, 0, 100, 0] }]);
    expect(removeWireSection(c, "w", { a: 0, b: 100 }).wires).toEqual([{ id: "w", points: [100, 0, 100, 60] }]);
  });

  it("that is the whole wire takes it away", () => {
    const c = circuit([], [{ id: "w", points: [0, 0, 100, 0] }, { id: "o", points: [0, 40, 100, 40] }]);
    expect(removeWireSection(c, "w", { a: 0, b: 100 }).wires.map((w) => w.id)).toEqual(["o"]);
  });

  it("does nothing for a wire that is not there or an empty section", () => {
    const c = circuit([], [{ id: "w", points: L }]);
    expect(removeWireSection(c, "x", { a: 0, b: 10 })).toBe(c);
    expect(removeWireSection(c, "w", { a: 50, b: 50 })).toBe(c);
  });
});

describe("numbering the labels, and back", () => {
  const two = circuit([comp({ id: "a" }), comp({ id: "b" }), comp({ id: "e", type: "battery", label: "E" }), comp({ id: "m", label: "Rx" })]);

  it("numbers, and a second click takes the numbers off", () => {
    expect(labelsNumbered(two)).toBe(false);
    const numbered = numberLabels(two);
    expect(numbered.components.map((c) => c.label)).toEqual(["R1", "R2", "E", "Rx"]);
    expect(labelsNumbered(numbered)).toBe(true);
    const back = unnumberLabels(numbered);
    expect(back.components.map((c) => c.label)).toEqual(["R", "R", "E", "Rx"]);
    expect(labelsNumbered(back)).toBe(false);
  });

  it("is not numbered when nothing has a number", () => {
    expect(labelsNumbered(circuit([comp({ id: "a" })]))).toBe(false);
    expect(unnumberLabels(two)).toBe(two);
  });
});
