import { describe, expect, it } from "vitest";
import { autoWidth, binLabel, binValues, boxStats, coefText, equationText, fitTrend, mean, median, movingAverage, quantile, stdev } from "../stats";

describe("quartiles", () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8];
  it("follow the rule of the lycée: Q1 is the term of rank ⌈n/4⌉, Q3 of rank ⌈3n/4⌉", () => {
    expect(quantile(v, 0.25, "lycee")).toBe(2);
    expect(quantile(v, 0.75, "lycee")).toBe(6);
    expect(quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 0.25, "lycee")).toBe(3); // n = 11: rank 3
    expect(quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 0.75, "lycee")).toBe(9); // rank 9
    expect(quantile([5], 0.25, "lycee")).toBe(5);
  });

  it("can follow Excel's two rules", () => {
    expect(quantile(v, 0.25, "inclusive")).toBeCloseTo(2.75);
    expect(quantile(v, 0.75, "inclusive")).toBeCloseTo(6.25);
    expect(quantile(v, 0.25, "exclusive")).toBeCloseTo(2.25);
    expect(quantile(v, 0.75, "exclusive")).toBeCloseTo(6.75);
  });

  it("has a median, a mean and a standard deviation", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2); // (the standard deviation of the whole data)
  });
});

describe("a box", () => {
  it("has the five numbers, the mean and the whiskers at the extremes when there are no outliers", () => {
    const b = boxStats([1, 2, 3, 4, 5, 6, 7, 8], "lycee")!;
    expect(b).toMatchObject({ n: 8, min: 1, q1: 2, median: 4.5, q3: 6, max: 8, low: 1, high: 8, outliers: [] });
    expect(b.mean).toBe(4.5);
  });

  it("puts the data beyond 1.5 × the interquartile range apart, and shortens the whisker to the last data inside", () => {
    const b = boxStats([10, 11, 12, 12, 13, 13, 14, 14, 15, 40], "lycee")!;
    expect(b.outliers).toEqual([40]);
    expect(b.high).toBe(15);
    expect(b.max).toBe(40);
    expect(boxStats([10, 11, 12, 12, 13, 13, 14, 14, 15, 40], "lycee", false)!.high).toBe(40);
  });

  it("is null for no data", () => {
    expect(boxStats([], "lycee")).toBeNull();
  });
});

