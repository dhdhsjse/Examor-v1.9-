// Work and energy: the work of a force and of the weight, tracks, straight-line graphs (Ec = f(v²), G = f(C)…), the simple
// pendulum, the spring and its mass, energy curves, the calorimeter, heating curves, energy transfer diagrams.
import { bool, clamp, fmt, ink, num, r1, rad, str, svg, type Pt } from "../svg";
import type { FigureDef } from "../types";
import { labeledFigure } from "../sciences/labeled";
import { LIQUID, SOLID, chem, cross, curve, dashed, disc, frame, ground, hatched, head, path, say, seg, spring, surface, tr, vecName, vector } from "./draw";

// ---- Work of a constant force ----
export const workFigure: FigureDef = {
  id: "pc-work",
  name: "Work of a constant force",
  params: [
    { key: "angle", label: "Angle α between F and AB", kind: "number", min: 0, max: 180, unit: "°" },
    { key: "displacement", label: "Displacement vector AB", kind: "bool", row: "o" },
    { key: "sign", label: "Kind of work", kind: "bool", row: "o" },
  ],
  defaults: () => ({ angle: 30, displacement: true, sign: false }),
  build: (p, lang) => {
    const c = ink(p);
    const a = clamp(num(p, "angle", 30), 0, 180);
    const A: Pt = [70, 170];
    const B: Pt = [400, 170];
    let s = ground(30, 450, 190);
    s += `<rect x="${A[0] - 30}" y="${A[1] - 20}" width="60" height="40" fill="${SOLID}" stroke-width="2"/>`;
    s += `<rect x="${B[0] - 30}" y="${B[1] - 20}" width="60" height="40" stroke-width="1.2" stroke-dasharray="5 4"/>`;
    s += disc(A, 2.5, c, `stroke="none"`) + disc(B, 2.5, c, `stroke="none"`);
    s += say(A[0], A[1] + 46, "A", { size: 14, anchor: "middle", fill: c, bold: true }) + say(B[0], B[1] + 46, "B", { size: 14, anchor: "middle", fill: c, bold: true });
    const tip: Pt = [A[0] + Math.cos(rad(a)) * 120, A[1] - Math.sin(rad(a)) * 120];
    s += vector(A, tip, c, 2.4) + vecName(tip[0] + (a > 90 ? -14 : 12), tip[1] - 6, "F", c, { size: 16 });
    s += dashed(A, [A[0] + 150, A[1]], 1);
    if (a > 0) {
      const r = 42;
      s += `<path d="M${A[0] + r} ${A[1]}A${r} ${r} 0 0 0 ${r1(A[0] + Math.cos(rad(a)) * r)} ${r1(A[1] - Math.sin(rad(a)) * r)}" stroke-width="1.3"/>`;
      s += say(A[0] + Math.cos(rad(a / 2)) * (r + 14), A[1] - Math.sin(rad(a / 2)) * (r + 14) + 5, "α", { size: 15, anchor: "middle", fill: c, italic: true });
    }
    if (bool(p, "displacement")) s += vector([A[0], 230], [B[0], 230], c, 1.6) + vecName((A[0] + B[0]) / 2, 252, "AB", c, { size: 14 });
    if (bool(p, "sign")) {
      const k = Math.abs(a - 90) < 0.5 ? { fr: "W = 0 : travail nul", ar: "W = 0 : شغل منعدم" } : a < 90 ? { fr: "W > 0 : travail moteur", ar: "W > 0 : شغل محرك" } : { fr: "W < 0 : travail résistant", ar: "W < 0 : شغل مقاوم" };
      s += say(450, 30, tr(lang, k), { size: 13, anchor: "end", fill: c, bold: true });
    }
    return svg(470, bool(p, "displacement") ? 266 : 210, s, c);
  },
};

