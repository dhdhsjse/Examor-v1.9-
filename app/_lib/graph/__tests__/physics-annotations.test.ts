import { describe, expect, it } from "vitest";
import { ANNOTATION_HINTS, ANNOTATION_SPECS, ANNOTATION_TYPES, detachCurve, guideTarget, handlesOf, moveHandle, newAnnotation, resolveAnnotation, tangentOf } from "../annotations";
import { PAPER_MARGIN, buildScene, configIssues, fatalIssue, graphToPxX, graphToPxY } from "../grid";
import { GRAPH_TEMPLATES, GRAPH_TEMPLATE_GROUPS, instantiateTemplate } from "../presets";
import { sampleCurve } from "../mathUtils";
import { GRAPH_AR, GRAPH_FR } from "../strings";
import { renderGraphSvg } from "../svg";
import { DEFAULT_GRAPH_CONFIG, type GraphAnnotation, type GraphConfig, type GraphFunction } from "../types";

const C = DEFAULT_GRAPH_CONFIG;
const fn = (type: GraphFunction["type"], params: Record<string, number>, id = "f", extra: Partial<GraphFunction> = {}): GraphFunction => ({ id, type, color: "#000", strokeWidth: 2, params, ...extra });
const line = fn("linear", { a: 1, b: 0 }, "line");
const decay = fn("exponential", { A: 8, tau: 2, y0: 0 });
const paper = (functions: GraphFunction[] = [], annotations: GraphAnnotation[] = [], extra: Partial<GraphConfig> = {}): GraphConfig => ({ ...C, functions, annotations, ...extra });
const resolve = (a: GraphAnnotation, c: GraphConfig) => resolveAnnotation(a, c, buildScene(c).origin);
const axisX = (x: number, extra: Partial<GraphAnnotation> = {}): GraphAnnotation => ({ id: "m", type: "axisMark", axis: "x", value: x, ...extra });
const axisY = (y: number, extra: Partial<GraphAnnotation> = {}): GraphAnnotation => ({ id: "m", type: "axisMark", axis: "y", value: y, ...extra });

