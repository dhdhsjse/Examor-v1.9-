import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STUDIO_AR, STUDIO_FR } from "../../chemistry/strings";
import { MOLECULE_AR, MOLECULE_FR } from "../../../_molecule/strings";
import { SHAPES_AR, SHAPES_FR } from "../../shapes/strings";
import { GRAPH_AR, GRAPH_FR } from "../strings";
import { PAPER_MARGIN, buildScene, configIssues, fatalIssue, formatNumber, graphToPxX, graphToPxY, lineCount, multiples, pxToGraphX, pxToGraphY } from "../grid";
import { COALESCE_MS, canRedo, canUndo, edit, isDirty, redo, startHistory, undo } from "../history";
import { GRAPH_PRESETS } from "../presets";
import { renderGraphSvg } from "../svg";
import { FUNCTION_SPECS, FUNCTION_TYPES, evaluateFunction, newFunction, sampleCurve } from "../mathUtils";
import { DEFAULT_GRAPH_CONFIG, normalizeGraphConfig, type FunctionType, type GraphConfig, type GraphFunction } from "../types";

const C = DEFAULT_GRAPH_CONFIG;
const with_ = (u: Partial<GraphConfig>): GraphConfig => ({ ...C, ...u });

describe("the coordinate system", () => {
  it("maps graph units to pixels, with y going up", () => {
    expect(graphToPxX(0, C)).toBe(0);
    expect(graphToPxX(10, C)).toBe(600);
    expect(graphToPxX(2.5, C)).toBe(150);
    expect(graphToPxY(0, C)).toBe(600); // the bottom of the paper
    expect(graphToPxY(10, C)).toBe(0);
    const c = with_({ xMin: -5, xMax: 5, yMin: -2, yMax: 6, width: 400, height: 800 });
    expect(graphToPxX(0, c)).toBe(200);
    expect(graphToPxY(0, c)).toBe(600);
  });

  it("goes back from pixels to graph units", () => {
    const c = with_({ xMin: -3, xMax: 7, yMin: 1, yMax: 4 });
    for (const x of [-3, 0, 1.25, 7]) expect(pxToGraphX(graphToPxX(x, c), c)).toBeCloseTo(x, 9);
    for (const y of [1, 2.5, 4]) expect(pxToGraphY(graphToPxY(y, c), c)).toBeCloseTo(y, 9);
  });

  it("scales when the limits change", () => {
    expect(graphToPxX(10, with_({ xMax: 20 }))).toBe(300);
  });
});

describe("the steps", () => {
  it("lists the multiples without float drift", () => {
    expect(multiples(0, 1, 0.1)).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
    expect(multiples(-1, 1, 0.5)).toEqual([-1, -0.5, 0, 0.5, 1]);
    expect(multiples(0.5, 2.5, 1)).toEqual([1, 2]);
    expect(lineCount(0, 10, 0.2)).toBe(51);
  });

  it("gives nothing for a step that is not positive or far too fine", () => {
    expect(multiples(0, 10, 0)).toEqual([]);
    expect(multiples(0, 10, -1)).toEqual([]);
    expect(multiples(0, 10, 0.001)).toEqual([]);
  });

  it("writes numbers without noise and with a real minus", () => {
    expect(formatNumber(0.1 + 0.2)).toBe("0.3");
    expect(formatNumber(-2)).toBe("−2");
    expect(formatNumber(5)).toBe("5");
  });
});

describe("what is wrong with a configuration", () => {
  it("refuses what cannot be drawn", () => {
    expect(fatalIssue(C)).toBeNull();
    expect(fatalIssue(with_({ xMax: 0 }))).toBe("x-range");
    expect(fatalIssue(with_({ yMin: 11 }))).toBe("y-range");
    expect(fatalIssue(with_({ majorGridStep: 0 }))).toBe("major-step");
    expect(fatalIssue(with_({ minorGridStep: -1 }))).toBe("minor-step");
    expect(fatalIssue(with_({ width: 50 }))).toBe("size");
    expect(fatalIssue(with_({ xMin: Number.NaN }))).toBe("x-range");
  });

  it("only reports a grid that is too fine, or a fine step above the main one", () => {
    expect(configIssues(with_({ minorGridStep: 0.001 }))).toEqual(["dense-minor"]);
    expect(configIssues(with_({ minorGridStep: 2 }))).toEqual(["minor-larger"]);
    expect(buildScene(with_({ minorGridStep: 0.001 })).minor).toEqual([]); // (left out, the rest is drawn)
    expect(buildScene(with_({ minorGridStep: 0.001 })).major.length).toBeGreaterThan(0);
  });

  it("draws nothing for a configuration that cannot be drawn", () => {
    const s = buildScene(with_({ xMax: -1 }));
    expect(s.major).toEqual([]);
    expect(renderGraphSvg(with_({ xMax: -1 }))).toBeNull();
  });
});