// ---- Work of the weight ----
export const workWeightFigure: FigureDef = {
  id: "pc-work-weight",
  name: "Work of the weight",
  params: [
    {
      key: "path",
      label: "Path",
      kind: "select",
      options: [
        { value: "curve", label: "Any curve" },
        { value: "straight", label: "Straight slope" },
      ],
    },
    { key: "heights", label: "Heights zA and zB", kind: "bool", row: "o" },
    { key: "weight", label: "Weight P", kind: "bool", row: "o" },
  ],
  defaults: () => ({ path: "curve", heights: true, weight: true }),
  build: (p) => {
    const c = ink(p);
    const A: Pt = [150, 70];
    const B: Pt = [420, 230];
    let s = `<path d="M50 270V20" stroke-width="1.5"/>` + head([50, 14], -90, c) + say(40, 24, "z", { size: 14, anchor: "end", fill: c, bold: true });
    s += `<path d="M44 270H470" stroke-width="1.2"/>` + say(40, 274, "O", { size: 13, anchor: "end", fill: c, bold: true });
    if (str(p, "path") === "straight") s += seg(A, B, `stroke-width="2"`);
    else s += `<path d="M${A[0]} ${A[1]}C220 40 230 200 300 190S380 150 ${B[0]} ${B[1]}" stroke-width="2"/>`;
    s += disc(A, 4, c, `stroke="none"`) + disc(B, 4, c, `stroke="none"`);
    s += say(A[0] - 8, A[1] - 10, "A", { size: 14, anchor: "end", fill: c, bold: true }) + say(B[0] + 10, B[1] - 8, "B", { size: 14, fill: c, bold: true });
    if (bool(p, "heights")) {
      s += dashed(A, [50, A[1]], 1) + dashed(B, [50, B[1]], 1);
      s += chem(44, A[1] + 4, "zA", { size: 13, anchor: "end", fill: c }) + chem(44, B[1] + 4, "zB", { size: 13, anchor: "end", fill: c });
      s += vector([470, (A[1] + B[1]) / 2], [470, A[1]], c, 1.2) + vector([470, (A[1] + B[1]) / 2], [470, B[1]], c, 1.2) + dashed(B, [480, B[1]], 0.8) + dashed([A[0], A[1]], [480, A[1]], 0.8);
      s += say(478, (A[1] + B[1]) / 2 + 5, "h", { size: 15, fill: c, italic: true });
    }
    if (bool(p, "weight")) s += vector(A, [A[0], A[1] + 70], c, 2.2) + vecName(A[0] + 16, A[1] + 64, "P", c, { size: 15 });
    return svg(500, 290, s, c);
  },
};

// ---- Tracks ----
export const trackFigure: FigureDef = {
  id: "pc-track",
  name: "Track",
  params: [
    {
      key: "shape",
      label: "Track",
      kind: "select",
      options: [
        { value: "slope-flat", label: "Slope, then flat" },
        { value: "flat-slope", label: "Flat, then up a slope" },
        { value: "slope-arc", label: "Slope, then a circular part" },
        { value: "arc-flat", label: "Quarter circle, then flat" },
      ],
    },
    { key: "angle", label: "Slope angle", kind: "number", min: 10, max: 45, unit: "°", when: (p) => p.shape !== "arc-flat" },
    { key: "ball", label: "A ball (not a block)", kind: "bool" },
  ],
  defaults: () => ({ shape: "slope-flat", angle: 25, ball: false }),
  build: (p) => {
    const c = ink(p);
    const shape = str(p, "shape", "slope-flat");
    const a = rad(clamp(num(p, "angle", 25), 10, 45));
    let s = "";
    const pt = (q: Pt, name: string, dx = 0, dy = 22) => disc(q, 3, c, `stroke="none"`) + say(q[0] + dx, q[1] + dy, name, { size: 14, anchor: "middle", fill: c, bold: true });
    const solid = (q: Pt, deg: number) =>
      bool(p, "ball")
        ? disc([q[0] + Math.sin(rad(deg)) * 14, q[1] - Math.cos(rad(deg)) * 14], 14, SOLID, `stroke-width="2"`)
        : `<rect x="${r1(q[0] - 18)}" y="${r1(q[1] - 24)}" width="36" height="24" fill="${SOLID}" stroke-width="2" transform="rotate(${r1(deg)} ${r1(q[0])} ${r1(q[1])})"/>`;
    const angleMark = (o: Pt, from: number, to: number, txt: string) => {
      const r = 40;
      return `<path d="M${r1(o[0] + r * Math.cos(from))} ${r1(o[1] - r * Math.sin(from))}A${r} ${r} 0 0 ${to > from ? 0 : 1} ${r1(o[0] + r * Math.cos(to))} ${r1(o[1] - r * Math.sin(to))}" stroke-width="1.2"/>` + say(o[0] + (r + 12) * Math.cos((from + to) / 2), o[1] - (r + 12) * Math.sin((from + to) / 2) + 5, txt, { size: 15, anchor: "middle", fill: c, italic: true });
    };
    if (shape === "slope-flat" || shape === "slope-arc") {
      const B: Pt = [260, 250];
      const L = 230;
      const A: Pt = [B[0] - L * Math.cos(a), B[1] - L * Math.sin(a)];
      s += seg(A, B, `stroke-width="2.4"`) + dashed(B, [B[0] - 120, B[1]], 0.9) + angleMark(B, Math.PI, Math.PI - a, "α");
      s += solid(A, (a * 180) / Math.PI) + pt(A, "A", 0, 24);
      if (shape === "slope-flat") {
        const C: Pt = [500, 250];
        s += seg(B, C, `stroke-width="2.4"`) + ground(B[0] - 10, C[0] + 20, 252, `stroke="none"`) + pt(B, "B") + pt(C, "C");
      } else {
        // a circular part BC of center O and radius r, tangent to the slope at B, going down then up
        const r = 110;
        const O: Pt = [B[0] + r * Math.sin(a), B[1] - r * Math.cos(a)];
        const C: Pt = [O[0] + r * Math.sin(rad(40)), O[1] + r * Math.cos(rad(40))];
        const pts: Pt[] = [];
        for (let t = -((a * 180) / Math.PI); t <= 40; t += 2) pts.push([O[0] + r * Math.sin(rad(t)), O[1] + r * Math.cos(rad(t))]);
        s += `<path d="${path(pts)}" stroke-width="2.4"/>` + pt(B, "B", -4) + pt(C, "C", 12, 16);
        const low: Pt = [O[0], O[1] + r];
        s += disc(O, 2.5, c, `stroke="none"`) + say(O[0], O[1] - 8, "O", { size: 13, anchor: "middle", fill: c, bold: true }) + dashed(O, low, 0.9) + dashed(O, C, 0.9) + say(O[0] + 6, O[1] + r / 2, "r", { size: 14, fill: c, italic: true });
        s += pt(low, "M");
      }
      return svg(540, 290, s, c);
    }
    if (shape === "flat-slope") {
      const A: Pt = [40, 250];
      const B: Pt = [260, 250];
      const C: Pt = [B[0] + 230 * Math.cos(a), B[1] - 230 * Math.sin(a)];
      s += seg(A, B, `stroke-width="2.4"`) + seg(B, C, `stroke-width="2.4"`) + dashed(B, [B[0] + 130, B[1]], 0.9) + angleMark(B, 0, a, "α");
      s += solid([A[0] + 18, A[1]], 0) + pt(A, "A") + pt(B, "B") + pt(C, "C", 14, -4);
      return svg(540, 290, s, c);
    }
    // quarter circle AB (center O, radius r), then flat BC
    const r = 160;
    const O: Pt = [60, 70];
    const A: Pt = [O[0], O[1]];
    const pts: Pt[] = [];
    // concave: vertical at A, horizontal at B, its center level with A above B
    for (let t = 0; t <= 90; t += 2) pts.push([O[0] + r - r * Math.cos(rad(t)), O[1] + r * Math.sin(rad(t))]);
    const Ctr: Pt = [O[0] + r, O[1]];
    const Bq: Pt = [O[0] + r, O[1] + r];
    s += `<path d="${path(pts)}" stroke-width="2.4"/>`;
    s += seg(Bq, [500, Bq[1]], `stroke-width="2.4"`);
    s += disc(Ctr, 2.5, c, `stroke="none"`) + say(Ctr[0] + 8, Ctr[1] - 6, "O", { size: 13, fill: c, bold: true }) + dashed(Ctr, A, 0.9) + dashed(Ctr, Bq, 0.9);
    s += say(Ctr[0] - r / 2, Ctr[1] - 8, "r", { size: 14, anchor: "middle", fill: c, italic: true });
    s += solid(A, 0) + pt(A, "A", -14, 0) + pt(Bq, "B", 0, 22) + pt([500, Bq[1]], "C", 0, 22);
    return svg(530, 270, s, c);
  },
};

