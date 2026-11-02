import { describe, expect, it } from "vitest";
import { compileFunction } from "../graphMath";
import {
  MAX_FUNCTIONS,
  addFunction,
  addTangent,
  colorOf,
  derivativeOf,
  drawingsOf,
  findAsymptotes,
  fitY,
  formatNum,
  lineLabel,
  lineText,
  moveTangent,
  removeFunction,
  removeLine,
  removeTangent,
  setCurve,
  tangentAt,
  zoomWindow,
  type GraphData,
} from "../mathGraph";

const f = (src: string) => compileFunction(src);
const graph = (extra: Partial<GraphData> = {}): GraphData => ({ functions: ["x^2"], xMin: -5, xMax: 5, yMin: -4, yMax: 6, grid: true, ...extra });

describe("the derivative", () => {
  it("is f′ to many digits for smooth functions", () => {
    expect(derivativeOf(f("x^2"))(3)).toBeCloseTo(6, 6);
    expect(derivativeOf(f("sin(x)"))(0)).toBeCloseTo(1, 6);
    expect(derivativeOf(f("e^x"))(1)).toBeCloseTo(Math.E, 6);
    expect(derivativeOf(f("1/x"))(2)).toBeCloseTo(-0.25, 6);
    expect(derivativeOf(f("x^3 - 3x"))(100)).toBeCloseTo(29997, 3);
  });

  it("uses one side where the function is defined on one side only", () => {
    expect(derivativeOf(f("sqrt(x)"))(1e-9)).toBeGreaterThan(100);
    expect(derivativeOf(f("ln(x)"))(1)).toBeCloseTo(1, 5);
    expect(Number.isNaN(derivativeOf(f("sqrt(x)"))(-3))).toBe(true);
  });
});

describe("a tangent", () => {
  it("touches the curve with the slope of f′: y = m·x + p", () => {
    const t = tangentAt(f("x^2"), 2)!;
    expect(t).toMatchObject({ a: 2, y: 4, m: 4 });
    expect(t.p).toBeCloseTo(-4, 8);
    const sin = tangentAt(f("sin(x)"), 0)!;
    expect(sin.m).toBe(1);
    expect(sin.p).toBeCloseTo(0, 8);
  });

  it("does not exist where the curve or its slope does not", () => {
    expect(tangentAt(f("1/x"), 0)).toBeNull();
    expect(tangentAt(f("ln(x)"), -1)).toBeNull();
    expect(tangentAt(f("sqrt(x)"), 0)).toBeNull(); // (vertical there)
    expect(tangentAt(f("|x|"), 0)).toBeNull(); // (a kink)
    expect(tangentAt(f("|x|"), 2)?.m).toBe(1);
  });

  it("is written as a line", () => {
    expect(lineText(2, 1)).toBe("y = 2x + 1");
    expect(lineText(1, 0)).toBe("y = x");
    expect(lineText(-1, -3)).toBe("y = −x − 3");
    expect(lineText(0, 2.5)).toBe("y = 2.5");
    expect(lineText(0.5, -0.0001)).toBe("y = 0.5x");
  });
});

describe("asymptotes", () => {
  const A = (src: string, a = -5, b = 5) => findAsymptotes(f(src), a, b);

  it("finds the vertical and the horizontal one of 1/x", () => {
    const a = A("1/x");
    expect(a.vertical).toEqual([0]);
    expect(a.horizontal).toEqual([0]);
    expect(a.oblique).toEqual([]);
  });

  it("finds both of 2x/(x − 1), whichever way it is written", () => {
    for (const src of ["2x/(x-1)", "(2x)/(x - 1)"]) {
      const a = A(src);
      expect(a.vertical).toEqual([1]);
      expect(a.horizontal).toEqual([2]);
    }
  });

  it("finds an oblique one: x + 1/x and (x² + 1)/x are y = x", () => {
    for (const src of ["x + 1/x", "(x^2+1)/x"]) {
      const a = A(src);
      expect(a.vertical).toEqual([0]);
      expect(a.horizontal).toEqual([]);
      expect(a.oblique).toEqual([{ m: 1, p: 0 }]);
    }
    const b = A("(x^2 - x + 3)/(x - 2)", -10, 10);
    expect(b.vertical).toEqual([2]);
    expect(b.oblique).toEqual([{ m: 1, p: 1 }]);
  });

  it("finds the one of ln(x) at the edge of its domain, and the one of e^x on the left only", () => {
    expect(A("ln(x)", -5, 5).vertical).toEqual([0]);
    const e = A("e^x");
    expect(e.horizontal).toEqual([0]);
    expect(e.vertical).toEqual([]);
    expect(e.oblique).toEqual([]);
  });

  it("finds every pole of tan(x) in the window", () => {
    const v = A("tan(x)", -2, 2).vertical;
    expect(v).toHaveLength(2);
    expect(v[0]).toBeCloseTo(-Math.PI / 2, 5);
    expect(v[1]).toBeCloseTo(Math.PI / 2, 5);
  });

  it("finds a pole with no sign change (1/x²)", () => {
    expect(A("1/x^2").vertical).toEqual([0]);
  });

  it("finds a pole that is not a nice number", () => {
    const v = A("1/(3x - 1)").vertical;
    expect(v).toHaveLength(1);
    expect(v[0]).toBeCloseTo(1 / 3, 6);
  });

  it("finds none where there are none", () => {
    for (const src of ["x^2", "x^3 - 3x", "sin(x)", "2x + 1", "sqrt(x)", "|x|", "x sin(x)", "sin(x)/x"]) {
      const a = A(src);
      expect(a.vertical, src).toEqual([]);
      expect(a.oblique.length === 0 || src === "2x + 1" || src === "|x|", src).toBe(true);
    }
    // sin(x)/x has a removable hole at 0, which is not an asymptote, and tends to 0 at both ends
    expect(A("sin(x)/x").horizontal).toEqual([0]);
  });

  it("is a line for a straight function (its own line), not a curve that approaches", () => {
    expect(A("2x + 1").oblique).toEqual([{ m: 2, p: 1 }]);
  });
});

