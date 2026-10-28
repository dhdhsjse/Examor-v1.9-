// Block arrows. The straight ones are written once, pointing right, and turned (left, up, down) by mapping their points; the
// others are written out. Two handles on most: the thickness of the shaft and the length of the head.
import { A, H, L, M, V, Z, clamp, polygon, type Pt } from "../path";
import type { Adjust, ShapeDef } from "../types";
import { multi, val } from "./adjust";

const BASE = { category: "Block arrows" } as const;
const fill = (d: string) => [{ d, paint: "fill" as const }];

type Dir = "right" | "left" | "up" | "down";

// A right arrow drawn in a box of W×H, mapped into the real box for another direction (vertical ones are drawn in the turned box).
const turn = (dir: Dir, w: number, h: number) => {
  switch (dir) {
    case "right":
      return { W: w, H: h, to: (x: number, y: number): Pt => [x, y], from: (x: number, y: number): Pt => [x, y] };
    case "left":
      return { W: w, H: h, to: (x: number, y: number): Pt => [w - x, y], from: (x: number, y: number): Pt => [w - x, y] };
    case "down":
      return { W: h, H: w, to: (x: number, y: number): Pt => [w - y, x], from: (x: number, y: number): Pt => [y, w - x] };
    case "up":
      return { W: h, H: w, to: (x: number, y: number): Pt => [y, h - x], from: (x: number, y: number): Pt => [h - y, x] };
  }
};

const THICK = 0.5; // the shaft, as a fraction of the arrow's height
const HEAD = 0.5; // the head's length, as a fraction of the shorter side

const arrowAdjust = (dir: Dir): Adjust =>
  multi(
    [THICK, HEAD],
    (w, h, a) => {
      const T = turn(dir, w, h);
      const t = val(a, 0, THICK, 0.05, 1) * T.H;
      const hl = Math.min(val(a, 1, HEAD, 0, 1) * Math.min(T.W, T.H), T.W);
      return [T.to(T.W - hl, (T.H - t) / 2), T.to(T.W - hl, 0)];
    },
    (i, x, y, w, h, a) => {
      const T = turn(dir, w, h);
      const [px, py] = T.from(x, y);
      const next = [a[0] ?? THICK, a[1] ?? HEAD];
      if (i === 0) {
        next[0] = clamp((T.H - 2 * py) / Math.max(T.H, 1), 0.05, 1);
        next[1] = clamp((T.W - px) / Math.max(Math.min(T.W, T.H), 1), 0, 1);
      } else {
        next[1] = clamp((T.W - px) / Math.max(Math.min(T.W, T.H), 1), 0, 1);
      }
      return next;
    },
  );

function rightArrow(dir: Dir): ShapeDef["parts"] {
  return (w, h, a) => {
    const T = turn(dir, w, h);
    const t = val(a, 0, THICK, 0.05, 1) * T.H;
    const hl = Math.min(val(a, 1, HEAD, 0, 1) * Math.min(T.W, T.H), T.W);
    const y0 = (T.H - t) / 2;
    const pts: Pt[] = [
      [0, y0],
      [T.W - hl, y0],
      [T.W - hl, 0],
      [T.W, T.H / 2],
      [T.W - hl, T.H],
      [T.W - hl, y0 + t],
      [0, y0 + t],
    ];
    return fill(polygon(pts.map(([x, y]) => T.to(x, y))));
  };
}

// An arrow at both ends, across (left-right) or down (up-down).
function doubleArrow(vertical: boolean): ShapeDef["parts"] {
  return (w, h, a) => {
    const T = vertical ? turn("down", w, h) : turn("right", w, h);
    const t = val(a, 0, THICK, 0.05, 1) * T.H;
    const hl = Math.min(val(a, 1, HEAD, 0, 1) * Math.min(T.W, T.H), T.W / 2);
    const y0 = (T.H - t) / 2;
    const pts: Pt[] = [
      [hl, 0],
      [0, T.H / 2],
      [hl, T.H],
      [hl, y0 + t],
      [T.W - hl, y0 + t],
      [T.W - hl, T.H],
      [T.W, T.H / 2],
      [T.W - hl, 0],
      [T.W - hl, y0],
      [hl, y0],
    ];
    return fill(polygon(pts.map(([x, y]) => T.to(x, y))));
  };
}

