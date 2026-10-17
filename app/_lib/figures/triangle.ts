import { angleMark, bool, centroid, clamp, cornerNames, fit, ink, label, num, outside, poly, rad, str, sub, svg, unit, type Pt } from "./svg";
import type { FigureDef, Params } from "./types";

// Angles of the ready shapes (A, B, C).
const SHAPES: Record<string, [number, number, number]> = {
  right: [35, 90, 55],
  isosceles: [40, 70, 70],
  equilateral: [60, 60, 60],
  "right-isosceles": [45, 90, 45],
  obtuse: [25, 120, 35],
};

const ANGLES = ["A", "B", "C"] as const;

// The teacher's names for the corners, for the labels of the settings ("Angle P", "Length QR").
const names3 = (p: Params) => cornerNames(str(p, "names", "ABC"), 3).map((n, i) => n || ANGLES[i]);
const corner = (i: number) => (p: Params) => ({ name: names3(p)[i] });
const side = (i: number, j: number) => (p: Params) => ({ name: names3(p)[i] + names3(p)[j] });

// The angles always make 180°: the one changed keeps its value, the next one makes up the rest.
function normalize(p: Params, changed: string): Params {
  const next = { ...p };
  if (changed === "shape") {
    const s = SHAPES[String(p.shape)];
    if (s) ANGLES.forEach((k, i) => (next[k] = s[i]));
    return next;
  }
  if (!ANGLES.includes(changed as (typeof ANGLES)[number])) return next;
  const follow = changed === "C" ? "B" : "C";
  const other = ANGLES.find((k) => k !== changed && k !== follow)!;
  const v = clamp(Math.round(num(p, changed, 60)), 1, 178);
  const o = clamp(Math.round(num(p, other, 60)), 1, 179 - v);
  next[changed] = v;
  next[other] = o;
  next[follow] = 180 - v - o;
  next.shape = Object.entries(SHAPES).find(([, s]) => s[0] === next.A && s[1] === next.B && s[2] === next.C)?.[0] ?? "custom";
  return next;
}

export const triangleFigure: FigureDef = {
  id: "triangle",
  name: "Triangle",
  hint: "Change any angle: the others adjust so they add up to 180°.",
  params: [
    {
      key: "shape",
      label: "Shape",
      kind: "select",
      options: [
        { value: "custom", label: "Custom" },
        { value: "right", label: "Right" },
        { value: "isosceles", label: "Isosceles" },
        { value: "equilateral", label: "Equilateral" },
        { value: "right-isosceles", label: "Right isosceles" },
        { value: "obtuse", label: "Obtuse" },
      ],
    },
    { key: "A", label: "Angle {name}", vars: corner(0), kind: "number", min: 1, max: 178, unit: "°", row: "angles" },
    { key: "B", label: "Angle {name}", vars: corner(1), kind: "number", min: 1, max: 178, unit: "°", row: "angles" },
    { key: "C", label: "Angle {name}", vars: corner(2), kind: "number", min: 1, max: 178, unit: "°", row: "angles" },
    { key: "names", label: "Corner names", kind: "text", placeholder: "ABC" },
    { key: "marks", label: "Mark the angles", kind: "bool" },
    { key: "values", label: "Write the angle values", kind: "bool" },
    { key: "sideBC", label: "Length {name}", vars: side(1, 2), kind: "text", placeholder: "5 cm", row: "sides" },
    { key: "sideCA", label: "Length {name}", vars: side(2, 0), kind: "text", row: "sides" },
    { key: "sideAB", label: "Length {name}", vars: side(0, 1), kind: "text", row: "sides" },
  ],
  defaults: (lang) => ({ shape: "right", A: 35, B: 90, C: 55, names: lang === "ar" ? "أ ب ج" : "ABC", marks: true, values: false, sideBC: "", sideCA: "", sideAB: "" }),
  normalize,
  build: (p) => {
    const color = ink(p);
    const [A, B, C] = ANGLES.map((k) => clamp(num(p, k, 60), 1, 178));
    // BC is the base (length 1); A from the law of sines.
    const c = Math.sin(rad(C)) / Math.sin(rad(A));
    const math: Pt[] = [[c * Math.cos(rad(B)), c * Math.sin(rad(B))], [0, 0], [1, 0]];
    const sideLabels = ["sideBC", "sideCA", "sideAB"].some((k) => str(p, k).trim());
    const { pts, w, h } = fit(math, 250, 200, sideLabels ? 46 : 34);
    const [pA, pB, pC] = pts;
    const g = centroid(pts);
    const names = cornerNames(str(p, "names", "ABC"), 3);
    const shortest = Math.min(Math.hypot(pA[0] - pB[0], pA[1] - pB[1]), Math.hypot(pB[0] - pC[0], pB[1] - pC[1]), Math.hypot(pA[0] - pC[0], pA[1] - pC[1]));
    const r = clamp(shortest * 0.22, 9, 22);

    let body = poly(pts);
    const corners: [Pt, Pt, Pt, number][] = [
      [pA, pB, pC, A],
      [pB, pA, pC, B],
      [pC, pA, pB, C],
    ];
    corners.forEach(([v, a, b, deg], i) => {
      const m = angleMark(v, a, b, r, color);
      // A right angle always gets its square; the other marks only when asked.
      if (bool(p, "marks") || Math.round(deg) === 90) body += m.path;
      if (bool(p, "values")) body += label(m.at, `${Math.round(deg)}°`, color, 12);
      body += label(outside(v, g, 15), names[i], color, 15, { bold: true });
    });
    // Side lengths, outside the middle of each side.
    ([
      ["sideBC", pB, pC],
      ["sideCA", pC, pA],
      ["sideAB", pA, pB],
    ] as const).forEach(([key, a, b]) => {
      const s = str(p, key).trim();
      if (!s) return;
      // Beside a steep side the label moves out by half its width, so it doesn't sit on the line.
      const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const away = unit(sub(mid, g));
      body += label(outside(mid, g, 12 + Math.abs(away[0]) * s.length * 3.3), s, color, 13, { italic: true });
    });
    return svg(w, h, body, color);
  },
};
