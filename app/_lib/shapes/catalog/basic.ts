// Basic shapes: the ellipse, polygons, the pie and the arcs, the cylinder and the cube, the heart and the sun, the brackets and braces.
import { A, C, H, L, M, Q, V, Z, angleOn, clamp, ellipseHole, fitPoints, holePath, onEllipse, polygon, rectPath, regularPolygon, type Pt } from "../path";
import type { Adjust, ShapeDef, ShapePart } from "../types";
import { multi, single, val } from "./adjust";

const BASE = { category: "Basic shapes" } as const;
const sq = (n: number) => n * n;

// ---- handles that turn round the box: the pie, the chord, the arc, the block arc ----

const angles = (def: [number, number]): Adjust =>
  multi(
    def,
    (w, h, a) => [onEllipse(w / 2, h / 2, w / 2, h / 2, a[0] ?? def[0]), onEllipse(w / 2, h / 2, w / 2, h / 2, a[1] ?? def[1])],
    (i, x, y, w, h, a) => {
      const at = Math.round(angleOn(w / 2, h / 2, w / 2, h / 2, x, y));
      const next = [a[0] ?? def[0], a[1] ?? def[1]];
      next[i] = at % 360;
      return next;
    },
  );

// The angle from `from` to `to` going clockwise, 0–360 (a full turn when they are equal would be a pie of nothing: 360).
const sweepOf = (from: number, to: number) => {
  const s = (((to - from) % 360) + 360) % 360;
  return s === 0 ? 360 : s;
};

function wedge(w: number, h: number, a: readonly number[], chord: boolean, def: [number, number]): ShapePart[] {
  const cx = w / 2;
  const cy = h / 2;
  const [a0, a1] = [a[0] ?? def[0], a[1] ?? def[1]];
  const s = sweepOf(a0, a1);
  const p0 = onEllipse(cx, cy, cx, cy, a0);
  const p1 = onEllipse(cx, cy, cx, cy, a0 + s);
  if (s >= 359.9) return [{ d: M(0, cy) + A(cx, cy, 1, 1, w, cy) + A(cx, cy, 1, 1, 0, cy) + Z, paint: "fill" }];
  const arc = A(cx, cy, s > 180 ? 1 : 0, 1, p1[0], p1[1]);
  return [{ d: M(p0[0], p0[1]) + arc + (chord ? Z : L(cx, cy) + Z), paint: "fill" }];
}

// ---- brackets and braces ----

function bracket(w: number, h: number, a: readonly number[], right: boolean): string {
  const r = Math.min(val(a, 0, 0.2, 0, 0.5) * Math.min(w, h), h / 2, w);
  const X = (x: number) => (right ? w - x : x);
  const sweep = right ? 1 : 0;
  return M(X(w), 0) + H(X(r)) + A(r, r, 0, sweep, X(0), r) + V(h - r) + A(r, r, 0, sweep, X(r), h) + H(X(w));
}

// (`dx`: how far to the right the brace is drawn, for the second one of a pair)
function brace(w: number, h: number, a: readonly number[], right: boolean, dx = 0): string {
  const r = Math.min(val(a, 0, 0.2, 0, 0.5) * Math.min(w, h), h / 4);
  const k = clamp(val(a, 1, 0.5, 0, 1) * h, 2 * r, h - 2 * r);
  const X = (x: number) => dx + (right ? w - x : x);
  return M(X(w), 0) + Q(X(w / 2), 0, X(w / 2), r) + V(k - r) + Q(X(w / 2), k, X(0), k) + Q(X(w / 2), k, X(w / 2), k + r) + V(h - r) + Q(X(w / 2), h, X(w), h);
}

const bracketAdjust = (right: boolean) =>
  single(
    0.2,
    (w, h, v) => [right ? w : 0, v * Math.min(w, h)],
    (_x, y, w, h) => y / Math.max(Math.min(w, h), 1),
    0,
    0.5,
  );

const braceAdjust = multi(
  [0.2, 0.5],
  (w, h, a) => [
    [w / 2, val(a, 0, 0.2, 0, 0.5) * Math.min(w, h)],
    [0, val(a, 1, 0.5, 0, 1) * h],
  ],
  (i, _x, y, w, h, a) => (i === 0 ? [clamp(y / Math.max(Math.min(w, h), 1), 0, 0.5), a[1] ?? 0.5] : [a[0] ?? 0.2, clamp(y / Math.max(h, 1), 0.1, 0.9)]),
);