const doubleAdjust = (vertical: boolean): Adjust =>
  multi(
    [THICK, HEAD],
    (w, h, a) => {
      const T = vertical ? turn("down", w, h) : turn("right", w, h);
      const t = val(a, 0, THICK, 0.05, 1) * T.H;
      const hl = Math.min(val(a, 1, HEAD, 0, 1) * Math.min(T.W, T.H), T.W / 2);
      return [T.to(T.W - hl, (T.H - t) / 2), T.to(T.W - hl, 0)];
    },
    (i, x, y, w, h, a) => {
      const T = vertical ? turn("down", w, h) : turn("right", w, h);
      const [px, py] = T.from(x, y);
      const next = [a[0] ?? THICK, a[1] ?? HEAD];
      if (i === 0) next[0] = clamp((T.H - 2 * py) / Math.max(T.H, 1), 0.05, 1);
      next[1] = clamp((T.W - px) / Math.max(Math.min(T.W, T.H), 1), 0, 0.5 * (T.W / Math.max(Math.min(T.W, T.H), 1)));
      return next;
    },
  );

const QUAD_T = 0.22;
const QUAD_H = 0.22;

// The four-way arrow: the thickness of the arms (a handle on the corner of the middle) and the length of the heads.
const quadAdjust: Adjust = multi(
  [QUAD_T, QUAD_H],
  (w, h, a) => {
    const m = Math.min(w, h);
    const t = val(a, 0, QUAD_T, 0.05, 0.6) * m;
    const hl = val(a, 1, QUAD_H, 0.05, 0.5) * m;
    return [
      [w / 2 + t / 2, h / 2 - t / 2],
      [w / 2, hl],
    ];
  },
  (i, x, y, w, h, a) => {
    const m = Math.max(Math.min(w, h), 1);
    const next = [a[0] ?? QUAD_T, a[1] ?? QUAD_H];
    if (i === 0) next[0] = clamp((2 * (x - w / 2)) / m, 0.05, 0.6);
    else next[1] = clamp(y / m, 0.05, 0.5);
    return next;
  },
);

// The bent arrows: thickness t, half the width of the head hw, length of the head hl (fractions of the shorter side).
type Dims = { m: number; t: number; hw: number; hl: number };
const dims = (w: number, h: number, a: readonly number[], d: readonly number[]): Dims => {
  const m = Math.min(w, h);
  const t = val(a, 0, d[0], 0.05, 0.6) * m;
  const hw = Math.max(val(a, 1, d[1], 0.05, 0.5) * m, t / 2 + 1);
  const hl = val(a, 2, d[2], 0.05, 0.6) * m;
  return { m, t, hw, hl };
};

const cornerArrow = (
  defaults: readonly number[],
  at: (w: number, h: number, d: Dims) => [Pt, Pt],
  set: (i: number, x: number, y: number, w: number, h: number, d: Dims) => Partial<Record<"t" | "hw" | "hl", number>>,
): Adjust =>
  multi(
    defaults,
    (w, h, a) => at(w, h, dims(w, h, a, defaults)),
    (i, x, y, w, h, a) => {
      const d = dims(w, h, a, defaults);
      const m = Math.max(d.m, 1);
      const got = set(i, x, y, w, h, d);
      return [clamp((got.t ?? d.t) / m, 0.05, 0.6), clamp((got.hw ?? d.hw) / m, 0.05, 0.5), clamp((got.hl ?? d.hl) / m, 0.05, 0.6), a[3] ?? defaults[3] ?? 0].slice(0, Math.max(defaults.length, 3));
    },
  );