// ---- Straight-line graph (Ec = f(v²), G = f(C), U = f(I)…) ----
export const lineGraphFigure: FigureDef = {
  id: "pc-line-graph",
  name: "Straight-line graph",
  hint: "Write the names of the axes with their units; the line goes from the origin (or b) to the top value.",
  params: [
    { key: "xName", label: "x axis", kind: "text", placeholder: "v² (m²/s²)", row: "n" },
    { key: "yName", label: "y axis", kind: "text", placeholder: "Ec (J)", row: "n" },
    { key: "xMax", label: "x max", kind: "number", min: 0.001, max: 100000, step: 0.001, row: "x" },
    { key: "xStep", label: "x step", kind: "number", min: 0.0001, max: 10000, step: 0.0001, row: "x" },
    { key: "yMax", label: "y max", kind: "number", min: 0.001, max: 100000, step: 0.001, row: "y" },
    { key: "yStep", label: "y step", kind: "number", min: 0.0001, max: 10000, step: 0.0001, row: "y" },
    { key: "b", label: "y at x = 0", kind: "number", min: -100000, max: 100000, step: 0.001, row: "l" },
    { key: "yEnd", label: "y at x max", kind: "number", min: -100000, max: 100000, step: 0.001, row: "l" },
    { key: "points", label: "Measured points", kind: "bool", row: "o" },
    { key: "grid", label: "Grid", kind: "bool", row: "o" },
    { key: "line", label: "The line", kind: "bool", row: "o" },
  ],
  defaults: () => ({ xName: "v² (m²/s²)", yName: "Ec (J)", xMax: 50, xStep: 10, yMax: 5, yStep: 1, b: 0, yEnd: 4.5, points: true, grid: true, line: true }),
  build: (p) => {
    const c = ink(p);
    const xMax = Math.max(1e-6, num(p, "xMax", 50));
    const yMax = Math.max(1e-6, num(p, "yMax", 5));
    const xStep = clamp(num(p, "xStep", 10), xMax / 40, xMax);
    const yStep = clamp(num(p, "yStep", 1), yMax / 40, yMax);
    const b = num(p, "b", 0);
    const yEnd = num(p, "yEnd", 4.5);
    const yMin = Math.min(0, b, yEnd);
    const f = frame({ x0: 60, y0: 250, w: 380, h: 210, xMax, yMax, yMin: yMin < 0 ? Math.floor(yMin / yStep) * yStep : 0, xName: str(p, "xName"), yName: str(p, "yName"), c, xStep, yStep, grid: bool(p, "grid") });
    let s = f.s;
    const line = (x: number) => b + ((yEnd - b) * x) / xMax;
    if (bool(p, "line")) s += `<path d="${path(curve(f, line, 0, xMax, 2))}" stroke-width="2"/>`;
    if (bool(p, "points")) {
      const n = Math.max(3, Math.min(8, Math.round(xMax / xStep)));
      const wobble = [0.02, -0.03, 0.025, -0.015, 0.03, -0.02, 0.015, -0.025];
      for (let i = 1; i <= n; i++) {
        const x = (i * xMax) / (n + 0.4);
        s += cross([f.X(x), f.Y(line(x) + wobble[i - 1] * yMax)]);
      }
    }
    return svg(480, 290, s, c);
  },
};

