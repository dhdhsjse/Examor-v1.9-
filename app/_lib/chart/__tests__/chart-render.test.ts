import { describe, expect, it } from "vitest";
import { FAMILIES, defaultChart } from "../catalog";
import { renderChartSvg } from "../render";
import type { ChartConfig } from "../types";

const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;
const svgOf = (c: ChartConfig, o?: Parameters<typeof renderChartSvg>[1]) => renderChartSvg(c, o).svg;
const chart = (family: ChartConfig["family"], variant?: string, mutate: (c: ChartConfig) => void = () => {}) => {
  const c = defaultChart(family, variant);
  mutate(c);
  return c;
};

describe("every kind of chart", () => {
  for (const f of FAMILIES)
    for (const v of f.variants)
      it(`${f.id}/${v.id} draws a picture of its size, with no broken number`, () => {
        const c = defaultChart(f.id, v.id);
        const { svg, width, height } = renderChartSvg(c);
        expect(width).toBe(c.width);
        expect(height).toBe(c.height);
        expect(svg.startsWith("<svg ")).toBe(true);
        expect(svg.endsWith("</svg>")).toBe(true);
        expect(svg).toContain(`width="${c.width}"`);
        expect(svg).not.toMatch(/NaN|undefined|Infinity/);
        expect(svg).toContain("Titre du graphique");
        // every thumbnail of the gallery draws too, with no text
        const mini = renderChartSvg({ ...c, width: 80, height: 60 }, { mini: true }).svg;
        expect(mini).not.toMatch(/NaN|undefined|Infinity/);
        expect(mini).not.toContain("<text");
      });
});

describe("the shapes", () => {
  it("a clustered column chart has a bar for every value, in the colors of the series", () => {
    const svg = svgOf(chart("column"));
    expect(count(svg, /<rect [^>]*data-series=/g)).toBe(12);
    expect(svg).toContain('fill="#156082"');
    expect(svg).toContain('fill="#e97132"');
    expect(svg).toContain("Catégorie 1");
    expect(svg).toContain("Série 3");
  });

  it("stacked bars are as tall as the sum, and 100 % stacked ones fill the axis", () => {
    const stacked = svgOf(chart("column", "stacked"));
    expect(stacked).toContain(">15<"); // the axis goes up to 15 (4.5 + 2.8 + 5 = 12.3)
    const full = svgOf(chart("column", "stacked100"));
    expect(full).toContain("100 %");
    expect(full).toContain("0 %");
  });

  it("a pie has a slice for every category, a doughnut a ring", () => {
    expect(count(svgOf(chart("pie")), /<path [^>]*data-series=/g)).toBe(4);
    const ring = svgOf(chart("pie", "doughnut"));
    expect(count(ring, /<path [^>]*data-series=/g)).toBe(4);
  });

  it("a line chart has a line for every series and markers when asked", () => {
    const plain = svgOf(chart("line", "line"));
    expect(count(plain, /<path [^>]*data-series=/g)).toBe(3);
    expect(plain).not.toContain("<circle");
    expect(svgOf(chart("line", "markers"))).toContain("<circle");
  });

  it("a histogram has a bar for every class, a box chart a box for every series", () => {
    expect(count(svgOf(chart("histogram", "classes")), /<rect [^>]*data-series=/g)).toBe(5);
    expect(count(svgOf(chart("box")), /<rect [^>]*data-series=/g)).toBe(3);
    expect(count(svgOf(chart("waterfall")), /<rect [^>]*data-series=/g)).toBe(5);
    expect(count(svgOf(chart("funnel")), /<rect [^>]*data-series=/g)).toBe(4);
  });

  it("a combination draws columns and a line, and a second axis when asked", () => {
    const combo = svgOf(chart("combo", "columnLine"));
    expect(count(combo, /<rect [^>]*data-series=/g)).toBe(8);
    expect(count(combo, /<path [^>]*data-series=/g)).toBe(1);
    const second = svgOf(chart("combo", "columnLineSecondary", (c) => (c.axes.y2.title = "Autre")));
    expect(second).toContain('data-part="axis-y2"');
    expect(second).toContain("Autre");
  });
});

