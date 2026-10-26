import { describe, expect, it } from "vitest";
import { snapTarget } from "../geometry";
import { addComponent, newComponent, numberLabels, updateComponent } from "../ops";
import { renderCircuitSvg } from "../svg";
import { COMPONENT_TYPES, UNITS, drawComponent, withUnit } from "../symbols";
import { DEFAULT_CIRCUIT_CONFIG, type CircuitComponent, type CircuitConfig } from "../types";
import { CIRCUIT_AR, CIRCUIT_FR } from "../strings";

const C = DEFAULT_CIRCUIT_CONFIG;
const comp = (extra: Partial<CircuitComponent> = {}): CircuitComponent => ({ id: "r", type: "resistor", x: 200, y: 200, rotation: 0, label: "R1", value: "10 kΩ", ...extra });
const texts = (c: CircuitComponent) => drawComponent(c).texts.map((t) => t.text);

describe("the value of a component", () => {
  it("is written unless the teacher turned it off (it is written by default)", () => {
    expect(texts(comp())).toEqual(["R1", "10 kΩ"]);
    expect(texts(comp({ showValue: true }))).toEqual(["R1", "10 kΩ"]);
    expect(texts(comp({ showValue: false }))).toEqual(["R1"]);
    expect(texts(comp({ label: "", showValue: false }))).toEqual([]);
    expect(renderCircuitSvg({ ...C, components: [comp({ showValue: false })] })!.svg).not.toContain("10 kΩ");
  });

  it("keeps the other texts of the symbol when it is off", () => {
    expect(texts(comp({ type: "ammeter", label: "", showValue: false }))).toEqual(["A"]);
  });

  it("is changed by updateComponent", () => {
    const c: CircuitConfig = { ...C, components: [comp()] };
    expect(updateComponent(c, "r", { showValue: false }).components[0].showValue).toBe(false);
  });
});

describe("where the label and the value are written", () => {
  const at = (side: CircuitComponent["labelSide"], rotation = 0) => drawComponent(comp({ labelSide: side, rotation })).texts;

  it("is automatic by default: above and below a component that lies", () => {
    expect(at(undefined).map((t) => [t.text, t.y < 200])).toEqual([["R1", true], ["10 kΩ", false]]);
    expect(at("auto")).toEqual(at(undefined));
  });

  it("can be both above, the value nearest the symbol", () => {
    const [label, value] = at("top");
    expect(label.y).toBeLessThan(value.y);
    expect(value.y).toBeLessThan(200);
    expect([label.x, value.x]).toEqual([200, 200]);
    expect(label.align).toBe("middle");
  });

  it("can be both below, the label nearest the symbol", () => {
    const [label, value] = at("bottom");
    expect(label.y).toBeGreaterThan(200);
    expect(value.y).toBeGreaterThan(label.y);
  });

  it("can be to the left (ending at the symbol) or to the right (starting at it), stacked round the middle", () => {
    const left = at("left");
    expect(left.every((t) => t.x < 160 && t.align === "end")).toBe(true);
    expect((left[0].y + left[1].y) / 2).toBe(200);
    const right = at("right");
    expect(right.every((t) => t.x > 240 && t.align === "start")).toBe(true);
    // a component that stands has its sides closer in, and its top and bottom beyond the terminals
    expect(at("right", 90).every((t) => t.x > 200 && t.x < 240)).toBe(true);
    expect(at("top", 90).every((t) => t.y < 160)).toBe(true);
  });

  it("puts a single text where a pair would put the nearest one", () => {
    const one = drawComponent(comp({ labelSide: "top", value: "" })).texts;
    expect(one).toHaveLength(1);
    expect(one[0].y).toBeLessThan(200);
    expect(drawComponent(comp({ labelSide: "left", value: "" })).texts[0].y).toBe(200);
  });
});

describe("units", () => {
  it("are offered for the components that have a value", () => {
    expect(UNITS.resistor).toContain("kΩ");
    expect(UNITS.capacitor).toContain("μF");
    expect(UNITS.switch).toEqual([]);
    for (const type of COMPONENT_TYPES) expect(Array.isArray(UNITS[type])).toBe(true);
  });

  it("go after the number, replacing the unit that was there", () => {
    expect(withUnit("10", "kΩ")).toBe("10 kΩ");
    expect(withUnit("", "V")).toBe("V");
    expect(withUnit("4.7 Ω", "μF")).toBe("4.7 μF");
    expect(withUnit("4,7kΩ", "MΩ")).toBe("4,7 MΩ");
    expect(withUnit("-5 V", "mV")).toBe("-5 mV");
  });
});

describe("numbering the labels", () => {
  const build = (...types: CircuitComponent["type"][]): CircuitConfig => types.reduce((cfg, type, i) => addComponent(cfg, newComponent(cfg, type, 100 + 80 * i, 100, 0, `c${i}`)), C);

  it("gives R1, R2, R3… to the resistors that still have the plain letter, in the order they were put", () => {
    const n = numberLabels(build("resistor", "capacitor", "resistor", "resistor"));
    expect(n.components.map((c) => c.label)).toEqual(["R1", "C", "R2", "R3"]);
  });

  it("keeps the plain letter of a kind of which there is only one, and a label the teacher wrote", () => {
    const base = build("resistor", "resistor", "battery");
    const custom = updateComponent(base, "c1", { label: "Rload" });
    expect(numberLabels(custom).components.map((c) => c.label)).toEqual(["R", "Rload", "E"]);
  });

  it("renumbers numbers it made (a resistor taken away leaves no gap) and does nothing when there is nothing to do", () => {
    const four = numberLabels(build("resistor", "resistor", "resistor"));
    const three = { ...four, components: four.components.filter((c) => c.id !== "c1") };
    expect(numberLabels(three).components.map((c) => c.label)).toEqual(["R1", "R2"]);
    expect(numberLabels(four)).toBe(four);
    expect(numberLabels(C)).toBe(C);
    expect(numberLabels(build("lamp", "lamp")).components.map((c) => c.label)).toEqual(["", ""]); // (a lamp has no letter)
  });
});

describe("snapping to a terminal", () => {
  it("reaches 15 px", () => {
    const c: CircuitConfig = { ...C, components: [comp({ x: 100, y: 100 })] };
    expect(snapTarget(c, { x: 60 + 15, y: 100 }).connects).toBe(true);
    expect(snapTarget(c, { x: 60 + 16, y: 100 }).connects).toBe(false);
  });
});

describe("the new words", () => {
  it("are translated", () => {
    for (const key of ["Unit", "Show the value", "Label position", "Above", "Below", "Number the labels (R1, R2…)"]) {
      expect(CIRCUIT_FR[key], `${key} (fr)`).toBeTruthy();
      expect(CIRCUIT_AR[key], `${key} (ar)`).toBeTruthy();
    }
  });
});
