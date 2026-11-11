// Force and motion: the recorded positions of a moving point (chronophotography), a frame of reference with the position
// and velocity vectors, the forces on a solid (on a plane, on a slope, hung from a thread), a solid turning about an axis.
import { bool, clamp, ink, num, r1, rad, str, svg, type Pt } from "../svg";
import type { FigureDef } from "../types";
import { SOLID, chem, dashed, disc, ground, hatched, head, say, seg, vecName, vector } from "./draw";

// ---- Chronophotography ----
export const chronoFigure: FigureDef = {
  id: "pc-chrono",
  name: "Recorded positions (chronophotography)",
  params: [
    {
      key: "motion",
      label: "Motion",
      kind: "select",
      options: [
        { value: "uniform", label: "Straight, uniform" },
        { value: "accelerated", label: "Straight, speeding up" },
        { value: "decelerated", label: "Straight, slowing down" },
        { value: "circular", label: "Circular, uniform" },
        { value: "curved", label: "Curved (thrown)" },
      ],
    },
    { key: "count", label: "Positions", kind: "number", min: 4, max: 14 },
    { key: "names", label: "Names (M0, M1…)", kind: "bool", row: "n" },
    { key: "speed", label: "A velocity vector", kind: "bool", row: "n" },
    { key: "tau", label: "Time between positions", kind: "text", placeholder: "τ = 40 ms" },
  ],
  defaults: () => ({ motion: "uniform", count: 8, names: true, speed: false, tau: "τ = 40 ms" }),
  build: (p) => {
    const c = ink(p);
    const motion = str(p, "motion", "uniform");
    const n = Math.round(clamp(num(p, "count", 8), 4, 14));
    const pts: Pt[] = [];
    let center: Pt | null = null;
    if (motion === "circular") {
      center = [200, 170];
      for (let i = 0; i < n; i++) {
        const a = rad(-160 + (i * 300) / Math.max(n, 13));
        pts.push([center[0] + 130 * Math.cos(a), center[1] + 130 * Math.sin(a)]);
      }
    } else if (motion === "curved") {
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        pts.push([40 + t * 460, 250 - 4 * 190 * t * (1 - t) * 0.9 - t * 40]);
      }
    } else {
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const x = motion === "accelerated" ? t * (0.25 + 0.75 * t) : motion === "decelerated" ? t * (1.75 - 0.75 * t) : t;
        pts.push([40 + x * 460, 70]);
      }
    }
    let s = "";
    if (center) s += disc(center, 3, c, `stroke="none"`) + say(center[0] - 8, center[1] + 18, "O", { size: 13, anchor: "middle", fill: c, bold: true }) + `<circle cx="${center[0]}" cy="${center[1]}" r="130" stroke-width="0.8" stroke-dasharray="3 5"/>`;
    pts.forEach((pt, i) => {
      s += `<circle cx="${r1(pt[0])}" cy="${r1(pt[1])}" r="4" fill="#ffffff" stroke-width="1.6"/>` + disc(pt, 1.4, c, `stroke="none"`);
      if (bool(p, "names")) {
        const out: Pt = center ? [(pt[0] - center[0]) / 130, (pt[1] - center[1]) / 130] : [0, -1];
        const at: Pt = [pt[0] + out[0] * 20, pt[1] + out[1] * 20 + 5];
        s += chem(at[0], at[1], `M${i}`, { size: 12, anchor: "middle", fill: c });
      }
    });
    if (bool(p, "speed")) {
      const i = Math.min(n - 2, Math.max(1, Math.floor(n / 2)));
      const a = pts[i - 1];
      const b = pts[i + 1];
      // v_i ≈ M(i−1)M(i+1) / 2τ: drawn along that chord, from M_i
      const d: Pt = [(b[0] - a[0]) * 0.6, (b[1] - a[1]) * 0.6];
      const to: Pt = [pts[i][0] + d[0], pts[i][1] + d[1]];
      s += vector(pts[i], to, c, 2) + vecName(to[0] + 6, to[1] + (center ? 16 : 26), `v${i}`, c, { size: 14, anchor: "start" });
    }
    const tau = str(p, "tau");
    const H = center ? 320 : motion === "curved" ? 290 : 120;
    if (tau) s += chem(520, H - 12, tau, { size: 13, anchor: "end", fill: c });
    return svg(540, H, s, c);
  },
};

