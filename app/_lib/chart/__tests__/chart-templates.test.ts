import { describe, expect, it } from "vitest";
import { FAMILIES, defaultChart } from "../catalog";
import { renderChartSvg } from "../render";
import { dress, lookOf, pushRecentKind, pushTemplate, readRecentKinds, readTemplates, type ChartTemplate } from "../templates";

const styled = () => {
  const c = defaultChart("column", "clustered", "fr");
  c.palette = "blue";
  c.fontSize = 14;
  c.grid = { ...c.grid, yMinor: true };
  c.title = { ...c.title, text: "Mes notes", color: "#aa0000" };
  c.axes.y = { ...c.axes.y, title: "Note", min: 2, max: 18, unit: 4 };
  c.series = [{ name: "Garçons", color: "#112233", points: { 1: { color: "#ff0000" } } }, { hidden: true, dash: "dashed" }];
  c.width = 640;
  c.blank = true;
  return c;
};

describe("the kinds used lately", () => {
  it("puts the newest first, each kind once, and keeps a few", () => {
    let list = pushRecentKind([], { family: "pie", variant: "pie" });
    list = pushRecentKind(list, { family: "column", variant: "stacked" });
    list = pushRecentKind(list, { family: "pie", variant: "pie" });
    expect(list).toEqual([{ family: "pie", variant: "pie" }, { family: "column", variant: "stacked" }]);
    const many = Array.from({ length: 12 }, (_, i) => ({ family: "line" as const, variant: `v${i}` })).reduce((acc, k) => pushRecentKind(acc, k), [] as ReturnType<typeof pushRecentKind>);
    expect(many).toHaveLength(8);
    expect(many[0].variant).toBe("v11");
  });

  it("is read back without what no longer exists", () => {
    const exists = (k: { family: string; variant: string }) => k.family === "pie";
    expect(readRecentKinds([{ family: "pie", variant: "pie" }, { family: "ghost", variant: "x" }, 4, null, { family: "pie", variant: "pie" }], exists)).toEqual([{ family: "pie", variant: "pie" }]);
    expect(readRecentKinds("nonsense", exists)).toEqual([]);
  });
});

describe("the look of a chart", () => {
  it("keeps the colors, fonts, grid and size, and nothing of what the chart says", () => {
    const look = lookOf(styled());
    expect("data" in look).toBe(false);
    expect(look.palette).toBe("blue");
    expect(look.fontSize).toBe(14);
    expect(look.grid.yMinor).toBe(true);
    expect(look.width).toBe(640);
    expect(look.title.text).toBe("");
    expect(look.title.color).toBe("#aa0000");
    expect(look.axes.y).toMatchObject({ title: "", min: null, max: null, unit: null });
    expect(look.series[0]).toEqual({ color: "#112233" });
    expect(look.series[1]).toEqual({ dash: "dashed" });
    expect(look.blank).toBe(false);
  });

  it("starts a new chart from the sample of its kind, dressed in the look", () => {
    const look = lookOf(styled());
    const sample = defaultChart("column", "clustered", "fr");
    const made = dress(sample, look);
    expect(made.palette).toBe("blue");
    expect(made.width).toBe(640);
    expect(made.series[0]).toEqual({ color: "#112233" });
    expect(made.data).toEqual(sample.data);
    expect(made.title.text).toBe(sample.title.text);
    expect(made.axes.y.min).toBeNull();
    expect(made.blank).toBe(false);
  });

  it("dresses a chart that exists without touching its table, its words, its scales or its names", () => {
    const mine = styled();
    mine.data = { ...mine.data, cells: [["", "A"], ["x", "1"], ["y", "2"]] };
    mine.palette = "red";
    mine.width = 300;
    const look = lookOf(defaultChart("column", "clustered", "fr"));
    look.palette = "green";
    look.width = 480;
    const made = dress(mine, look);
    expect(made.palette).toBe("green");
    expect(made.width).toBe(480);
    expect(made.data.cells).toEqual([["", "A"], ["x", "1"], ["y", "2"]]);
    expect(made.title.text).toBe("Mes notes");
    expect(made.axes.y).toMatchObject({ title: "Note", min: 2, max: 18, unit: 4 });
    expect(made.series[0].name).toBe("Garçons");
    expect(made.series[0].points).toEqual({ 1: { color: "#ff0000" } });
    expect(made.series[1].hidden).toBe(true);
    expect(made.blank).toBe(true);
  });

  it("changes the kind of a chart to the one of the template, as Change Chart Type does", () => {
    const line = lookOf(defaultChart("line", "markers", "fr"));
    const made = dress(styled(), line);
    expect(made.family).toBe("line");
    expect(made.variant).toBe("markers");
    expect(made.data).toEqual(styled().data);
    expect(made.title.text).toBe("Mes notes");
    const waterfall = dress(styled(), lookOf(defaultChart("waterfall", "waterfall", "fr")));
    expect(waterfall.family).toBe("waterfall");
    expect(waterfall.waterfall.totals.length).toBeGreaterThan(0);
  });

  it("gives back the same chart when a chart is dressed in its own look (every kind)", () => {
    for (const f of FAMILIES) {
      for (const v of f.variants) {
        const c = defaultChart(f.id, v.id, "fr");
        expect(dress(c, lookOf(c)), `${f.id}/${v.id}`).toEqual(c);
      }
    }
  });

  it("draws a sound picture for the template of every kind", () => {
    for (const f of FAMILIES) {
      const c = dress(defaultChart(f.id, f.variants[0].id, "fr"), lookOf(styled()));
      const svg = renderChartSvg({ ...c, blank: false }, { lang: "fr" }).svg;
      expect(svg, f.id).not.toMatch(/NaN|undefined/);
    }
  });
});

describe("the templates saved", () => {
  const make = (id: string, name: string): ChartTemplate => ({ id, name, look: lookOf(styled()) });

  it("replaces a template of the same name, whatever its case, and keeps the newest first", () => {
    let list = pushTemplate([], make("1", "Examen"));
    list = pushTemplate(list, make("2", "TP"));
    list = pushTemplate(list, make("3", "  examen "));
    expect(list.map((x) => x.id)).toEqual(["3", "2"]);
    const many = Array.from({ length: 30 }, (_, i) => make(String(i), `T${i}`)).reduce((acc, x) => pushTemplate(acc, x), [] as ChartTemplate[]);
    expect(many).toHaveLength(24);
    expect(many[0].id).toBe("29");
  });

  it("comes back from the browser as it went", () => {
    const list = [make("1", "Examen"), make("2", "TP")];
    const back = readTemplates(JSON.parse(JSON.stringify(list)));
    expect(back.map((x) => [x.id, x.name])).toEqual([["1", "Examen"], ["2", "TP"]]);
    expect(back[0].look.palette).toBe("blue");
    expect(back[0].look.series[0]).toEqual({ color: "#112233" });
  });

  it("leaves out what is not a template and fills in what an older look lacks", () => {
    const old = { id: "x", name: "Ancien", look: { family: "pie", variant: "doughnut", palette: "green" } };
    const back = readTemplates([old, { id: "y", name: "", look: old.look }, { id: "z", name: "Z", look: { family: "ghost" } }, "text", null, { name: "no id", look: old.look }]);
    expect(back).toHaveLength(1);
    expect(back[0].look.palette).toBe("green");
    expect(back[0].look.variant).toBe("doughnut");
    expect(back[0].look.legend.position).toBe("right");
    expect(back[0].look.axes.y.show).toBe(true);
    expect("data" in back[0].look).toBe(false);
    expect(readTemplates("nonsense")).toEqual([]);
  });
});