const CORNER = [0.25, 0.25, 0.25] as const;
const bentAdjust = cornerArrow(
  CORNER,
  (w, h, d) => [
    [d.t, (h + d.hw + d.t / 2) / 2],
    [w - d.hl, 2 * d.hw],
  ],
  (i, x, y, w) => (i === 0 ? { t: x } : { hl: w - x, hw: y / 2 }),
);
const bentUpAdjust = cornerArrow(
  CORNER,
  (w, h, d) => [
    [w - d.hw - d.t / 2, (h + d.hl) / 2],
    [w - 2 * d.hw, d.hl],
  ],
  (i, x, y, w, _h, d) => (i === 0 ? { t: 2 * (w - d.hw - x) } : { hw: (w - x) / 2, hl: y }),
);
const leftUpAdjust = cornerArrow(
  CORNER,
  (w, h, d) => [
    [w - d.hw - d.t / 2, (d.hl + h - d.hw) / 2],
    [w - 2 * d.hw, d.hl],
  ],
  (i, x, y, w, _h, d) => (i === 0 ? { t: 2 * (w - d.hw - x) } : { hw: (w - x) / 2, hl: y }),
);
const uTurnAdjust = cornerArrow(
  [0.25, 0.25, 0.25, 0.43],
  (w, h, d) => [
    [d.t, h * 0.85],
    [w - 2 * d.hw, Math.max(h * 0.75, d.hl + d.t) - d.hl],
  ],
  (i, x, y, w, h, d) => (i === 0 ? { t: x } : { hw: (w - x) / 2, hl: Math.max(h * 0.75, d.hl + d.t) - y }),
);

function quad(w: number, h: number, a: readonly number[]) {
  const m = Math.min(w, h);
  const t = val(a, 0, QUAD_T, 0.05, 0.6) * m;
  const hl = val(a, 1, QUAD_H, 0.05, 0.5) * m;
  const hw = Math.min(t * 0.9 + hl * 0.2, m / 2);
  const cx = w / 2;
  const cy = h / 2;
  const pts: Pt[] = [
    [cx, 0],
    [cx + hw, hl],
    [cx + t / 2, hl],
    [cx + t / 2, cy - t / 2],
    [w - hl, cy - t / 2],
    [w - hl, cy - hw],
    [w, cy],
    [w - hl, cy + hw],
    [w - hl, cy + t / 2],
    [cx + t / 2, cy + t / 2],
    [cx + t / 2, h - hl],
    [cx + hw, h - hl],
    [cx, h],
    [cx - hw, h - hl],
    [cx - t / 2, h - hl],
    [cx - t / 2, cy + t / 2],
    [hl, cy + t / 2],
    [hl, cy + hw],
    [0, cy],
    [hl, cy - hw],
    [hl, cy - t / 2],
    [cx - t / 2, cy - t / 2],
    [cx - t / 2, hl],
    [cx - hw, hl],
  ];
  return fill(polygon(pts));
}

// "Bent arrow": up the left side, then right, ending in a head pointing right.
function bent(w: number, h: number, a: readonly number[]) {
  const { t, hw, hl: hl0 } = dims(w, h, a, CORNER);
  const hl = Math.min(hl0, w);
  const pts: Pt[] = [
    [0, h],
    [0, hw - t / 2],
    [w - hl, hw - t / 2],
    [w - hl, 0],
    [w, hw],
    [w - hl, 2 * hw],
    [w - hl, hw + t / 2],
    [t, hw + t / 2],
    [t, h],
  ];
  return fill(polygon(pts));
}

// "Bent-up arrow": along the bottom, then up the right side, ending in a head pointing up.
function bentUp(w: number, h: number, a: readonly number[]) {
  const { t, hw, hl: hl0 } = dims(w, h, a, CORNER);
  const hl = Math.min(hl0, h);
  const cx = w - hw;
  const pts: Pt[] = [
    [0, h - t],
    [cx - t / 2, h - t],
    [cx - t / 2, hl],
    [cx - hw, hl],
    [cx, 0],
    [cx + hw, hl],
    [cx + t / 2, hl],
    [cx + t / 2, h],
    [0, h],
  ];
  return fill(polygon(pts));
}

// "Left-up arrow": one arm to the left and one up, meeting at the bottom-right corner.
function leftUp(w: number, h: number, a: readonly number[]) {
  const { t, hw, hl } = dims(w, h, a, CORNER);
  const cx = w - hw;
  const cy = h - hw;
  const pts: Pt[] = [
    [cx, 0],
    [cx + hw, hl],
    [cx + t / 2, hl],
    [cx + t / 2, cy + t / 2],
    [hl, cy + t / 2],
    [hl, cy + hw],
    [0, cy],
    [hl, cy - hw],
    [hl, cy - t / 2],
    [cx - t / 2, cy - t / 2],
    [cx - t / 2, hl],
    [cx - hw, hl],
  ];
  return fill(polygon(pts));
}

