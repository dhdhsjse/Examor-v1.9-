import { describe, expect, it } from "vitest";
import { newAnnotation, nearestCurve, resolveAnnotation } from "../annotations";
import { buildScene, graphToPxX, graphToPxY } from "../grid";
import { FUNCTION_SPECS, FUNCTION_TYPES, dataDots, isMathFunction, newDataSeries, parseDataText, sampleCurve, sortedPoints } from "../mathUtils";
import { GRAPH_AR, GRAPH_FR } from "../strings";
import { renderGraphSvg } from "../svg";
import { DEFAULT_GRAPH_CONFIG, type GraphAnnotation, type GraphConfig, type GraphFunction } from "../types";

const C = DEFAULT_GRAPH_CONFIG;
const series = (points: [number, number][], extra: Partial<GraphFunction> = {}): GraphFunction => ({
  ...newDataSeries(C, points.map(([x, y], i) => ({ id: `p${i}`, x, y }))),
  id: "s",
  color: "#2563eb",
  ...extra,
});
const line: GraphFunction = { id: "line", type: "linear", color: "#000", strokeWidth: 2, params: { a: 1, b: 0 } };
const paper = (functions: GraphFunction[] = [], annotations: GraphAnnotation[] = []): GraphConfig => ({ ...C, functions, annotations });

describe("a series of measured points", () => {
  it("is not a function of the palette, and has no formula", () => {
    expect(FUNCTION_TYPES).not.toContain("data");
    expect(FUNCTION_SPECS.data.params).toEqual([]);
    expect(isMathFunction(series([]))).toBe(false);
    expect(isMathFunction(line)).toBe(true);
  });

  it("puts its points on the paper where their graph coordinates say, ordered by x", () => {
    const s = series([[4, 2], [1, 7], [2, 5]]);
    expect(sortedPoints(s).map((p) => p.x)).toEqual([1, 2, 4]);
    expect(dataDots(s, C)).toEqual([
      { id: "p1", x: graphToPxX(1, C), y: graphToPxY(7, C) },
      { id: "p2", x: graphToPxX(2, C), y: graphToPxY(5, C) },
      { id: "p0", x: graphToPxX(4, C), y: graphToPxY(2, C) },
    ]);
  });

  it("leaves out the points that are off the paper", () => {
    expect(dataDots(series([[1, 1], [50, 5], [3, -4]]), C).map((d) => d.id)).toEqual(["p0"]);
  });

  it("is only points until its lines are asked for", () => {
    const s = series([[1, 1], [2, 4], [3, 2]]);
    expect(sampleCurve(s, C)).toEqual({ segments: [], status: "ok" });
    const joined = sampleCurve({ ...s, lineStyle: "straight" }, C);
    expect(joined.status).toBe("ok");
    expect(joined.segments).toHaveLength(1);
    expect(joined.segments[0]).toEqual([graphToPxX(1, C), graphToPxY(1, C), graphToPxX(2, C), graphToPxY(4, C), graphToPxX(3, C), graphToPxY(2, C)]);
  });

  it("cuts the line at the edge of the paper and does not draw across a gap", () => {
    // 1 and 2 are on the paper, 20 is off it to the right, 3 and 4 follow in x order (3 < 20): the order is x, so 20 comes last
    const s = series([[1, 1], [2, 2], [20, 9], [3, 3]], { lineStyle: "straight" });
    const { segments } = sampleCurve(s, C);
    for (const seg of segments) for (let i = 0; i < seg.length; i += 2) expect(seg[i]).toBeLessThanOrEqual(600 + 1e-9);
    expect(segments.length).toBe(1); // 1, 2, 3 joined; then the segment to x = 20 runs to the paper's edge
    expect(segments[0].slice(-2)[0]).toBeCloseTo(600, 6);
  });

  it("says when every point is off the paper, and nothing when there are none yet", () => {
    expect(sampleCurve(series([]), C).status).toBe("ok");
    expect(sampleCurve(series([[50, 50]]), C).status).toBe("outside");
  });

  it("has its points in the scene (white circles with a coloured border in the picture) unless they are hidden", () => {
    const c = paper([series([[2, 3], [5, 6]])]);
    expect(buildScene(c).curves[0].dots).toHaveLength(2);
    expect(buildScene(paper([series([[2, 3]], { showPoints: false })])).curves[0].dots).toEqual([]);
    const svg = renderGraphSvg(c)!.svg;
    expect(svg.match(/<circle[^>]*r="4"[^>]*fill="#ffffff"[^>]*stroke="#2563eb"/g)).toHaveLength(2);
  });

  it("cannot carry a tangent, a triangle or a point on a curve", () => {
    const c = paper([series([[1, 1], [2, 2]])]);
    expect(nearestCurve(c, 1, 1)).toBeNull();
    expect(newAnnotation("tangent", { x: 1, y: 1, curveId: "s" }, c)).toBeNull();
    const m = newAnnotation("marker", { x: 1, y: 1, curveId: "s" }, c)!;
    expect(m.curveId).toBeUndefined(); // (a free point, not one on the series)
    const both = paper([series([[1, 1]]), line]);
    expect(newAnnotation("tangent", { x: 2, y: 2, curveId: "s" }, both)?.curveId).toBe("line"); // (it takes the curve that has a formula)
  });
});