describe("what is around the plot", () => {
  it("writes the title, or not", () => {
    expect(svgOf(chart("column", "clustered", (c) => (c.title.text = "Mes <notes> & co")))).toContain("Mes &lt;notes&gt; &amp; co");
    expect(svgOf(chart("column", "clustered", (c) => (c.title.show = false)))).not.toContain("Titre du graphique");
  });

  it("puts the legend where it is asked, or leaves it out", () => {
    const bottom = svgOf(chart("column"));
    const right = svgOf(chart("column", "clustered", (c) => (c.legend.position = "right")));
    const none = svgOf(chart("column", "clustered", (c) => (c.legend.show = false)));
    expect(bottom).toContain("Série 1");
    expect(right).toContain("Série 1");
    expect(none).not.toContain("Série 1");
    // (the legend at the bottom is under the plot: its text is lower than the one at the right)
    const y = (svg: string) => Number(/<text x="[\d.]+" y="([\d.]+)"[^>]*>Série 1</.exec(svg)?.[1]);
    expect(y(bottom)).toBeGreaterThan(y(right));
  });

  it("writes the titles of the axes, the numbers with the decimal mark, and the data table", () => {
    const svg = svgOf(
      chart("column", "clustered", (c) => {
        c.axes.x.title = "Matières";
        c.axes.y.title = "Notes";
        c.axes.y.unit = 0.5;
        c.dataTable = true;
      }),
    );
    expect(svg).toContain("Matières");
    expect(svg).toContain("Notes");
    expect(svg).toContain(">0,5<");
    expect(svg).toContain(">4,3<"); // (the table of the numbers: 4,3 for the first bar)
    const dot = svgOf(chart("column", "clustered", (c) => ((c.axes.y.unit = 0.5), (c.decimalMark = "."))));
    expect(dot).toContain(">0.5<");
  });

  it("uses the colors of the palette, and hatchings for black and white", () => {
    expect(svgOf(chart("column", "clustered", (c) => (c.palette = "gray")))).toContain('fill="#262626"');
    const hatched = svgOf(chart("column", "clustered", (c) => (c.patterns = true)));
    expect(hatched).toContain("<pattern");
    expect(hatched).toContain('fill="url(#p0-');
    expect(count(hatched, /<pattern /g)).toBe(3);
  });

  it("writes in the font of the chart", () => {
    expect(svgOf(chart("column", "clustered", (c) => (c.fontFamily = "Georgia")))).toContain("Georgia");
  });
});

describe("what a series can have", () => {
  it("shows the value labels, with the number format", () => {
    const labels = svgOf(chart("column", "clustered", (c) => ((c.labels.show = true), (c.labels.format = { decimals: 2 }))));
    expect(labels).toContain(">4,30<");
    expect(count(labels, /<text [^>]*>\d,\d\d</g)).toBeGreaterThanOrEqual(12);
    const pie = svgOf(chart("pie", "pie", (c) => ((c.labels.show = true), (c.labels.value = false), (c.labels.percent = true))));
    expect(pie).toContain("59 %"); // 8,2 / 14
  });

  it("draws the trendline of a scatter with its equation and R²", () => {
    const svg = svgOf(
      chart("scatter", "markers", (c) => {
        c.series = [{ trendline: { kind: "linear", order: 2, period: 2, forward: 0, backward: 0, equation: true, r2: true, color: null, dash: "dashed" } }];
      }),
    );
    expect(svg).toContain("R² = 0,");
    expect(svg).toMatch(/y = 0,\d+x \+ 0,\d+/);
    expect(svg).toContain("Linéaire");
  });

  it("draws error bars, a second color for a point, and a hidden series not at all", () => {
    const bars = svgOf(chart("column", "clustered", (c) => (c.series = [{ error: { kind: "fixed", value: 0.5, direction: "both", cap: true } }])));
    expect(count(bars, /<line /g)).toBeGreaterThan(count(svgOf(chart("column")), /<line /g) + 8);
    const point = svgOf(chart("column", "clustered", (c) => (c.series = [{ points: { 1: { color: "#ff00aa" } } }])));
    expect(count(point, /fill="#ff00aa"/g)).toBe(1);
    const hidden = svgOf(chart("column", "clustered", (c) => (c.series = [{ hidden: true }])));
    expect(count(hidden, /<rect [^>]*data-series=/g)).toBe(8);
    expect(hidden).not.toContain("Série 1");
  });

  it("uses the name given to a series, and the style of a line", () => {
    const svg = svgOf(chart("line", "line", (c) => (c.series = [{ name: "Garçons", dash: "dashed", width: 4, smooth: true }])));
    expect(svg).toContain("Garçons");
    expect(svg).toContain("stroke-dasharray");
    expect(svg).toContain('stroke-width="4"');
    expect(svg).toContain("C"); // (a smooth line is made of curves)
  });
});

