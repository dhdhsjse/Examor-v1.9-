import { describe, expect, it } from "vitest";
import { compileLatex, derivativeTable, functionName, latexToFormula, studyFunction } from "../functionStudy";

const study = (latex: string, range = {}) => {
  const { fn, error } = compileLatex(latex);
  if (!fn) throw new Error(error ?? "no function");
  return studyFunction(fn, range);
};

describe("latexToFormula", () => {
  it("reads fractions, roots, powers and functions", () => {
    expect(latexToFormula("f(x)=\\frac{x^2-1}{x+2}")).toBe("((x^2-1)/(x+2))");
    expect(latexToFormula("g\\left(t\\right)=\\sqrt{t}+t^{3}")).toBe("sqrt(x)+x^(3)");
    expect(latexToFormula("y=2\\cdot e^{-x}")).toBe("2* e^(-x)");
    expect(latexToFormula("f(x)=\\ln\\left(x\\right)")).toBe("ln (x)");
    expect(latexToFormula("f(x)=0{,}5x")).toBe("0.5x");
  });
  it("finds the name and variable", () => {
    expect(functionName("g(t)=t^2")).toEqual({ name: "g", variable: "t" });
    expect(functionName("x^2")).toEqual({ name: "f", variable: "x" });
  });
  it("rejects what is not a function", () => {
    expect(compileLatex("").fn).toBeNull();
    expect(compileLatex("f(x)=3").fn).toBeNull();
  });
});

describe("studyFunction", () => {
  it("a parabola: decreasing then increasing, minimum at 1", () => {
    const s = study("f(x)=x^2-2x");
    expect(s.points.map((p) => p.x)).toEqual([-Infinity, 1, Infinity]);
    expect(s.points[1]).toMatchObject({ kind: "critical", value: -1 });
    expect(s.signs).toEqual([-1, 1]);
    expect(s.points[0].value).toBe(Infinity);
  });
  it("a cubic with two extrema", () => {
    const s = study("f(x)=x^3-3x");
    expect(s.points.map((p) => p.x)).toEqual([-Infinity, -1, 1, Infinity]);
    expect(s.signs).toEqual([1, -1, 1]);
    expect(s.points[1].value).toBe(2);
    expect(s.points[2].value).toBe(-2);
  });
  it("x³ touches 0 without changing sign", () => {
    const s = study("f(x)=x^3");
    expect(s.points.map((p) => p.x)).toEqual([-Infinity, 0, Infinity]);
    expect(s.signs).toEqual([1, 1]);
  });
  it("1/x has a pole at 0", () => {
    const s = study("f(x)=\\frac{1}{x}");
    expect(s.points.map((p) => p.x)).toEqual([-Infinity, 0, Infinity]);
    expect(s.points[1]).toMatchObject({ kind: "pole", left: -Infinity, right: Infinity });
    expect(s.signs).toEqual([-1, -1]);
    expect(s.points[0].value).toBe(0);
  });
  it("a pole not on the samples", () => {
    const s = study("f(x)=\\frac{x+1}{x-0.3}");
    expect(s.points.some((p) => p.kind === "pole" && Math.abs(p.x - 0.3) < 1e-6)).toBe(true);
  });
  it("√x starts at 0", () => {
    const s = study("f(x)=\\sqrt{x}");
    expect(s.points[0]).toMatchObject({ x: 0, kind: "edge", value: 0 });
    expect(s.points[1].x).toBe(Infinity);
    expect(s.signs).toEqual([1]);
  });
  it("on a closed interval", () => {
    const s = study("f(x)=x^2", { from: -2, to: 3 });
    expect(s.points.map((p) => p.x)).toEqual([-2, 0, 3]);
    expect(s.points[2].value).toBe(9);
  });
});

describe("derivativeTable", () => {
  it("lays out x, f'(x) and f(x)", () => {
    const t = derivativeTable(study("f(x)=x^2-2x"), { name: "f", variable: "x", lang: "fr" });
    expect(t.cells).toEqual([
      ["x", "−∞", "", "1", "", "+∞"],
      ["f'(x)", "", "−", "0", "+", ""],
      ["f(x)", "+∞", "↘", "−1", "↗", "+∞"],
    ]);
  });
});
