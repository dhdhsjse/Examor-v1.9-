import { describe, expect, it } from "vitest";
import { CM_PX, MAX_PAPER, PAPER_MARGIN, buildScene, configIssues, fatalIssue, fitPaper, formatNumber, graphToPxX, graphToPxY, scaleTick } from "../grid";
import { edit, isDirty, startHistory } from "../history";
import { GRAPH_PRESETS, PRESET_RESET, presetApplies, presetChanges } from "../presets";
import { hasScripts, labelWidth, parseLabel, plainLabel } from "../richLabel";
import { renderGraphSvg } from "../svg";
import { DEFAULT_GRAPH_CONFIG, axisSteps, normalizeGraphConfig, type GraphAnnotation, type GraphConfig, type GraphFunction } from "../types";

const C = DEFAULT_GRAPH_CONFIG;
const with_ = (u: Partial<GraphConfig>): GraphConfig => ({ ...C, ...u });
const ticks = (c: GraphConfig) => buildScene(c).texts.filter((t) => t.kind === "tick").map((t) => t.text);

// a sheet with its own scale on each axis: 1 cm = 5 mL along, 2 pH up, on millimetre paper
const titration = with_({ xMin: 0, xMax: 40, yMin: 0, yMax: 14, xMajorStep: 5, xMinorStep: 0.5, yMajorStep: 2, yMinorStep: 0.2, xLabel: "V_b(mL)", yLabel: "pH" });

describe("a scale on each axis", () => {
  it("falls back to the shared steps, so a paper saved before has the grid it had", () => {
    expect(axisSteps(C, "x")).toEqual({ major: 1, minor: 0.2 });
    expect(axisSteps(C, "y")).toEqual({ major: 1, minor: 0.2 });
    expect(axisSteps(with_({ yMajorStep: 5 }), "y")).toEqual({ major: 5, minor: 0.2 });
    expect(axisSteps(with_({ yMajorStep: 5 }), "x")).toEqual({ major: 1, minor: 0.2 });
  });

  it("draws the main and the fine lines of each axis at its own spacing", () => {
    const s = buildScene(titration);
    const xs = s.major.filter((m) => m.x1 === m.x2).map((m) => m.x1);
    const ys = s.major.filter((m) => m.y1 === m.y2).map((m) => m.y1);
    expect(xs).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40].map((x) => graphToPxX(x, titration)));
    expect(ys).toHaveLength(8); // 0, 2 … 14
    expect(ys[1]).toBeCloseTo(graphToPxY(2, titration), 9);
    // 40 / 0.5 + 1 = 81 vertical fine lines, 9 of them on a main one; 14 / 0.2 + 1 = 71 horizontal ones, 8 of them
    expect(s.minor.filter((m) => m.x1 === m.x2)).toHaveLength(81 - 9);
    expect(s.minor.filter((m) => m.y1 === m.y2)).toHaveLength(71 - 8);
  });

  it("numbers the main lines of each axis by its own step", () => {
    expect(ticks(titration).filter((t) => t !== "0")).toContain("35");
    expect(ticks(titration)).toContain("14");
    expect(ticks(titration)).not.toContain("7"); // (7 is neither a multiple of 5 along nor of 2 up)
  });

  it("refuses a step of zero on either axis and reports a fine step above the main one on either", () => {
    expect(fatalIssue(with_({ xMajorStep: 0 }))).toBe("major-step");
    expect(fatalIssue(with_({ yMinorStep: -1 }))).toBe("minor-step");
    expect(configIssues(with_({ yMajorStep: 0.1, yMinorStep: 0.5 }))).toContain("minor-larger");
    expect(configIssues(with_({ xMinorStep: 0.0001 }))).toContain("dense-minor");
    expect(configIssues(titration)).toEqual([]);
  });

  it("is applied by a preset for both axes, which gives up the steps of one axis", () => {
    const preset = GRAPH_PRESETS[3];
    const c = { ...titration, ...presetChanges(preset) };
    expect(axisSteps(c, "x")).toEqual({ major: preset.values.majorGridStep, minor: preset.values.minorGridStep });
    expect(axisSteps(c, "y")).toEqual(axisSteps(c, "x"));
    expect(presetApplies(c, preset)).toBe(true);
    expect(presetApplies(with_({ ...preset.values, xMajorStep: 4 }), preset)).toBe(false); // (an axis with its own step is not that preset)
    expect(Object.keys(PRESET_RESET).sort()).toEqual(["xMajorStep", "xMinorStep", "yMajorStep", "yMinorStep"]);
  });
});