// ---- Frame of reference ----
export const frameFigure: FigureDef = {
  id: "pc-frame",
  name: "Frame of reference and vectors",
  params: [
    { key: "path", label: "Trajectory", kind: "bool", row: "a" },
    { key: "position", label: "Position vector OM", kind: "bool", row: "a" },
    { key: "speed", label: "Velocity vector", kind: "bool", row: "b" },
    { key: "coords", label: "Coordinates x and y", kind: "bool", row: "b" },
    { key: "frenet", label: "Frenet frame (u, n)", kind: "bool" },
  ],
  defaults: () => ({ path: true, position: true, speed: true, coords: true, frenet: false }),
  build: (p) => {
    const c = ink(p);
    const O: Pt = [60, 280];
    let s = `<path d="M${O[0] - 10} ${O[1]}H460M${O[0]} ${O[1] + 10}V30" stroke-width="1.5"/>` + head([466, O[1]], 0, c) + head([O[0], 24], -90, c);
    s += say(O[0] - 8, O[1] + 18, "O", { size: 14, anchor: "end", fill: c, bold: true }) + say(458, O[1] + 22, "x", { size: 14, fill: c, bold: true }) + say(O[0] - 18, 36, "y", { size: 14, fill: c, bold: true });
    s += vector(O, [O[0] + 40, O[1]], c, 2.4) + vecName(O[0] + 22, O[1] + 26, "i", c, { size: 14 });
    s += vector(O, [O[0], O[1] - 40], c, 2.4) + vecName(O[0] - 18, O[1] - 14, "j", c, { size: 14 });
    // the trajectory: y = f(x), and M on it
    const f = (x: number) => 260 - 170 * Math.sin((Math.PI * (x - 90)) / 420);
    const pts: Pt[] = [];
    for (let x = 100; x <= 440; x += 5) pts.push([x, f(x)]);
    if (bool(p, "path")) s += `<polyline points="${pts.map((q) => `${r1(q[0])},${r1(q[1])}`).join(" ")}" stroke-width="1.6"/>`;
    const mx = 230;
    const M: Pt = [mx, f(mx)];
    const slope = (f(mx + 1) - f(mx - 1)) / 2;
    const u: Pt = [1 / Math.hypot(1, slope), slope / Math.hypot(1, slope)];
    s += disc(M, 3.5, c, `stroke="none"`) + say(M[0] - 4, M[1] - 12, "M", { size: 14, anchor: "end", fill: c, bold: true });
    if (bool(p, "coords")) {
      s += dashed(M, [M[0], O[1]], 1) + dashed(M, [O[0], M[1]], 1);
      s += say(M[0], O[1] + 20, "x", { size: 13, anchor: "middle", fill: c }) + say(O[0] - 8, M[1] + 4, "y", { size: 13, anchor: "end", fill: c });
    }
    if (bool(p, "position")) s += vector(O, M, c, 2) + vecName((O[0] + M[0]) / 2 + 14, (O[1] + M[1]) / 2 + 16, "OM", c, { size: 14 });
    if (bool(p, "speed")) {
      const V: Pt = [M[0] + u[0] * 95, M[1] + u[1] * 95];
      s += vector(M, V, c, 2.2) + vecName(V[0] + 4, V[1] - 10, "v", c, { size: 15 });
    }
    if (bool(p, "frenet")) {
      // n: toward the inside of the bend (this curve bends down)
      const nrm: Pt = [-u[1], u[0]];
      const inside: Pt = nrm[1] > 0 ? nrm : [-nrm[0], -nrm[1]];
      s += vector(M, [M[0] + u[0] * 44, M[1] + u[1] * 44], c, 1.6) + vecName(M[0] + u[0] * 44 + 2, M[1] + u[1] * 44 + 18, "u", c, { size: 13 });
      s += vector(M, [M[0] + inside[0] * 44, M[1] + inside[1] * 44], c, 1.6) + vecName(M[0] + inside[0] * 44 - 12, M[1] + inside[1] * 44 + 4, "n", c, { size: 13 });
    }
    return svg(490, 310, s, c);
  },
};

