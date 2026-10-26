// The annotations of the graph paper (tangents, asymptotes, slope triangles, point markers, texts): what each one is, how a
// new one is made from a click, how it is resolved into lines, dots and texts in pixels of the paper (the canvas and the
// picture for the page both draw that), where its handles are and what dragging one changes. Pure functions (no React),
// unit-tested.
import { clipSegment, evaluateFunction, formatNumber, getSlopeAt, isMathFunction, FUNCTION_SPECS, type P } from "./mathUtils";
import type { AnnotationType, GraphAnnotation, GraphConfig, GraphFunction } from "./types";

export type AnnotationSpec = {
  type: AnnotationType;
  /** The English name (the key of the translations in graph/strings.ts) */
  name: string;
  /** Whether it is a line that can be dashed (the colour is for all of them) */
  dashable: boolean;
};

export const ANNOTATION_SPECS: Record<AnnotationType, AnnotationSpec> = {
  text: { type: "text", name: "Text", dashable: false },
  asymptote: { type: "asymptote", name: "Asymptote", dashable: true },
  tangent: { type: "tangent", name: "Tangent", dashable: true },
  triangle: { type: "triangle", name: "Slope triangle", dashable: true },
  marker: { type: "marker", name: "Point", dashable: false },
};
export const ANNOTATION_TYPES = Object.keys(ANNOTATION_SPECS) as AnnotationType[];

/** One line of help for each tool, shown over the paper while it is in hand (the English text is the key of the translations). */
export const ANNOTATION_HINTS: Record<AnnotationType, string> = {
  text: "Click the paper to write a text there",
  asymptote: "Click the paper to draw a dashed line at that height",
  tangent: "Click a curve to draw its tangent at that point",
  triangle: "Click a curve for a slope triangle on it (click beside the curves for a free one)",
  marker: "Click the paper for a point (click a curve to put it on that curve)"
};

/** The help line of the tool for measured points (the English text is the key of the translations). */
export const POINTS_HINT = "Click the paper to add a point to the selected series (Shift+click a point to remove it)";

export const DEFAULT_FONT_SIZE = 16;
export const LABEL_FONT_SIZE = 14;
export const MARKER_COLOR = "#dc2626";
export const MARKER_SIZE = 5;
const LINE_WIDTH = 1.5;
const ASYMPTOTE_WIDTH = 2;
const DASH: [number, number] = [6, 5];
const GUIDE_DASH: [number, number] = [4, 4];

// ---- units ----

const pxX = (x: number, c: GraphConfig) => ((x - c.xMin) / (c.xMax - c.xMin)) * c.width;
const pxY = (y: number, c: GraphConfig) => c.height - ((y - c.yMin) / (c.yMax - c.yMin)) * c.height;
const clean = (v: number) => {
  const r = Math.round(v * 1e9) / 1e9;
  return r === 0 ? 0 : r;
};
const fnOf = (a: GraphAnnotation, c: GraphConfig): GraphFunction | undefined => (a.curveId ? c.functions.find((f) => f.id === a.curveId) : undefined);
/** A computed value as it is written next to a figure: 4 significant digits (a slope is not 2.226892015). */
export const readout = (v: number) => formatNumber(Number(v.toPrecision(4)));
const finite = (...v: (number | undefined)[]) => v.every((n) => typeof n === "number" && Number.isFinite(n));

/** The name of a curve for a list: its kind, with a number when there are several of that kind ("Exponential 2"). */
export function curveName(c: GraphConfig, fn: GraphFunction): { name: string; n: number | null } {
  const same = c.functions.filter((f) => f.type === fn.type);
  return { name: FUNCTION_SPECS[fn.type].name, n: same.length > 1 ? same.indexOf(fn) + 1 : null };
}

