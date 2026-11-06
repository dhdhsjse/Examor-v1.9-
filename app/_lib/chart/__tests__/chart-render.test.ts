import { describe, expect, it } from "vitest";
import { chartNumber, renderChartSvg, valueScale } from "../render";
import { CHART_KINDS, newChart, readChart, type ChartConfig } from "../types";

const chart = (patch: Partial<ChartConfig> = {}): ChartConfig => ({ ...newChart(), ...patch });
const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;

describe("the picture of a chart", () => {
  it("is an SVG of the chart's own size", () => {
    const svg = renderChartSvg(chart({ width: 500, height: 300 }));
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('width="500" height="300"');
  });

  it("draws a bar per value (an empty value has no bar) and a name under each", () => {
    const svg = renderChartSvg(chart({ rows: [{ label: "Lundi", value: 3 }, { label: "Mardi", value: null }, { label: "Mercredi", value: 5 }] }));
    // (the white background is a rect too)
    expect(count(svg, /<rect /g)).toBe(1 + 2);
    expect(svg).toContain(">Lundi<");
    expect(svg).toContain(">Mardi<");
  });

  it("draws a line through the values and a dot at each, cut where one is missing", () => {
    const svg = renderChartSvg(chart({ kind: "line", rows: [{ label: "a", value: 1 }, { label: "b", value: 2 }, { label: "c", value: null }, { label: "d", value: 4 }, { label: "e", value: 3 }] }));
    expect(count(svg, /<polyline /g)).toBe(2);
    expect(count(svg, /<circle /g)).toBe(4);
  });

  it("draws a slice per positive value of a pie, with its legend", () => {
    const svg = renderChartSvg(chart({ kind: "pie", rows: [{ label: "Rouge", value: 1 }, { label: "Vert", value: 3 }, { label: "Rien", value: 0 }] }));
    expect(count(svg, /<path /g)).toBe(2);
    expect(svg).toContain(">Rouge<");
    expect(svg).not.toContain(">Rien<");
  });

  it("writes the percentages of the slices when asked", () => {
    const svg = renderChartSvg(chart({ kind: "pie", showValues: true, rows: [{ label: "a", value: 1 }, { label: "b", value: 3 }] }));
    expect(svg).toContain(">25 %<");
    expect(svg).toContain(">75 %<");
  });

  it("writes the values on the bars when asked, with the decimal mark of the exam", () => {
    const rows = [{ label: "a", value: 2.75 }];
    expect(renderChartSvg(chart({ showValues: true, rows }))).toContain(">2,75<");
    expect(renderChartSvg(chart({ showValues: true, rows }), { decimal: "." })).toContain(">2.75<");
    expect(renderChartSvg(chart({ showValues: false, rows }))).not.toContain(">2,75<");
  });

  it("writes the title and the names of the axes", () => {
    const svg = renderChartSvg(chart({ title: "Notes du groupe", xTitle: "Élèves", yTitle: "Note" }));
    expect(svg).toContain(">Notes du groupe<");
    expect(svg).toContain(">Élèves<");
    expect(svg).toContain(">Note<");
  });

  it("escapes what the teacher types", () => {
    const svg = renderChartSvg(chart({ title: 'a < b & "c"', rows: [{ label: "<x>", value: 1 }] }));
    expect(svg).toContain("a &lt; b &amp; &quot;c&quot;");
    expect(svg).toContain("&lt;x&gt;");
    expect(svg).not.toContain("<x>");
  });

  it("still draws something with no value at all", () => {
    for (const kind of CHART_KINDS) expect(renderChartSvg(chart({ kind, rows: [{ label: "a", value: null }] }))).toContain("</svg>");
  });

  it("draws horizontal bars with the names on their left", () => {
    const svg = renderChartSvg(chart({ kind: "hbar", rows: [{ label: "Lundi", value: 3 }, { label: "Mardi", value: null }, { label: "Mercredi", value: 5 }] }));
    expect(count(svg, /<rect /g)).toBe(1 + 2);
    expect(svg).toContain('text-anchor="end">Lundi<');
  });

  it("draws a stick per value, and the bars of a histogram side by side", () => {
    const rows = [{ label: "1", value: 2 }, { label: "2", value: null }, { label: "3", value: 4 }];
    expect(count(renderChartSvg(chart({ kind: "stick", grid: false, rows })), /stroke-width="3"/g)).toBe(2);
    const hist = renderChartSvg(chart({ kind: "histogram", rows: [{ label: "[0;10[", value: 2 }, { label: "[10;20[", value: 4 }] }));
    const [a, b] = [...hist.matchAll(/<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"[^>]*stroke=/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(a[0] + a[1]).toBeCloseTo(b[0], 0); // (the second starts where the first ends)
  });

  it("fills the room under the line of an area chart", () => {
    const svg = renderChartSvg(chart({ kind: "area", rows: [{ label: "a", value: 1 }, { label: "b", value: 3 }, { label: "c", value: 2 }] }));
    expect(count(svg, /<polygon /g)).toBe(1);
    expect(count(svg, /<polyline /g)).toBe(1);
  });

  it("draws a half pie: its slices share half a turn", () => {
    const svg = renderChartSvg(chart({ kind: "halfpie", showValues: true, rows: [{ label: "a", value: 1 }, { label: "b", value: 1 }] }));
    expect(count(svg, /<path /g)).toBe(2);
    expect(svg).toContain(">50 %<");
  });

  it("puts what was drawn over the chart in its picture", () => {
    const shapes = [{ id: "s1", shape: "rect", x: 10, y: 10, w: 40, h: 20, fill: "#ff0000", stroke: null, strokeWidth: 1, rotation: 0 }];
    const svg = renderChartSvg(chart({ shapes: shapes as unknown as ChartConfig["shapes"] }));
    expect(svg.length).toBeGreaterThan(renderChartSvg(chart()).length);
    expect(svg).toContain("#ff0000");
  });

  it("goes below 0 for negative values", () => {
    const s = valueScale([-3, 7]);
    expect(s.min).toBeLessThanOrEqual(-3);
    expect(s.max).toBeGreaterThanOrEqual(7);
    expect(valueScale([4, 9]).min).toBe(0);
  });
});

describe("numbers and saved charts", () => {
  it("writes at most two decimals", () => {
    expect(chartNumber(1 / 3)).toBe("0,33");
    expect(chartNumber(2, ".")).toBe("2");
  });

  it("reads a chart saved on a block, and nothing from what is not one", () => {
    const saved = JSON.parse(JSON.stringify(chart({ title: "x" })));
    expect(readChart(saved)?.title).toBe("x");
    expect(readChart({ family: "column", data: {} })).toBeNull(); // (a chart of the older Chart Studio)
    expect(readChart(undefined)).toBeNull();
    expect(readChart({ kind: "bar", rows: [{ label: 1, value: "x" }] })?.rows[0]).toEqual({ label: "1", value: null });
  });
});