describe("a mark on an axis", () => {
  it("is a tick across the axis with its text just beyond it: below the x axis, left of the y axis", () => {
    const x = resolve(axisX(4, { text: "a" }), C);
    expect(x.lines).toEqual([{ points: [graphToPxX(4, C), 600 - 5, graphToPxX(4, C), 600 + 5], width: 2 }]);
    expect(x.texts[0]).toMatchObject({ text: "a", align: "middle", bold: true });
    expect(x.texts[0].y).toBeGreaterThan(600 + 5);
    const y = resolve(axisY(6, { text: "E" }), C);
    expect(y.lines[0].points).toEqual([-5, graphToPxY(6, C), 5, graphToPxY(6, C)]);
    expect(y.texts[0]).toMatchObject({ text: "E", align: "end" });
    expect(y.texts[0].x).toBeLessThan(-5);
  });

  it("writes the value itself when it has no text, with a decimal comma if the paper has one", () => {
    expect(resolve(axisX(2.5), C).texts[0].text).toBe("2.5");
    expect(resolve(axisX(2.5), paper([], [], { decimalComma: true })).texts[0].text).toBe("2,5");
    expect(resolve(axisX(2.5, { text: "  " }), C).texts[0].text).toBe("2.5");
  });

  it("typesets its text, with sub- and superscripts", () => {
    const t = resolve(axisX(4, { text: "t_1" }), C).texts[0];
    expect(t.text).toBe("t_1");
    expect(t.runs).toEqual([{ text: "t" }, { text: "1", script: "sub" }]);
    expect(resolve(axisX(4, { text: "a" }), C).texts[0].runs).toBeUndefined();
  });

  it("has a dashed guide down to its curve, or up to it for a mark on the y axis", () => {
    const c = paper([line]);
    const down = resolve(axisX(4, { guides: true, curveId: "line" }), c);
    expect(down.lines).toHaveLength(2);
    expect(down.lines[1]).toEqual({ points: [graphToPxX(4, c), 600, graphToPxX(4, c), graphToPxY(4, c)], width: 1, dash: [4, 4] });
    const across = resolve(axisY(6, { guides: true, curveId: "line" }), c); // (the first place the curve is 6: x = 6)
    expect(across.lines[1]).toEqual({ points: [0, graphToPxY(6, c), graphToPxX(6, c), graphToPxY(6, c)], width: 1, dash: [4, 4] });
    expect(resolve(axisX(4, { curveId: "line" }), c).lines).toHaveLength(1); // (no guide unless asked)
  });

  it("has a guide to a place on the other axis when it is not on a curve", () => {
    const s = resolve(axisY(7.94, { guides: true, guideTo: 8 }), C);
    const [x1, y1, x2, y2] = s.lines[1].points;
    expect([x1, x2]).toEqual([0, graphToPxX(8, C)]);
    expect(y1).toBeCloseTo(graphToPxY(7.94, C), 9);
    expect(y2).toBeCloseTo(y1, 9); // (a horizontal line)
    expect(resolve(axisX(3, { guides: true, guideTo: 9 }), C).lines[1].points).toEqual([graphToPxX(3, C), 600, graphToPxX(3, C), graphToPxY(9, C)]);
    expect(resolve(axisX(3, { guides: true }), C).lines).toHaveLength(1); // (nowhere to go: only the tick)
  });

  it("reaches the end of a curve that stops there (the last point of a measurement)", () => {
    const stops = fn("linear", { a: -1, b: 10 }, "s", { from: 0, to: 8 });
    const c = paper([stops]);
    const s = resolve(axisY(2, { guides: true, curveId: "s" }), c); // y = 10 − x is 2 at x = 8, the end
    expect(s.lines[1].points[2]).toBeCloseTo(graphToPxX(8, c), 6);
  });

  it("says when it is off the paper, has no value, or lost its curve", () => {
    expect(resolve(axisX(50), C).status).toBe("outside");
    expect(resolve({ id: "m", type: "axisMark", axis: "x" }, C).status).toBe("undefined");
    expect(resolve(axisX(4, { guides: true, curveId: "gone" }), C).status).toBe("no-curve");
  });

  it("goes inside the paper, right of the y axis, when its text does not fit in the margin", () => {
    const long = resolve(axisY(5, { text: "−12,06" }), C).texts[0];
    expect(long.align).toBe("start");
    expect(long.x).toBeGreaterThan(0);
    const short = resolve(axisY(5, { text: "E" }), C).texts[0];
    expect(short.align).toBe("end");
    // with the y axis well inside the paper the same text has room on its left
    const middle = paper([], [], { xMin: -10, xMax: 10 });
    expect(resolve(axisY(5, { text: "−12,06" }), middle).texts[0].align).toBe("end");
    expect(PAPER_MARGIN).toBeGreaterThan(30);
  });

  it("is made from a click: on a curve it marks the x of its point with a guide, else it takes the nearer axis", () => {
    const c = paper([line]);
    expect(newAnnotation("axisMark", { x: 4, y: 4, curveId: "line" }, c)).toMatchObject({ axis: "x", value: 4, curveId: "line", guides: true });
    expect(newAnnotation("axisMark", { x: 6, y: 0.4 }, c)).toMatchObject({ axis: "x", value: 6 }); // (near the x axis)
    expect(newAnnotation("axisMark", { x: 0.3, y: 7 }, c)).toMatchObject({ axis: "y", value: 7 }); // (near the y axis)
    expect(newAnnotation("axisMark", { x: 4, y: 4 }, c)!.curveId).toBeUndefined();
  });

  it("is dragged along its axis, to the fine grid of that axis", () => {
    const c = paper([], [], { xMinorStep: 0.5, yMinorStep: 0.25 });
    expect(handlesOf(axisX(4), c)).toEqual([{ role: "move", x: graphToPxX(4, c), y: 600 }]);
    expect(handlesOf(axisY(6), c)).toEqual([{ role: "move", x: 0, y: graphToPxY(6, c) }]);
    expect(moveHandle(axisX(4), "move", 3.2, 9, { x: 0.5, y: 0.25 })).toEqual({ value: 3 });
    expect(moveHandle(axisY(4), "move", 3.2, 7.1, { x: 0.5, y: 0.25 })).toEqual({ value: 7 });
    expect(moveHandle(axisX(4), "move", 3.2, 9, null)).toEqual({ value: 3.2 });
  });

  it("tells the value its guide reaches", () => {
    const c = paper([line]);
    expect(guideTarget(axisX(4, { guides: true, curveId: "line" }), c)).toBe(4);
    expect(guideTarget(axisY(6, { guides: true, curveId: "line" }), c)).toBeCloseTo(6, 6);
    expect(guideTarget(axisX(4, { guides: true, guideTo: 7 }), c)).toBe(7);
    expect(guideTarget(axisX(4, { guides: true }), c)).toBeNull();
    expect(guideTarget({ id: "t", type: "text" }, c)).toBeNull();
  });

  it("is not masked from the student unless it is told to be", () => {
    const c = paper([], [axisX(4, { hidden: true }), axisY(3)]);
    expect(buildScene(c, { student: true }).annotations.map((a) => a.type)).toEqual(["axisMark"]);
    expect(buildScene(c).annotations).toHaveLength(2);
  });
});

