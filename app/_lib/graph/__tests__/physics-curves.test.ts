import { describe, expect, it } from "vitest";
import { compileFunction, tryCompile } from "../../graphMath";
import { buildScene, graphToPxX, graphToPxY } from "../grid";
import {
  FUNCTION_SPECS,
  FUNCTION_TYPES,
  compileExpression,
  defaultExpression,
  evaluateFunction,
  expressionError,
  getSlopeAt,
  monotoneCurve,
  newDataSeries,
  newFunction,
  sampleCurve,
  solveForX,
  titrationInfo,
  titrationPh,
} from "../mathUtils";
import { GRAPH_AR, GRAPH_FR } from "../strings";
import { renderGraphSvg } from "../svg";
import { DEFAULT_GRAPH_CONFIG, type FunctionType, type GraphConfig, type GraphFunction } from "../types";

const C = DEFAULT_GRAPH_CONFIG;
const with_ = (u: Partial<GraphConfig>): GraphConfig => ({ ...C, ...u });
const fn = (type: FunctionType, params: Record<string, number>, extra: Partial<GraphFunction> = {}): GraphFunction => ({ id: "f", type, color: "#000", strokeWidth: 2, params, ...extra });
const formula = (expression: string, extra: Partial<GraphFunction> = {}) => fn("formula", {}, { expression, ...extra });

describe("the formula parser, for physics", () => {
  it("takes t as well as x, and the u(t) = of a sheet", () => {
    expect(compileFunction("9*(1-exp(-t/30))", ["x", "t"])(30)).toBeCloseTo(9 * (1 - Math.exp(-1)), 12);
    expect(compileFunction("u(t) = 2t + 1", ["x", "t"])(3)).toBe(7);
    expect(compileFunction("f(x) = 2x + 1")(3)).toBe(7); // (as before)
    expect(compileFunction("y = x^2")(3)).toBe(9);
    expect(tryCompile("2*t").error).toMatch(/Unknown name/); // (t means nothing in a function plot)
    expect(tryCompile("tan(t)", ["x", "t"]).error).toBeNull(); // (tan is not t + an)
  });

  it("reads scientific notation, and still reads 2e^x as 2·e^x", () => {
    expect(compileFunction("1e-3*x")(1000)).toBeCloseTo(1, 12);
    expect(compileFunction("2.5E2")(0)).toBe(250);
    expect(compileFunction("2e^x")(1)).toBeCloseTo(2 * Math.E, 12);
    expect(compileFunction("2e")(0)).toBeCloseTo(2 * Math.E, 12);
    expect(compileFunction("5.")(0)).toBe(5);
    expect(compileFunction(".5")(0)).toBe(0.5);
    expect(tryCompile(".").error).not.toBeNull();
  });
});

describe("a formula curve", () => {
  it("is evaluated from its text, in x or t", () => {
    expect(evaluateFunction(formula("2*x+1"), 3)).toBe(7);
    expect(evaluateFunction(formula("5*exp(-t/40)*cos(2*pi*t/12)"), 0)).toBe(5);
    expect(evaluateFunction(formula("log(x/(30-x))"), 15)).toBeCloseTo(0, 12);
    expect(evaluateFunction(formula("log(x/(30-x))"), 30)).toBe(Infinity);
  });

  it("is not defined when its text cannot be read", () => {
    expect(Number.isNaN(evaluateFunction(formula("2*"), 1))).toBe(true);
    expect(Number.isNaN(evaluateFunction(formula(""), 1))).toBe(true);
    expect(expressionError("2*")).not.toBeNull();
    expect(expressionError("2*x")).toBeNull();
    expect(sampleCurve(formula("2*"), C).status).toBe("undefined");
  });

  it("is read once for each text", () => {
    const f = compileExpression("3*x");
    expect(f).not.toBeNull();
    expect(compileExpression("3*x")).toBe(f);
    expect(compileExpression("3*")).toBeNull();
    expect(compileExpression("3*")).toBeNull();
  });

  it("starts with a formula that shows on any paper", () => {
    const papers = [C, with_({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 }), with_({ xMin: 2, xMax: 8, yMin: 3, yMax: 9 }), with_({ xMin: 0, xMax: 0.5, yMin: 0, yMax: 100 })];
    for (const p of papers) {
      const f = newFunction("formula", p);
      expect(f.expression, `${p.xMin}..${p.xMax}`).toBe(defaultExpression(p));
      expect(expressionError(f.expression!)).toBeNull();
      expect(sampleCurve(f, p).status).toBe("ok");
    }
  });

  it("has a numeric slope, so it can carry a tangent", () => {
    const f = formula("x^2");
    expect(getSlopeAt(f, 3)).toBeCloseTo(6, 5);
    expect(getSlopeAt(formula("5*exp(-t/2)"), 0)).toBeCloseTo(-2.5, 5);
    expect(Number.isNaN(getSlopeAt(formula("ln(x)"), -1))).toBe(true);
  });
});