/** The curve whose y at graph x is the closest (on the paper) to graph y: the one a click near a curve means. null if no curve is defined at x. */
export function nearestCurve(c: GraphConfig, x: number, y: number): GraphFunction | null {
  let best: GraphFunction | null = null;
  let bestGap = Infinity;
  for (const f of c.functions.filter(isMathFunction)) {
    const fy = evaluateFunction(f, x);
    if (!Number.isFinite(fy)) continue;
    const gap = Math.abs(pxY(fy, c) - pxY(y, c));
    if (gap < bestGap) [best, bestGap] = [f, gap];
  }
  return best;
}

// ---- making one ----

export type PlacePoint = { x: number; y: number; curveId?: string | null };

/**
 * A new annotation of this type from a click at graph (x, y) (`curveId`: the click was on that curve). null when it cannot be made:
 * a tangent needs a curve, and there is none under the click or on the paper.
 */
export function newAnnotation(type: AnnotationType, point: PlacePoint, c: GraphConfig, id: string = crypto.randomUUID()): GraphAnnotation | null {
  const step = clean(c.majorGridStep > 0 ? c.majorGridStep : 1);
  const clicked = point.curveId ? c.functions.find((f) => f.id === point.curveId) : undefined;
  const curve = (clicked && isMathFunction(clicked) ? clicked : undefined) ?? nearestCurve(c, point.x, point.y) ?? undefined; // (a series of measured points has no formula)
  switch (type) {
    case "text":
      return { id, type, x: point.x, y: point.y, text: "Text", color: "#000000", fontSize: DEFAULT_FONT_SIZE };
    case "asymptote":
      return { id, type, orientation: "horizontal", value: point.y, color: "#000000", dashed: true };
    case "tangent":
      return curve ? { id, type, curveId: curve.id, x: point.x, color: "#000000", dashed: true } : null;
    case "triangle": {
      const onCurve = clicked && isMathFunction(clicked) ? curve : undefined; // (a click on the paper, not on a curve, is a free triangle)
      const x2 = point.x + 2 * step <= c.xMax ? point.x + 2 * step : point.x - 2 * step;
      return onCurve
        ? { id, type, curveId: onCurve.id, x: point.x, x2, color: "#000000", dashed: false }
        : { id, type, x: point.x, y: point.y, x2, y2: point.y + 2 * step, color: "#000000", dashed: false };
    }
    case "marker": {
      const onCurve = clicked && isMathFunction(clicked) ? curve : undefined;
      return onCurve ? { id, type, curveId: onCurve.id, x: point.x, shape: "cross", color: MARKER_COLOR } : { id, type, x: point.x, y: point.y, shape: "cross", color: MARKER_COLOR };
    }
  }
}

/** A curve is going away: what is on it must not point at nothing. Tangents (which mean nothing without it) go; triangles and markers stay where they are, off the curve. */
export function detachCurve(c: GraphConfig, curveId: string): GraphAnnotation[] {
  const out: GraphAnnotation[] = [];
  for (const a of c.annotations) {
    if (a.curveId !== curveId) {
      out.push(a);
      continue;
    }
    if (a.type === "tangent") continue;
    const fn = fnOf(a, c)!;
    const { curveId: _gone, ...rest } = a;
    void _gone;
    const y = finite(a.x) ? evaluateFunction(fn, a.x!) : undefined;
    const y2 = finite(a.x2) ? evaluateFunction(fn, a.x2!) : undefined;
    out.push({ ...rest, ...(y !== undefined && Number.isFinite(y) ? { y: clean(y) } : {}), ...(a.type === "triangle" && y2 !== undefined && Number.isFinite(y2) ? { y2: clean(y2) } : {}) });
  }
  return out;
}

// ---- resolving one ----