// ---- Simple pendulum ----
export const pendulumFigure: FigureDef = {
  id: "pc-pendulum",
  name: "Simple pendulum",
  params: [
    { key: "angle", label: "Angle θ", kind: "number", min: 5, max: 70, unit: "°" },
    { key: "forces", label: "Forces T and P", kind: "bool", row: "a" },
    { key: "heights", label: "Height h (z axis)", kind: "bool", row: "a" },
    { key: "path", label: "Path of the bob", kind: "bool", row: "b" },
    { key: "rest", label: "Equilibrium position", kind: "bool", row: "b" },
  ],
  defaults: () => ({ angle: 35, forces: false, heights: false, path: true, rest: true }),
  build: (p) => {
    const c = ink(p);
    const th = clamp(num(p, "angle", 35), 5, 70);
    const O: Pt = [220, 40];
    const L = 230;
    const M: Pt = [O[0] + L * Math.sin(rad(th)), O[1] + L * Math.cos(rad(th))];
    const G0: Pt = [O[0], O[1] + L];
    let s = hatched([140, 40], [300, 40], -1) + disc(O, 3, c, `stroke="none"`) + say(O[0] - 8, O[1] + 18, "O", { size: 13, anchor: "end", fill: c, bold: true });
    s += dashed(O, [O[0], O[1] + L + 30], 1);
    if (bool(p, "path")) s += `<path d="M${r1(O[0] - L * Math.sin(rad(th + 8)))} ${r1(O[1] + L * Math.cos(rad(th + 8)))}A${L} ${L} 0 0 0 ${r1(O[0] + L * Math.sin(rad(th + 8)))} ${r1(O[1] + L * Math.cos(rad(th + 8)))}" stroke-width="1" stroke-dasharray="3 4"/>`;
    if (bool(p, "rest")) s += disc(G0, 12, "#ffffff", `stroke-width="1.2" stroke-dasharray="3 3"`) + say(G0[0] - 18, G0[1] + 22, "G₀", { size: 12, anchor: "end", fill: c });
    s += seg(O, M, `stroke-width="1.6"`) + disc(M, 12, SOLID, `stroke-width="2"`) + disc(M, 2, c, `stroke="none"`) + say(M[0] + 16, M[1] + 4, "G", { size: 13, fill: c });
    const r = 54;
    s += `<path d="M${O[0]} ${O[1] + r}A${r} ${r} 0 0 0 ${r1(O[0] + r * Math.sin(rad(th)))} ${r1(O[1] + r * Math.cos(rad(th)))}" stroke-width="1.2"/>`;
    s += say(O[0] + (r + 14) * Math.sin(rad(th / 2)), O[1] + (r + 14) * Math.cos(rad(th / 2)) + 5, "θ", { size: 15, anchor: "middle", fill: c, italic: true });
    s += say((O[0] + M[0]) / 2 + 10, (O[1] + M[1]) / 2, "ℓ", { size: 15, fill: c, italic: true });
    if (bool(p, "forces")) {
      const u: Pt = [(O[0] - M[0]) / L, (O[1] - M[1]) / L];
      const T: Pt = [M[0] + u[0] * 80, M[1] + u[1] * 80];
      s += vector(M, T, c, 2.2) + vecName(T[0] + 14, T[1] + 6, "T", c, { size: 15 });
      s += vector(M, [M[0], M[1] + 80], c, 2.2) + vecName(M[0] + 16, M[1] + 74, "P", c, { size: 15 });
    }
    if (bool(p, "heights")) {
      const x = 400;
      s += `<path d="M${x} ${G0[1] + 30}V${M[1] - 50}" stroke-width="1.4"/>` + head([x, M[1] - 56], -90, c) + say(x + 8, M[1] - 50, "z", { size: 14, fill: c, bold: true });
      s += dashed(G0, [x, G0[1]], 0.9) + dashed(M, [x, M[1]], 0.9) + say(x + 8, G0[1] + 4, "0", { size: 12, fill: c });
      s += vector([x - 20, (M[1] + G0[1]) / 2], [x - 20, M[1]], c, 1.1) + vector([x - 20, (M[1] + G0[1]) / 2], [x - 20, G0[1]], c, 1.1) + say(x - 28, (M[1] + G0[1]) / 2 + 5, "h", { size: 14, anchor: "end", fill: c, italic: true });
    }
    return svg(bool(p, "heights") ? 440 : 400, O[1] + L + 50, s, c);
  },
};

