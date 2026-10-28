// Stars and banners: stars of 4 to 32 points (a handle sets how deep the notches are), the explosions, waves, scrolls and ribbons.
import { A, L, M, Z, clamp, polygon, polyline, starPoints, type Pt } from "../path";
import type { ShapeDef, ShapePart } from "../types";
import { multi, single, val } from "./adjust";

const BASE = { category: "Stars and banners" } as const;
const fill = (d: string): ShapePart[] => [{ d, paint: "fill" }];

// How deep the notches are (as a fraction of the points' radius) when the shape is new.
const INNER: Record<number, number> = { 4: 0.38, 5: 0.382, 6: 0.55, 7: 0.5, 8: 0.62, 10: 0.7, 12: 0.78, 16: 0.84, 24: 0.9, 32: 0.93 };

const star = (n: number): ShapeDef => ({
  ...BASE,
  id: `star${n}`,
  label: `${n}-point star`,
  textInset: n >= 8 ? [0.2, 0.2, 0.2, 0.2] : [0.25, 0.3, 0.25, 0.15],
  adjust: multi(
    [INNER[n]],
    (w, h, a) => [starPoints(n, val(a, 0, INNER[n], 0.05, 0.97), w, h)[1]],
    (_i, x, y, w, h) => [clamp(Math.hypot((x - w / 2) / Math.max(w / 2, 1), (y - h / 2) / Math.max(h / 2, 1)), 0.05, 0.97)],
  ),
  parts: (w, h, a) => fill(polygon(starPoints(n, val(a, 0, INNER[n], 0.05, 0.97), w, h))),
});

// The irregular stars of PowerPoint's "Explosion" shapes, on a 21600 grid.
const EXPLOSION_1: Pt[] = [[10800, 5800], [14522, 0], [14155, 5325], [18380, 4457], [16702, 7315], [21097, 8137], [17607, 10475], [21600, 13290], [16837, 12942], [18145, 18095], [14020, 14457], [13247, 19737], [10532, 15627], [8485, 21600], [7715, 15627], [4762, 17617], [5667, 13937], [135, 14587], [3722, 11775], [0, 8615], [5627, 7617], [2850, 2295], [6537, 6320], [8320, 1]];
const EXPLOSION_2: Pt[] = [[11462, 4342], [14790, 0], [14525, 5777], [18007, 3172], [16380, 6532], [21600, 6645], [16985, 9402], [18270, 11290], [16380, 12310], [18877, 15632], [14640, 14350], [14942, 17370], [12180, 15935], [11612, 18842], [9872, 17370], [8700, 19712], [7527, 18125], [4917, 21600], [4805, 18240], [1285, 17825], [3330, 15370], [0, 12877], [3935, 11592], [1172, 8270], [5372, 7817], [4502, 3625], [8550, 4382], [9722, 1887]];
const grid = (pts: Pt[], w: number, h: number) => pts.map(([x, y]) => [(x / 21600) * w, (y / 21600) * h] as const);

// A wavy band: the top edge is a sine of `periods` periods and the bottom edge is the same, `h - 2·amp` lower.
function wave(w: number, h: number, a: readonly number[], periods: number): string {
  const amp = val(a, 0, 0.125, 0, 0.2) * h;
  const n = 36 * periods;
  const top = (x: number) => amp - amp * Math.sin((2 * Math.PI * periods * x) / w);
  const xs = Array.from({ length: n + 1 }, (_, i) => (i / n) * w);
  const down = h - 2 * amp;
  return polyline(xs.map((x) => [x, top(x)] as const)) + polyline(xs.map((x) => [x, top(x) + down] as const).reverse()).replace(/^M/, "L") + Z;
}

const waveAdjust = single(
  0.125,
  (w, h, v) => [w / 4, v * h],
  (_x, y, _w, h) => y / Math.max(h, 1),
  0,
  0.2,
);

// A pill (a roll of paper): a rectangle with half-round ends.
const pill = (x: number, y: number, w: number, h: number) => {
  const r = Math.min(h / 2, w / 2);
  return M(x + r, y) + L(x + w - r, y) + A(r, r, 0, 1, x + w - r, y + h) + L(x + r, y + h) + A(r, r, 0, 1, x + r, y) + Z;
};