describe("the range a curve is drawn on", () => {
  const line = fn("linear", { a: 1, b: 0 }, { from: 2, to: 6 });

  it("has no value outside it", () => {
    expect(evaluateFunction(line, 1.99)).toBeNaN();
    expect(evaluateFunction(line, 2)).toBe(2);
    expect(evaluateFunction(line, 6)).toBe(6);
    expect(evaluateFunction(line, 6.01)).toBeNaN();
    expect(evaluateFunction({ ...line, to: undefined }, 100)).toBe(100); // (an end left empty is as far as the paper goes)
  });

  it("is a line that starts and ends exactly there", () => {
    const { segments, status } = sampleCurve(line, C);
    expect(status).toBe("ok");
    expect(segments).toHaveLength(1);
    const seg = segments[0];
    expect(seg[0]).toBeCloseTo(graphToPxX(2, C), 9);
    expect(seg[1]).toBeCloseTo(graphToPxY(2, C), 9);
    expect(seg[seg.length - 2]).toBeCloseTo(graphToPxX(6, C), 9);
    expect(seg[seg.length - 1]).toBeCloseTo(graphToPxY(6, C), 9);
  });

  it("is not drawn at all when the paper is somewhere else", () => {
    expect(sampleCurve({ ...line, from: 20, to: 30 }, C).status).toBe("undefined");
  });

  it("cuts a curve into pieces: the charge of a capacitor, then its discharge in a coil", () => {
    const charge = formula("9*(1-exp(-(x-1)/2))", { from: 1, to: 6 });
    const discharge = fn("oscillation", { A: 9, T: 2, tau: 3, phi: 0, y0: 0, x0: 6 });
    expect(evaluateFunction(charge, 6)).toBeCloseTo(9 * (1 - Math.exp(-2.5)), 9);
    expect(evaluateFunction(discharge, 6)).toBe(9); // (it starts where the charge stops, at the top)
    expect(evaluateFunction(discharge, 5.9)).toBeNaN();
    expect(sampleCurve(charge, C).status).toBe("ok");
    expect(sampleCurve(discharge, C).status).toBe("ok");
  });

  it("has no tangent outside it", () => {
    expect(getSlopeAt(line, 1)).toBeNaN();
    expect(getSlopeAt(line, 3)).toBe(1);
    expect(getSlopeAt(formula("x^2", { from: 0 }), 0)).toBeCloseTo(0, 5); // (one-sided at the end of its range)
  });
});

