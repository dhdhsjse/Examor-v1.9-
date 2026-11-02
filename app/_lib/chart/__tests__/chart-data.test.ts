import { describe, expect, it } from "vitest";
import { FAMILIES, changeKind, defaultChart, normalizeChart, sampleData } from "../catalog";
import { boxSeries, classBins, classLabels, classTable, rawBins, readCells, readModel, waterfallSteps } from "../data";
import { niceScale, autoDecimals, axisText, fraction, valueText } from "../scale";
import { paletteColor, readableOn, shade } from "../palette";
import type { ChartConfig } from "../types";

const chart = (family: ChartConfig["family"], variant?: string, mutate: (c: ChartConfig) => void = () => {}) => {
  const c = defaultChart(family, variant);
  mutate(c);
  return c;
};

describe("reading the table", () => {
  it("reads categories and series from the sample of a column chart", () => {
    const m = readModel(defaultChart("column"));
    expect(m.categories).toEqual(["Catégorie 1", "Catégorie 2", "Catégorie 3", "Catégorie 4"]);
    expect(m.series.map((s) => s.name)).toEqual(["Série 1", "Série 2", "Série 3"]);
    expect(m.series[0].values).toEqual([4.3, 2.5, 3.5, 4.5]);
    expect(m.empty).toBe(false);
  });

  it("turns a table of series in the rows round", () => {
    const c = chart("column", "clustered", (c) => {
      c.data = { cells: [["", "A", "B", "C"], ["Ventes", "1", "2", "3"], ["Achats", "4", "5", "6"]], seriesIn: "rows", header: true, labels: true, calc: true };
    });
    const m = readModel(c);
    // (each row is a series, named by its first cell; the first row names the categories)
    expect(m.categories).toEqual(["A", "B", "C"]);
    expect(m.series.map((s) => s.name)).toEqual(["Ventes", "Achats"]);
    expect(m.series[1].values).toEqual([4, 5, 6]);
  });

  it("can have no names or no categories: they are numbered", () => {
    const c = chart("column", "clustered", (c) => {
      c.data = { cells: [["3", "4"], ["5", "6"]], header: false, labels: false, calc: true };
    });
    const m = readModel(c);
    expect(m.categories).toEqual(["1", "2"]);
    expect(m.series.map((s) => s.name)).toEqual(["Série 1", "Série 2"]);
  });

  it("works out formulas, reads the decimal comma, and leaves gaps empty", () => {
    const c = chart("column", "clustered", (c) => {
      c.data = { cells: [["", "V", "W"], ["a", "2,5", "=B2*2"], ["b", "", "=SUM(C2:C2)"], ["c", "x", "7"]], header: true, labels: true, calc: true };
    });
    const m = readModel(c);
    expect(m.series[0].values).toEqual([2.5, null, null]);
    expect(m.series[1].values).toEqual([5, 5, 7]);
    expect(readCells(c.data).text[1][2]).toBe("5");
  });

  it("drops the empty rows at the end and the series with nothing in them", () => {
    const c = chart("column", "clustered", (c) => {
      c.data = { cells: [["", "A", "", "C"], ["a", "1", "", "3"], ["b", "2", "", "4"], ["", "", "", ""]], header: true, labels: true, calc: true };
    });
    const m = readModel(c);
    expect(m.categories).toEqual(["a", "b"]);
    expect(m.series.map((s) => s.name)).toEqual(["A", "C"]);
  });

  it("uses the name given to a series over the one of the table", () => {
    const c = chart("column", "clustered", (c) => {
      c.series = [{ name: "Garçons" }];
    });
    expect(readModel(c).series[0].name).toBe("Garçons");
  });

  it("takes the x values of a scatter from the first column when they are all numbers", () => {
    expect(readModel(defaultChart("scatter")).xs).toEqual([1, 2, 3, 4, 5, 6]);
    expect(readModel(defaultChart("column")).xs).toBeNull();
  });
});