// ---- scalloped outlines (the cloud) ----

/** A cloud: `bumps` round arcs between points spread over an ellipse. Also the cloud of the callouts. */
export function cloudPath(w: number, h: number, bumps = 9): string {
  const cx = w / 2;
  const cy = h / 2;
  const rho = 0.8;
  const chord = 2 * rho * Math.sin(Math.PI / bumps);
  const r = chord * 0.62;
  const at = (i: number): Pt => [cx + rho * cx * Math.cos(-Math.PI / 2 + (2 * Math.PI * i) / bumps), cy + rho * cy * Math.sin(-Math.PI / 2 + (2 * Math.PI * i) / bumps)];
  let d = "";
  for (let i = 0; i < bumps; i++) {
    const p = at(i);
    const q = at(i + 1);
    d += (i ? "" : M(p[0], p[1])) + A(r * cx, r * cy, 0, 1, q[0], q[1]);
  }
  return d + Z;
}

const hole = (w: number, h: number, t: number) => ellipseHole(w / 2, h / 2, Math.max(w / 2 - t, 0.5), Math.max(h / 2 - t, 0.5));

const ringAdjust = single(
  0.25,
  (w, h, v) => [w / 2, v * Math.min(w, h)],
  (_x, y, w, h) => y / Math.max(Math.min(w, h), 1),
  0.02,
  0.5,
);

// The diagonal bar of the "no" sign cuts the hole in two half-moons (drawn the other way round, so that they are holes).
function noSymbol(w: number, h: number, a: readonly number[]): string {
  const cx = w / 2;
  const cy = h / 2;
  const t = val(a, 0, 0.25, 0.02, 0.5) * Math.min(w, h);
  const rho = clamp(1 - (2 * t) / Math.min(w, h), 0.05, 0.98); // the hole's radius, in units of the ellipse
  const s = (1 - rho) / 2; // half the width of the bar
  const k = Math.sqrt(Math.max(sq(rho) - sq(s), 0));
  const u = Math.SQRT1_2;
  // the bar runs along (1,1)/√2; n is the way across it
  const P = (n: number, d: number): Pt => [cx + cx * (n * u + d * u), cy + cy * (-n * u + d * u)];
  const half = (side: 1 | -1) => {
    const from = P(side * s, side === 1 ? k : -k);
    const to = P(side * s, side === 1 ? -k : k);
    return M(from[0], from[1]) + A(rho * cx, rho * cy, 0, 0, to[0], to[1]) + Z;
  };
  return M(0, cy) + A(cx, cy, 1, 1, w, cy) + A(cx, cy, 1, 1, 0, cy) + Z + half(1) + half(-1);
}