export type SceneLine = { points: number[]; width: number; dash?: [number, number] };
export type SceneDot = { x: number; y: number; r: number };
/** A text of an annotation: (x, y) is the start (or middle, or end) of its middle line */
export type AnnotationText = { text: string; x: number; y: number; align: "start" | "middle" | "end"; size: number; bold?: boolean };
/** "outside": it is not on the paper (nothing is drawn); "undefined": the curve has no value there; "no-curve": the curve is gone */
export type AnnotationStatus = "ok" | "outside" | "undefined" | "no-curve";
export type SceneAnnotation = { id: string; type: AnnotationType; color: string; lines: SceneLine[]; dots: SceneDot[]; texts: AnnotationText[]; status: AnnotationStatus; /** masked, in the teacher's view: drawn faded */ hidden?: boolean };

const segmentLine = (p: P, q: P, c: GraphConfig, width: number, dash?: [number, number]): SceneLine[] => {
  const clipped = clipSegment(p, q, c.width, c.height);
  return clipped ? [{ points: [clipped[0].x, clipped[0].y, clipped[1].x, clipped[1].y], width, dash }] : [];
};
const inside = (p: P, c: GraphConfig) => p.x >= -1e-6 && p.x <= c.width + 1e-6 && p.y >= -1e-6 && p.y <= c.height + 1e-6;

/** The y of a triangle's or a marker's point at `x`: the curve's if it is on one, else the annotation's own. */
function pointY(a: GraphAnnotation, c: GraphConfig, x: number | undefined, own: number | undefined): number | "no-curve" {
  if (a.curveId === undefined) return own ?? Number.NaN;
  const fn = fnOf(a, c);
  if (!fn) return "no-curve";
  return x === undefined ? Number.NaN : evaluateFunction(fn, x);
}

/** The slope and the point of contact of a tangent, or the reason it has none. */
export function tangentOf(a: GraphAnnotation, c: GraphConfig): { x: number; y: number; slope: number } | "no-curve" | "undefined" {
  const fn = fnOf(a, c);
  if (!fn) return "no-curve";
  if (!finite(a.x)) return "undefined";
  const y = evaluateFunction(fn, a.x!);
  const slope = getSlopeAt(fn, a.x!);
  return Number.isFinite(y) && Number.isFinite(slope) ? { x: a.x!, y, slope } : "undefined";
}