describe("an oscillation", () => {
  const damped = fn("oscillation", { A: 6, T: 8, tau: 14, phi: 0, y0: 1, x0: 2 });

  it("starts at its amplitude at x₀, and nothing is drawn before", () => {
    expect(evaluateFunction(damped, 2)).toBe(7); // A + y₀
    expect(evaluateFunction(damped, 1.99)).toBeNaN();
  });

  it("goes through zero every half period and fades by e^(−x/τ)", () => {
    expect(evaluateFunction(damped, 4)).toBeCloseTo(1, 9); // a quarter of the period later: cos = 0, back at y₀
    expect(evaluateFunction(damped, 6)).toBeCloseTo(1 + 6 * Math.exp(-4 / 14) * Math.cos(Math.PI), 9);
    const peaks = [2, 10, 18].map((x) => evaluateFunction(damped, x) - 1); // one period apart: each peak is e^(−T/τ) of the one before
    expect(peaks[1] / peaks[0]).toBeCloseTo(Math.exp(-8 / 14), 9);
    expect(peaks[2] / peaks[1]).toBeCloseTo(Math.exp(-8 / 14), 9);
  });

  it("does not fade for a damping time of 0, and takes a phase in degrees", () => {
    const pure = fn("oscillation", { A: 40, T: 2, tau: 0, phi: 0, y0: 0, x0: 0 });
    expect(evaluateFunction(pure, 0)).toBe(40);
    expect(evaluateFunction(pure, 1)).toBeCloseTo(-40, 9);
    expect(evaluateFunction(pure, 100)).toBeCloseTo(40, 6);
    expect(evaluateFunction({ ...pure, params: { ...pure.params, phi: 90 } }, 0)).toBeCloseTo(0, 9); // cos(90°)
    expect(evaluateFunction({ ...pure, params: { ...pure.params, phi: -90 } }, 0.5)).toBeCloseTo(40 * Math.cos(Math.PI / 2 - Math.PI / 2), 9);
  });

  it("has no value for a period of 0", () => {
    expect(evaluateFunction(fn("oscillation", { A: 1, T: 0, tau: 0, phi: 0, y0: 0, x0: 0 }), 1)).toBeNaN();
  });

  it("has an exact slope", () => {
    for (const f of [damped, fn("oscillation", { A: 3, T: 5, tau: 0, phi: 30, y0: 0, x0: 0 })]) {
      for (const x of [2.5, 4, 7.3, 9]) {
        const h = 1e-5;
        const numeric = (evaluateFunction(f, x + h) - evaluateFunction(f, x - h)) / (2 * h);
        expect(getSlopeAt(f, x), `${f.params.tau} at ${x}`).toBeCloseTo(numeric, 5);
      }
    }
  });

  it("shows up on the paper with its starting values", () => {
    const c = with_({ xMin: 0, xMax: 40, yMin: -8, yMax: 8 });
    const f = newFunction("oscillation", c);
    expect(sampleCurve(f, c).status).toBe("ok");
    expect(f.params.x0).toBe(0);
  });
});