describe("trendlines", () => {
  const line: [number, number][] = [[1, 3], [2, 5], [3, 7], [4, 9]];

  it("fits a straight line exactly, with R² = 1 and its equation", () => {
    const fit = fitTrend(line, { kind: "linear", order: 2 })!;
    expect(fit.coef[0]).toBeCloseTo(2, 9);
    expect(fit.coef[1]).toBeCloseTo(1, 9);
    expect(fit.r2).toBeCloseTo(1, 9);
    expect(fit.predict(10)).toBeCloseTo(21, 8);
    expect(equationText(fit)).toBe("y = 2x + 1");
    expect(equationText(fit, ".")).toBe("y = 2x + 1");
  });

  it("fits noisy points by least squares", () => {
    const fit = fitTrend([[0, 1], [1, 3], [2, 4], [3, 8]], { kind: "linear", order: 2 })!;
    expect(fit.coef[0]).toBeCloseTo(2.2, 9);
    expect(fit.coef[1]).toBeCloseTo(0.7, 9);
    expect(fit.r2).toBeGreaterThan(0.9);
    expect(fit.r2).toBeLessThan(1);
  });

  it("writes a negative slope and a decimal comma", () => {
    const fit = fitTrend([[0, 4], [1, 3.5], [2, 3], [3, 2.5]], { kind: "linear", order: 2 })!;
    expect(equationText(fit)).toBe("y = −0,5x + 4");
    expect(equationText(fit, ".")).toBe("y = −0.5x + 4");
  });

  it("fits a polynomial, an exponential, a logarithm and a power", () => {
    const parabola: [number, number][] = [-2, -1, 0, 1, 2, 3].map((x) => [x, 2 * x * x - 3 * x + 1]);
    const p = fitTrend(parabola, { kind: "poly", order: 2 })!;
    expect(p.coef.map((c) => Math.round(c * 1e6) / 1e6)).toEqual([2, -3, 1]);
    expect(equationText(p)).toBe("y = 2x^2 − 3x + 1");
    const e = fitTrend([0, 1, 2, 3].map((x): [number, number] => [x, 3 * Math.exp(0.5 * x)]), { kind: "exp", order: 2 })!;
    expect(e.coef[0]).toBeCloseTo(3, 8);
    expect(e.coef[1]).toBeCloseTo(0.5, 8);
    const l = fitTrend([1, 2, 4, 8].map((x): [number, number] => [x, 2 * Math.log(x) + 1]), { kind: "log", order: 2 })!;
    expect(l.coef[0]).toBeCloseTo(2, 8);
    expect(l.coef[1]).toBeCloseTo(1, 8);
    const w = fitTrend([1, 2, 3, 4].map((x): [number, number] => [x, 2 * x ** 1.5]), { kind: "power", order: 2 })!;
    expect(w.coef[0]).toBeCloseTo(2, 8);
    expect(w.coef[1]).toBeCloseTo(1.5, 8);
  });

  it("refuses what cannot be fitted: a logarithm of a negative x, an exponential through a zero, one point", () => {
    expect(fitTrend([[-1, 1], [2, 2], [3, 3]], { kind: "log", order: 2 })).toBeNull();
    expect(fitTrend([[1, 0], [2, 2], [3, 3]], { kind: "exp", order: 2 })).toBeNull();
    expect(fitTrend([[1, 1]], { kind: "linear", order: 2 })).toBeNull();
    expect(fitTrend([[1, 1], [2, Number.NaN], [3, 3]], { kind: "linear", order: 2 })).not.toBeNull(); // (a gap is left out)
  });

  it("averages over a period", () => {
    expect(movingAverage([1, 2, 3, 4, 5], 2)).toEqual([null, 1.5, 2.5, 3.5, 4.5]);
    expect(movingAverage([1, null, 3, 4], 2)).toEqual([null, null, null, 3.5]);
  });

  it("writes coefficients with four significant digits", () => {
    expect(coefText(2.34567)).toBe("2,346");
    expect(coefText(-0.00001234, ".")).toBe("−1.234e-5");
    expect(coefText(12345678, ".")).toBe("1.235e+7");
    expect(coefText(0)).toBe("0");
  });
});

describe("the classes of a histogram", () => {
  const marks = [8, 12, 15, 9, 11, 13, 10, 14, 7, 16, 12, 11, 9, 13, 15, 10, 12, 8, 14, 11, 17, 12, 10, 13, 6, 12, 15, 11, 9, 14];

  it("chooses a nice width", () => {
    expect(autoWidth(marks)).toBe(2);
    expect(autoWidth([5, 5, 5])).toBe(1);
  });

  it("counts every value once, in [lo; hi[ classes, the last holding its upper end", () => {
    const bins = binValues(marks, { bins: "width", width: 4, count: 5, start: 4 });
    expect(bins.map((b) => [b.lo, b.hi])).toEqual([[4, 8], [8, 12], [12, 16], [16, 20]]);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(marks.length);
    expect(bins.map((b) => b.count)).toEqual([2, 12, 14, 2]); // 8, 12 and 16 go to the class above
    expect(binValues([1, 2, 3, 4], { bins: "width", width: 1, count: 5, start: 1 }).map((b) => b.count)).toEqual([1, 1, 1, 1]);
  });

  it("can be given a number of classes", () => {
    const bins = binValues([0, 10], { bins: "count", width: 1, count: 5, start: null });
    expect(bins).toHaveLength(5);
    expect(bins[0]).toMatchObject({ lo: 0, hi: 2 });
    expect(bins[4].count).toBe(1); // (10 is in the last class)
  });

  it("writes a class the way the programmes do", () => {
    const bins = binValues([0, 3, 9], { bins: "width", width: 5, count: 5, start: 0 });
    expect(binLabel(bins[0], false, "french")).toBe("[0;5[");
    expect(binLabel(bins[1], true, "french")).toBe("[5;10]");
    expect(binLabel({ lo: 0.5, hi: 1, count: 0 }, false, "french")).toBe("[0,5;1[");
    expect(binLabel({ lo: 0.5, hi: 1, count: 0 }, false, "plain", ".")).toBe("0.5–1");
  });
});