describe("the scene", () => {
  it("draws the grid: fine lines between the main ones, none on top of them", () => {
    const s = buildScene(C);
    // 0..10 by 1 = 11 main lines each way; by 0.2 = 51 fine lines each way, 11 of them on a main line
    expect(s.major).toHaveLength(22);
    expect(s.minor).toHaveLength(2 * (51 - 11));
    expect(s.major.every((m) => (m.x1 === m.x2 ? m.y1 === 0 && m.y2 === 600 : m.x1 === 0 && m.x2 === 600))).toBe(true);
  });

  it("draws no grid when it is off, but keeps the axes", () => {
    const s = buildScene(with_({ showGrid: false }));
    expect(s.major).toEqual([]);
    expect(s.minor).toEqual([]);
    expect(s.axes).toHaveLength(2);
    expect(s.arrows).toHaveLength(2);
  });

  it("puts the axes through (0, 0), with an arrow past the edge of the paper", () => {
    const c = with_({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 });
    const s = buildScene(c);
    expect(s.origin).toEqual({ x: 300, y: 300 });
    expect(s.arrows[0][0]).toBeGreaterThan(c.width); // the tip of the x axis
    expect(s.arrows[1][1]).toBeLessThan(0); // the tip of the y axis
  });

  it("keeps the axes on the nearest edge when 0 is off the paper", () => {
    const s = buildScene(with_({ xMin: 2, xMax: 8, yMin: 3, yMax: 9 }));
    expect(s.origin).toEqual({ x: 0, y: 600 });
  });

  it("writes the labels at the end of the axes and the numbers along them", () => {
    const s = buildScene(C);
    const label = (text: string) => s.texts.find((t) => t.text === text && t.kind === "label");
    expect(label("t(s)")?.align).toBe("end");
    expect(label("t(s)")!.x).toBeGreaterThan(500); // by the right end of the x axis
    expect(label("x(m)")!.y).toBeLessThan(30); // by the top of the y axis
    const ticks = s.texts.filter((t) => t.kind === "tick").map((t) => t.text);
    expect(ticks).toContain("10");
    expect(ticks.filter((t) => t === "0")).toHaveLength(1); // (the origin once, not once per axis)
    expect(buildScene(with_({ showNumbers: false })).texts.filter((t) => t.kind === "tick")).toEqual([]);
    expect(buildScene(with_({ xLabel: "", yLabel: "  " })).texts.filter((t) => t.kind === "label")).toEqual([]);
  });

  it("moves the label of the y axis to its left when there is no room on the right", () => {
    const s = buildScene(with_({ xMin: -10, xMax: 0, yLabel: "a very long label of the vertical axis" }));
    const l = s.texts.find((t) => t.kind === "label" && t.text.startsWith("a very"))!;
    expect(l.align).toBe("end");
  });
});

describe("the picture for the page", () => {
  it("is the paper with its margin, drawn from the same scene", () => {
    const r = renderGraphSvg(C)!;
    expect(r.width).toBe(600 + 2 * PAPER_MARGIN);
    expect(r.height).toBe(600 + 2 * PAPER_MARGIN);
    expect(r.svg).toContain("t(s)");
    expect(r.svg).toContain("x(m)");
    expect(r.svg.match(/<polygon/g)).toHaveLength(2); // the two arrow heads
  });

  it("uses the grid colour and leaves the grid out when it is off", () => {
    expect(renderGraphSvg(with_({ gridColor: "#ff0000" }))!.svg).toContain('stroke="#ff0000"');
    expect(renderGraphSvg(with_({ showGrid: false, gridColor: "#ff0000" }))!.svg).not.toContain("#ff0000");
  });

  it("escapes the labels", () => {
    const svg = renderGraphSvg(with_({ xLabel: "a<b & c" }))!.svg;
    expect(svg).toContain("a&lt;b &amp; c");
  });
});

describe("undo and redo", () => {
  it("steps back and forward, and a new edit drops what was undone", () => {
    let h = startHistory(C);
    h = edit(h, with_({ xMax: 20 }), "xMax", 0);
    h = edit(h, with_({ xMax: 20, yMax: 5 }), "yMax", 5000);
    expect(canUndo(h)).toBe(true);
    h = undo(h);
    expect(h.present.yMax).toBe(10);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(h.present.yMax).toBe(5);
    h = undo(undo(h));
    expect(h.present).toEqual(C);
    expect(canUndo(h)).toBe(false);
    h = edit(h, with_({ xLabel: "z" }), "xLabel", 9000);
    expect(canRedo(h)).toBe(false);
  });

  it("merges a quick series of edits of one field into one step", () => {
    let h = startHistory(C);
    h = edit(h, with_({ xLabel: "t" }), "xLabel", 0);
    h = edit(h, with_({ xLabel: "ti" }), "xLabel", 100);
    h = edit(h, with_({ xLabel: "tim" }), "xLabel", 200);
    expect(h.past).toHaveLength(1);
    h = edit(h, with_({ xLabel: "time" }), "xLabel", 200 + COALESCE_MS + 1); // (a pause: a new step)
    expect(h.past).toHaveLength(2);
    expect(undo(h).present.xLabel).toBe("tim");
  });

  it("is not a step when nothing changed, and knows when it is back where it started", () => {
    let h = startHistory(C);
    expect(edit(h, { ...C }, "x", 0)).toBe(h);
    h = edit(h, with_({ xMax: 12 }), "xMax", 0);
    expect(isDirty(h)).toBe(true);
    expect(isDirty(undo(h))).toBe(false);
  });
});