describe("a titration", () => {
  // the sheets of an exam: 0.07 mol/L, 20 mL against a base of the same concentration, a strong acid and a weak one (pKa 3.55)
  const strong = { pKa: -2, C: 0.07, V0: 20, Ct: 0.07, kind: 0 };
  const weak = { pKa: 3.55, C: 0.07, V0: 20, Ct: 0.07, kind: 0 };

  it("starts where the acid says: −log C for a strong one, ½(pKa − log C) for a weak one", () => {
    expect(titrationPh(strong, 0)).toBeCloseTo(-Math.log10(0.07), 2);
    expect(titrationPh(weak, 0)).toBeCloseTo((3.55 - Math.log10(0.07)) / 2, 1);
  });

  it("is 7 at the equivalence of a strong acid, and above 7 for a weak one: ½(pKa + 14 + log C_E)", () => {
    expect(titrationPh(strong, 20)).toBeCloseTo(7, 2);
    expect(titrationPh(weak, 20)).toBeCloseTo((3.55 + 14 + Math.log10(0.035)) / 2, 1);
  });

  it("is the pKa at half of the equivalence (the buffer), and jumps across the equivalence", () => {
    expect(titrationPh(weak, 10)).toBeCloseTo(3.55, 1);
    expect(titrationPh(weak, 20.5) - titrationPh(weak, 19.5)).toBeGreaterThan(4);
  });

  it("ends in a strong base: 14 + log of what is left over", () => {
    expect(titrationPh(weak, 40)).toBeCloseTo(14 + Math.log10((0.07 * 40 - 0.07 * 20) / 60), 1);
  });

  it("rises with the volume, from the first drop to the last", () => {
    let last = -Infinity;
    for (let v = 0; v <= 60; v += 0.25) {
      const pH = titrationPh(weak, v);
      expect(pH, `v = ${v}`).toBeGreaterThanOrEqual(last - 1e-9);
      last = pH;
    }
  });

  it("works for a base titrated by a strong acid: it falls, from ½(pKa + 14 + log C), through the pKa, to the acid of the equivalence", () => {
    const ammonia = { pKa: 9.25, C: 0.1, V0: 20, Ct: 0.1, kind: 1 };
    expect(titrationPh(ammonia, 0)).toBeCloseTo((9.25 + 14 + Math.log10(0.1)) / 2, 1); // 11.1
    expect(titrationPh(ammonia, 10)).toBeCloseTo(9.25, 1);
    expect(titrationPh(ammonia, 20)).toBeCloseTo((9.25 - Math.log10(0.05)) / 2, 1); // 5.3
    expect(titrationPh(ammonia, 40)).toBeCloseTo(-Math.log10((0.1 * 40 - 0.1 * 20) / 60), 1);
    expect(titrationPh(ammonia, 5)).toBeGreaterThan(titrationPh(ammonia, 15));
  });

  it("says where its equivalence is", () => {
    const info = titrationInfo(weak)!;
    expect(info.ve).toBeCloseTo(20, 9);
    expect(info.phE).toBeCloseTo(8.05, 1);
    expect(info.phHalf).toBeCloseTo(3.55, 1); // the pKa of a weak acid
    expect(titrationInfo({ ...weak, Ct: 0 })).toBeNull();
  });

  it("is not defined for nothing to titrate, a negative volume, or concentrations that make no sense", () => {
    expect(titrationPh({ ...weak, C: 0 }, 5)).toBeNaN();
    expect(titrationPh(weak, -1)).toBeNaN();
    expect(titrationPh({ ...weak, V0: -5 }, 5)).toBeNaN();
    expect(titrationPh({ ...weak, pKa: Number.NaN }, 5)).toBeNaN();
  });

  it("is drawn as a curve with the jump of an exam figure, and carries a tangent", () => {
    const c = with_({ xMin: 0, xMax: 40, yMin: 0, yMax: 14 });
    const f = fn("titration", weak);
    expect(sampleCurve(f, c).status).toBe("ok");
    expect(getSlopeAt(f, 20)).toBeGreaterThan(5); // steep at the equivalence
    expect(getSlopeAt(f, 5)).toBeLessThan(0.5);
  });

  it("starts as a weak acid and a strong base, equivalent in the middle of the paper", () => {
    const c = with_({ xMin: 0, xMax: 20, yMin: 0, yMax: 14 });
    const f = newFunction("titration", c);
    expect(titrationInfo(f.params)!.ve).toBeCloseTo(10, 1);
    expect(sampleCurve(f, c).status).toBe("ok");
  });
});