export const BASIC: ShapeDef[] = [
  { ...BASE, id: "ellipse", label: "Oval", textInset: [0.146, 0.146, 0.146, 0.146], parts: (w, h) => [{ d: M(0, h / 2) + A(w / 2, h / 2, 1, 1, w, h / 2) + A(w / 2, h / 2, 1, 1, 0, h / 2) + Z, paint: "fill" }] },
  {
    ...BASE,
    id: "triangle",
    label: "Isosceles triangle",
    textInset: [0.25, 0.5, 0.25, 0],
    adjust: single(
      0.5,
      (w, _h, v) => [v * w, 0],
      (x, _y, w) => x / Math.max(w, 1),
    ),
    parts: (w, h, a) => [
      {
        d: polygon([
          [val(a, 0, 0.5, 0, 1) * w, 0],
          [w, h],
          [0, h],
        ]),
        paint: "fill",
      },
    ],
  },
  {
    ...BASE,
    id: "rightTriangle",
    label: "Right triangle",
    textInset: [0, 0.5, 0.5, 0],
    parts: (w, h) => [
      {
        d: polygon([
          [0, 0],
          [w, h],
          [0, h],
        ]),
        paint: "fill",
      },
    ],
  },
  {
    ...BASE,
    id: "parallelogram",
    label: "Parallelogram",
    textInset: [0.12, 0, 0.12, 0],
    adjust: single(
      0.25,
      (w, _h, v) => [v * w, 0],
      (x, _y, w) => x / Math.max(w, 1),
      0,
      0.9,
    ),
    parts: (w, h, a) => {
      const o = val(a, 0, 0.25, 0, 0.9) * w;
      return [
        {
          d: polygon([
            [o, 0],
            [w, 0],
            [w - o, h],
            [0, h],
          ]),
          paint: "fill",
        },
      ];
    },
  },
  {
    ...BASE,
    id: "trapezoid",
    label: "Trapezoid",
    textInset: [0.12, 0, 0.12, 0],
    adjust: single(
      0.25,
      (w, _h, v) => [v * w, 0],
      (x, _y, w) => x / Math.max(w, 1),
      0,
      0.5,
    ),
    parts: (w, h, a) => {
      const o = val(a, 0, 0.25, 0, 0.5) * w;
      return [
        {
          d: polygon([
            [o, 0],
            [w - o, 0],
            [w, h],
            [0, h],
          ]),
          paint: "fill",
        },
      ];
    },
  },
  {
    ...BASE,
    id: "diamond",
    label: "Diamond",
    textInset: [0.25, 0.25, 0.25, 0.25],
    parts: (w, h) => [
      {
        d: polygon([
          [w / 2, 0],
          [w, h / 2],
          [w / 2, h],
          [0, h / 2],
        ]),
        paint: "fill",
      },
    ],
  },
  { ...BASE, id: "pentagon", label: "Regular pentagon", textInset: [0.18, 0.2, 0.18, 0.05], parts: (w, h) => [{ d: polygon(regularPolygon(5, w, h)), paint: "fill" }] },
  {
    ...BASE,
    id: "hexagon",
    label: "Hexagon",
    textInset: [0.12, 0, 0.12, 0],
    adjust: single(
      0.25,
      (w, _h, v) => [v * w, 0],
      (x, _y, w) => x / Math.max(w, 1),
      0,
      0.5,
    ),
    parts: (w, h, a) => {
      const o = val(a, 0, 0.25, 0, 0.5) * w;
      return [
        {
          d: polygon([
            [o, 0],
            [w - o, 0],
            [w, h / 2],
            [w - o, h],
            [o, h],
            [0, h / 2],
          ]),
          paint: "fill",
        },
      ];
    },
  },
  { ...BASE, id: "heptagon", label: "Heptagon", textInset: [0.15, 0.12, 0.15, 0.1], parts: (w, h) => [{ d: polygon(regularPolygon(7, w, h)), paint: "fill" }] },
  {
    ...BASE,
    id: "octagon",
    label: "Octagon",
    textInset: [0.1, 0.1, 0.1, 0.1],
    adjust: single(
      0.29,
      (w, h, v) => [v * Math.min(w, h), 0],
      (x, _y, w, h) => x / Math.max(Math.min(w, h), 1),
      0,
      0.5,
    ),
    parts: (w, h, a) => {
      const o = val(a, 0, 0.29, 0, 0.5) * Math.min(w, h);
      return [
        {
          d: polygon([
            [o, 0],
            [w - o, 0],
            [w, o],
            [w, h - o],
            [w - o, h],
            [o, h],
            [0, h - o],
            [0, o],
          ]),
          paint: "fill",
        },
      ];
    },
  },
  { ...BASE, id: "decagon", label: "Decagon", textInset: [0.1, 0.1, 0.1, 0.1], parts: (w, h) => [{ d: polygon(regularPolygon(10, w, h)), paint: "fill" }] },
  { ...BASE, id: "dodecagon", label: "Dodecagon", textInset: [0.1, 0.1, 0.1, 0.1], parts: (w, h) => [{ d: polygon(regularPolygon(12, w, h)), paint: "fill" }] },
  { ...BASE, id: "pie", label: "Partial circle", adjust: angles([0, 270]), textInset: [0.15, 0.15, 0.15, 0.15], parts: (w, h, a) => wedge(w, h, a, false, [0, 270]) },
  { ...BASE, id: "chord", label: "Chord", adjust: angles([45, 270]), textInset: [0.15, 0.15, 0.15, 0.15], parts: (w, h, a) => wedge(w, h, a, true, [45, 270]) },
  {
    ...BASE,
    id: "teardrop",
    label: "Teardrop",
    textInset: [0.146, 0.2, 0.146, 0.146],
    parts: (w, h) => [{ d: M(w / 2, 0) + L(w, 0) + L(w, h / 2) + A(w / 2, h / 2, 1, 1, w / 2, 0) + Z, paint: "fill" }],
  },
  {
    ...BASE,
    id: "frame",
    label: "Frame",
    adjust: single(
      0.125,
      (w, h, v) => [v * Math.min(w, h), v * Math.min(w, h)],
      (x, _y, w, h) => x / Math.max(Math.min(w, h), 1),
      0.02,
      0.5,
    ),
    parts: (w, h, a) => {
      const t = val(a, 0, 0.125, 0.02, 0.5) * Math.min(w, h);
      return [{ d: rectPath(0, 0, w, h) + holePath(t, t, Math.max(w - 2 * t, 0), Math.max(h - 2 * t, 0)), paint: "fill" }];
    },
  },
  {
    ...BASE,
    id: "halfFrame",
    label: "Half frame",
    adjust: single(
      0.33,
      (w, h, v) => [v * Math.min(w, h), v * Math.min(w, h)],
      (x, _y, w, h) => x / Math.max(Math.min(w, h), 1),
      0.05,
      0.9,
    ),
    parts: (w, h, a) => {
      const t = val(a, 0, 0.33, 0.05, 0.9) * Math.min(w, h);
      return [
        {
          d: polygon([
            [0, 0],
            [w, 0],
            [w - (t * w) / Math.max(h, 1), t],
            [t, t],
            [t, h - (t * h) / Math.max(w, 1)],
            [0, h],
          ]),
          paint: "fill",
        },
      ];
    },
  },
  {
    ...BASE,
    id: "lShape",
    label: "L-shape",
    adjust: single(
      0.5,
      (w, h, v) => [v * w, h],
      (x, _y, w) => x / Math.max(w, 1),
      0.1,
      0.9,
    ),
    parts: (w, h, a) => {
      const t = val(a, 0, 0.5, 0.1, 0.9);
      return [
        {
          d: polygon([
            [0, 0],
            [w * t, 0],
            [w * t, h * (1 - t)],
            [w, h * (1 - t)],
            [w, h],
            [0, h],
          ]),
          paint: "fill",
        },
      ];
    },
  },
  {
    ...BASE,
    id: "cross",
    label: "Cross shape",
    adjust: single(
      0.25,
      (w, h, v) => [v * Math.min(w, h), 0],
      (x, _y, w, h) => x / Math.max(Math.min(w, h), 1),
      0,
      0.5,
    ),
    parts: (w, h, a) => {
      const o = val(a, 0, 0.25, 0, 0.5) * Math.min(w, h);
      return [
        {
          d: polygon([
            [o, 0],
            [w - o, 0],
            [w - o, o],
            [w, o],
            [w, h - o],
            [w - o, h - o],
            [w - o, h],
            [o, h],
            [o, h - o],
            [0, h - o],
            [0, o],
            [o, o],
          ]),
          paint: "fill",
        },
      ];
    },
  },
  {
    ...BASE,
    id: "plaque",
    label: "Plaque",
    adjust: single(
      0.167,
      (w, h, v) => [v * Math.min(w, h), 0],
      (x, _y, w, h) => x / Math.max(Math.min(w, h), 1),
      0,
      0.5,
    ),
    textInset: [0.1, 0.1, 0.1, 0.1],
    parts: (w, h, a) => {
      const r = val(a, 0, 0.167, 0, 0.5) * Math.min(w, h);
      return [{ d: M(r, 0) + H(w - r) + A(r, r, 0, 0, w, r) + V(h - r) + A(r, r, 0, 0, w - r, h) + H(r) + A(r, r, 0, 0, 0, h - r) + V(r) + A(r, r, 0, 0, r, 0) + Z, paint: "fill" }];
    },
  },
  {
    ...BASE,
    id: "can",
    label: "Cylinder",
    textInset: [0, 0.25, 0, 0],
    adjust: single(
      0.25,
      (w, h, v) => [w / 2, 2 * v * Math.min(w, h)],
      (_x, y, w, h) => y / (2 * Math.max(Math.min(w, h), 1)),
      0,
      0.5,
    ),
    parts: (w, h, a) => {
      const e = Math.min(val(a, 0, 0.25, 0, 0.5) * Math.min(w, h), h / 2); // the height of the top ellipse's half
      return [
        { d: M(0, e) + A(w / 2, e, 0, 1, w, e) + V(h - e) + A(w / 2, e, 0, 1, 0, h - e) + Z, paint: "fill" },
        { d: M(0, e) + A(w / 2, e, 0, 0, w, e) + A(w / 2, e, 0, 0, 0, e) + Z, paint: "light" },
      ];
    },
  },
  {
    ...BASE,
    id: "cube",
    label: "Cube",
    adjust: single(
      0.25,
      (w, h, v) => [0, v * Math.min(w, h)],
      (_x, y, w, h) => y / Math.max(Math.min(w, h), 1),
      0,
      0.9,
    ),
    parts: (w, h, a) => {
      const d = val(a, 0, 0.25, 0, 0.9) * Math.min(w, h);
      return [
        { d: rectPath(0, d, w - d, h - d), paint: "fill" },
        {
          d: polygon([
            [0, d],
            [d, 0],
            [w, 0],
            [w - d, d],
          ]),
          paint: "light",
        },
        {
          d: polygon([
            [w - d, d],
            [w, 0],
            [w, h - d],
            [w - d, h],
          ]),
          paint: "dark",
        },
      ];
    },
  },
  {
    ...BASE,
    id: "bevel",
    label: "Bevel",
    adjust: single(
      0.125,
      (w, h, v) => [v * Math.min(w, h), v * Math.min(w, h)],
      (x, _y, w, h) => x / Math.max(Math.min(w, h), 1),
      0,
      0.5,
    ),
    parts: (w, h, a) => {
      const t = val(a, 0, 0.125, 0, 0.5) * Math.min(w, h);
      const tl: Pt = [t, t];
      const tr: Pt = [w - t, t];
      const br: Pt = [w - t, h - t];
      const bl: Pt = [t, h - t];
      return [
        { d: rectPath(0, 0, w, h), paint: "fill" },
        { d: polygon([[0, 0], [w, 0], tr, tl]), paint: "light" },
        { d: polygon([[0, 0], tl, bl, [0, h]]), paint: "light" },
        { d: polygon([[w, 0], [w, h], br, tr]), paint: "dark" },
        { d: polygon([[0, h], bl, br, [w, h]]), paint: "dark" },
        { d: rectPath(t, t, Math.max(w - 2 * t, 0), Math.max(h - 2 * t, 0)), paint: "fill" },
      ];
    },
  },
  {
    ...BASE,
    id: "donut",
    label: "Donut",
    adjust: ringAdjust,
    parts: (w, h, a) => {
      const t = val(a, 0, 0.25, 0.02, 0.5) * Math.min(w, h);
      return [{ d: M(0, h / 2) + A(w / 2, h / 2, 1, 1, w, h / 2) + A(w / 2, h / 2, 1, 1, 0, h / 2) + Z + hole(w, h, t), paint: "fill" }];
    },
  },
  { ...BASE, id: "noSymbol", label: "\"No\" symbol", adjust: ringAdjust, parts: (w, h, a) => [{ d: noSymbol(w, h, a), paint: "fill" }] },
  {
    ...BASE,
    id: "blockArc",
    label: "Block arc",
    adjust: multi(
      [180, 0, 0.25],
      (w, h, a) => {
        const t = val(a, 2, 0.25, 0.02, 0.5) * Math.min(w, h);
        return [onEllipse(w / 2, h / 2, w / 2, h / 2, a[0] ?? 180), onEllipse(w / 2, h / 2, w / 2, h / 2, a[1] ?? 0), onEllipse(w / 2, h / 2, w / 2 - t, h / 2 - t, a[0] ?? 180)];
      },
      (i, x, y, w, h, a) => {
        const next = [a[0] ?? 180, a[1] ?? 0, a[2] ?? 0.25];
        if (i < 2) next[i] = Math.round(angleOn(w / 2, h / 2, w / 2, h / 2, x, y)) % 360;
        else next[2] = clamp((w / 2 - Math.hypot(x - w / 2, ((y - h / 2) * (w / 2)) / Math.max(h / 2, 1))) / Math.max(Math.min(w, h), 1), 0.02, 0.5);
        return next;
      },
    ),
    parts: (w, h, a) => {
      const cx = w / 2;
      const cy = h / 2;
      const t = val(a, 2, 0.25, 0.02, 0.5) * Math.min(w, h);
      const [a0, a1] = [a[0] ?? 180, a[1] ?? 0];
      const s = sweepOf(a0, a1);
      const o0 = onEllipse(cx, cy, cx, cy, a0);
      const o1 = onEllipse(cx, cy, cx, cy, a0 + s);
      const rx = Math.max(cx - t, 0.5);
      const ry = Math.max(cy - t, 0.5);
      const i0 = onEllipse(cx, cy, rx, ry, a0);
      const i1 = onEllipse(cx, cy, rx, ry, a0 + s);
      const large = s > 180 ? 1 : 0;
      return [{ d: M(o0[0], o0[1]) + A(cx, cy, large, 1, o1[0], o1[1]) + L(i1[0], i1[1]) + A(rx, ry, large, 0, i0[0], i0[1]) + Z, paint: "fill" }];
    },
  },
  {
    ...BASE,
    id: "foldedCorner",
    label: "Folded corner",
    adjust: single(
      0.16667,
      (w, h, v) => [w - v * Math.min(w, h), h],
      (x, _y, w, h) => (w - x) / Math.max(Math.min(w, h), 1),
      0,
      0.5,
    ),
    parts: (w, h, a) => {
      const f = val(a, 0, 0.16667, 0, 0.5) * Math.min(w, h);
      return [
        {
          d: polygon([
            [0, 0],
            [w, 0],
            [w, h - f],
            [w - f, h],
            [0, h],
          ]),
          paint: "fill",
        },
        {
          d: polygon([
            [w - f, h],
            [w, h - f],
            [w - f, h - f],
          ]),
          paint: "dark",
        },
      ];
    },
  },
  {
    ...BASE,
    id: "smiley",
    label: "Smiley face",
    textInset: [0.1, 0.1, 0.1, 0.1],
    parts: (w, h) => {
      const eye = (x: number) => M(x - w * 0.055, h * 0.36) + A(w * 0.055, h * 0.075, 1, 1, x + w * 0.055, h * 0.36) + A(w * 0.055, h * 0.075, 1, 1, x - w * 0.055, h * 0.36) + Z;
      return [
        { d: M(0, h / 2) + A(w / 2, h / 2, 1, 1, w, h / 2) + A(w / 2, h / 2, 1, 1, 0, h / 2) + Z, paint: "fill" },
        { d: eye(w * 0.34) + eye(w * 0.66), paint: "solid" },
        { d: M(w * 0.23, h * 0.6) + C(w * 0.33, h * 0.83, w * 0.67, h * 0.83, w * 0.77, h * 0.6), paint: "line" },
      ];
    },
  },
  {
    ...BASE,
    id: "heart",
    label: "Heart",
    textInset: [0.18, 0.15, 0.18, 0.25],
    parts: (w, h) => [
      {
        d:
          M(w / 2, h * 0.28) +
          C(w / 2, h * 0.12, w * 0.38, 0, w * 0.25, 0) +
          C(w * 0.1, 0, 0, h * 0.12, 0, h * 0.3) +
          C(0, h * 0.55, w * 0.35, h * 0.75, w / 2, h) +
          C(w * 0.65, h * 0.75, w, h * 0.55, w, h * 0.3) +
          C(w, h * 0.12, w * 0.9, 0, w * 0.75, 0) +
          C(w * 0.62, 0, w / 2, h * 0.12, w / 2, h * 0.28) +
          Z,
        paint: "fill",
      },
    ],
  },
  {
    ...BASE,
    id: "lightning",
    label: "Lightning bolt",
    textInset: [0.25, 0.2, 0.25, 0.2],
    parts: (w, h) => [
      {
        d: polygon(
          fitPoints(
            [
              [0.39, 0],
              [0.6, 0.28],
              [0.51, 0.31],
              [0.77, 0.56],
              [0.68, 0.6],
              [1, 1],
              [0.47, 0.69],
              [0.54, 0.65],
              [0.23, 0.45],
              [0.33, 0.38],
              [0, 0.17],
            ],
            w,
            h,
          ),
        ),
        paint: "fill",
      },
    ],
  },
  {
    ...BASE,
    id: "sun",
    label: "Sun",
    adjust: single(
      0.25,
      (w, h, v) => [w / 2 - v * w, h / 2],
      (x, _y, w) => (w / 2 - x) / Math.max(w, 1),
      0.1,
      0.45,
    ),
    textInset: [0.25, 0.25, 0.25, 0.25],
    parts: (w, h, a) => {
      const cx = w / 2;
      const cy = h / 2;
      const k = val(a, 0, 0.25, 0.1, 0.45);
      const rx = k * w;
      const ry = k * h;
      const rays = Array.from({ length: 8 }, (_, i) => {
        const ang = (Math.PI * 2 * i) / 8;
        const tip: Pt = [cx + Math.cos(ang) * cx * 0.98, cy + Math.sin(ang) * cy * 0.98];
        const base = (d: number): Pt => [cx + Math.cos(ang + d) * rx * 1.15, cy + Math.sin(ang + d) * ry * 1.15];
        return polygon([tip, base(0.22), base(-0.22)]);
      }).join("");
      return [
        { d: rays, paint: "fill" },
        { d: M(cx - rx, cy) + A(rx, ry, 1, 1, cx + rx, cy) + A(rx, ry, 1, 1, cx - rx, cy) + Z, paint: "fill" },
      ];
    },
  },
  {
    ...BASE,
    id: "moon",
    label: "Moon",
    textInset: [0.3, 0.15, 0, 0.15],
    adjust: single(
      0.5,
      (w, h, v) => [v * w, h / 2],
      (x, _y, w) => x / Math.max(w, 1),
      0.1,
      0.9,
    ),
    parts: (w, h, a) => {
      const t = val(a, 0, 0.5, 0.1, 0.9) * w;
      return [{ d: M(w, 0) + A(w, h / 2, 0, 0, w, h) + A(w - t, h / 2, 0, 1, w, 0) + Z, paint: "fill" }];
    },
  },
  { ...BASE, id: "cloud", label: "Cloud", textInset: [0.15, 0.2, 0.15, 0.2], parts: (w, h) => [{ d: cloudPath(w, h), paint: "fill" }] },
  {
    ...BASE,
    id: "arc",
    label: "Arc",
    adjust: angles([270, 0]),
    parts: (w, h, a) => {
      const cx = w / 2;
      const cy = h / 2;
      const [a0, a1] = [a[0] ?? 270, a[1] ?? 0];
      const s = sweepOf(a0, a1);
      const p0 = onEllipse(cx, cy, cx, cy, a0);
      const p1 = onEllipse(cx, cy, cx, cy, a0 + s);
      return [{ d: M(p0[0], p0[1]) + A(cx, cy, s > 180 ? 1 : 0, 1, p1[0], p1[1]), paint: "line" }];
    },
  },
  { ...BASE, id: "leftBracket", label: "Left bracket", adjust: bracketAdjust(false), size: [30, 120], parts: (w, h, a) => [{ d: bracket(w, h, a, false), paint: "line" }] },
  { ...BASE, id: "rightBracket", label: "Right bracket", adjust: bracketAdjust(true), size: [30, 120], parts: (w, h, a) => [{ d: bracket(w, h, a, true), paint: "line" }] },
  { ...BASE, id: "leftBrace", label: "Left brace", adjust: braceAdjust, size: [30, 120], parts: (w, h, a) => [{ d: brace(w, h, a, false), paint: "line" }] },
  { ...BASE, id: "rightBrace", label: "Right brace", adjust: braceAdjust, size: [30, 120], parts: (w, h, a) => [{ d: brace(w, h, a, true), paint: "line" }] },
  {
    ...BASE,
    id: "bracketPair",
    label: "Double bracket",
    adjust: bracketAdjust(false),
    textInset: [0.05, 0, 0.05, 0],
    size: [140, 70],
    parts: (w, h, a) => {
      const r = Math.min(val(a, 0, 0.2, 0, 0.5) * Math.min(w, h), w / 2, h / 2);
      return [
        { d: M(r, 0) + A(r, r, 0, 0, 0, r) + V(h - r) + A(r, r, 0, 0, r, h), paint: "line" },
        { d: M(w - r, 0) + A(r, r, 0, 1, w, r) + V(h - r) + A(r, r, 0, 1, w - r, h), paint: "line" },
      ];
    },
  },
  {
    ...BASE,
    id: "bracePair",
    label: "Double brace",
    adjust: braceAdjust,
    textInset: [0.1, 0, 0.1, 0],
    size: [140, 70],
    parts: (w, h, a) => {
      const bw = Math.min(w * 0.12, 24);
      return [
        { d: brace(bw, h, a, false), paint: "line" },
        { d: brace(bw, h, a, true, w - bw), paint: "line" },
      ];
    },
  },
];