describe("the name of a curve", () => {
  it("is made on a click, numbered by the order of the curves, just above the click", () => {
    const c = paper([line, decay]);
    const a = newAnnotation("curveLabel", { x: 3, y: 3, curveId: "f" }, c)!;
    expect(a).toMatchObject({ type: "curveLabel", curveId: "f", x: 3, text: "(2)" });
    expect(a.y).toBeGreaterThan(3);
    expect(newAnnotation("curveLabel", { x: 3, y: 9.9, curveId: "line" }, c)!.y).toBeLessThan(9.9); // (no room above: below)
    expect(newAnnotation("curveLabel", { x: 3, y: 3 }, paper())).toBeNull(); // (it needs a curve)
  });

  it("is of a series of measured points too, which a tangent cannot be on", () => {
    const series: GraphFunction = { id: "s", type: "data", color: "#2563eb", strokeWidth: 2, params: {}, points: [{ id: "p", x: 1, y: 1 }] };
    expect(newAnnotation("curveLabel", { x: 1, y: 1, curveId: "s" }, paper([series]))).toMatchObject({ curveId: "s", text: "(1)" });
  });

  it("is written at its place in the colour of its curve, with a circle if asked", () => {
    const red = { ...line, color: "#dc2626" };
    const c = paper([red]);
    const a: GraphAnnotation = { id: "n", type: "curveLabel", curveId: "line", x: 2, y: 5, text: "2", frame: "circle", fontSize: 14 };
    const s = resolve(a, c);
    expect(s.color).toBe("#dc2626");
    expect(s.texts[0]).toMatchObject({ text: "2", x: graphToPxX(2, c), y: graphToPxY(5, c), align: "middle", size: 14, bold: true });
    expect(s.texts[0].frame).toMatchObject({ shape: "circle", x: graphToPxX(2, c), y: graphToPxY(5, c) });
    expect(s.texts[0].frame!.w).toBeGreaterThanOrEqual(14 + 8); // (a circle that holds its text)
    expect(resolve({ ...a, color: "#00ff00" }, c).color).toBe("#00ff00");
    expect(resolve({ ...a, frame: undefined }, c).texts[0].frame).toBeUndefined();
    expect(resolve({ ...a, frame: "box" }, c).texts[0].frame).toMatchObject({ shape: "box" });
  });

  it("says when its curve is gone, or it is off the paper", () => {
    expect(resolve({ id: "n", type: "curveLabel", curveId: "gone", x: 2, y: 5, text: "1" }, paper([line])).status).toBe("no-curve");
    expect(resolve({ id: "n", type: "curveLabel", curveId: "line", x: 50, y: 5, text: "1" }, paper([line])).status).toBe("outside");
    expect(resolve({ id: "n", type: "curveLabel", curveId: "line", text: "1" }, paper([line])).status).toBe("undefined");
  });

  it("goes with its curve when the curve goes, and is left out of the student's paper when the curve is", () => {
    const label: GraphAnnotation = { id: "n", type: "curveLabel", curveId: "line", x: 2, y: 5, text: "1" };
    const mark: GraphAnnotation = axisX(4, { curveId: "line", guides: true });
    const after = detachCurve(paper([line], [label, mark]), "line");
    expect(after.map((a) => a.type)).toEqual(["axisMark"]); // (the mark stays, off its curve)
    expect(after[0].curveId).toBeUndefined();
    const hidden = paper([{ ...line, hidden: true }, { ...decay, id: "d" }], [label, { ...label, id: "m2", curveId: "d" }]);
    expect(buildScene(hidden, { student: true }).annotations.map((a) => a.id)).toEqual(["m2"]);
    expect(buildScene(hidden).annotations).toHaveLength(2);
  });

  it("is dragged as a text, not by handles", () => {
    expect(handlesOf({ id: "n", type: "curveLabel", curveId: "line", x: 2, y: 5 }, paper([line]))).toEqual([]);
    expect(moveHandle({ id: "n", type: "curveLabel", curveId: "line", x: 2, y: 5 }, "move", 3, 3, null)).toBeNull();
  });
});