// "U-turn arrow": up the left side, over, and down the right side to a head pointing down.
function uTurn(w: number, h: number, a: readonly number[]) {
  const { m, t, hw: hw0, hl } = dims(w, h, a, [0.25, 0.25, 0.25]);
  const hw = Math.min(hw0, w / 2);
  const xo0 = w - hw + t / 2;
  const R = Math.min(Math.max(val(a, 3, 0.43, 0.05, 1) * m * 0.5, t), xo0 / 2);
  const Ri = Math.max(R - t, 0);
  const ty = Math.max(h * 0.75, hl + t); // where the head's tip is
  const xr = w - hw; // the right leg's centre line
  const xo = xr + t / 2;
  const xi = xr - t / 2;
  const d =
    M(0, h) +
    V(R) +
    A(R, R, 0, 1, R, 0) +
    H(xo - R) +
    A(R, R, 0, 1, xo, R) +
    V(ty - hl) +
    H(xr + hw) +
    L(xr, ty) +
    L(xr - hw, ty - hl) +
    H(xi) +
    V(R) +
    (Ri > 0.5 ? A(Ri, Ri, 0, 0, xi - Ri, t) : "") +
    H(t + Ri) +
    (Ri > 0.5 ? A(Ri, Ri, 0, 0, t, t + Ri) : "") +
    V(h) +
    Z;
  return fill(d);
}