describe("the examples", () => {
  it("are all drawable on the default paper", () => {
    for (const p of GRAPH_PRESETS) expect(fatalIssue({ ...C, ...p.values }), p.id).toBeNull();
    for (const p of GRAPH_PRESETS) expect(configIssues({ ...C, ...p.values }), p.id).toEqual([]);
  });
});

describe("the interface strings", () => {
  const T_CALL = /\bt\("((?:[^"\\]|\\.)*)"/g;
  const dir = join(__dirname, "../../../_components/graph-studio");
  const sources = readdirSync(dir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => readFileSync(join(dir, f), "utf8"));
  sources.push(readFileSync(join(__dirname, "../../../_features/tools/tool-graph-studio.tsx"), "utf8"), readFileSync(join(__dirname, "../grid.ts"), "utf8"));
  const used = new Set(sources.flatMap((src) => [...src.matchAll(T_CALL)].map((m) => m[1])));
  const app = readFileSync(join(__dirname, "../../uiStrings.ts"), "utf8");
  const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  it("have a French and an Arabic text each, here or elsewhere in the app", () => {
    expect(used.size).toBeGreaterThan(15);
    expect([...used].filter((k) => !(k in GRAPH_FR) && !(k in STUDIO_FR) && !(k in MOLECULE_FR) && !(k in SHAPES_FR) && !app.includes(`"${k}":`))).toEqual([]);
    expect([...used].filter((k) => !(k in GRAPH_AR) && !(k in STUDIO_AR) && !(k in MOLECULE_AR) && !(k in SHAPES_AR) && !app.includes(`"${k}":`))).toEqual([]);
  });

  it("translate the names of the examples, and keep the {placeholders}", () => {
    for (const p of GRAPH_PRESETS) {
      expect(GRAPH_FR[p.name], p.name).toBeTruthy();
      expect(GRAPH_AR[p.name], p.name).toBeTruthy();
    }
    for (const type of FUNCTION_TYPES) {
      expect(GRAPH_FR[FUNCTION_SPECS[type].name], type).toBeTruthy();
      expect(GRAPH_AR[FUNCTION_SPECS[type].name], type).toBeTruthy();
    }
    for (const dict of [GRAPH_FR, GRAPH_AR]) for (const [key, text] of Object.entries(dict)) expect(placeholders(text), key).toEqual(placeholders(key));
  });
});