// A scroll: the sheet between two rolls. `vertical` = the rolls are at the top and bottom edges.
function scroll(w: number, h: number, a: readonly number[], vertical: boolean): ShapePart[] {
  const m = Math.min(w, h);
  const c = val(a, 0, 0.125, 0.04, 0.3) * m;
  if (vertical) {
    return [
      { d: polygon([[c * 0.9, c], [w - c * 0.9, c], [w - c * 0.9, h - c], [c * 0.9, h - c]]), paint: "fill" },
      { d: pill(0, 0, w, 2 * c), paint: "dark" },
      { d: pill(0, h - 2 * c, w, 2 * c), paint: "dark" },
    ];
  }
  const roll = (x: number) => pill2(x, 0, 2 * c, h);
  return [
    { d: polygon([[c, c * 0.9], [w - c, c * 0.9], [w - c, h - c * 0.9], [c, h - c * 0.9]]), paint: "fill" },
    { d: roll(0), paint: "dark" },
    { d: roll(w - 2 * c), paint: "dark" },
  ];
}

// A vertical pill.
const pill2 = (x: number, y: number, w: number, h: number) => {
  const r = Math.min(w / 2, h / 2);
  return M(x, y + r) + A(r, r, 0, 1, x + w, y + r) + L(x + w, y + h - r) + A(r, r, 0, 1, x, y + h - r) + Z;
};

const scrollAdjust = single(
  0.125,
  (w, h, v) => [v * Math.min(w, h), 0],
  (x, _y, w, h) => x / Math.max(Math.min(w, h), 1),
  0.04,
  0.3,
);

// A ribbon: a panel across the middle, two tails that fold behind it. `up` = the tails are higher than the panel.
function ribbon(w: number, h: number, a: readonly number[], up: boolean): ShapePart[] {
  const cw = val(a, 0, 0.2, 0.1, 0.35) * w;
  const f = cw * 0.42;
  const Y = (y: number) => (up ? h - y : y);
  const panel = polygon([[cw, Y(0)], [w - cw, Y(0)], [w - cw, Y(h * 0.7)], [cw, Y(h * 0.7)]]);
  const tail = (left: boolean) => {
    const X = (x: number) => (left ? x : w - x);
    return polygon([[X(0), Y(h * 0.3)], [X(cw + f), Y(h * 0.3)], [X(cw + f), Y(h)], [X(0), Y(h)], [X(cw * 0.35), Y(h * 0.65)]]);
  };
  const fold = (left: boolean) => {
    const X = (x: number) => (left ? x : w - x);
    return polygon([[X(cw), Y(h * 0.7)], [X(cw + f), Y(h * 0.7)], [X(cw + f), Y(h)]]);
  };
  return [
    { d: tail(true), paint: "fill" },
    { d: tail(false), paint: "fill" },
    { d: panel, paint: "fill" },
    { d: fold(true), paint: "dark" },
    { d: fold(false), paint: "dark" },
  ];
}

const ribbonAdjust = single(
  0.2,
  (w, _h, v) => [v * w, 0],
  (x, _y, w) => x / Math.max(w, 1),
  0.1,
  0.35,
);

export const STARS: ShapeDef[] = [
  ...[4, 5, 6, 7, 8, 10, 12, 16, 24, 32].map(star),
  { ...BASE, id: "explosion1", label: "Explosion 1", textInset: [0.2, 0.25, 0.2, 0.2], parts: (w, h) => fill(polygon(grid(EXPLOSION_1, w, h))) },
  { ...BASE, id: "explosion2", label: "Explosion 2", textInset: [0.2, 0.25, 0.2, 0.2], parts: (w, h) => fill(polygon(grid(EXPLOSION_2, w, h))) },
  { ...BASE, id: "wave", label: "Wave", adjust: waveAdjust, textInset: [0, 0.15, 0, 0.15], parts: (w, h, a) => fill(wave(w, h, a, 1)) },
  { ...BASE, id: "doubleWave", label: "Double wave", adjust: waveAdjust, textInset: [0, 0.15, 0, 0.15], parts: (w, h, a) => fill(wave(w, h, a, 2)) },
  { ...BASE, id: "verticalScroll", label: "Scroll: vertical", adjust: scrollAdjust, size: [100, 120], textInset: [0.1, 0.15, 0.1, 0.15], parts: (w, h, a) => scroll(w, h, a, true) },
  { ...BASE, id: "horizontalScroll", label: "Scroll: horizontal", adjust: scrollAdjust, size: [140, 90], textInset: [0.15, 0.1, 0.15, 0.1], parts: (w, h, a) => scroll(w, h, a, false) },
  { ...BASE, id: "ribbonDown", label: "Ribbon: tilted down", adjust: ribbonAdjust, size: [160, 90], textInset: [0.2, 0, 0.2, 0.3], parts: (w, h, a) => ribbon(w, h, a, false) },
  { ...BASE, id: "ribbonUp", label: "Ribbon: tilted up", adjust: ribbonAdjust, size: [160, 90], textInset: [0.2, 0.3, 0.2, 0], parts: (w, h, a) => ribbon(w, h, a, true) },
];