// ---- Spring and mass ----
export const springFigure: FigureDef = {
  id: "pc-spring",
  name: "Spring and solid",
  params: [
    {
      key: "layout",
      label: "Spring",
      kind: "select",
      options: [
        { value: "horizontal", label: "Horizontal" },
        { value: "vertical", label: "Vertical" },
      ],
    },
    {
      key: "state",
      label: "Position",
      kind: "select",
      options: [
        { value: "rest", label: "At equilibrium" },
        { value: "stretched", label: "Stretched (x > 0)" },
        { value: "compressed", label: "Compressed (x < 0)" },
      ],
    },
    { key: "axis", label: "Axis and x", kind: "bool", row: "o" },
    { key: "forces", label: "Forces", kind: "bool", row: "o" },
  ],
  defaults: () => ({ layout: "horizontal", state: "stretched", axis: true, forces: false }),
  build: (p) => {
    const c = ink(p);
    const state = str(p, "state", "stretched");
    const dx = state === "stretched" ? 70 : state === "compressed" ? -55 : 0;
    const forces = bool(p, "forces");
    const axis = bool(p, "axis");
    let s = "";
    if (str(p, "layout") === "vertical") {
      const top = 40;
      const rest = 200; // top of the solid at equilibrium
      const y = rest + dx * 0.8;
      s += hatched([130, top], [270, top], -1) + spring([200, top], [200, y], 12, 22);
      s += `<rect x="170" y="${r1(y)}" width="60" height="50" fill="${SOLID}" stroke-width="2"/>`;
      const G: Pt = [200, y + 25];
      s += disc(G, 2.5, c, `stroke="none"`) + say(212, G[1] + 4, "G", { size: 12, fill: c });
      if (axis) {
        const x = 320;
        s += dashed([230, rest + 25], [x + 10, rest + 25], 0.9) + `<path d="M${x} 80V${rest + 130}" stroke-width="1.4"/>` + head([x, rest + 136], 90, c);
        s += say(x + 8, rest + 134, "x", { size: 14, fill: c, bold: true }) + say(x + 8, rest + 29, "O", { size: 13, fill: c, bold: true });
        s += vector([x, rest + 25], [x, rest + 5], c, 1.8) + vecName(x - 10, rest + 14, "i", c, { size: 13, anchor: "end" });
        if (dx) s += dashed(G, [x, G[1]], 0.9) + say(x + 8, G[1] + 4, "x", { size: 13, fill: c, italic: true });
      }
      if (forces) {
        s += vector([200, y], [200, y - 70], c, 2.2) + vecName(222, y - 50, "T", c, { size: 15 });
        s += vector(G, [200, G[1] + 80], c, 2.2) + vecName(222, G[1] + 74, "P", c, { size: 15 });
      }
      return svg(380, rest + 150, s, c);
    }
    const wall = 40;
    const rest = 240; // left side of the solid at equilibrium
    const x = rest + dx;
    s += hatched([wall, 60], [wall, 170], -1) + ground(wall, 520, 170) + spring([wall, 135], [x, 135], 12, 22);
    s += `<rect x="${r1(x)}" y="100" width="70" height="70" fill="${SOLID}" stroke-width="2"/>`;
    const G: Pt = [x + 35, 135];
    s += disc(G, 2.5, c, `stroke="none"`) + say(G[0] + 6, G[1] - 8, "G", { size: 12, fill: c });
    if (axis) {
      s += `<path d="M${wall + 10} 210H520" stroke-width="1.4"/>` + head([526, 210], 0, c) + say(522, 232, "x", { size: 14, anchor: "end", fill: c, bold: true });
      s += dashed([rest + 35, 170], [rest + 35, 214], 0.9) + say(rest + 35, 232, "O", { size: 13, anchor: "middle", fill: c, bold: true });
      s += vector([rest + 35, 210], [rest + 75, 210], c, 1.8) + vecName(rest + 58, 232, "i", c, { size: 13 });
      if (dx) s += dashed(G, [G[0], 214], 0.9) + disc([G[0], 210], 2.5, c, `stroke="none"`) + say(G[0], 248, "x", { size: 13, anchor: "middle", fill: c, italic: true });
    }
    if (forces) {
      s += vector(G, [G[0], G[1] + 85], c, 2.2) + vecName(G[0] + 16, G[1] + 80, "P", c, { size: 15 });
      s += vector([G[0], 170], [G[0], 60], c, 2.2) + vecName(G[0] + 16, 70, "R", c, { size: 15 });
      if (dx) {
        // the spring pulls the solid back (stretched) or pushes it away (compressed)
        const dir = dx > 0 ? -1 : 1;
        s += vector([x + (dir > 0 ? 70 : 0), 135], [x + (dir > 0 ? 70 : 0) + dir * 70, 135], c, 2.2) + vecName(x + (dir > 0 ? 70 : 0) + dir * 50, 124, "T", c, { size: 15 });
      }
    }
    return svg(540, 260, s, c);
  },
};