describe("the lists of a graph", () => {
  it("adds and removes functions with their options, up to six", () => {
    let g = graph({ functions: ["x", "x^2"], curves: [{}, { color: "#000000", derivative: true }] });
    const added = addFunction(g, "sin(x)")!;
    expect(added.functions).toEqual(["x", "x^2", "sin(x)"]);
    expect(added.curves).toEqual([{}, { color: "#000000", derivative: true }]);
    g = { ...g, ...removeFunction(g, 0) };
    expect(g.functions).toEqual(["x^2"]);
    expect(g.curves).toEqual([{ color: "#000000", derivative: true }]); // (the options followed their curve)
    expect(addFunction(graph({ functions: Array(MAX_FUNCTIONS).fill("x") }))).toBeNull();
  });

  it("keeps no empty option lists", () => {
    const g = graph();
    expect(setCurve(g, 0, { derivative: true }).curves).toEqual([{ derivative: true }]);
    expect(setCurve({ ...g, curves: [{ derivative: true }] }, 0, { derivative: false }).curves).toBeUndefined();
    expect(setCurve({ ...g, curves: [{ hidden: true }] }, 0, { hidden: false }).curves).toBeUndefined();
  });

  it("adds, moves and removes tangents", () => {
    let g = graph();
    g = { ...g, ...addTangent(g, 0, 1)! };
    g = { ...g, ...addTangent(g, 0, -2)! };
    expect(addTangent(g, 0, 1)).toBeNull(); // (one there already)
    expect(g.curves?.[0].tangents).toEqual([1, -2]);
    g = { ...g, ...moveTangent(g, 0, 1, 3) };
    expect(g.curves?.[0].tangents).toEqual([1, 3]);
    g = { ...g, ...removeTangent(g, 0, 0) };
    g = { ...g, ...removeTangent(g, 0, 0) };
    expect(g.curves).toBeUndefined();
  });

  it("removes the last line and the list with it", () => {
    expect(removeLine({ lines: [{ kind: "v", a: 1 }] }, 0).lines).toBeUndefined();
    expect(removeLine({ lines: [{ kind: "v", a: 1 }, { kind: "h", b: 2 }] }, 0).lines).toEqual([{ kind: "h", b: 2 }]);
  });

  it("gives each curve its color: its own, else the one of its place", () => {
    expect(colorOf({}, 0)).toBe("#1d4ed8");
    expect(colorOf({}, 1)).toBe("#dc2626");
    expect(colorOf({}, 2)).toBe("#059669");
    expect(colorOf({ curves: [{}, { color: "#111111" }] }, 1)).toBe("#111111");
  });
});

describe("what a graph draws", () => {
  it("draws only what is asked for, and nothing for a hidden or unreadable curve", () => {
    const g = graph({
      functions: ["1/x", "x^2", "((", "x"],
      curves: [{ derivative: true, asymptotes: true, tangents: [1, 0] }, { hidden: true, derivative: true }],
    });
    const [a, b, c, d] = drawingsOf(g);
    expect(a.fn).toBeTypeOf("function");
    expect(a.derivative).toBeTypeOf("function");
    expect(a.tangents.map((t) => t.a)).toEqual([1]); // (no tangent at 0: 1/x has none there)
    expect(a.asymptotes).toEqual([{ kind: "v", a: 0 }, { kind: "h", b: 0 }]);
    expect(b.fn).toBeNull();
    expect(b.derivative).toBeNull();
    expect(c.fn).toBeNull();
    expect(d.derivative).toBeNull();
    expect(d.asymptotes).toEqual([]);
  });

  it("labels lines and numbers", () => {
    expect(lineLabel({ kind: "v", a: 1 })).toBe("x = 1");
    expect(lineLabel({ kind: "h", b: -0.5 })).toBe("y = −0.5");
    expect(lineLabel({ kind: "o", m: 1, p: 1 })).toBe("y = x + 1");
    expect(formatNum(0.33333)).toBe("0.333");
    expect(formatNum(-2)).toBe("−2");
    expect(formatNum(-0.0001)).toBe("0");
  });
});

describe("the window", () => {
  it("fits the curves without letting a pole stretch it", () => {
    const fit = fitY([f("x^2")], -3, 3)!;
    expect(fit.yMin).toBeLessThanOrEqual(0);
    expect(fit.yMax).toBeGreaterThanOrEqual(8);
    const pole = fitY([f("1/x")], -5, 5)!;
    expect(pole.yMax - pole.yMin).toBeLessThan(40);
    expect(fitY([() => Number.NaN], 0, 1)).toBeNull();
  });

  it("zooms about a point, which stays where it is", () => {
    const w = zoomWindow({ xMin: -5, xMax: 5, yMin: -4, yMax: 6 }, 0.5, 1, 1);
    expect(w).toEqual({ xMin: -2, xMax: 3, yMin: -1.5, yMax: 3.5 });
  });
});