// ---- Forces on a solid ----
export const forcesFigure: FigureDef = {
  id: "pc-forces",
  name: "Forces on a solid",
  params: [
    {
      key: "support",
      label: "The solid is",
      kind: "select",
      options: [
        { value: "plane", label: "On a horizontal plane" },
        { value: "slope", label: "On a slope" },
        { value: "thread", label: "Hung from a thread" },
      ],
    },
    { key: "angle", label: "Slope angle", kind: "number", min: 10, max: 50, unit: "°", when: (p) => p.support === "slope" },
    { key: "weight", label: "Weight P", kind: "bool", row: "f1" },
    { key: "reaction", label: "Reaction R", kind: "bool", row: "f1" },
    { key: "friction", label: "Friction (R = RN + f)", kind: "bool", row: "f2", when: (p) => p.support !== "thread" },
    { key: "pull", label: "Pulling force F", kind: "bool", row: "f2", when: (p) => p.support !== "thread" },
    { key: "pullAngle", label: "Angle of F", kind: "number", min: 0, max: 60, unit: "°", when: (p) => p.support !== "thread" && p.pull === true },
    { key: "axes", label: "Axes", kind: "bool", row: "o" },
    { key: "names", label: "Names of the forces", kind: "bool", row: "o" },
  ],
  defaults: () => ({ support: "slope", angle: 30, weight: true, reaction: true, friction: false, pull: false, pullAngle: 20, axes: false, names: true }),
  build: (p) => {
    const c = ink(p);
    const support = str(p, "support", "slope");
    const names = bool(p, "names");
    const label = (at: Pt, name: string) => (names ? vecName(at[0], at[1], name, c, { size: 15 }) : "");
    let s = "";
    if (support === "thread") {
      const top: Pt = [200, 30];
      const G: Pt = [200, 190];
      s += hatched([130, 30], [270, 30], -1) + seg(top, [200, 160], `stroke-width="1.6"`) + `<rect x="170" y="160" width="60" height="60" fill="${SOLID}" stroke-width="2"/>` + disc(G, 2.5, c, `stroke="none"`) + say(G[0] + 8, G[1] + 16, "G", { size: 13, fill: c });
      if (bool(p, "reaction")) s += vector([200, 160], [200, 80], c, 2.2) + label([222, 110], "T");
      if (bool(p, "weight")) s += vector(G, [200, 290], c, 2.2) + label([222, 280], "P");
      return svg(400, 310, s, c);
    }
    const a = support === "slope" ? clamp(num(p, "angle", 30), 10, 50) : 0;
    const u: Pt = [Math.cos(rad(a)), -Math.sin(rad(a))]; // up the slope
    const nrm: Pt = [-Math.sin(rad(a)), -Math.cos(rad(a))]; // out of the surface
    const len = 380;
    const A: Pt = [40, support === "slope" ? 300 : 200]; // bottom of the slope (or left end of the plane)
    const B: Pt = [A[0] + u[0] * len, A[1] + u[1] * len];
    if (support === "slope") {
      s += `<path d="M${A[0]} ${A[1]}L${r1(B[0])} ${r1(B[1])}V${A[1]}Z" fill="#ffffff" stroke-width="2"/>` + ground(A[0] - 20, B[0] + 20, A[1]);
      const r = 46;
      s += `<path d="M${A[0] + r} ${A[1]}A${r} ${r} 0 0 0 ${r1(A[0] + u[0] * r)} ${r1(A[1] + u[1] * r)}" stroke-width="1.2"/>` + say(A[0] + r + 8, A[1] - 8, "α", { size: 15, fill: c, italic: true });
    } else s += ground(A[0], A[0] + len, A[1]);
    // the block: 70 × 46, on the surface at 45% of the length
    const foot: Pt = [A[0] + u[0] * len * 0.45, A[1] + u[1] * len * 0.45];
    const at = (x: number, y: number): Pt => [foot[0] + u[0] * x + nrm[0] * y, foot[1] + u[1] * x + nrm[1] * y];
    const corners = [at(-35, 0), at(35, 0), at(35, 46), at(-35, 46)];
    s += `<polygon points="${corners.map((q) => `${r1(q[0])},${r1(q[1])}`).join(" ")}" fill="${SOLID}" stroke-width="2"/>`;
    const G = at(0, 23);
    s += disc(G, 2.6, c, `stroke="none"`);
    const gl = at(-26, 36);
    s += say(gl[0], gl[1] + 4, "G", { size: 12, anchor: "middle", fill: c });
    const friction = bool(p, "friction");
    if (bool(p, "weight")) s += vector(G, [G[0], G[1] + 110], c, 2.2) + label([G[0] + 16, G[1] + 104], "P");
    if (bool(p, "reaction")) {
      // with friction the reaction leans back, against the motion (up the slope / to the right): R = RN + f
      const base = at(0, 0);
      const RN: Pt = [base[0] + nrm[0] * 96, base[1] + nrm[1] * 96];
      const f: Pt = [base[0] - u[0] * 44, base[1] - u[1] * 44];
      const tip: Pt = friction ? [RN[0] + f[0] - base[0], RN[1] + f[1] - base[1]] : RN;
      s += vector(base, tip, c, 2.2) + label([tip[0] - 14, tip[1] - 6], "R");
      if (friction) {
        s += vector(base, RN, c, 1.3) + dashed(RN, tip, 0.8) + dashed(f, tip, 0.8) + vector(base, f, c, 1.3);
        s += names ? vecName(RN[0] + 14, RN[1] + 4, "R_N", c, { size: 13, anchor: "start" }) + vecName(f[0] - 4, f[1] + 22, "f", c, { size: 13 }) : "";
      }
    }
    if (bool(p, "pull")) {
      const b = clamp(num(p, "pullAngle", 20), 0, 60);
      const d: Pt = [Math.cos(rad(a + b)), -Math.sin(rad(a + b))];
      const base = at(35, 23);
      const tip: Pt = [base[0] + d[0] * 100, base[1] + d[1] * 100];
      s += vector(base, tip, c, 2.2) + label([tip[0] + 10, tip[1] - 8], "F");
      if (b > 0) s += dashed(base, [base[0] + u[0] * 70, base[1] + u[1] * 70], 0.9) + say(base[0] + u[0] * 60 + 6, base[1] + u[1] * 60 - 10, "β", { size: 13, fill: c, italic: true });
    }
    if (bool(p, "axes")) {
      const o = at(-35 - 80, 0);
      s += vector(o, [o[0] + u[0] * 60, o[1] + u[1] * 60], c, 1.4) + say(o[0] + u[0] * 64 + 4, o[1] + u[1] * 64 + 12, "x", { size: 13, fill: c, bold: true });
      s += vector(o, [o[0] + nrm[0] * 60, o[1] + nrm[1] * 60], c, 1.4) + say(o[0] + nrm[0] * 64 - 6, o[1] + nrm[1] * 64, "y", { size: 13, fill: c, bold: true, anchor: "end" });
    }
    return svg(470, A[1] + (support === "slope" ? 20 : 120), s, c);
  },
};