// ---- Energy curves ----
export const energyCurvesFigure: FigureDef = {
  id: "pc-energy-curves",
  name: "Energy curves (Ec, Ep, Em)",
  params: [
    {
      key: "kind",
      label: "Graph",
      kind: "select",
      options: [
        { value: "fall", label: "Free fall, against time" },
        { value: "height", label: "Against the height z" },
        { value: "oscillator", label: "Oscillator, against time" },
      ],
    },
    { key: "friction", label: "With friction (Em goes down)", kind: "bool" },
    { key: "names", label: "Names of the curves", kind: "bool" },
  ],
  defaults: () => ({ kind: "fall", friction: false, names: true }),
  build: (p) => {
    const c = ink(p);
    const kind = str(p, "kind", "fall");
    const fr = bool(p, "friction");
    const xName = kind === "height" ? "z (m)" : "t (s)";
    const f = frame({ x0: 60, y0: 250, w: 380, h: 200, xMax: 1, yMax: 1.1, xName, yName: "E (J)", c, ticks: false });
    let s = f.s;
    const loss = (x: number) => (fr ? 0.35 * x : 0);
    let ec: (x: number) => number;
    let ep: (x: number) => number;
    if (kind === "fall") {
      ep = (x) => 1 - x * x;
      ec = (x) => x * x - loss(x) * x;
    } else if (kind === "height") {
      ep = (x) => x;
      ec = (x) => 1 - x - loss(1 - x) * (1 - x);
    } else {
      const damp = (x: number) => (fr ? Math.exp(-1.6 * x) : 1);
      ep = (x) => damp(x) * Math.cos(2 * Math.PI * 2 * x) ** 2;
      ec = (x) => damp(x) * Math.sin(2 * Math.PI * 2 * x) ** 2;
    }
    const em = (x: number) => ec(x) + ep(x);
    s += `<path d="${path(curve(f, em, 0, 1))}" stroke-width="2.4"/>`;
    s += `<path d="${path(curve(f, ep, 0, 1))}" stroke-width="1.8" stroke-dasharray="8 5"/>`;
    s += `<path d="${path(curve(f, ec, 0, 1))}" stroke-width="1.8" stroke-dasharray="2 4"/>`;
    if (bool(p, "names")) {
      const lab = (x: number, fn: (x: number) => number, t: string, dy: number) => chem(f.X(x), f.Y(fn(x)) + dy, t, { size: 13, anchor: "middle", fill: c, bold: true });
      s += lab(0.93, em, "Em", -10);
      if (kind === "oscillator") s += lab(0.25, ep, "Ep", -8) + lab(0.125, ec, "Ec", -8);
      else s += lab(0.25, ep, kind === "height" ? "Epp" : "Epp", kind === "height" ? 18 : -8) + lab(0.25, ec, "Ec", kind === "height" ? -8 : 18);
    }
    return svg(480, 290, s, c);
  },
};