describe("which numbers are written", () => {
  it("writes only the scale (the first main line) and the origin, as an exam sheet does", () => {
    const c = { ...titration, xNumbers: "scale" as const, yNumbers: "scale" as const };
    expect(ticks(c)).toEqual(["0", "5", "2"]); // 0 once, 5 mL for 1 cm along, 2 pH for 1 cm up
    expect(scaleTick(0, 40, 5)).toBe(5);
    expect(scaleTick(-10, 10, 2)).toBe(2);
    expect(scaleTick(-10, -2, 2)).toBe(-2); // (an axis that is all negative: the line nearest to 0)
    expect(scaleTick(3, 9, 1)).toBe(3);
  });

  it("writes none on one axis and all on the other", () => {
    expect(ticks({ ...titration, xNumbers: "none" })).not.toContain("5");
    expect(ticks({ ...titration, xNumbers: "none" })).toContain("2"); // (the y axis keeps its numbers: and the 0 of the origin, no longer written by the x axis)
    expect(ticks({ ...titration, xNumbers: "none" })).toContain("0");
    expect(ticks({ ...titration, xNumbers: "none", yNumbers: "none" })).toEqual([]);
  });

  it("keeps the switch that turns every number off", () => {
    expect(ticks({ ...titration, showNumbers: false })).toEqual([]);
    expect(ticks({ ...titration, showNumbers: false, xNumbers: "all", yNumbers: "all" })).toEqual([]);
  });

  it("keeps the tick marks whatever is written", () => {
    expect(buildScene({ ...titration, xNumbers: "none", yNumbers: "none" }).ticks).toHaveLength(buildScene(titration).ticks.length);
  });

  it("writes a decimal comma when asked, in the numbers along the axes", () => {
    const c = with_({ xMin: 0, xMax: 2.5, yMin: -14, yMax: 10, xMajorStep: 0.25, yMajorStep: 2, xMinorStep: 0.05, yMinorStep: 0.5, decimalComma: true, xNumbers: "scale", yNumbers: "all" });
    expect(ticks(c)).toContain("0,25");
    expect(ticks(c)).toContain("−14"); // (a real minus sign)
    expect(ticks({ ...c, decimalComma: false })).toContain("0.25");
    expect(formatNumber(1.96, true)).toBe("1,96");
    expect(formatNumber(-12.25, true)).toBe("−12,25");
    expect(formatNumber(1.96)).toBe("1.96");
  });

  it("makes the numbers bold or bigger, and the titles too, only when asked", () => {
    const plain = buildScene(C);
    expect(plain.texts.some((t) => t.bold || t.italic)).toBe(false);
    const styled = buildScene(with_({ numberBold: true, numberSize: 13, labelBold: true, labelItalic: true, labelSize: 18 }));
    const tick = styled.texts.find((t) => t.kind === "tick")!;
    expect(tick).toMatchObject({ bold: true, size: 13 });
    const label = styled.texts.find((t) => t.kind === "label")!;
    expect(label).toMatchObject({ bold: true, italic: true, size: 18 });
  });
});

describe("the medium lines", () => {
  const mm = with_({ xMin: 0, xMax: 10, yMin: 0, yMax: 10, majorGridStep: 1, minorGridStep: 0.1 });

  it("are halfway between the main lines, and take the place of the fine lines under them", () => {
    const plain = buildScene(mm);
    const s = buildScene({ ...mm, midGrid: true });
    expect(plain.mid).toEqual([]);
    expect(s.mid).toHaveLength(2 * 10); // 0.5, 1.5 … 9.5 on each axis
    expect(s.major).toHaveLength(plain.major.length);
    expect(s.minor).toHaveLength(plain.minor.length - 2 * 10);
  });

  it("are in the picture with their own weight, and not at all without the grid", () => {
    expect(renderGraphSvg({ ...mm, midGrid: true })!.svg).toContain('stroke-width="0.65"');
    expect(renderGraphSvg(mm)!.svg).not.toContain('stroke-width="0.65"');
    expect(buildScene({ ...mm, midGrid: true, showGrid: false }).mid).toEqual([]);
  });
});