describe("the picture for the students", () => {
  it("keeps the frame, the scale and the names, and has none of the data", () => {
    const full = svgOf(chart("column"));
    const blank = svgOf(chart("column"), { blank: true });
    expect(blank).toContain("Catégorie 1");
    expect(blank).toContain("Titre du graphique");
    expect(blank).not.toContain("data-series");
    expect(blank).not.toContain("Série 1"); // (no legend: nothing to explain)
    expect(count(full, /data-series/g)).toBeGreaterThan(0);
    expect(svgOf(chart("column", "clustered", (c) => (c.blank = true)))).not.toContain("data-series");
    expect(svgOf(chart("pie"), { blank: true })).not.toContain("data-series");
    expect(svgOf(chart("scatter"), { blank: true })).not.toContain("data-series");
  });
});

describe("a chart with nothing to draw, or with odd data", () => {
  it("draws the frame and does not break", () => {
    const empty = chart("column", "clustered", (c) => (c.data = { cells: [[""]], header: true, labels: true, calc: true }));
    for (const f of FAMILIES) {
      const c = { ...empty, family: f.id, variant: f.variants[0].id };
      const svg = svgOf(c);
      expect(svg, f.id).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it("copes with one category, negative numbers, a log scale, gaps and huge numbers", () => {
    const odd = (cells: string[][], mutate: (c: ChartConfig) => void = () => {}) =>
      chart("column", "clustered", (c) => {
        c.data = { cells, header: true, labels: true, calc: true };
        mutate(c);
      });
    for (const family of ["column", "bar", "line", "area", "scatter", "radar", "waterfall", "funnel", "pie"] as const) {
      for (const cells of [
        [["", "A"], ["x", "3"]],
        [["", "A", "B"], ["x", "-3", "2"], ["y", "4", "-1"], ["z", "", "5"]],
        [["", "A"], ["x", "1e9"], ["y", "2e9"], ["z", "3.5e9"]],
        [["", "A"], ["x", "0"], ["y", "0"], ["z", "0"]],
      ]) {
        const svg = svgOf({ ...odd(cells), family, variant: family === "pie" || family === "waterfall" || family === "funnel" || family === "radar" ? defaultChart(family).variant : defaultChart(family).variant });
        expect(svg, `${family} ${JSON.stringify(cells)}`).not.toMatch(/NaN|undefined|Infinity/);
      }
    }
    const log = svgOf(odd([["", "A"], ["x", "1"], ["y", "100"], ["z", "10000"]], (c) => (c.axes.y.log = true)));
    expect(log).toContain(">10000<");
    expect(log).not.toMatch(/NaN|Infinity/);
  });
});

describe("telling the parts of a pie apart without colors", () => {
  const pie = () => defaultChart("pie", "pie", "fr");
  const svgOf = (identify?: "color" | "number" | "name") => renderChartSvg({ ...pie(), legend: { ...pie().legend, identify } }, { lang: "fr" }).svg;

  it("writes a number in each slice and lists them in the legend", () => {
    const svg = svgOf("number");
    expect(svg).toContain(">1<");
    expect(svg).toContain(">3<");
    expect(svg).toContain("1. Catégorie 1");
    expect(svg).not.toMatch(/<rect [^>]*width="12" height="10"/);
  });

  it("writes the name in each slice and draws no legend", () => {
    const svg = svgOf("name");
    expect((svg.match(/>Catégorie \d</g) ?? []).length).toBe(4);
  });

  it("keeps the colors and their legend by default", () => {
    expect(svgOf()).toMatch(/<rect [^>]*width="12" height="10"/);
  });
});

describe("a text of your own in each slice", () => {
  it("writes it in the slice, with no legend, on plain slices when asked", () => {
    const c = defaultChart("pie", "pie", "fr");
    c.legend = { ...c.legend, identify: "text" };
    c.series = [{ points: { 0: { text: "Agriculture" }, 1: { text: "Industrie" } } }];
    c.pie = { ...c.pie, plain: true };
    const svg = renderChartSvg(c, { lang: "fr" }).svg;
    expect(svg).toContain(">Agriculture<");
    expect(svg).toContain(">Industrie<");
    expect(svg).not.toContain("Catégorie 1");
    expect(svg).not.toMatch(/<rect [^>]*width="12" height="10"/);
    expect((svg.match(/fill="#ffffff"/g) ?? []).length).toBeGreaterThan(4);
  });
});
