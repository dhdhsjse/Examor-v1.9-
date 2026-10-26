import { describe, expect, it } from "vitest";
import { ANNOTATION_HINTS, ANNOTATION_SPECS, ANNOTATION_TYPES, curveName, detachCurve, freeFromCurve, handlesOf, markerY, moveHandle, nearestCurve, newAnnotation, resolveAnnotation, tangentOf, triangleDeltas } from "../annotations";
import { buildScene, graphToPxX, graphToPxY } from "../grid";
import { clipSegment, evaluateFunction, getSlopeAt } from "../mathUtils";
import { GRAPH_AR, GRAPH_FR } from "../strings";
import { renderGraphSvg } from "../svg";
import { DEFAULT_GRAPH_CONFIG, normalizeGraphConfig, type GraphAnnotation, type GraphConfig, type GraphFunction } from "../types";

const C = DEFAULT_GRAPH_CONFIG;
const fn = (type: GraphFunction["type"], params: Record<string, number>, id = "f"): GraphFunction => ({ id, type, color: "#000", strokeWidth: 2, params });
const decay = fn("exponential", { A: 8, tau: 2, y0: 0 });
const line = fn("linear", { a: 1, b: 0 }, "line");
const paper = (functions: GraphFunction[] = [], annotations: GraphAnnotation[] = [], extra: Partial<GraphConfig> = {}): GraphConfig => ({ ...C, functions, annotations, ...extra });
const resolve = (a: GraphAnnotation, c: GraphConfig) => resolveAnnotation(a, c, buildScene(c).origin);

describe("the slope of a curve", () => {
  it("is the derivative, for every kind of function", () => {
    const fns = [fn("linear", { a: 2, b: 1 }), fn("quadratic", { a: 0.5, b: -1, c: 2 }), decay, fn("logarithmic", { a: 3, b: 1 }), fn("sigmoid", { ymin: 1, ymax: 9, k: 1.5, x0: 5 })];
    for (const f of fns) {
      for (const x of [0.5, 2, 4.9, 7]) {
        const h = 1e-5;
        const numeric = (evaluateFunction(f, x + h) - evaluateFunction(f, x - h)) / (2 * h);
        expect(getSlopeAt(f, x), `${f.type} at ${x}`).toBeCloseTo(numeric, 5);
      }
    }
  });

  it("is not defined where the function is not", () => {
    expect(Number.isNaN(getSlopeAt(fn("logarithmic", { a: 1, b: 0 }), -1))).toBe(true);
    expect(Number.isNaN(getSlopeAt(fn("exponential", { A: 1, tau: 0, y0: 0 }), 1))).toBe(true);
  });

  it("is flat far from the step of a sigmoid, not an overflow", () => {
    expect(getSlopeAt(fn("sigmoid", { ymin: 0, ymax: 1, k: 50, x0: 0 }), -100)).toBe(0);
  });
});

describe("clipping a segment to the paper", () => {
  it("keeps the part on the paper, and nothing of one off it", () => {
    expect(clipSegment({ x: 10, y: 10 }, { x: 20, y: 20 }, 100, 100)).toEqual([{ x: 10, y: 10 }, { x: 20, y: 20 }]);
    const [a, b] = clipSegment({ x: -50, y: 50 }, { x: 150, y: 50 }, 100, 100)!;
    expect([a.x, b.x]).toEqual([0, 100]);
    expect(clipSegment({ x: -10, y: -10 }, { x: -5, y: 200 }, 100, 100)).toBeNull();
    const [c, d] = clipSegment({ x: 0, y: 150 }, { x: 100, y: -50 }, 100, 100)!;
    expect([c.y, d.y]).toEqual([100, 0]);
  });
});