// ---- Calorimeter ----
function calorimeter(heater: boolean, body: boolean, c: string) {
  let s = "";
  // the vessel: outer wall, the vacuum, inner wall
  s += `<path d="M60 70V280Q60 300 80 300H240Q260 300 260 280V70" fill="#ffffff" stroke-width="2.2"/>`;
  s += `<path d="M74 70V272Q74 286 88 286H232Q246 286 246 272V70" stroke-width="1.6"/>`;
  s += `<path d="M76 140H244V272Q244 284 232 284H88Q76 284 76 272Z" fill="${LIQUID}" stroke="none"/>` + surface(76, 244, 140);
  // the lid
  s += `<rect x="50" y="56" width="220" height="16" rx="3" fill="#ffffff" stroke-width="2"/>`;
  // thermometer
  s += `<rect x="113" y="10" width="12" height="240" rx="6" fill="#ffffff" stroke-width="1.6"/><circle cx="119" cy="248" r="8" fill="${c}" stroke="none"/><path d="M119 248V120" stroke-width="3"/>`;
  for (let y = 30; y <= 110; y += 10) s += `<path d="M125 ${y}h-5" stroke-width="1"/>`;
  // stirrer
  s += `<path d="M190 20V240M170 240H210M176 252H204" stroke-width="2"/><path d="M180 20H200" stroke-width="3"/>`;
  if (body) s += `<rect x="134" y="210" width="40" height="40" fill="#bfbfbf" stroke-width="1.8"/><path d="M154 210V148" stroke-width="1"/>`;
  if (heater) {
    s += `<path d="M150 0V180M162 0V180" stroke-width="1.6"/><rect x="146" y="180" width="20" height="56" rx="2" fill="#ffffff" stroke-width="1.8"/>`;
    for (let y = 186; y < 232; y += 8) s += `<path d="M146 ${y}l20 4" stroke-width="1"/>`;
  }
  return s;
}
export const calorimeterFigure = labeledFigure({
  id: "pc-calorimeter",
  name: "Calorimeter",
  params: [
    { key: "heater", label: "Heating resistor", kind: "bool", row: "o" },
    { key: "body", label: "A solid in the water", kind: "bool", row: "o" },
  ],
  defaults: { heater: false, body: false },
  w: 300,
  h: 310,
  draw: (p, c) => calorimeter(bool(p, "heater"), bool(p, "body"), c),
  parts: (p) => [
    { key: "thermo", at: [113, 30], side: "l", fr: "Thermomètre", ar: "محرار" },
    { key: "lid", at: [50, 64], side: "l", fr: "Couvercle", ar: "غطاء" },
    { key: "wall", at: [60, 200], side: "l", fr: "Paroi isolante (double paroi)", ar: "جدار عازل (جدار مزدوج)" },
    { key: "water", at: [90, 170], side: "l", fr: "Eau", ar: "الماء" },
    { key: "stirrer", at: [200, 20], side: "r", fr: "Agitateur", ar: "محرك" },
    { key: "vessel", at: [260, 220], side: "r", fr: "Vase calorimétrique", ar: "إناء المسعر" },
    ...(bool(p, "heater") ? [{ key: "heater", at: [166, 210] as Pt, side: "r" as const, fr: "Résistor chauffant", ar: "موصل أومي للتسخين" }] : []),
    ...(bool(p, "body") ? [{ key: "body", at: [134, 236] as Pt, side: "l" as const, fr: "Corps solide", ar: "جسم صلب" }] : []),
  ],
});

// ---- Heating curve ----
export const heatingCurveFigure: FigureDef = {
  id: "pc-heating-curve",
  name: "Heating curve (change of state)",
  params: [
    {
      key: "direction",
      label: "Curve",
      kind: "select",
      options: [
        { value: "heating", label: "Heating" },
        { value: "cooling", label: "Cooling" },
      ],
    },
    { key: "melt", label: "Melting point", kind: "number", min: -200, max: 2000, unit: "°C", row: "t" },
    { key: "boil", label: "Boiling point", kind: "number", min: -200, max: 3000, unit: "°C", row: "t" },
    { key: "start", label: "Starting temperature", kind: "number", min: -273, max: 3000, unit: "°C", row: "s" },
    { key: "end", label: "Final temperature", kind: "number", min: -273, max: 3000, unit: "°C", row: "s" },
    { key: "states", label: "States of matter", kind: "bool", row: "o" },
    { key: "values", label: "Temperatures on the axis", kind: "bool", row: "o" },
  ],
  defaults: () => ({ direction: "heating", melt: 0, boil: 100, start: -20, end: 120, states: true, values: true }),
  build: (p, lang) => {
    const c = ink(p);
    const heat = str(p, "direction", "heating") === "heating";
    const melt = num(p, "melt", 0);
    const boil = Math.max(melt + 1, num(p, "boil", 100));
    let t0 = num(p, "start", -20);
    let t1 = num(p, "end", 120);
    if (!heat) [t0, t1] = [Math.max(t0, t1), Math.min(t0, t1)];
    const lo = Math.min(t0, t1, melt);
    const hi = Math.max(t0, t1, melt);
    // temperatures reached: the plateaus between start and end
    const temps = [t0, ...(heat ? [melt, boil] : [boil, melt]).filter((t) => (heat ? t > t0 && t < t1 : t < t0 && t > t1)), t1];
    const top = Math.max(hi, ...temps);
    const bottom = Math.min(lo, ...temps);
    const range = top - bottom || 1;
    const zeroAt = bottom - range * 0.1;
    const Yv = (t: number) => (t - zeroAt) / (range * 1.15);
    const f = frame({ x0: 70, y0: 260, w: 380, h: 210, xMax: 1, yMax: 1, xName: "t (min)", yName: "θ (°C)", c, ticks: false });
    let s = f.s.replace(/<text[^>]*>O<\/text>/, "");
    // segments: a slope, a plateau, a slope…
    const pts: Pt[] = [];
    const n = temps.length - 1;
    const slopeW = 0.9 / (n * 2 - 1 || 1);
    let x = 0.02;
    const state = (t: number) => (t < melt ? "S" : t > boil ? "G" : "L");
    const words: Record<string, { fr: string; ar: string }> = { S: { fr: "solide", ar: "صلب" }, L: { fr: "liquide", ar: "سائل" }, G: { fr: "gaz", ar: "غاز" } };
    let labels = "";
    for (let i = 0; i < n; i++) {
      const a = temps[i];
      const b = temps[i + 1];
      pts.push([f.X(x), f.Y(Yv(a))]);
      const mid = (a + b) / 2;
      if (bool(p, "states")) labels += say(f.X(x + slopeW / 2) + 14, f.Y(Yv(mid)) + 4, tr(lang, words[state(mid)]), { size: 11.5, fill: c });
      x += slopeW;
      pts.push([f.X(x), f.Y(Yv(b))]);
      if (i < n - 1) {
        // the change of state: a plateau
        const two = b === melt ? ["S", "L"] : ["L", "G"];
        if (bool(p, "states")) labels += say(f.X(x + slopeW / 2), f.Y(Yv(b)) - 8, `${tr(lang, words[two[0]])} + ${tr(lang, words[two[1]])}`, { size: 11.5, anchor: "middle", fill: c });
        x += slopeW;
      }
    }
    s += `<path d="${path(pts)}" stroke-width="2.4"/>` + labels;
    if (bool(p, "values")) for (const t of new Set([melt, boil].filter((t) => t >= bottom && t <= top))) s += chem(f.x0 - 8, f.Y(Yv(t)) + 4, fmt(t), { size: 11.5, anchor: "end", fill: c }) + `<path d="M${f.x0} ${r1(f.Y(Yv(t)))}H${r1(f.X(0.95))}" stroke-width="0.8" stroke-dasharray="4 3"/>`;
    return svg(500, 300, s, c);
  },
};