describe("the classes of a histogram", () => {
  it("come from one column of raw values", () => {
    const c = defaultChart("histogram", "raw");
    const t = rawBins(c, readModel(c));
    expect(t.total).toBe(30);
    expect(t.bins.reduce((s, b) => s + b.count, 0)).toBe(30);
    expect(classLabels(t, c)[0]).toMatch(/^\[\d+;\d+\[$/);
  });

  it("come from a table of classes, with the area kept when they are not all as wide", () => {
    const c = defaultChart("histogram", "classes");
    const t = classTable(c, readModel(c));
    expect(t.bins.map((b) => [b.lo, b.hi, b.count])).toEqual([[0, 4, 2], [4, 8, 5], [8, 12, 11], [12, 16, 9], [16, 20, 3]]);
    expect(t.unequal).toBe(false);
    expect(t.total).toBe(30);
    c.data.cells = [["a", "b", "n"], ["0", "5", "10"], ["5", "15", "20"], ["bad", "1", "1"], ["20", "10", "3"]];
    const u = classBins(c);
    expect(u.bins).toHaveLength(2); // (a row that is not numbers, or whose end is before its start, is left out)
    expect(u.unequal).toBe(true);
  });
});

describe("boxes and waterfalls", () => {
  it("has a box for every series with data, not the hidden ones", () => {
    const c = defaultChart("box");
    expect(boxSeries(c, readModel(c)).map((b) => b.name)).toEqual(["Classe A", "Classe B", "Classe C"]);
    c.series = [{}, { hidden: true }];
    expect(boxSeries(c, readModel(c)).map((b) => b.name)).toEqual(["Classe A", "Classe C"]);
    expect(boxSeries(c, readModel(c))[0].stats.median).toBe(12.5);
  });

  it("adds the steps up, and the totals show the running total", () => {
    const c = defaultChart("waterfall");
    const steps = waterfallSteps(c, readModel(c));
    expect(steps.map((s) => [s.label, s.total, s.from, s.to])).toEqual([["Départ", true, 0, 100], ["Ventes", false, 100, 160], ["Achats", false, 160, 115], ["Frais", false, 115, 95], ["Total", true, 0, 95]]);
  });
});

describe("the kinds", () => {
  it("has the twelve families of the dialog, and a sample table for every variant", () => {
    expect(FAMILIES.map((f) => f.id)).toEqual(["column", "line", "pie", "bar", "area", "scatter", "radar", "histogram", "box", "waterfall", "funnel", "combo"]);
    for (const f of FAMILIES)
      for (const v of f.variants) {
        const d = sampleData(f.id, v.id, "fr");
        const model = readModel(defaultChart(f.id, v.id));
        expect(d.cells.length, `${f.id}/${v.id}`).toBeGreaterThan(2);
        expect(model.empty, `${f.id}/${v.id}`).toBe(false);
      }
  });

  it("sets what a variant means: stacked bars overlap, a pie varies its colors, a histogram has no gap", () => {
    expect(defaultChart("column", "stacked").overlap).toBe(100);
    expect(defaultChart("column", "clustered").overlap).toBe(0);
    expect(defaultChart("pie").varyColors).toBe(true);
    expect(defaultChart("histogram").gap).toBe(0);
    expect(defaultChart("waterfall").waterfall.totals).toEqual([0, 4]);
  });

  it("changes kind and keeps the table and the look", () => {
    const c = chart("column", "clustered", (c) => {
      c.title.text = "Mes notes";
      c.palette = "gray";
    });
    const pie = changeKind(c, "pie", "pie");
    expect(pie.family).toBe("pie");
    expect(pie.title.text).toBe("Mes notes");
    expect(pie.palette).toBe("gray");
    expect(pie.data).toBe(c.data);
    expect(pie.varyColors).toBe(true);
    expect(changeKind(pie, "column", "stacked").overlap).toBe(100);
    expect(changeKind(pie, "column", "clustered").varyColors).toBe(false);
  });

  it("opens a chart saved with fewer settings, and a damaged one", () => {
    const c = normalizeChart({ family: "line", variant: "markers", data: { cells: [["", "A"], ["x", "1"]] }, title: { text: "T" } });
    expect(c.family).toBe("line");
    expect(c.title).toMatchObject({ text: "T", show: true, size: 16 });
    expect(c.axes.y.show).toBe(true);
    expect(c.labels.show).toBe(false);
    const bad = normalizeChart({ family: "nonsense", data: { cells: [] } });
    expect(bad.family).toBe("column");
    expect(bad.data.cells.length).toBeGreaterThan(1);
    expect(normalizeChart(null).family).toBe("column");
  });
});

describe("the scale of an axis", () => {
  it("is chosen from the data and starts at zero for columns", () => {
    const s = niceScale({ lo: 1.8, hi: 5, includeZero: true }, { min: null, max: null, unit: null, minorUnit: null, log: false });
    expect(s.min).toBe(0);
    expect(s.max).toBe(5);
    expect(s.ticks).toEqual([0, 1, 2, 3, 4, 5]);
    expect(s.minor.length).toBeGreaterThan(0);
  });

  it("is the one the teacher fixes", () => {
    const s = niceScale({ lo: 0, hi: 10 }, { min: 2, max: 8, unit: 2, minorUnit: 1, log: false });
    expect([s.min, s.max, s.unit]).toEqual([2, 8, 2]);
    expect(s.ticks).toEqual([2, 4, 6, 8]);
    expect(s.minor).toEqual([3, 5, 7]);
  });

  it("copes with one value, with decimals, and with a unit so small that it would be thousands of lines", () => {
    expect(niceScale({ lo: 5, hi: 5 }, { min: null, max: null, unit: null, minorUnit: null, log: false }).max).toBeGreaterThan(5);
    const d = niceScale({ lo: 0, hi: 0.9 }, { min: null, max: null, unit: null, minorUnit: null, log: false });
    expect(d.ticks[1]).toBe(0.2);
    expect(niceScale({ lo: 0, hi: 1e6 }, { min: null, max: null, unit: 1, minorUnit: null, log: false }).ticks.length).toBeLessThanOrEqual(121);
  });

  it("goes by decades on a logarithmic scale", () => {
    const s = niceScale({ lo: 3, hi: 4500 }, { min: null, max: null, unit: null, minorUnit: null, log: true });
    expect([s.min, s.max]).toEqual([1, 10000]);
    expect(s.ticks).toEqual([1, 10, 100, 1000, 10000]);
    expect(s.minor.slice(0, 3)).toEqual([2, 3, 4]);
    expect(fraction(s, 100)).toBeCloseTo(0.5);
  });

  it("puts a value between 0 and 1 where it falls", () => {
    const s = niceScale({ lo: 0, hi: 10 }, { min: 0, max: 10, unit: null, minorUnit: null, log: false });
    expect(fraction(s, 2.5)).toBe(0.25);
    expect(fraction(s, 12)).toBeCloseTo(1.2);
  });

  it("writes the numbers with the decimals the unit needs", () => {
    expect(autoDecimals(20)).toBe(0);
    expect(autoDecimals(0.5)).toBe(1);
    expect(autoDecimals(0.25)).toBe(2);
    expect(axisText(1.5, {}, 0.5, ",")).toBe("1,5");
    expect(axisText(-2, {}, 1, ",")).toBe("−2");
    expect(axisText(0.25, { percent: true }, 0.05, ",")).toBe("25 %");
    expect(axisText(1500, { thousands: true, suffix: " €" }, 500, ",")).toBe("1 500 €");
    expect(valueText(2.123456789, {}, ",")).toBe("2,123457");
    expect(valueText(2.5, { decimals: 2 }, ".")).toBe("2.50");
  });
});

describe("the colors", () => {
  it("has a color for every series, and lighter or darker ones after the palette runs out", () => {
    expect(paletteColor("colorful", 0)).toBe("#156082");
    expect(paletteColor("colorful", 8)).not.toBe(paletteColor("colorful", 0));
    expect(paletteColor("gray", 1)).toBe("#595959");
  });

  it("mixes with white and black, and finds the ink that reads", () => {
    expect(shade("#000000", 0.5)).toBe("#808080");
    expect(shade("#ffffff", -0.5)).toBe("#808080");
    expect(shade("red", 0.5)).toBe("red");
    expect(readableOn("#ffffff")).toBe("#111827");
    expect(readableOn("#156082")).toBe("#ffffff");
  });
});