describe("making an annotation from a click", () => {
  it("needs a curve for a tangent: the one clicked, else the nearest", () => {
    expect(newAnnotation("tangent", { x: 2, y: 3 }, paper())).toBeNull();
    const c = paper([line, decay]);
    expect(newAnnotation("tangent", { x: 2, y: 2, curveId: "f" }, c)).toMatchObject({ type: "tangent", curveId: "f", x: 2, dashed: true });
    expect(newAnnotation("tangent", { x: 2, y: 2.1 }, c)).toMatchObject({ curveId: "line" }); // (y = x passes through (2, 2); the decay is at 2.9 there)
    expect(nearestCurve(c, 2, 2.9)?.id).toBe("f");
    expect(nearestCurve(paper(), 2, 2)).toBeNull();
  });

  it("makes a slope triangle on a curve when it was clicked, and a free one beside the curves", () => {
    const c = paper([line]);
    const onCurve = newAnnotation("triangle", { x: 2, y: 2, curveId: "line" }, c)!;
    expect(onCurve).toMatchObject({ curveId: "line", x: 2, x2: 4 });
    expect(onCurve.y).toBeUndefined();
    const free = newAnnotation("triangle", { x: 2, y: 6 }, c)!;
    expect(free).toMatchObject({ x: 2, y: 6, x2: 4, y2: 8 });
    expect(free.curveId).toBeUndefined();
    expect(newAnnotation("triangle", { x: 9, y: 2, curveId: "line" }, c)!.x2).toBe(7); // (no room on the right: it goes left)
  });

  it("makes a point, a text and an asymptote with their defaults", () => {
    const c = paper([line]);
    expect(newAnnotation("marker", { x: 3, y: 5 }, c)).toMatchObject({ x: 3, y: 5, shape: "cross", color: "#dc2626" });
    expect(newAnnotation("marker", { x: 3, y: 3, curveId: "line" }, c)).toMatchObject({ curveId: "line", x: 3 });
    expect(newAnnotation("text", { x: 1, y: 2 }, c)).toMatchObject({ x: 1, y: 2, text: "Text" });
    expect(newAnnotation("asymptote", { x: 1, y: 4 }, c)).toMatchObject({ orientation: "horizontal", value: 4, dashed: true });
  });
});

describe("an asymptote", () => {
  it("is a straight dashed line across the whole paper", () => {
    const h = resolve({ id: "a", type: "asymptote", orientation: "horizontal", value: 5, dashed: true }, C);
    expect(h.lines).toEqual([{ points: [0, 300, 600, 300], width: 2, dash: [6, 5] }]);
    const v = resolve({ id: "a", type: "asymptote", orientation: "vertical", value: 2.5, dashed: false }, C);
    expect(v.lines).toEqual([{ points: [150, 0, 150, 600], width: 2, dash: undefined }]);
  });

  it("is not drawn off the paper, and says so", () => {
    expect(resolve({ id: "a", type: "asymptote", value: 50 }, C)).toMatchObject({ lines: [], status: "outside" });
    expect(resolve({ id: "a", type: "asymptote" }, C).status).toBe("undefined");
  });

  it("writes its label by the right end (or the top)", () => {
    const h = resolve({ id: "a", type: "asymptote", value: 5, text: "y = 5" }, C);
    expect(h.texts[0]).toMatchObject({ text: "y = 5", align: "end" });
    expect(resolve({ id: "a", type: "asymptote", orientation: "vertical", value: 5, text: "  " }, C).texts).toEqual([]);
  });
});