describe("the same curves, wherever they are put", () => {
  it("has the parameters its spec says, and shows on a paper of any kind", () => {
    const papers = [C, with_({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 }), with_({ xMin: 0, xMax: 20, yMin: 0, yMax: 14 }), with_({ xMin: 2, xMax: 8, yMin: 3, yMax: 9 }), with_({ xMin: 0, xMax: 0.5, yMin: 0, yMax: 100 })];
    for (const paper of papers) {
      for (const type of ["oscillation", "titration", "formula"] as FunctionType[]) {
        const f = { ...newFunction(type, paper), id: "n" };
        expect(sampleCurve(f, paper).status, `${type} on ${paper.xMin}..${paper.xMax}`).toBe("ok");
        expect(Object.keys(f.params).sort(), type).toEqual(FUNCTION_SPECS[type].params.map((p) => p.key).sort());
      }
    }
  });

  it("is in the palette, with a name in French and in Arabic, and every hint it gives", () => {
    for (const type of ["oscillation", "titration", "formula"] as FunctionType[]) expect(FUNCTION_TYPES).toContain(type);
    for (const dict of [GRAPH_FR, GRAPH_AR]) {
      for (const type of FUNCTION_TYPES) {
        const spec = FUNCTION_SPECS[type];
        expect(dict[spec.name], spec.name).toBeTruthy();
        if (spec.note) expect(dict[spec.note], spec.note).toBeTruthy();
        for (const p of spec.params) {
          if (p.title) expect(dict[p.title], p.title).toBeTruthy();
          if (p.options) {
            expect(dict[p.label], p.label).toBeTruthy();
            for (const o of p.options) expect(dict[o.label], o.label).toBeTruthy();
          }
        }
      }
    }
  });

  it("gives a choice its values (an acid or a base), not a number to type", () => {
    const kind = FUNCTION_SPECS.titration.params.find((p) => p.key === "kind")!;
    expect(kind.options!.map((o) => o.value)).toEqual([0, 1]);
  });
});

describe("a smooth line through measured points", () => {
  const pts = [
    { x: 0, y: 90 },
    { x: 10, y: 45 },
    { x: 20, y: 26 },
    { x: 30, y: 15 },
    { x: 45, y: 7 },
    { x: 60, y: 4.4 },
  ];

  it("goes through every point, and nowhere outside them", () => {
    const f = monotoneCurve(pts);
    for (const p of pts) expect(f(p.x)).toBeCloseTo(p.y, 9);
    expect(f(-0.1)).toBeNaN();
    expect(f(60.1)).toBeNaN();
  });

  it("never overshoots: between two points it stays between their values, and falls where they fall", () => {
    const f = monotoneCurve(pts);
    for (let i = 0; i < pts.length - 1; i++) {
      for (let k = 1; k < 20; k++) {
        const x = pts[i].x + ((pts[i + 1].x - pts[i].x) * k) / 20;
        expect(f(x), `x = ${x}`).toBeLessThanOrEqual(pts[i].y + 1e-9);
        expect(f(x), `x = ${x}`).toBeGreaterThanOrEqual(pts[i + 1].y - 1e-9);
      }
    }
    // a flat stretch stays flat and a turning point is a flat point, not a wiggle
    const bump = monotoneCurve([{ x: 0, y: 0 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 0 }]);
    for (let x = 1; x <= 2; x += 0.1) expect(bump(x)).toBeCloseTo(5, 9);
    const peak = monotoneCurve([{ x: 0, y: 0 }, { x: 1, y: 3 }, { x: 2, y: 0 }]);
    for (let x = 0; x <= 2; x += 0.05) expect(peak(x)).toBeLessThanOrEqual(3 + 1e-9);
  });

  it("is a straight line for two points and nothing for none", () => {
    const f = monotoneCurve([{ x: 0, y: 0 }, { x: 4, y: 8 }]);
    expect(f(1)).toBeCloseTo(2, 9);
    expect(f(3)).toBeCloseTo(6, 9);
    expect(monotoneCurve([])(1)).toBeNaN();
    expect(monotoneCurve([{ x: 1, y: 2 }])(1)).toBe(2);
  });

  it("is drawn by a series that asks for it, from its first point to its last", () => {
    const c = with_({ xMin: 0, xMax: 70, yMin: 0, yMax: 100 });
    const s: GraphFunction = { ...newDataSeries(c, pts.map((p, i) => ({ id: `p${i}`, ...p }))), id: "s", lineStyle: "smooth" };
    const { segments, status } = sampleCurve(s, c);
    expect(status).toBe("ok");
    expect(segments).toHaveLength(1);
    const seg = segments[0];
    expect(seg[0]).toBeCloseTo(graphToPxX(0, c), 9);
    expect(seg[1]).toBeCloseTo(graphToPxY(90, c), 9);
    expect(seg[seg.length - 2]).toBeCloseTo(graphToPxX(60, c), 9);
    expect(seg[seg.length - 1]).toBeCloseTo(graphToPxY(4.4, c), 9);
    expect(seg.length / 2).toBeGreaterThan(pts.length * 5); // (many more points than the data: a curve, not a polyline)
    expect(sampleCurve({ ...s, lineStyle: "straight" }, c).segments[0]).toHaveLength(pts.length * 2);
    expect(sampleCurve({ ...s, lineStyle: "none" }, c).segments).toEqual([]);
  });

  it("takes the mean of points that share an x, and works with two points", () => {
    const c = with_({});
    const twice = { ...newDataSeries(c, [{ id: "a", x: 1, y: 2 }, { id: "b", x: 1, y: 4 }, { id: "c", x: 5, y: 8 }]), id: "t", lineStyle: "smooth" as const };
    expect(sampleCurve(twice, c).segments).toHaveLength(1);
    const two = { ...newDataSeries(c, [{ id: "a", x: 1, y: 1 }, { id: "b", x: 5, y: 5 }]), id: "u", lineStyle: "smooth" as const };
    expect(sampleCurve(two, c).segments).toHaveLength(1);
    const one = { ...newDataSeries(c, [{ id: "a", x: 1, y: 1 }]), id: "v", lineStyle: "smooth" as const };
    expect(sampleCurve(one, c)).toEqual({ segments: [], status: "ok" });
  });

  it("is in the picture as a polyline with its points over it", () => {
    const c = with_({ xMin: 0, xMax: 70, yMin: 0, yMax: 100, functions: [{ ...newDataSeries(with_({}), pts.map((p, i) => ({ id: `p${i}`, ...p }))), id: "s", lineStyle: "smooth" }] });
    const svg = renderGraphSvg(c)!.svg;
    expect(svg).toContain("<polyline");
    expect(svg.match(/<circle[^>]*r="4"/g)).toHaveLength(pts.length);
    expect(buildScene(c).curves[0].segments).toHaveLength(1);
  });
});