// ---- Energy transfer diagram ----
export const energyChainFigure: FigureDef = {
  id: "pc-energy-chain",
  name: "Energy transfer diagram",
  hint: "Leave a box empty for the student to fill.",
  params: [
    { key: "system", label: "System", kind: "text", placeholder: "Conducteur ohmique" },
    { key: "in1", label: "Received (1)", kind: "text", placeholder: "We", row: "i" },
    { key: "in2", label: "Received (2)", kind: "text", placeholder: "", row: "i" },
    { key: "out1", label: "Given (1)", kind: "text", placeholder: "Q", row: "o" },
    { key: "out2", label: "Given (2)", kind: "text", placeholder: "", row: "o" },
    { key: "outside", label: "Surroundings boxes", kind: "bool" },
  ],
  defaults: (lang) => ({ system: lang === "ar" ? "موصل أومي" : "Conducteur ohmique", in1: "We", in2: "", out1: "Q", out2: "", outside: true }),
  build: (p, lang) => {
    const c = ink(p);
    const sys = str(p, "system");
    const ins = [str(p, "in1"), str(p, "in2")].filter((v, i) => i === 0 || v);
    const outs = [str(p, "out1"), str(p, "out2")].filter((v, i) => i === 0 || v);
    const S: Pt = [270, 120];
    let s = `<rect x="${S[0] - 80}" y="${S[1] - 40}" width="160" height="80" rx="8" fill="#ffffff" stroke-width="2.2"/>`;
    s += sys ? say(S[0], S[1] + 5, sys, { size: 13.5, anchor: "middle", fill: c, bold: true }) : "";
    const row = (i: number, n: number) => S[1] + (n === 1 ? 0 : i ? 20 : -20);
    const ext = tr(lang, { fr: "Extérieur", ar: "الوسط الخارجي" });
    ins.forEach((t, i) => {
      const y = row(i, ins.length);
      s += vector([60, y], [S[0] - 82, y], c, 2) + (t ? chem(126, y - 8, t, { size: 14, anchor: "middle", fill: c, bold: true }) : `<rect x="104" y="${y - 26}" width="44" height="20" fill="#ffffff" stroke-width="1" stroke-dasharray="3 3"/>`);
    });
    outs.forEach((t, i) => {
      const y = row(i, outs.length);
      s += vector([S[0] + 82, y], [480, y], c, 2) + (t ? chem(414, y - 8, t, { size: 14, anchor: "middle", fill: c, bold: true }) : `<rect x="392" y="${y - 26}" width="44" height="20" fill="#ffffff" stroke-width="1" stroke-dasharray="3 3"/>`);
    });
    if (bool(p, "outside")) {
      s += `<rect x="4" y="${S[1] - 36}" width="56" height="72" rx="6" stroke-width="1.4" stroke-dasharray="5 3"/><rect x="480" y="${S[1] - 36}" width="56" height="72" rx="6" stroke-width="1.4" stroke-dasharray="5 3"/>`;
      s += say(32, S[1] + 56, ext, { size: 11, anchor: "middle", fill: c }) + say(508, S[1] + 56, ext, { size: 11, anchor: "middle", fill: c });
    }
    return svg(540, 200, s, c);
  },
};

export const ENERGY_FIGURES: FigureDef[] = [workFigure, workWeightFigure, trackFigure, lineGraphFigure, pendulumFigure, springFigure, energyCurvesFigure, calorimeterFigure, heatingCurveFigure, energyChainFigure];