/** The lines, dots and texts of an annotation on this paper, in pixels of the paper. `origin` = where the axes cross (for the guides of a marker). */
export function resolveAnnotation(a: GraphAnnotation, c: GraphConfig, origin: P): SceneAnnotation {
  const color = a.color ?? (a.type === "marker" ? MARKER_COLOR : "#000000");
  const out: SceneAnnotation = { id: a.id, type: a.type, color, lines: [], dots: [], texts: [], status: "ok" };
  const dash = (a.dashed ?? ANNOTATION_SPECS[a.type].dashable) ? DASH : undefined;

  switch (a.type) {
    case "text": {
      if (!finite(a.x, a.y)) return { ...out, status: "undefined" };
      if (a.text) out.texts.push({ text: a.text, x: pxX(a.x!, c), y: pxY(a.y!, c), align: "start", size: a.fontSize ?? DEFAULT_FONT_SIZE, bold: true });
      return out;
    }
    case "asymptote": {
      if (!finite(a.value)) return { ...out, status: "undefined" };
      const vertical = a.orientation === "vertical";
      const at = vertical ? pxX(a.value!, c) : pxY(a.value!, c);
      if (at < -1e-6 || at > (vertical ? c.width : c.height) + 1e-6) return { ...out, status: "outside" };
      out.lines.push({ points: vertical ? [at, 0, at, c.height] : [0, at, c.width, at], width: ASYMPTOTE_WIDTH, dash });
      const label = a.text?.trim();
      if (label) out.texts.push(vertical ? { text: label, x: at + 6, y: 12, align: "start", size: LABEL_FONT_SIZE } : { text: label, x: c.width - 4, y: at - 10, align: "end", size: LABEL_FONT_SIZE });
      return out;
    }
    case "tangent": {
      const t = tangentOf(a, c);
      if (t === "no-curve" || t === "undefined") return { ...out, status: t };
      // the line y = y₀ + m·(x − x₀) across the whole paper, cut at its edges
      const at = (x: number): P => ({ x: pxX(x, c), y: pxY(t.y + t.slope * (x - t.x), c) });
      out.lines.push(...segmentLine(at(c.xMin), at(c.xMax), c, LINE_WIDTH, dash));
      const contact = { x: pxX(t.x, c), y: pxY(t.y, c) };
      if (inside(contact, c)) out.dots.push({ ...contact, r: 3.5 });
      if (!out.lines.length && !out.dots.length) out.status = "outside";
      return out;
    }
    case "triangle": {
      if (!finite(a.x, a.x2)) return { ...out, status: "undefined" };
      const y1 = pointY(a, c, a.x, a.y);
      const y2 = pointY(a, c, a.x2, a.y2);
      if (y1 === "no-curve" || y2 === "no-curve") return { ...out, status: "no-curve" };
      if (!finite(y1, y2)) return { ...out, status: "undefined" };
      // A = (x, y₁), B = (x₂, y₁), C = (x₂, y₂): the right angle is at B
      const A = { x: pxX(a.x!, c), y: pxY(y1, c) };
      const B = { x: pxX(a.x2!, c), y: A.y };
      const C = { x: B.x, y: pxY(y2, c) };
      out.lines.push(...segmentLine(A, B, c, LINE_WIDTH, dash), ...segmentLine(B, C, c, LINE_WIDTH, dash), ...segmentLine(C, A, c, LINE_WIDTH, dash));
      if (!out.lines.length) return { ...out, status: "outside" };
      const dx = a.x2! - a.x!;
      const dy = y2 - y1;
      const values = !!a.showValues;
      // the labels go outside the triangle: Δx under the leg when the hypotenuse is above it, Δy beside the vertical leg, away from A
      out.texts.push(
        { text: values ? `Δx = ${readout(dx)}` : "Δx", x: (A.x + B.x) / 2, y: C.y < B.y ? A.y + 13 : A.y - 13, align: "middle", size: LABEL_FONT_SIZE },
        { text: values ? `Δy = ${readout(dy)}` : "Δy", x: B.x >= A.x ? B.x + 6 : B.x - 6, y: (B.y + C.y) / 2, align: B.x >= A.x ? "start" : "end", size: LABEL_FONT_SIZE },
      );
      return out;
    }
    case "marker": {
      if (!finite(a.x)) return { ...out, status: "undefined" };
      const y = pointY(a, c, a.x, a.y);
      if (y === "no-curve") return { ...out, status: "no-curve" };
      if (!finite(y)) return { ...out, status: "undefined" };
      const P0 = { x: pxX(a.x!, c), y: pxY(y, c) };
      if (!inside(P0, c)) return { ...out, status: "outside" };
      const s = MARKER_SIZE;
      const shape = a.shape ?? "cross";
      if (shape === "dot") out.dots.push({ ...P0, r: s - 1 });
      else if (shape === "plus") out.lines.push({ points: [P0.x - s, P0.y, P0.x + s, P0.y], width: 2 }, { points: [P0.x, P0.y - s, P0.x, P0.y + s], width: 2 });
      else out.lines.push({ points: [P0.x - s, P0.y - s, P0.x + s, P0.y + s], width: 2 }, { points: [P0.x - s, P0.y + s, P0.x + s, P0.y - s], width: 2 });
      if (a.guides) out.lines.push(...segmentLine(P0, { x: origin.x, y: P0.y }, c, 1, GUIDE_DASH), ...segmentLine(P0, { x: P0.x, y: origin.y }, c, 1, GUIDE_DASH));
      const label = a.text?.trim();
      if (label) out.texts.push({ text: label, x: P0.x + 8, y: P0.y - 11, align: "start", size: LABEL_FONT_SIZE, bold: true });
      return out;
    }
  }
}

// ---- handles ----

export type Handle = { role: "move" | "point" | "start" | "end"; x: number; y: number };