describe("pasted values", () => {
  it("reads tab, semicolon, space and comma separated lines, and a decimal comma", () => {
    expect(parseDataText("0\t9\n1\t6,2\n2 4.1\n3;2,5\n4,1.5")).toEqual({
      points: [{ x: 0, y: 9 }, { x: 1, y: 6.2 }, { x: 2, y: 4.1 }, { x: 3, y: 2.5 }, { x: 4, y: 1.5 }],
      rejected: 0,
    });
  });

  it("skips a header, a blank line and anything that is not two numbers, and says how many", () => {
    const r = parseDataText("t (s)\tu (V)\n\n0\t5\n1\n2\t3\t4\nabc def\n3\t1");
    expect(r.points).toEqual([{ x: 0, y: 5 }, { x: 3, y: 1 }]);
    expect(r.rejected).toBe(4); // the header, "1", "2 3 4", "abc def"
  });

  it("reads negative and scientific numbers", () => {
    expect(parseDataText("-1\t-2.5\n1e-3\t2E2").points).toEqual([{ x: -1, y: -2.5 }, { x: 0.001, y: 200 }]);
  });
});

describe("masking", () => {
  const hiddenCurve = { ...line, hidden: true };
  const keep: GraphFunction = { ...line, id: "keep", params: { a: 0, b: 5 } };
  const note: GraphAnnotation = { id: "n", type: "text", x: 1, y: 1, text: "answer", hidden: true };
  const shown: GraphAnnotation = { id: "m", type: "marker", x: 2, y: 2 };

  it("leaves a masked curve and annotation out of the student's scene, and flags them in the teacher's", () => {
    const c = paper([hiddenCurve, keep], [note, shown]);
    const student = buildScene(c, { student: true });
    expect(student.curves.map((k) => k.id)).toEqual(["keep"]);
    expect(student.annotations.map((a) => a.id)).toEqual(["m"]);
    const teacher = buildScene(c);
    expect(teacher.curves.map((k) => [k.id, k.hidden])).toEqual([["line", true], ["keep", undefined]]);
    expect(teacher.annotations.map((a) => [a.id, a.hidden])).toEqual([["n", true], ["m", undefined]]);
  });

  it("hides the points of a masked series too", () => {
    const c = paper([series([[1, 1]], { hidden: true })]);
    expect(buildScene(c, { student: true }).curves).toEqual([]);
    expect(buildScene(c).curves[0].dots).toHaveLength(1);
  });

  it("draws the answer key in the teacher's picture and the student version in the student's", () => {
    const c = paper([hiddenCurve, keep], [note, shown]);
    const teacher = renderGraphSvg(c)!.svg;
    const student = renderGraphSvg(c, { student: true })!.svg;
    expect(teacher).toContain('data-curve="line"');
    expect(teacher).toContain(">answer</text>");
    expect(student).not.toContain('data-curve="line"');
    expect(student).not.toContain("answer");
    expect(student).toContain('data-curve="keep"');
    expect(student).toContain('data-annotation="m"');
  });

  it("does not change the grid, the axes or the labels", () => {
    const base = renderGraphSvg(paper())!.svg;
    expect(renderGraphSvg(paper([hiddenCurve]), { student: true })!.svg).toBe(base);
  });

  it("keeps a tangent on a masked curve unless it is masked too (the teacher decides)", () => {
    const tangent: GraphAnnotation = { id: "t", type: "tangent", curveId: "line", x: 3 };
    const c = paper([hiddenCurve], [tangent]);
    expect(buildScene(c, { student: true }).annotations).toHaveLength(1);
    expect(resolveAnnotation(tangent, c, { x: 0, y: 600 }).lines).toHaveLength(1);
  });
});

describe("the new words", () => {
  it("are translated", () => {
    for (const key of ["Measurements", "New series", "Add points", "Show the points", "Hide from the students", "Hidden from the students", "{added} added, {rejected} skipped"]) {
      expect(GRAPH_FR[key], `${key} (fr)`).toBeTruthy();
      expect(GRAPH_AR[key], `${key} (ar)`).toBeTruthy();
    }
  });
});