describe("a line", () => {
  const seg: GraphAnnotation = { id: "l", type: "line", x: 2, y: 1, x2: 6, y2: 3, dashed: false };

  it("is a segment between its two ends, across the paper when it is carried on", () => {
    const s = resolve(seg, C);
    expect(s.lines).toEqual([{ points: [graphToPxX(2, C), graphToPxY(1, C), graphToPxX(6, C), graphToPxY(3, C)], width: 1.5, dash: undefined }]);
    const far = resolve({ ...seg, extend: true }, C).lines[0].points;
    expect(far[0]).toBeCloseTo(0, 6); // (cut at the left edge of the paper)
    expect(far[far.length - 2]).toBeCloseTo(600, 6); // and at the right one
    const slope = (far[far.length - 1] - far[1]) / (far[far.length - 2] - far[0]);
    expect(-slope).toBeCloseTo(0.5, 9); // (the same line: up 2 for 4 along)
  });

  it("can be dashed, and has an arrowhead at its end", () => {
    expect(resolve({ ...seg, dashed: true }, C).lines[0].dash).toEqual([6, 5]);
    expect(resolve({ ...seg, dashed: undefined }, C).lines[0].dash).toEqual([6, 5]); // (a line is dashed like a tangent, unless told not to be)
    const withArrow = resolve({ ...seg, arrow: true }, C);
    expect(withArrow.lines).toHaveLength(2);
    expect(withArrow.lines[1].points).toHaveLength(6); // (two barbs and the tip)
    expect(withArrow.lines[1].points.slice(2, 4)).toEqual([graphToPxX(6, C), graphToPxY(3, C)]);
  });

  it("says when it has no length, no value, or is off the paper", () => {
    expect(resolve({ ...seg, x2: 2, y2: 1 }, C).status).toBe("undefined");
    expect(resolve({ id: "l", type: "line", x: 1, y: 1 }, C).status).toBe("undefined");
    expect(resolve({ ...seg, x: 20, x2: 30 }, C).status).toBe("outside");
  });

  it("is made on a click, up and right of it (down and left near the edge), and is dragged by its ends", () => {
    expect(newAnnotation("line", { x: 2, y: 3 }, C)).toMatchObject({ type: "line", x: 2, y: 3, x2: 4, y2: 5, dashed: false });
    expect(newAnnotation("line", { x: 9, y: 9 }, C)).toMatchObject({ x2: 7, y2: 7 });
    const c = paper([], [], { xMajorStep: 5, yMajorStep: 2, xMax: 40, yMax: 14 });
    expect(newAnnotation("line", { x: 5, y: 4 }, c)).toMatchObject({ x2: 15, y2: 8 }); // (two squares of each axis)
    expect(handlesOf(seg, C).map((h) => h.role)).toEqual(["start", "end"]);
    expect(moveHandle(seg, "start", 2.95, 1.05, 0.2)).toEqual({ x: 3, y: 1 });
    expect(moveHandle(seg, "end", 6.9, 3.1, { x: 1, y: 0.5 })).toEqual({ x2: 7, y2: 3 });
  });
});