// ---- Rotation about a fixed axis ----
export const rotationFigure: FigureDef = {
  id: "pc-rotation",
  name: "Solid turning about a fixed axis",
  params: [
    { key: "angle", label: "Angle θ", kind: "number", min: 15, max: 160, unit: "°" },
    { key: "arc", label: "Arc s", kind: "bool", row: "a" },
    { key: "speed", label: "Velocity vector", kind: "bool", row: "a" },
  ],
  defaults: () => ({ angle: 55, arc: true, speed: true }),
  build: (p) => {
    const c = ink(p);
    const th = clamp(num(p, "angle", 55), 15, 160);
    const O: Pt = [190, 190];
    const R = 130;
    const M: Pt = [O[0] + R * Math.cos(rad(-th)), O[1] + R * Math.sin(rad(-th))];
    const M0: Pt = [O[0] + R, O[1]];
    let s = `<circle cx="${O[0]}" cy="${O[1]}" r="${R}" fill="${SOLID}" stroke-width="2"/>`;
    s += `<path d="M${O[0] - R - 20} ${O[1]}H${O[0] + R + 40}" stroke-width="1" stroke-dasharray="6 4"/>` + head([O[0] + R + 46, O[1]], 0, c);
    // the axis (Δ), seen end-on
    s += `<circle cx="${O[0]}" cy="${O[1]}" r="7" fill="#ffffff" stroke-width="1.6"/>` + disc(O, 2, c, `stroke="none"`);
    s += say(O[0] - 10, O[1] + 22, "O", { size: 14, anchor: "end", fill: c, bold: true }) + say(O[0] + 12, O[1] + 24, "(Δ)", { size: 13, fill: c });
    s += seg(O, M, `stroke-width="1.6"`) + disc(M, 4, c, `stroke="none"`) + disc(M0, 3, c, `stroke="none"`);
    const out: Pt = [Math.cos(rad(-th)), Math.sin(rad(-th))];
    s += say(M[0] + out[0] * 18, M[1] + out[1] * 18 + 5, "M", { size: 14, anchor: "middle", fill: c, bold: true }) + say(M0[0] + 12, M0[1] + 18, "M₀", { size: 13, fill: c });
    const r = 40;
    s += `<path d="M${O[0] + r} ${O[1]}A${r} ${r} 0 0 0 ${r1(O[0] + r * Math.cos(rad(-th)))} ${r1(O[1] + r * Math.sin(rad(-th)))}" stroke-width="1.3"/>`;
    s += say(O[0] + (r + 14) * Math.cos(rad(-th / 2)), O[1] + (r + 14) * Math.sin(rad(-th / 2)) + 5, "θ", { size: 15, anchor: "middle", fill: c, italic: true });
    s += say(O[0] + (R / 2) * Math.cos(rad(-th)) - 10 * Math.sin(rad(th)), O[1] + (R / 2) * Math.sin(rad(-th)) - 8, "R", { size: 13, anchor: "end", fill: c, italic: true });
    if (bool(p, "arc")) {
      const ra = R + 16;
      s += `<path d="M${O[0] + ra} ${O[1]}A${ra} ${ra} 0 0 0 ${r1(O[0] + ra * Math.cos(rad(-th)))} ${r1(O[1] + ra * Math.sin(rad(-th)))}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
      s += say(O[0] + (ra + 14) * Math.cos(rad(-th / 2)), O[1] + (ra + 14) * Math.sin(rad(-th / 2)) + 5, "s", { size: 15, anchor: "middle", fill: c, italic: true });
    }
    if (bool(p, "speed")) {
      // turning anticlockwise: v is tangent to the circle, d(OM)/dθ
      const tip: Pt = [M[0] - Math.sin(rad(th)) * 80, M[1] - Math.cos(rad(th)) * 80];
      s += vector(M, tip, c, 2.2) + vecName(tip[0] - 8, tip[1] - 6, "v", c, { size: 15 });
    }
    return svg(400, 360, s, c);
  },
};

export const MOTION_FIGURES: FigureDef[] = [chronoFigure, frameFigure, forcesFigure, rotationFigure];