describe("a tangent", () => {
  it("follows the slope of an exponential decay at its point of contact", () => {
    const a: GraphAnnotation = { id: "t", type: "tangent", curveId: "f", x: 0 };
    const c = paper([decay], [a]);
    const t = tangentOf(a, c);
    expect(t).toMatchObject({ x: 0, y: 8 });
    expect(typeof t !== "string" && t.slope).toBeCloseTo(-4, 9); // -A/tau
    const s = resolve(a, c);
    expect(s.lines).toHaveLength(1);
    const [x1, y1, x2, y2] = s.lines[0].points;
    // y = 8 - 4x meets the x axis at x = 2 = tau (the classic way to read tau)
    const at = (px: number) => y1 + ((px - x1) * (y2 - y1)) / (x2 - x1);
    expect(at(graphToPxX(2, c))).toBeCloseTo(graphToPxY(0, c), 6);
    expect(at(graphToPxX(0, c))).toBeCloseTo(graphToPxY(8, c), 6); // through the point of contact
    expect(s.dots).toHaveLength(1);
    expect(s.dots[0].x).toBeCloseTo(graphToPxX(0, c), 9);
    expect(s.dots[0].y).toBeCloseTo(graphToPxY(8, c), 9);
    for (const v of [y1, y2]) {
      expect(v).toBeGreaterThanOrEqual(-1e-9);
      expect(v).toBeLessThanOrEqual(600 + 1e-9); // (cut at the edge of the paper)
    }
  });

  it("says when its curve is gone or has no value there", () => {
    const a: GraphAnnotation = { id: "t", type: "tangent", curveId: "gone", x: 1 };
    expect(resolve(a, paper([decay])).status).toBe("no-curve");
    const log = fn("logarithmic", { a: 1, b: 0 }, "g");
    expect(resolve({ ...a, curveId: "g", x: -1 }, paper([log])).status).toBe("undefined");
  });

  it("knows its slope", () => {
    const a: GraphAnnotation = { id: "t", type: "tangent", curveId: "line", x: 3 };
    expect(tangentOf(a, paper([line]))).toEqual({ x: 3, y: 3, slope: 1 });
  });
});

describe("a slope triangle", () => {
  const a: GraphAnnotation = { id: "g", type: "triangle", curveId: "line", x: 2, x2: 6 };

  it("has its right angle at the end of the horizontal leg, on the curve at both ends", () => {
    const c = paper([line]);
    const s = resolve(a, c);
    expect(s.lines).toHaveLength(3);
    const px = (x: number) => graphToPxX(x, c);
    const py = (y: number) => graphToPxY(y, c);
    expect(s.lines[0].points).toEqual([px(2), py(2), px(6), py(2)]); // A to B, along x
    expect(s.lines[1].points).toEqual([px(6), py(2), px(6), py(6)]); // B to C, along y
    expect(s.lines[2].points).toEqual([px(6), py(6), px(2), py(2)]); // C to A, on the line y = x
    expect(triangleDeltas(a, c)).toEqual({ dx: 4, dy: 4 });
  });

  it("is labelled with the letters, or the values when asked, outside the triangle", () => {
    const c = paper([line]);
    const plain = resolve(a, c);
    expect(plain.texts.map((t) => t.text)).toEqual(["Δx", "Δy"]);
    expect(resolve({ ...a, showValues: true }, c).texts.map((t) => t.text)).toEqual(["Δx = 4", "Δy = 4"]);
    const [dx, dy] = plain.texts;
    expect(dx.y).toBeGreaterThan(graphToPxY(2, c)); // (below the leg: the hypotenuse is above it)
    expect(dy.x).toBeGreaterThan(graphToPxX(6, c)); // (right of the vertical leg)
    expect(dy.align).toBe("start");
  });

  it("can go down and to the left, and be free of any curve", () => {
    const down = fn("linear", { a: -1, b: 10 }, "d");
    const c = paper([down]);
    const t = resolve({ ...a, curveId: "d" }, c);
    expect(t.texts[0].y).toBeLessThan(graphToPxY(8, c)); // (the hypotenuse is below the leg: the label goes above it)
    const free: GraphAnnotation = { id: "g", type: "triangle", x: 1, y: 1, x2: 4, y2: 3 };
    expect(triangleDeltas(free, C)).toEqual({ dx: 3, dy: 2 });
    expect(resolve(free, C).lines).toHaveLength(3);
    expect(resolve({ ...free, x: 8, x2: 3 }, C).texts[1].align).toBe("end");
  });

  it("is not drawn without a curve or with a curve that has no value", () => {
    expect(resolve(a, paper()).status).toBe("no-curve");
    expect(resolve({ ...a, curveId: "l", x: -3, x2: 5 }, paper([fn("logarithmic", { a: 1, b: 0 }, "l")])).status).toBe("undefined");
  });
});