describe("finding where a curve has a value", () => {
  it("finds x for a given y on a line, a decay and a titration", () => {
    expect(solveForX(fn("linear", { a: 2, b: 1 }), 7, C)).toBeCloseTo(3, 9);
    expect(solveForX(fn("exponential", { A: 8, tau: 2, y0: 0 }), 4, C)).toBeCloseTo(2 * Math.LN2, 9);
    const c = with_({ xMin: 0, xMax: 40, yMin: 0, yMax: 14 });
    const params = { pKa: 3.75, C: 0.05, V0: 20, Ct: 0.05, kind: 0 };
    expect(solveForX(fn("titration", params), titrationPh(params, 10), c)).toBeCloseTo(10, 6); // the half-equivalence
    expect(solveForX(fn("titration", params), 3.75, c)).toBeCloseTo(10, 0); // (the pKa itself, within a tenth of a mL: the exact balance is a little above it)
  });

  it("is null when the curve never has that value, or has no value at all", () => {
    expect(solveForX(fn("linear", { a: 1, b: 0 }), 50, C)).toBeNull();
    expect(solveForX(fn("logarithmic", { a: 1, b: 0 }), 1, with_({ xMin: -5, xMax: -1 }))).toBeNull();
  });

  it("finds the end of a curve whose range stops there", () => {
    const line = fn("linear", { a: -9.8, b: 9.5 }, { from: 0, to: 2.2 });
    expect(solveForX(line, 9.5 - 9.8 * 2.2, with_({ xMin: 0, xMax: 2.5, yMin: -14, yMax: 10 }))).toBeCloseTo(2.2, 6);
  });
});