describe("a tangent on one side", () => {
  const a: GraphAnnotation = { id: "t", type: "tangent", curveId: "f", x: 2 };
  const c = paper([decay], [a]);
  const points = (side?: "both" | "right" | "left") => resolve({ ...a, side }, c).lines[0].points;

  it("is the whole line across the paper unless it says otherwise, as before", () => {
    const p = points();
    expect(p[0]).toBeCloseTo(0, 6);
    expect(p[p.length - 2]).toBeGreaterThan(graphToPxX(2, c));
    expect(points("both")).toEqual(points());
  });

  it("starts at its point of contact when it is only to the right of it, and ends there when it is to the left", () => {
    const right = points("right");
    expect(right[0]).toBeCloseTo(graphToPxX(2, c), 9);
    expect(right[1]).toBeCloseTo(graphToPxY(tangentOf(a, c) !== "no-curve" && typeof tangentOf(a, c) !== "string" ? (tangentOf(a, c) as { y: number }).y : 0, c), 9);
    const left = points("left");
    expect(left[0]).toBeCloseTo(0, 6);
    expect(left[left.length - 2]).toBeCloseTo(graphToPxX(2, c), 9);
  });
});

describe("the tools", () => {
  it("has a name and a hint for each, in French and in Arabic", () => {
    expect(ANNOTATION_TYPES).toEqual(expect.arrayContaining(["axisMark", "curveLabel", "line"]));
    for (const type of ["axisMark", "curveLabel", "line"] as const) {
      for (const key of [ANNOTATION_SPECS[type].name, ANNOTATION_HINTS[type]]) {
        expect(GRAPH_FR[key], `${key} (fr)`).toBeTruthy();
        expect(GRAPH_AR[key], `${key} (ar)`).toBeTruthy();
      }
    }
  });

  it("makes a text with a frame, whose frame follows its alignment", () => {
    const text: GraphAnnotation = { id: "x", type: "text", x: 2, y: 8, text: "Figure 2", fontSize: 16, frame: "box" };
    const s = resolve(text, C).texts[0];
    expect(s.align).toBe("start");
    expect(s.frame!.shape).toBe("box");
    expect(s.frame!.x).toBeGreaterThan(s.x); // (the box is centred on the text, which starts at x)
    expect(s.frame!.h).toBe(16 + 6);
  });
});