describe("a point marker", () => {
  it("is a cross, a plus or a dot, with its label and dashed lines to the axes", () => {
    const cross = resolve({ id: "m", type: "marker", x: 4, y: 5 }, C);
    expect(cross.lines).toHaveLength(2);
    expect(resolve({ id: "m", type: "marker", x: 4, y: 5, shape: "dot" }, C).dots).toHaveLength(1);
    expect(resolve({ id: "m", type: "marker", x: 4, y: 5, shape: "plus" }, C).lines).toHaveLength(2);
    const full = resolve({ id: "m", type: "marker", x: 4, y: 5, guides: true, text: "V_E" }, C);
    expect(full.lines).toHaveLength(4);
    expect(full.lines.filter((l) => l.dash)).toHaveLength(2);
    expect(full.texts[0].text).toBe("V_E");
  });

  it("takes its y from its curve", () => {
    const c = paper([line]);
    const a: GraphAnnotation = { id: "m", type: "marker", curveId: "line", x: 4 };
    expect(markerY(a, c)).toBe(4);
    const s = resolve(a, c);
    const cx = (s.lines[0].points[0] + s.lines[0].points[2]) / 2;
    const cy = (s.lines[0].points[1] + s.lines[0].points[3]) / 2;
    expect([cx, cy]).toEqual([graphToPxX(4, c), graphToPxY(4, c)]);
  });

  it("is not drawn off the paper", () => {
    expect(resolve({ id: "m", type: "marker", x: 40, y: 5 }, C).status).toBe("outside");
  });
});

describe("a text", () => {
  it("is where it was put, in graph units", () => {
    const s = resolve({ id: "x", type: "text", x: 2, y: 8, text: "الشكل 1", fontSize: 18 }, C);
    expect(s.texts).toEqual([{ text: "الشكل 1", x: graphToPxX(2, C), y: graphToPxY(8, C), align: "start", size: 18, bold: true }]);
    expect(resolve({ id: "x", type: "text", x: 2, y: 8, text: "" }, C).texts).toEqual([]);
  });

  it("stays at the same graph position when the axes change", () => {
    const a: GraphAnnotation = { id: "x", type: "text", x: 5, y: 5, text: "A" };
    const wide = { ...C, xMax: 20 };
    expect(resolve(a, wide).texts[0].x).toBe(graphToPxX(5, wide));
  });
});

describe("handles", () => {
  it("are on the points of the annotation", () => {
    const c = paper([line]);
    expect(handlesOf({ id: "t", type: "tangent", curveId: "line", x: 3 }, c)).toEqual([{ role: "point", x: graphToPxX(3, c), y: graphToPxY(3, c) }]);
    expect(handlesOf({ id: "g", type: "triangle", curveId: "line", x: 2, x2: 6 }, c).map((h) => h.role)).toEqual(["start", "end"]);
    expect(handlesOf({ id: "x", type: "text", x: 1, y: 1 }, c)).toEqual([]);
    expect(handlesOf({ id: "a", type: "asymptote", orientation: "vertical", value: 3 }, c)[0].x).toBe(graphToPxX(3, c));
  });

  it("move what they hold, rounded to the grid: a point on a curve slides along it", () => {
    expect(moveHandle({ id: "a", type: "asymptote", orientation: "horizontal", value: 3 }, "move", 7.13, 4.37, 0.2)).toEqual({ value: 4.4 });
    expect(moveHandle({ id: "a", type: "asymptote", orientation: "vertical", value: 3 }, "move", 7.13, 4.37, 0.2)).toEqual({ value: 7.2 });
    expect(moveHandle({ id: "t", type: "tangent", curveId: "f", x: 1 }, "point", 2.93, 9, 0.2)).toEqual({ x: 3 });
    expect(moveHandle({ id: "m", type: "marker", curveId: "f", x: 1 }, "move", 2.93, 9, 0.2)).toEqual({ x: 3 }); // (no y: the curve's)
    expect(moveHandle({ id: "m", type: "marker", x: 1, y: 1 }, "move", 2.93, 9.15, 0.2)).toEqual({ x: 3, y: 9.2 });
    expect(moveHandle({ id: "g", type: "triangle", curveId: "f", x: 1, x2: 3 }, "end", 5.5, 1, null)).toEqual({ x2: 5.5 });
    expect(moveHandle({ id: "g", type: "triangle", x: 1, y: 1, x2: 3, y2: 3 }, "start", 0.5, 0.5, null)).toEqual({ x: 0.5, y: 0.5 });
    expect(moveHandle({ id: "x", type: "text", x: 1, y: 1 }, "move", 2, 2, null)).toBeNull();
  });
});