/** The places a selected annotation is picked up by, in pixels of the paper. (A text is dragged by itself.) */
export function handlesOf(a: GraphAnnotation, c: GraphConfig): Handle[] {
  switch (a.type) {
    case "asymptote":
      if (!finite(a.value)) return [];
      return a.orientation === "vertical" ? [{ role: "move", x: pxX(a.value!, c), y: 24 }] : [{ role: "move", x: c.width - 24, y: pxY(a.value!, c) }];
    case "tangent": {
      const t = tangentOf(a, c);
      return typeof t === "string" ? [] : [{ role: "point", x: pxX(t.x, c), y: pxY(t.y, c) }];
    }
    case "triangle": {
      if (!finite(a.x, a.x2)) return [];
      const y1 = pointY(a, c, a.x, a.y);
      const y2 = pointY(a, c, a.x2, a.y2);
      if (typeof y1 === "string" || typeof y2 === "string" || !finite(y1, y2)) return [];
      return [
        { role: "start", x: pxX(a.x!, c), y: pxY(y1, c) },
        { role: "end", x: pxX(a.x2!, c), y: pxY(y2, c) },
      ];
    }
    case "marker": {
      if (!finite(a.x)) return [];
      const y = pointY(a, c, a.x, a.y);
      return typeof y === "string" || !finite(y) ? [] : [{ role: "move", x: pxX(a.x!, c), y: pxY(y, c) }];
    }
    default:
      return [];
  }
}

/** What dragging a handle to graph (x, y) changes (`snap`: the step to round to, or null). A curve's own y is never set: the point slides along the curve. */
export function moveHandle(a: GraphAnnotation, role: Handle["role"], x: number, y: number, snap: number | null): Partial<GraphAnnotation> | null {
  const s = (v: number) => clean(snap && snap > 0 ? Math.round(v / snap) * snap : v);
  const onCurve = a.curveId !== undefined;
  switch (a.type) {
    case "asymptote":
      return { value: s(a.orientation === "vertical" ? x : y) };
    case "tangent":
      return { x: s(x) };
    case "triangle":
      if (role === "start") return onCurve ? { x: s(x) } : { x: s(x), y: s(y) };
      return onCurve ? { x2: s(x) } : { x2: s(x), y2: s(y) };
    case "marker":
      return onCurve ? { x: s(x) } : { x: s(x), y: s(y) };
    default:
      return null;
  }
}

/** Δx and Δy of a triangle (null if it cannot be worked out), and what a tangent's line is: y = slope·x + intercept. */
export function triangleDeltas(a: GraphAnnotation, c: GraphConfig): { dx: number; dy: number } | null {
  if (!finite(a.x, a.x2)) return null;
  const y1 = pointY(a, c, a.x, a.y);
  const y2 = pointY(a, c, a.x2, a.y2);
  return typeof y1 === "string" || typeof y2 === "string" || !finite(y1, y2) ? null : { dx: a.x2! - a.x!, dy: y2 - y1 };
}

/** The y of a marker (its own, or its curve's) or null. */
export function markerY(a: GraphAnnotation, c: GraphConfig): number | null {
  const y = pointY(a, c, a.x, a.y);
  return typeof y === "number" && Number.isFinite(y) ? y : null;
}

/** What to change in an annotation to take it off its curve and leave it where it is (its y values become its own). */
export function freeFromCurve(a: GraphAnnotation, c: GraphConfig): Partial<GraphAnnotation> {
  const fn = fnOf(a, c);
  const y = fn && finite(a.x) ? evaluateFunction(fn, a.x!) : undefined;
  const y2 = fn && finite(a.x2) ? evaluateFunction(fn, a.x2!) : undefined;
  return { curveId: undefined, ...(y !== undefined && Number.isFinite(y) ? { y: clean(y) } : {}), ...(a.type === "triangle" && y2 !== undefined && Number.isFinite(y2) ? { y2: clean(y2) } : {}) };
}
