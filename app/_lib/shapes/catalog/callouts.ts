// Callouts: a box, an oval or a cloud with a pointer, or a box with a line, to a point (the yellow handle) that can be anywhere.
// The values are the point's place as fractions of the box, from its centre: (−0.2083, 0.625) is just below and left of the box.
import { A, H, L, M, V, Z, clamp, ellipsePath, onEllipse, polygon, type Pt } from "../path";
import type { Adjust, ShapeDef, ShapePart } from "../types";
import { cloudPath } from "./basic";

const BASE = { category: "Callouts" } as const;
const DEF: readonly [number, number] = [-0.2083, 0.625];

const tipAdjust: Adjust = {
  defaults: DEF,
  handles: (w, h, a) => [[w * (0.5 + (a[0] ?? DEF[0])), h * (0.5 + (a[1] ?? DEF[1]))]],
  drag: (_i, x, y, w, h) => [clamp(x / Math.max(w, 1) - 0.5, -1.5, 2.5), clamp(y / Math.max(h, 1) - 0.5, -1.5, 2.5)],
};

const tipOf = (w: number, h: number, a: readonly number[]): Pt => [w * (0.5 + (a[0] ?? DEF[0])), h * (0.5 + (a[1] ?? DEF[1]))];

type Side = "top" | "right" | "bottom" | "left";
const sideOf = (w: number, h: number, tip: Pt): Side => {
  const dx = (tip[0] - w / 2) / Math.max(w / 2, 1);
  const dy = (tip[1] - h / 2) / Math.max(h / 2, 1);
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "top" : "bottom";
};

// A rectangle (corners of radius r) with a pointer from the side that faces the tip.
function wedgeRect(w: number, h: number, r: number, tip: Pt): string {
  const k = clamp(r, 0, Math.min(w, h) / 2);
  const side = sideOf(w, h, tip);
  const [tx, ty] = tip;
  const lo = (a: number, b: number) => clamp(a, k, b - k);
  const xs = tx < w / 2 ? [lo(w / 6, w), lo((5 * w) / 12, w)] : [lo((7 * w) / 12, w), lo((5 * w) / 6, w)];
  const ys = ty < h / 2 ? [lo(h / 6, h), lo((5 * h) / 12, h)] : [lo((7 * h) / 12, h), lo((5 * h) / 6, h)];
  const arc = (x: number, y: number) => (k > 0.01 ? A(k, k, 0, 1, x, y) : "");
  return (
    M(k, 0) +
    (side === "top" ? L(xs[0], 0) + L(tx, ty) + L(xs[1], 0) : "") +
    H(w - k) +
    arc(w, k) +
    (side === "right" ? L(w, ys[0]) + L(tx, ty) + L(w, ys[1]) : "") +
    V(h - k) +
    arc(w - k, h) +
    (side === "bottom" ? L(xs[1], h) + L(tx, ty) + L(xs[0], h) : "") +
    H(k) +
    arc(0, h - k) +
    (side === "left" ? L(0, ys[1]) + L(tx, ty) + L(0, ys[0]) : "") +
    V(k) +
    arc(k, 0) +
    Z
  );
}

// An ellipse with a pointer.
function wedgeEllipse(w: number, h: number, tip: Pt): string {
  const cx = w / 2;
  const cy = h / 2;
  const theta = (Math.atan2((tip[1] - cy) / Math.max(cy, 1), (tip[0] - cx) / Math.max(cx, 1)) * 180) / Math.PI;
  const spread = 22;
  const p0 = onEllipse(cx, cy, cx, cy, theta + spread);
  const p1 = onEllipse(cx, cy, cx, cy, theta - spread);
  return M(p0[0], p0[1]) + A(cx, cy, 1, 1, p1[0], p1[1]) + L(tip[0], tip[1]) + Z;
}

// Where a line from the box meets it: the middle of the side that faces the tip.
function anchor(w: number, h: number, tip: Pt): { at: Pt; side: Side } {
  const side = sideOf(w, h, tip);
  const at: Pt = side === "top" ? [w / 2, 0] : side === "bottom" ? [w / 2, h] : side === "left" ? [0, h / 2] : [w, h / 2];
  return { at, side };
}

function bubbles(w: number, h: number, tip: Pt): string {
  const cx = w / 2;
  const cy = h / 2;
  const dx = (tip[0] - cx) / Math.max(cx, 1);
  const dy = (tip[1] - cy) / Math.max(cy, 1);
  if (Math.hypot(dx, dy) < 1) return "";
  const theta = Math.atan2(dy, dx);
  const edge: Pt = [cx + Math.cos(theta) * cx * 0.8, cy + Math.sin(theta) * cy * 0.8];
  const m = Math.min(w, h);
  return [
    [0.3, 0.085],
    [0.62, 0.06],
    [0.92, 0.04],
  ]
    .map(([t, r]) => {
      const x = edge[0] + (tip[0] - edge[0]) * t;
      const y = edge[1] + (tip[1] - edge[1]) * t;
      return ellipsePath(x, y, r * m, r * m);
    })
    .join("");
}

const fill = (d: string): ShapePart => ({ d, paint: "fill" });

export const CALLOUTS: ShapeDef[] = [
  { ...BASE, id: "calloutRect", label: "Speech bubble: rectangle", adjust: tipAdjust, parts: (w, h, a) => [fill(wedgeRect(w, h, 0, tipOf(w, h, a)))] },
  {
    ...BASE,
    id: "calloutRoundRect",
    label: "Speech bubble: rectangle with corners rounded",
    adjust: tipAdjust,
    parts: (w, h, a) => [fill(wedgeRect(w, h, Math.min(w, h) * 0.1667, tipOf(w, h, a)))],
  },
  { ...BASE, id: "calloutOval", label: "Speech bubble: oval", adjust: tipAdjust, textInset: [0.146, 0.146, 0.146, 0.146], parts: (w, h, a) => [fill(wedgeEllipse(w, h, tipOf(w, h, a)))] },
  {
    ...BASE,
    id: "calloutCloud",
    label: "Thought bubble: cloud",
    adjust: tipAdjust,
    textInset: [0.15, 0.2, 0.15, 0.2],
    parts: (w, h, a) => [fill(cloudPath(w, h)), fill(bubbles(w, h, tipOf(w, h, a)))],
  },
  {
    ...BASE,
    id: "calloutLine1",
    label: "Callout: line",
    adjust: tipAdjust,
    parts: (w, h, a) => {
      const tip = tipOf(w, h, a);
      const { at } = anchor(w, h, tip);
      return [fill(polygon([[0, 0], [w, 0], [w, h], [0, h]])), { d: M(at[0], at[1]) + L(tip[0], tip[1]), paint: "line" }];
    },
  },
  {
    ...BASE,
    id: "calloutLine2",
    label: "Callout: bent line",
    adjust: tipAdjust,
    parts: (w, h, a) => {
      const tip = tipOf(w, h, a);
      const { at, side } = anchor(w, h, tip);
      const bend: Pt = side === "left" || side === "right" ? [(at[0] + tip[0]) / 2, at[1]] : [at[0], (at[1] + tip[1]) / 2];
      return [fill(polygon([[0, 0], [w, 0], [w, h], [0, h]])), { d: M(at[0], at[1]) + L(bend[0], bend[1]) + L(tip[0], tip[1]), paint: "line" }];
    },
  },
];