describe("the size of the paper", () => {
  it("makes every main square the same number of cm on both axes", () => {
    const r = fitPaper(titration, 1)!;
    expect(r.width).toBe(Math.round(8 * CM_PX)); // 40 / 5 squares
    expect(r.height).toBe(Math.round(7 * CM_PX)); // 14 / 2 squares
    expect(r.cellCm).toBeCloseTo(1, 9);
    expect(fitPaper(titration, 1.5)!.width).toBe(Math.round(12 * CM_PX));
    expect(CM_PX).toBeCloseTo(37.7953, 3);
  });

  it("is scaled down to fit a width, keeping its squares square, and kept inside the limits", () => {
    const narrow = fitPaper(titration, 1.5, 400)!;
    expect(narrow.width).toBe(400);
    expect(narrow.height / narrow.width).toBeCloseTo(7 / 8, 2);
    expect(narrow.cellCm).toBeCloseTo(400 / 8 / CM_PX, 6);
    const huge = fitPaper(with_({ xMax: 400, majorGridStep: 1, minorGridStep: 0.2 }), 1)!;
    expect(huge.width).toBe(MAX_PAPER);
    expect(fitPaper(with_({ xMax: 1, majorGridStep: 1 }), 0.1)!.width).toBeGreaterThanOrEqual(200);
  });

  it("is not worked out for a paper that makes no sense", () => {
    expect(fitPaper(with_({ xMax: -1 }), 1)).toBeNull();
    expect(fitPaper(titration, 0)).toBeNull();
    expect(fitPaper(with_({ majorGridStep: 0 }), 1)).toBeNull();
  });
});

describe("sub- and superscripts in a text", () => {
  it("reads _ and ^ as a subscript and a power", () => {
    expect(parseLabel("u_C(V)")).toEqual([{ text: "u" }, { text: "C", script: "sub" }, { text: "(V)" }]);
    expect(parseLabel("n(H_2O_2)(×10^-4 mol)")).toEqual([
      { text: "n(H" },
      { text: "2", script: "sub" },
      { text: "O" },
      { text: "2", script: "sub" },
      { text: ")(×10" },
      { text: "−4", script: "sup" }, // (a real minus)
      { text: " mol)" },
    ]);
    expect(parseLabel("m^2.s^-2")).toEqual([{ text: "m" }, { text: "2", script: "sup" }, { text: ".s" }, { text: "−2", script: "sup" }]);
    expect(parseLabel("Na^+")).toEqual([{ text: "Na" }, { text: "+", script: "sup" }]);
  });

  it("takes a whole word for a subscript and braces for anything else", () => {
    expect(parseLabel("x_max")).toEqual([{ text: "x" }, { text: "max", script: "sub" }]);
    expect(parseLabel("V_{E}/2")).toEqual([{ text: "V" }, { text: "E", script: "sub" }, { text: "/2" }]);
    expect(parseLabel("T_{1/2}")).toEqual([{ text: "T" }, { text: "1/2", script: "sub" }]);
    expect(parseLabel("10^{-14}")).toEqual([{ text: "10" }, { text: "−14", script: "sup" }]);
    expect(parseLabel("pK_a")).toEqual([{ text: "pK" }, { text: "a", script: "sub" }]);
  });

  it("leaves a lone _ or ^, and an escaped one, as they are", () => {
    expect(parseLabel("a_ b")).toEqual([{ text: "a_ b" }]);
    expect(parseLabel("snake\\_case")).toEqual([{ text: "snake_case" }]);
    expect(parseLabel("x^")).toEqual([{ text: "x^" }]);
    expect(parseLabel("t(s)")).toEqual([{ text: "t(s)" }]);
    expect(parseLabel("")).toEqual([{ text: "" }]);
    expect(hasScripts("t(s)")).toBe(false);
    expect(hasScripts("u_C")).toBe(true);
    expect(plainLabel("u_C(V)")).toBe("uC(V)");
  });

  it("is sized by the smaller size of the scripts", () => {
    expect(labelWidth(parseLabel("ab"), 10)).toBeCloseTo(12, 9);
    expect(labelWidth(parseLabel("a_b"), 10)).toBeLessThan(labelWidth([{ text: "ab" }], 10));
  });

  it("makes the title of an axis, with its runs, and draws it with tspans in the picture", () => {
    const s = buildScene(titration);
    const label = s.texts.find((t) => t.kind === "label" && t.text === "V_b(mL)")!;
    expect(label.runs).toEqual([{ text: "V" }, { text: "b", script: "sub" }, { text: "(mL)" }]);
    expect(s.texts.find((t) => t.text === "pH")!.runs).toBeUndefined(); // (plain text stays plain)
    const svg = renderGraphSvg(titration)!.svg;
    expect(svg).toMatch(/<text[^>]*>V<tspan dy="[\d.]+" font-size="10.5">b<\/tspan><tspan dy="-[\d.]+">\(mL\)<\/tspan><\/text>/);
    expect(svg).toContain(">pH</text>");
  });

  it("writes a power above the line and comes back to it", () => {
    const svg = renderGraphSvg(with_({ xLabel: "10^-4 mol" }))!.svg;
    const dys = [...svg.matchAll(/<tspan dy="(-?[\d.]+)"/g)].map((m) => Number(m[1]));
    expect(dys).toHaveLength(2);
    expect(dys[0]).toBeLessThan(0); // up
    expect(dys[0] + dys[1]).toBeCloseTo(0, 9); // and back: the text after it is on the line again
  });
});

