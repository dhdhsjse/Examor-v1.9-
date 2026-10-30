// Equation shapes: plus, minus, multiply, divide, equal, not equal. Each is one outline (the not-equal sign is the union of the
// two bars and the slash, worked out, so that no inner line shows).
import { A, M, Z, clamp, polygon, rectPath, type Pt } from "../path";
import type { ShapeDef } from "../types";
import { multi, single, val } from "./adjust";

const BASE = { category: "Equation shapes" } as const;
const fill = (d: string) => [{ d, paint: "fill" as const }];

const thickness = (def: number) =>
  single(
    def,
    (w, h, v) => [w / 2, h / 2 - v * Math.min(w, h) * 0.5],
    (_x, y, w, h) => ((h / 2 - y) * 2) / Math.max(Math.min(w, h), 1),
    0.05,
    0.9,
  );

// Not equal: bars of thickness t at y1..y2 and y3..y4, and a slash leaning to the right.
function notEqual(w: number, h: number, a: readonly number[]): string {
  const m = Math.min(w, h);
  const t = val(a, 0, 0.1176, 0.03, 0.4) * m;
  const gap = val(a, 1, 0.1176, 0.03, 0.4) * m;
  const cy = h / 2;
  const y1 = cy - gap / 2 - t;
  const y2 = cy - gap / 2;
  const y3 = cy + gap / 2;
  const y4 = cy + gap / 2 + t;
  // the slash: its left edge goes from (xl0, h) to (xl1, 0); its right edge is `sw` to the right of it
  const lean = w * 0.28;
  const sw = Math.max(t * 1.05, 6);
  const xl = (y: number) => w / 2 - sw / 2 - lean / 2 + lean * (1 - y / h);
  const xr = (y: number) => xl(y) + sw;
  const pts: Pt[] = [
    [xl(0), 0],
    [xr(0), 0],
    [xr(y1), y1],
    [w, y1],
    [w, y2],
    [xr(y2), y2],
    [xr(y3), y3],
    [w, y3],
    [w, y4],
    [xr(y4), y4],
    [xr(h), h],
    [xl(h), h],
    [xl(y4), y4],
    [0, y4],
    [0, y3],
    [xl(y3), y3],
    [xl(y2), y2],
    [0, y2],
    [0, y1],
    [xl(y1), y1],
  ];
  return polygon(pts);
}