describe("the curves", () => {
  const fn = (type: FunctionType, params: Record<string, number>): GraphFunction => ({ id: "f", type, color: "#000", strokeWidth: 2, params });

  it("evaluates each function", () => {
    expect(evaluateFunction(fn("linear", { a: 2, b: 1 }), 3)).toBe(7);
    expect(evaluateFunction(fn("quadratic", { a: 1, b: -2, c: 1 }), 3)).toBe(4);
    expect(evaluateFunction(fn("exponential", { A: 10, tau: 2, y0: 1 }), 0)).toBe(11);
    expect(evaluateFunction(fn("exponential", { A: 10, tau: 2, y0: 0 }), 2)).toBeCloseTo(10 / Math.E, 9);
    expect(evaluateFunction(fn("logarithmic", { a: 2, b: 1 }), Math.E)).toBeCloseTo(3, 9);
    const s = fn("sigmoid", { ymin: 1, ymax: 13, k: 2, x0: 5 });
    expect(evaluateFunction(s, 5)).toBeCloseTo(7, 9); // the middle
    expect(evaluateFunction(s, -50)).toBeCloseTo(1, 6);
    expect(evaluateFunction(s, 60)).toBeCloseTo(13, 6);
  });

  it("is not defined where the function is not", () => {
    expect(Number.isFinite(evaluateFunction(fn("logarithmic", { a: 1, b: 0 }), 0))).toBe(false);
    expect(Number.isFinite(evaluateFunction(fn("logarithmic", { a: 1, b: 0 }), -1))).toBe(false);
    expect(Number.isFinite(evaluateFunction(fn("exponential", { A: 1, tau: 0, y0: 0 }), 1))).toBe(false);
  });

  it("samples a line as one polyline from edge to edge, in pixels of the paper", () => {
    const { segments, status } = sampleCurve(fn("linear", { a: 1, b: 0 }), C);
    expect(status).toBe("ok");
    expect(segments).toHaveLength(1);
    const seg = segments[0];
    expect(seg.slice(0, 2)).toEqual([0, 600]); // (0, 0) is the bottom left corner
    expect(seg.slice(-2)).toEqual([600, 0]); // (10, 10) the top right one
    expect(seg.length / 2).toBe(601); // one point per pixel
  });

  it("cuts a curve exactly at the edge of the paper, and never draws across it", () => {
    // a parabola whose arms leave the paper through the top and come back: x² − 8x + 12 = 0 at 2 and 6, above 10 for x > 7.5
    const c = with_({ xMin: -2, xMax: 12 });
    const { segments } = sampleCurve(fn("quadratic", { a: 1, b: -8, c: 12 }), c);
    for (const seg of segments) for (let i = 1; i < seg.length; i += 2) {
        expect(seg[i]).toBeGreaterThanOrEqual(-1e-9);
        expect(seg[i]).toBeLessThanOrEqual(600 + 1e-9);
      }
    expect(segments.length).toBe(2); // the left arm (leaves through the top at the left), the right arm (enters through the top)
    expect(segments[0][1]).toBeCloseTo(0, 6); // starts on the top edge
    expect(segments[1][segments[1].length - 1]).toBeCloseTo(0, 6); // ends on the top edge
  });

  it("breaks the curve where it is not defined (the log at x <= 0)", () => {
    const c = with_({ xMin: -2, xMax: 10, yMin: -10, yMax: 10 });
    const { segments, status } = sampleCurve(fn("logarithmic", { a: 1, b: 0 }), c);
    expect(status).toBe("ok");
    const firstX = segments[0][0];
    expect(firstX).toBeGreaterThan(graphToPxX(0, c)); // nothing left of x = 0
    expect(sampleCurve(fn("logarithmic", { a: 1, b: 0 }), with_({ xMin: -5, xMax: -1 })).status).toBe("undefined");
  });

  it("says when a curve is defined but off the paper", () => {
    expect(sampleCurve(fn("linear", { a: 0, b: 50 }), C)).toEqual({ segments: [], status: "outside" });
  });

  it("gives a flat line at the edge of the paper, not nothing", () => {
    const { segments } = sampleCurve(fn("linear", { a: 0, b: 10 }), C);
    expect(segments).toHaveLength(1);
    expect(segments[0].filter((_, i) => i % 2 === 1).every((y) => y === 0)).toBe(true);
  });

  it("starts every new curve inside the paper it is put on, whatever the axes", () => {
    const papers = [C, with_({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 }), with_({ xMin: 0, xMax: 20, yMin: 0, yMax: 14 }), with_({ xMin: 2, xMax: 8, yMin: 3, yMax: 9 }), with_({ xMin: 0, xMax: 0.5, yMin: 0, yMax: 100 })];
    for (const paper of papers) {
      for (const type of FUNCTION_TYPES) {
        const f = { ...newFunction(type, paper), id: "n" };
        expect(sampleCurve(f, paper).status, `${type} on ${paper.xMin}..${paper.xMax}`).toBe("ok");
        expect(Object.keys(f.params).sort(), type).toEqual(FUNCTION_SPECS[type].params.map((p) => p.key).sort());
      }
    }
  });

  it("gives the next colour of the palette to each new curve", () => {
    const first = newFunction("linear", C);
    const second = newFunction("linear", { ...C, functions: [first] });
    expect(first.color).toBe("#000000");
    expect(second.color).not.toBe(first.color);
  });

  it("is in the scene and the picture, under the axes", () => {
    const f = { ...newFunction("linear", C), id: "line-1", color: "#ff0000" };
    const c = { ...C, functions: [f] };
    expect(buildScene(c).curves).toHaveLength(1);
    const svg = renderGraphSvg(c)!.svg;
    expect(svg).toContain('stroke="#ff0000"');
    expect(svg.indexOf("data-curve")).toBeLessThan(svg.indexOf("<polygon")); // (before the arrow heads)
  });

  it("reads a configuration saved before the curves existed", () => {
    const { functions: _omit, ...old } = C;
    void _omit;
    expect(normalizeGraphConfig(old).functions).toEqual([]);
  });

  it("does not make a step of an edit that changes nothing in the curves", () => {
    const f = newFunction("linear", C);
    const h = startHistory({ ...C, functions: [f] });
    expect(edit(h, { ...C, functions: [{ ...f }] }, "k", 0)).toBe(h);
    expect(edit(h, { ...C, functions: [{ ...f, params: { ...f.params, a: 99 } }] }, "k", 0)).not.toBe(h);
  });
});