describe("a paper saved before the physics sheets", () => {
  it("is read, and drawn, as it was", () => {
    const old = normalizeGraphConfig({ xMin: 0, xMax: 10, yMin: 0, yMax: 10, width: 600, height: 600, xLabel: "t(s)", yLabel: "x(m)", majorGridStep: 1, minorGridStep: 0.2, showGrid: true, gridColor: "#000000", showNumbers: true });
    expect(old.xMajorStep).toBeUndefined();
    expect(old.midGrid).toBeUndefined();
    const svg = renderGraphSvg(old)!.svg;
    expect(svg).not.toContain("<tspan");
    expect(svg).not.toContain("stroke-dasharray");
    expect(svg).not.toContain('stroke-width="0.65"');
    expect(svg).toBe(renderGraphSvg(C)!.svg);
    expect(PAPER_MARGIN).toBe(44);
  });
});

describe("undo and the settings a paper did not have yet", () => {
  it("counts the first time an optional setting is set as a change, and setting it back as none", () => {
    let h = startHistory(C);
    h = edit(h, with_({ decimalComma: true }), "decimalComma", 0);
    expect(h.past).toHaveLength(1);
    expect(h.present.decimalComma).toBe(true);
    expect(isDirty(h)).toBe(true);
    h = edit(h, with_({ decimalComma: undefined }), "decimalComma", 5000);
    expect(isDirty(h)).toBe(false); // (a setting that is not there is the same as one that is undefined)
  });

  it("knows a paper with a new setting is not the one it started from", () => {
    const h = startHistory(C);
    expect(edit(h, with_({ xMajorStep: 5 }), "x", 0)).not.toBe(h);
    expect(edit(h, with_({ xMajorStep: undefined }), "x", 0)).toBe(h);
  });
});

// a curve and a text to see the picture with a style on each
describe("the picture with the new styles", () => {
  const curve: GraphFunction = { id: "k", type: "linear", color: "#000000", strokeWidth: 2, params: { a: 1, b: 0 } };
  const note: GraphAnnotation = { id: "n", type: "text", x: 2, y: 8, text: "(1)", frame: "circle", fontSize: 14 };

  it("dashes a dashed or dotted curve with round dots", () => {
    expect(buildScene({ ...C, functions: [curve] }).curves[0].dash).toBeUndefined();
    expect(buildScene({ ...C, functions: [{ ...curve, dash: "dashed" }] }).curves[0].dash).toEqual([8, 5]);
    expect(buildScene({ ...C, functions: [{ ...curve, dash: "dotted", strokeWidth: 3 }] }).curves[0].dash).toEqual([0.1, 7.5]);
    expect(renderGraphSvg({ ...C, functions: [{ ...curve, dash: "dashed" }] })!.svg).toContain('stroke-dasharray="8 5"');
  });

  it("puts a white box or a circle behind a framed text, and the text over it", () => {
    const svg = renderGraphSvg({ ...C, annotations: [note] })!.svg;
    const frame = svg.indexOf('<circle cx=');
    expect(frame).toBeGreaterThan(-1);
    expect(svg.slice(frame, frame + 200)).toContain('fill="#ffffff"');
    expect(svg.indexOf(">(1)</text>")).toBeGreaterThan(frame);
    const boxed = renderGraphSvg({ ...C, annotations: [{ ...note, frame: "box" }] })!.svg;
    expect(boxed).toMatch(/<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="[\d.]+" fill="#ffffff" data-annotation="n"\/>/);
    expect(renderGraphSvg({ ...C, annotations: [{ ...note, frame: undefined }] })!.svg).not.toMatch(/<circle[^>]*data-annotation/);
  });
});
