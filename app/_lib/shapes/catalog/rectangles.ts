// Rectangles: square, rounded, cut and mixed corners. One handle on the top edge sets the size of the corners.
import { A, H, M, V, Z, polygon, rectPath, roundedRect } from "../path";
import type { ShapeDef } from "../types";
import { cornerAdjust, val } from "./adjust";

const BASE = { category: "Rectangles" } as const;
const radius = (w: number, h: number, a: readonly number[], def: number) => val(a, 0, def, 0, 0.5) * Math.min(w, h);

export const RECTANGLES: ShapeDef[] = [
  { ...BASE, id: "rect", label: "Rectangle", parts: (w, h) => [{ d: rectPath(0, 0, w, h), paint: "fill" }] },
  { ...BASE, id: "roundRect", label: "Rounded rectangle", adjust: cornerAdjust(0.1667), parts: (w, h, a) => [{ d: roundedRect(w, h, radius(w, h, a, 0.1667)), paint: "fill" }] },
  {
    ...BASE,
    id: "snip1Rect",
    label: "Snip single corner rectangle",
    adjust: cornerAdjust(0.2),
    parts: (w, h, a) => {
      const s = radius(w, h, a, 0.2);
      return [
        {
          d: polygon([
            [0, 0],
            [w - s, 0],
            [w, s],
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
    id: "snip2SameRect",
    label: "Snip same-side corner rectangle",
    adjust: cornerAdjust(0.2),
    parts: (w, h, a) => {
      const s = radius(w, h, a, 0.2);
      return [
        {
          d: polygon([
            [s, 0],
            [w - s, 0],
            [w, s],
            [w, h],
            [0, h],
            [0, s],
          ]),
          paint: "fill",
        },
      ];
    },
  },
  {
    ...BASE,
    id: "snip2DiagRect",
    label: "Snip diagonal corner rectangle",
    adjust: cornerAdjust(0.2),
    parts: (w, h, a) => {
      const s = radius(w, h, a, 0.2);
      return [
        {
          d: polygon([
            [0, 0],
            [w - s, 0],
            [w, s],
            [w, h],
            [s, h],
            [0, h - s],
          ]),
          paint: "fill",
        },
      ];
    },
  },
  {
    ...BASE,
    id: "round1Rect",
    label: "Round single corner rectangle",
    adjust: cornerAdjust(0.2),
    parts: (w, h, a) => {
      const r = radius(w, h, a, 0.2);
      return [{ d: M(0, 0) + H(w - r) + A(r, r, 0, 1, w, r) + V(h) + H(0) + Z, paint: "fill" }];
    },
  },
  {
    ...BASE,
    id: "round2SameRect",
    label: "Round same-side corner rectangle",
    adjust: cornerAdjust(0.2),
    parts: (w, h, a) => {
      const r = radius(w, h, a, 0.2);
      return [{ d: M(r, 0) + H(w - r) + A(r, r, 0, 1, w, r) + V(h) + H(0) + V(r) + A(r, r, 0, 1, r, 0) + Z, paint: "fill" }];
    },
  },
  {
    ...BASE,
    id: "round2DiagRect",
    label: "Round diagonal corner rectangle",
    adjust: cornerAdjust(0.2),
    parts: (w, h, a) => {
      const r = radius(w, h, a, 0.2);
      return [{ d: M(r, 0) + H(w) + V(h - r) + A(r, r, 0, 1, w - r, h) + H(0) + V(r) + A(r, r, 0, 1, r, 0) + Z, paint: "fill" }];
    },
  },
];