describe("the physics sheets", () => {
  const sheets = GRAPH_TEMPLATES.map((t) => ({ t, config: instantiateTemplate(t) }));

  it("are ready to use: drawable, with every curve and every annotation showing", () => {
    expect(sheets.length).toBeGreaterThanOrEqual(12);
    for (const { t, config } of sheets) {
      expect(fatalIssue(config), t.id).toBeNull();
      expect(configIssues(config), t.id).toEqual([]);
      for (const f of config.functions) expect(sampleCurve(f, config).status, `${t.id} ${f.type}`).toBe("ok");
      for (const a of buildScene(config).annotations) expect(a.status, `${t.id} ${a.type}`).toBe("ok");
      expect(renderGraphSvg(config), t.id).not.toBeNull();
    }
  });

  it("have a scale on each axis, written as a sheet does: the origin and the first main square", () => {
    for (const { t, config } of sheets) {
      expect(config.midGrid, t.id).toBe(true);
      expect(config.xMajorStep, t.id).toBeGreaterThan(0);
      expect(config.yMajorStep, t.id).toBeGreaterThan(0);
      expect(config.xMinorStep, t.id).toBeCloseTo(config.xMajorStep! / 10, 9); // 1 mm for 1 cm
      expect(config.yMinorStep, t.id).toBeCloseTo(config.yMajorStep! / 10, 9);
    }
  });

  it("have a paper that fits the page without being scaled, with square main squares", () => {
    for (const { t, config } of sheets) {
      expect(config.width, t.id).toBeLessThanOrEqual(698 - 2 * PAPER_MARGIN); // (an A4 page's width between its margins, less the room round the paper)
      const cellX = config.width / ((config.xMax - config.xMin) / config.xMajorStep!);
      const cellY = config.height / ((config.yMax - config.yMin) / config.yMajorStep!);
      expect(Math.abs(cellX - cellY), t.id).toBeLessThan(1); // (square, within the rounding to whole pixels)
    }
  });

  it("refer only to curves they have, and give each curve and annotation its own id", () => {
    for (const { t, config } of sheets) {
      const ids = [...config.functions, ...config.annotations].map((x) => x.id);
      expect(new Set(ids).size, t.id).toBe(ids.length);
      for (const a of config.annotations) if (a.curveId) expect(config.functions.map((f) => f.id), t.id).toContain(a.curveId);
    }
  });

  it("are new every time (a sheet put twice does not share ids), and keep the grid colour of the paper they replace", () => {
    const t = GRAPH_TEMPLATES[0];
    expect(instantiateTemplate(t).functions[0].id).not.toBe(instantiateTemplate(t).functions[0].id);
    expect(instantiateTemplate(t, { gridColor: "#888888" }).gridColor).toBe("#888888");
  });

  it("are scaled down to a narrower page, keeping their squares square", () => {
    const wide = instantiateTemplate(GRAPH_TEMPLATES[0]);
    const narrow = instantiateTemplate(GRAPH_TEMPLATES[0], C, 300);
    expect(narrow.width).toBe(300);
    expect(narrow.width / narrow.height).toBeCloseTo(wide.width / wide.height, 1);
  });

  it("have a name, and a group, in French and in Arabic", () => {
    expect(GRAPH_TEMPLATE_GROUPS).toEqual(["Chemistry", "Electricity", "Mechanics"]);
    for (const { t } of sheets) {
      expect(GRAPH_TEMPLATE_GROUPS, t.id).toContain(t.group);
      for (const dict of [GRAPH_FR, GRAPH_AR]) expect(dict[t.name], t.name).toBeTruthy();
    }
    for (const g of GRAPH_TEMPLATE_GROUPS) for (const dict of [GRAPH_FR, GRAPH_AR]) expect(dict[g], g).toBeTruthy();
  });

  it("cover what the exams ask: titrations, kinetics, RC, RL, RLC, LC, a speed and a line", () => {
    const ids = GRAPH_TEMPLATES.map((t) => t.id);
    for (const id of ["titration-weak", "titration-two", "titration-henderson", "kinetics-decay", "kinetics-two", "kinetics-progress", "rc-charge", "rl-currents", "rlc-damped", "lc-undamped", "rc-rlc", "speed-limit", "projectile", "proportional"]) expect(ids).toContain(id);
    const types = new Set(sheets.flatMap(({ config }) => config.functions.map((f) => f.type)));
    for (const type of ["titration", "oscillation", "formula", "exponential", "linear", "data"]) expect(types).toContain(type);
    const notes = new Set(sheets.flatMap(({ config }) => config.annotations.map((a) => a.type)));
    for (const type of ["tangent", "asymptote", "axisMark", "curveLabel", "triangle"]) expect(notes).toContain(type);
  });

  it("draw the figure of an exam: two titration curves with their circled names, an RC charge then an RLC discharge with its marks", () => {
    const two = instantiateTemplate(GRAPH_TEMPLATES.find((t) => t.id === "titration-two")!);
    expect(two.functions).toHaveLength(2);
    expect(buildScene(two).annotations.filter((a) => a.type === "curveLabel").every((a) => a.texts[0].frame?.shape === "circle")).toBe(true);
    const rc = instantiateTemplate(GRAPH_TEMPLATES.find((t) => t.id === "rc-rlc")!);
    expect(rc.functions.map((f) => f.type)).toEqual(["formula", "oscillation"]);
    const labels = buildScene(rc).annotations.filter((a) => a.type === "axisMark").map((a) => a.texts[0].text);
    expect(labels).toEqual(expect.arrayContaining(["a", "b", "E"]));
    const svg = renderGraphSvg(rc)!.svg;
    expect(svg).toContain(">a</text>");
    expect(svg).toContain("stroke-dasharray");
  });
});