describe("a curve that goes", () => {
  it("takes its tangents with it and leaves the triangles and points where they were", () => {
    const c = paper(
      [line],
      [
        { id: "t", type: "tangent", curveId: "line", x: 3 },
        { id: "g", type: "triangle", curveId: "line", x: 2, x2: 6 },
        { id: "m", type: "marker", curveId: "line", x: 4 },
        { id: "k", type: "marker", x: 1, y: 1 },
      ],
    );
    const after = detachCurve(c, "line");
    expect(after.map((a) => a.id)).toEqual(["g", "m", "k"]);
    expect(after[0]).toMatchObject({ x: 2, y: 2, x2: 6, y2: 6 });
    expect(after[0].curveId).toBeUndefined();
    expect(after[1]).toMatchObject({ x: 4, y: 4 });
    expect(after[2]).toEqual({ id: "k", type: "marker", x: 1, y: 1 });
  });

  it("can be let go of by one annotation", () => {
    expect(freeFromCurve({ id: "g", type: "triangle", curveId: "line", x: 2, x2: 6 }, paper([line]))).toEqual({ curveId: undefined, y: 2, y2: 6 });
  });
});

describe("in the scene and the picture", () => {
  it("are drawn after the curves, with the texts last", () => {
    const c = paper([line], [{ id: "m", type: "marker", x: 4, y: 5, text: "E", color: "#00ff00" }]);
    expect(buildScene(c).annotations).toHaveLength(1);
    const svg = renderGraphSvg(c)!.svg;
    expect(svg).toContain('stroke="#00ff00"');
    expect(svg.indexOf("data-curve")).toBeLessThan(svg.indexOf("data-annotation"));
    expect(svg).toContain(">E</text>");
  });

  it("are read from a block saved before annotations existed", () => {
    const { annotations: omitted, ...old } = C;
    void omitted;
    expect(normalizeGraphConfig(old).annotations).toEqual([]);
  });
});

describe("the names", () => {
  it("numbers the curves of one kind", () => {
    const c = paper([fn("linear", { a: 1, b: 0 }, "a"), fn("linear", { a: 2, b: 0 }, "b"), decay]);
    expect(curveName(c, c.functions[1])).toEqual({ name: "Linear", n: 2 });
    expect(curveName(c, c.functions[2])).toEqual({ name: "Exponential", n: null });
  });

  it("translates every tool and every hint (the generic words are in the rest of the app)", () => {
    for (const type of ANNOTATION_TYPES) {
      for (const key of [ANNOTATION_SPECS[type].name, ANNOTATION_HINTS[type]]) {
        if (key === "Text") continue;
        expect(GRAPH_FR[key], `${key} (fr)`).toBeTruthy();
        expect(GRAPH_AR[key], `${key} (ar)`).toBeTruthy();
      }
    }
  });
});