export const EQUATION: ShapeDef[] = [
  {
    ...BASE,
    id: "mathPlus",
    label: "Plus",
    adjust: thickness(0.2352),
    parts: (w, h, a) => {
      const m = Math.min(w, h);
      const t = val(a, 0, 0.2352, 0.05, 0.9) * m;
      const cx = w / 2;
      const cy = h / 2;
      return fill(
        polygon([
          [cx - t / 2, 0],
          [cx + t / 2, 0],
          [cx + t / 2, cy - t / 2],
          [w, cy - t / 2],
          [w, cy + t / 2],
          [cx + t / 2, cy + t / 2],
          [cx + t / 2, h],
          [cx - t / 2, h],
          [cx - t / 2, cy + t / 2],
          [0, cy + t / 2],
          [0, cy - t / 2],
          [cx - t / 2, cy - t / 2],
        ]),
      );
    },
  },
  {
    ...BASE,
    id: "mathMinus",
    label: "Minus",
    adjust: thickness(0.2352),
    parts: (w, h, a) => {
      const t = val(a, 0, 0.2352, 0.05, 0.9) * Math.min(w, h);
      return fill(rectPath(0, (h - t) / 2, w, t));
    },
  },
  {
    ...BASE,
    id: "mathMultiply",
    label: "Multiply",
    adjust: single(
      0.2352,
      (w, h, v) => [w * (0.5 - v * 0.5), h * 0],
      (x, _y, w) => ((0.5 - x / Math.max(w, 1)) * 2) / 1,
      0.05,
      0.6,
    ),
    parts: (w, h, a) => {
      const e = val(a, 0, 0.2352, 0.05, 0.6) * 0.7071 * 0.8;
      const unit: Pt[] = [
        [e, 0],
        [0.5, 0.5 - e],
        [1 - e, 0],
        [1, e],
        [0.5 + e, 0.5],
        [1, 1 - e],
        [1 - e, 1],
        [0.5, 0.5 + e],
        [e, 1],
        [0, 1 - e],
        [0.5 - e, 0.5],
        [0, e],
      ];
      return fill(polygon(unit.map(([x, y]) => [x * w, y * h] as const)));
    },
  },
  {
    ...BASE,
    id: "mathDivide",
    label: "Divide",
    adjust: single(
      0.2352,
      (w, h, v) => [w / 2, h / 2 - (v * Math.min(w, h)) / 2],
      (_x, y, w, h) => ((h / 2 - y) * 2) / Math.max(Math.min(w, h), 1),
      0.05,
      0.5,
    ),
    parts: (w, h, a) => {
      const m = Math.min(w, h);
      const t = val(a, 0, 0.2352, 0.05, 0.5) * m;
      const r = clamp(t * 0.62, 2, m / 4);
      const dy = Math.min(h / 2 - r, t / 2 + r * 1.6);
      const dot = (cy: number) => M(w / 2 - r, cy) + A(r, r, 1, 1, w / 2 + r, cy) + A(r, r, 1, 1, w / 2 - r, cy) + Z;
      return [
        { d: rectPath(0, (h - t) / 2, w, t), paint: "fill" },
        { d: dot(h / 2 - dy) + dot(h / 2 + dy), paint: "fill" },
      ];
    },
  },
  {
    ...BASE,
    id: "mathEqual",
    label: "Equal",
    adjust: multi(
      [0.2352, 0.1176],
      (w, h, a) => {
        const m = Math.min(w, h);
        const t = val(a, 0, 0.2352, 0.05, 0.4) * m;
        const g = val(a, 1, 0.1176, 0.03, 0.4) * m;
        return [
          [w / 2, h / 2 - g / 2 - t],
          [w / 2, h / 2 - g / 2],
        ];
      },
      (i, _x, y, w, h, a) => {
        const m = Math.max(Math.min(w, h), 1);
        const t = val(a, 0, 0.2352, 0.05, 0.4);
        const g = val(a, 1, 0.1176, 0.03, 0.4);
        if (i === 1) return [t, clamp(((h / 2 - y) * 2) / m, 0.03, 0.4)];
        return [clamp((h / 2 - g * m * 0.5 - y) / m, 0.05, 0.4), g];
      },
    ),
    parts: (w, h, a) => {
      const m = Math.min(w, h);
      const t = val(a, 0, 0.2352, 0.05, 0.4) * m;
      const g = val(a, 1, 0.1176, 0.03, 0.4) * m;
      return fill(rectPath(0, h / 2 - g / 2 - t, w, t) + rectPath(0, h / 2 + g / 2, w, t));
    },
  },
  {
    ...BASE,
    id: "mathNotEqual",
    label: "Not equal",
    adjust: multi(
      [0.1176, 0.1176],
      (w, h, a) => {
        const m = Math.min(w, h);
        const t = val(a, 0, 0.1176, 0.03, 0.4) * m;
        const g = val(a, 1, 0.1176, 0.03, 0.4) * m;
        return [
          [w * 0.12, h / 2 - g / 2 - t],
          [w * 0.12, h / 2 - g / 2],
        ];
      },
      (i, _x, y, w, h, a) => {
        const m = Math.max(Math.min(w, h), 1);
        const t = val(a, 0, 0.1176, 0.03, 0.4);
        const g = val(a, 1, 0.1176, 0.03, 0.4);
        if (i === 1) return [t, clamp(((h / 2 - y) * 2) / m, 0.03, 0.4)];
        return [clamp((h / 2 - g * m * 0.5 - y) / m, 0.03, 0.4), g];
      },
    ),
    parts: (w, h, a) => fill(notEqual(w, h, a)),
  },
];