export const ARROWS: ShapeDef[] = [
  { ...BASE, id: "rightArrow", label: "Right arrow", adjust: arrowAdjust("right"), parts: rightArrow("right") },
  { ...BASE, id: "leftArrow", label: "Left arrow", adjust: arrowAdjust("left"), parts: rightArrow("left") },
  { ...BASE, id: "upArrow", label: "Up arrow", adjust: arrowAdjust("up"), size: [90, 120], parts: rightArrow("up") },
  { ...BASE, id: "downArrow", label: "Down arrow", adjust: arrowAdjust("down"), size: [90, 120], parts: rightArrow("down") },
  { ...BASE, id: "leftRightArrow", label: "Left-right arrow", adjust: doubleAdjust(false), parts: doubleArrow(false) },
  { ...BASE, id: "upDownArrow", label: "Up-down arrow", adjust: doubleAdjust(true), size: [90, 120], parts: doubleArrow(true) },
  { ...BASE, id: "quadArrow", label: "Four-way arrow", adjust: quadAdjust, size: [120, 120], parts: (w, h, a) => quad(w, h, a) },
  { ...BASE, id: "bentArrow", label: "Bent arrow", adjust: bentAdjust, size: [110, 110], parts: (w, h, a) => bent(w, h, a) },
  { ...BASE, id: "uTurnArrow", label: "U-turn arrow", adjust: uTurnAdjust, size: [110, 110], parts: (w, h, a) => uTurn(w, h, a) },
  { ...BASE, id: "leftUpArrow", label: "Left-up arrow", adjust: leftUpAdjust, size: [110, 110], parts: (w, h, a) => leftUp(w, h, a) },
  { ...BASE, id: "bentUpArrow", label: "Bent-up arrow", adjust: bentUpAdjust, size: [110, 110], parts: (w, h, a) => bentUp(w, h, a) },
  {
    ...BASE,
    id: "stripedRightArrow",
    label: "Striped right arrow",
    adjust: arrowAdjust("right"),
    parts: (w, h, a) => {
      const t = val(a, 0, THICK, 0.05, 1) * h;
      const hl = Math.min(val(a, 1, HEAD, 0, 1) * Math.min(w, h), w * 0.7);
      const x0 = w * 0.22;
      const y0 = (h - t) / 2;
      const pts: Pt[] = [
        [x0, y0],
        [w - hl, y0],
        [w - hl, 0],
        [w, h / 2],
        [w - hl, h],
        [w - hl, y0 + t],
        [x0, y0 + t],
      ];
      const stripe = (x: number, sw: number) => polygon([[x, y0], [x + sw, y0], [x + sw, y0 + t], [x, y0 + t]]);
      return fill(polygon(pts) + stripe(0, w * 0.05) + stripe(w * 0.09, w * 0.08));
    },
  },
  {
    ...BASE,
    id: "notchedRightArrow",
    label: "Notched right arrow",
    adjust: arrowAdjust("right"),
    parts: (w, h, a) => {
      const t = val(a, 0, THICK, 0.05, 1) * h;
      const hl = Math.min(val(a, 1, HEAD, 0, 1) * Math.min(w, h), w);
      const y0 = (h - t) / 2;
      const n = Math.min(t / 2, w - hl);
      return fill(
        polygon([
          [0, y0],
          [w - hl, y0],
          [w - hl, 0],
          [w, h / 2],
          [w - hl, h],
          [w - hl, y0 + t],
          [0, y0 + t],
          [n, h / 2],
        ]),
      );
    },
  },
  {
    ...BASE,
    id: "homePlate",
    label: "Pentagon arrow",
    textInset: [0, 0, 0.12, 0],
    adjust: multi(
      [0.5],
      (w, h, a) => [[w - val(a, 0, 0.5, 0, 1) * Math.min(w, h), 0]],
      (_i, x, _y, w, h) => [clamp((w - x) / Math.max(Math.min(w, h), 1), 0, 1)],
    ),
    parts: (w, h, a) => {
      const d = Math.min(val(a, 0, 0.5, 0, 1) * Math.min(w, h), w);
      return fill(
        polygon([
          [0, 0],
          [w - d, 0],
          [w, h / 2],
          [w - d, h],
          [0, h],
        ]),
      );
    },
  },
  {
    ...BASE,
    id: "chevron",
    label: "Chevron",
    textInset: [0.12, 0, 0.12, 0],
    adjust: multi(
      [0.5],
      (w, h, a) => [[w - val(a, 0, 0.5, 0, 1) * Math.min(w, h), 0]],
      (_i, x, _y, w, h) => [clamp((w - x) / Math.max(Math.min(w, h), 1), 0, 1)],
    ),
    parts: (w, h, a) => {
      const d = Math.min(val(a, 0, 0.5, 0, 1) * Math.min(w, h), w);
      return fill(
        polygon([
          [0, 0],
          [w - d, 0],
          [w, h / 2],
          [w - d, h],
          [0, h],
          [d, h / 2],
        ]),
      );
    },
  },
  {
    ...BASE,
    id: "rightArrowCallout",
    label: "Right arrow callout",
    size: [150, 90],
    textInset: [0, 0, 0.35, 0],
    adjust: multi(
      [0.64, 0.25, 0.25],
      (w, h, a) => {
        const bx = val(a, 0, 0.64, 0.2, 0.9) * w;
        const hl = val(a, 2, 0.25, 0.05, 0.5) * Math.min(w, h);
        return [
          [bx, h / 2],
          [w - hl, 0],
        ];
      },
      (i, x, _y, w, h, a) => {
        const next = [a[0] ?? 0.64, a[1] ?? 0.25, a[2] ?? 0.25];
        if (i === 0) next[0] = clamp(x / Math.max(w, 1), 0.2, 0.9);
        else next[2] = clamp((w - x) / Math.max(Math.min(w, h), 1), 0.05, 0.5);
        return next;
      },
    ),
    parts: (w, h, a) => {
      const bx = val(a, 0, 0.64, 0.2, 0.9) * w;
      const t = val(a, 1, 0.25, 0.05, 0.6) * h;
      const hl = Math.min(val(a, 2, 0.25, 0.05, 0.5) * Math.min(w, h), w - bx);
      const hw = Math.min(t / 2 + hl * 0.5, h / 2);
      const cy = h / 2;
      return fill(
        polygon([
          [0, 0],
          [bx, 0],
          [bx, cy - t / 2],
          [w - hl, cy - t / 2],
          [w - hl, cy - hw],
          [w, cy],
          [w - hl, cy + hw],
          [w - hl, cy + t / 2],
          [bx, cy + t / 2],
          [bx, h],
          [0, h],
        ]),
      );
    },
  },
];
