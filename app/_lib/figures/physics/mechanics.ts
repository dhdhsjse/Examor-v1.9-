// The evolution of a mechanical system: a projectile, a fall with air resistance (v(t)), oscillations x(t), a satellite
// on a circular orbit, a charged particle in a uniform electric or magnetic field.
import { bool, clamp, ink, num, r1, rad, str, svg, type Pt } from "../svg";
import type { FigureDef } from "../types";
import { chem, curve, dashed, disc, frame, guide, head, path, say, seg, tr, vecName, vector } from "./draw";

// ---- Projectile ----
export const projectileFigure: FigureDef = {
  id: "pc-projectile",
  name: "Projectile motion",
  params: [
    { key: "angle", label: "Launch angle α", kind: "number", min: 0, max: 80, unit: "°" },
    { key: "height", label: "Launched from a height h", kind: "bool", row: "a" },
    { key: "vectors", label: "Vectors v0 and g", kind: "bool", row: "a" },
    { key: "summit", label: "Summit S", kind: "bool", row: "b" },
    { key: "range", label: "Impact point P", kind: "bool", row: "b" },
  ],
  defaults: () => ({ angle: 45, height: false, vectors: true, summit: true, range: true }),
  build: (p) => {
    const c = ink(p);
    const a = clamp(num(p, "angle", 45), 0, 80);
    const high = bool(p, "height") || a < 5;
    const O: Pt = [50, 300];
    const h0 = high ? 100 : 0;
    const L: Pt = [O[0], O[1] - h0]; // launch point
    // trajectory in px: x = v cos(a) t, y = v sin(a) t − g t²/2, scaled so it fits
    const v = 1;
    const g = 1;
    const vx = v * Math.cos(rad(a));
    const vy = v * Math.sin(rad(a));
    const tf = (2 * vy) / g; // time back to the launch level
    const yMaxRel = (vy * vy) / (2 * g);
    const xLevel = vx * tf;
    // scale: the part above the launch level fills 380 × 200
    const k = Math.min(380 / Math.max(xLevel, 0.4), 200 / Math.max(yMaxRel, 0.05), 900);
    const X = (t: number) => L[0] + vx * t * k;
    const Y = (t: number) => L[1] - (vy * t - (g * t * t) / 2) * k;
    // impact on the ground (y = O): vy t − g t²/2 = −h0/k
    const tImpact = (vy + Math.sqrt(vy * vy + (2 * g * h0) / k)) / g;
    const pts: Pt[] = [];
    for (let i = 0; i <= 120; i++) pts.push([X((i / 120) * tImpact), Y((i / 120) * tImpact)]);
    const W = Math.max(...pts.map((q) => q[0])) + 60;
    let s = `<path d="M${O[0] - 10} ${O[1]}H${r1(W - 10)}" stroke-width="1.6"/>` + head([W - 4, O[1]], 0, c) + `<path d="M${O[0]} ${O[1] + 10}V30" stroke-width="1.6"/>` + head([O[0], 24], -90, c);
    s += say(O[0] - 8, O[1] + 18, "O", { size: 13, anchor: "end", fill: c, bold: true }) + say(W - 10, O[1] + 22, "x", { size: 14, anchor: "end", fill: c, bold: true }) + say(O[0] - 12, 36, "y", { size: 14, fill: c, bold: true, anchor: "end" });
    s += `<path d="${path(pts)}" stroke-width="2" stroke-dasharray="7 4"/>` + disc(L, 4, c, `stroke="none"`);
    if (high) s += say(L[0] - 8, L[1] + 4, "A", { size: 13, anchor: "end", fill: c, bold: true }) + say(L[0] + 6, (L[1] + O[1]) / 2 + 4, "h", { size: 14, fill: c, italic: true });
    if (bool(p, "vectors")) {
      const tip: Pt = [L[0] + Math.cos(rad(a)) * 80, L[1] - Math.sin(rad(a)) * 80];
      s += vector(L, tip, c, 2.2) + vecName(tip[0] + 6, tip[1] - 6, "v0", c, { size: 15, anchor: "start" });
      if (a > 3) s += `<path d="M${L[0] + 40} ${L[1]}A40 40 0 0 0 ${r1(L[0] + Math.cos(rad(a)) * 40)} ${r1(L[1] - Math.sin(rad(a)) * 40)}" stroke-width="1.2"/>` + say(L[0] + 46, L[1] - 10, "α", { size: 14, fill: c, italic: true }) + dashed(L, [L[0] + 60, L[1]], 0.8);
      const ts = vy / g;
      const S: Pt = [X(ts * 0.55), Y(ts * 0.55)];
      s += vector(S, [S[0], S[1] + 56], c, 2) + vecName(S[0] + 14, S[1] + 50, "g", c, { size: 15, anchor: "start" });
    }
    if (bool(p, "summit") && a > 3) {
      const ts = vy / g;
      const S: Pt = [X(ts), Y(ts)];
      s += disc(S, 3.5, c, `stroke="none"`) + say(S[0], S[1] - 10, "S", { size: 13, anchor: "middle", fill: c, bold: true }) + dashed(S, [S[0], O[1]], 0.9) + dashed(S, [O[0], S[1]], 0.9);
      s += chem(S[0], O[1] + 18, "xS", { size: 12, anchor: "middle", fill: c }) + chem(O[0] - 8, S[1] + 4, "yS", { size: 12, anchor: "end", fill: c });
    }
    if (bool(p, "range")) {
      const P: Pt = [X(tImpact), O[1]];
      s += disc(P, 3.5, c, `stroke="none"`) + say(P[0], O[1] - 10, "P", { size: 13, anchor: "middle", fill: c, bold: true }) + chem(P[0], O[1] + 18, "xP", { size: 12, anchor: "middle", fill: c });
    }
    return svg(Math.max(W, 300), O[1] + 30, s, c);
  },
};

// ---- Falling with air resistance ----
export const fallSpeedFigure: FigureDef = {
  id: "pc-fall-speed",
  name: "Falling body: speed v(t)",
  params: [
    {
      key: "kind",
      label: "Fall",
      kind: "select",
      options: [
        { value: "fluid", label: "With fluid friction" },
        { value: "free", label: "Free fall" },
      ],
    },
    { key: "vlim", label: "Terminal speed", kind: "number", min: 0.1, max: 100, step: 0.1, unit: "m/s", row: "v" },
    { key: "tau", label: "Time constant τ", kind: "number", min: 0.01, max: 100, step: 0.01, unit: "s", row: "v", when: (p) => p.kind !== "free" },
    { key: "tangent", label: "Tangent at t = 0", kind: "bool", row: "o" },
    { key: "regimes", label: "Initial and steady regimes", kind: "bool", row: "o" },
    { key: "grid", label: "Grid", kind: "bool" },
  ],
  defaults: () => ({ kind: "fluid", vlim: 2, tau: 0.2, tangent: true, regimes: true, grid: true }),
  build: (p, lang) => {
    const c = ink(p);
    const free = str(p, "kind") === "free";
    const vlim = Math.max(0.1, num(p, "vlim", 2));
    const tau = Math.max(0.01, num(p, "tau", 0.2));
    const tMax = free ? 1 : tau * 5;
    const vTop = free ? 10 : vlim * 1.2;
    const step = (v: number) => {
      const raw = v / 8;
      const pow = 10 ** Math.floor(Math.log10(raw));
      return [1, 2, 2.5, 5, 10].map((k) => k * pow).find((k) => k >= raw) ?? raw;
    };
    const f = frame({ x0: 60, y0: 250, w: 380, h: 200, xMax: tMax, yMax: Math.ceil(vTop / step(vTop)) * step(vTop), xName: "t (s)", yName: "v (m/s)", c, xStep: step(tMax), yStep: step(vTop), grid: bool(p, "grid"), gridX: step(tMax) / 2, gridY: step(vTop) / 2 });
    const fn = free ? (t: number) => 9.8 * t : (t: number) => vlim * (1 - Math.exp(-t / tau));
    let s = f.s + `<path d="${path(curve(f, fn, 0, tMax, 200))}" stroke-width="2.2"/>`;
    if (!free) {
      s += `<path d="M${f.x0} ${r1(f.Y(vlim))}H${r1(f.X(tMax))}" stroke-width="1" stroke-dasharray="6 4"/>` + chem(f.x0 - 26, f.Y(vlim) + 4, "vlim", { size: 12, anchor: "end", fill: c, bold: true });
      if (bool(p, "tangent")) s += seg([f.X(0), f.Y(0)], [f.X(tau * 1.2), f.Y(vlim * 1.2)], `stroke-width="1.2"`) + guide(f, tau, vlim, "τ", "", c);
      if (bool(p, "regimes")) {
        s += dashed([f.X(tau * 3), f.y0], [f.X(tau * 3), f.Y(vlim * 1.15)], 0.9);
        s += say(f.X(tau * 1.5), f.Y(vlim * 0.35), tr(lang, { fr: "régime initial", ar: "النظام البدئي" }), { size: 11.5, anchor: "middle", fill: c, italic: true });
        s += say(f.X(tau * 4), f.Y(vlim * 0.75), tr(lang, { fr: "régime permanent", ar: "النظام الدائم" }), { size: 11.5, anchor: "middle", fill: c, italic: true });
      }
    }
    return svg(480, 290, s, c);
  },
};

// ---- Oscillations ----
export const oscillationFigure: FigureDef = {
  id: "pc-oscillation",
  name: "Oscillations x(t)",
  params: [
    {
      key: "damping",
      label: "Oscillations",
      kind: "select",
      options: [
        { value: "none", label: "Free (no friction)" },
        { value: "weak", label: "Damped (pseudo-periodic)" },
        { value: "strong", label: "Aperiodic" },
      ],
    },
    { key: "amp", label: "Amplitude Xm", kind: "number", min: 0.1, max: 1000, step: 0.1, row: "a" },
    { key: "period", label: "Period", kind: "number", min: 0.01, max: 1000, step: 0.01, row: "a" },
    { key: "start", label: "At t = 0", kind: "select", options: [{ value: "max", label: "At the maximum" }, { value: "zero", label: "At zero, going up" }] },
    { key: "yName", label: "y axis", kind: "text", placeholder: "x (cm)", row: "n" },
    { key: "tName", label: "x axis", kind: "text", placeholder: "t (s)", row: "n" },
    { key: "guides", label: "Amplitude and period", kind: "bool", row: "o" },
    { key: "grid", label: "Grid", kind: "bool", row: "o" },
  ],
  defaults: () => ({ damping: "none", amp: 2, period: 0.4, start: "max", yName: "x (cm)", tName: "t (s)", guides: true, grid: true }),
  build: (p) => {
    const c = ink(p);
    const damp = str(p, "damping", "none");
    const Xm = Math.max(0.1, num(p, "amp", 2));
    const T = Math.max(0.01, num(p, "period", 0.4));
    const zero = str(p, "start") === "zero" && damp !== "strong";
    const tMax = T * 3;
    const step = (v: number) => {
      const raw = v / 6;
      const pow = 10 ** Math.floor(Math.log10(raw));
      return [1, 2, 2.5, 5, 10].map((k) => k * pow).find((k) => k >= raw) ?? raw;
    };
    const yStep = step(Xm * 2);
    const yMax = Math.ceil((Xm * 1.15) / yStep) * yStep;
    const f = frame({ x0: 60, y0: 180, w: 400, h: 160, xMax: tMax, yMax, yMin: -yMax, xName: str(p, "tName", "t (s)"), yName: str(p, "yName", "x (cm)"), c, xStep: step(tMax), yStep, grid: bool(p, "grid"), gridX: step(tMax) / 2, gridY: yStep / 2 });
    const w = (2 * Math.PI) / T;
    const fn = (t: number) => {
      if (damp === "strong") return Xm * (1 + 3 * t / T) * Math.exp((-3 * t) / T);
      const e = damp === "weak" ? Math.exp(-t / (1.2 * T)) : 1;
      return Xm * e * (zero ? Math.sin(w * t) : Math.cos(w * t));
    };
    let s = f.s + `<path d="${path(curve(f, fn, 0, tMax, 400))}" stroke-width="2.2"/>`;
    if (bool(p, "guides") && damp !== "strong") {
      const tPeak = zero ? T / 4 : 0;
      s += `<path d="M${f.x0} ${r1(f.Y(Xm))}H${r1(f.X(tMax))}" stroke-width="0.9" stroke-dasharray="5 4"/>` + chem(f.x0 - 30, f.Y(Xm) + 4, "Xm", { size: 12, anchor: "end", fill: c, bold: true });
      // the period, measured between two maxima, drawn under the curve
      const t1 = tPeak + T;
      const y = f.Y(-Xm) + 16;
      s += dashed([f.X(tPeak), f.Y(fn(tPeak))], [f.X(tPeak), y], 0.8) + dashed([f.X(t1), f.Y(fn(t1))], [f.X(t1), y], 0.8);
      s += vector([(f.X(tPeak) + f.X(t1)) / 2, y], [f.X(tPeak), y], c, 1.1) + vector([(f.X(tPeak) + f.X(t1)) / 2, y], [f.X(t1), y], c, 1.1) + chem((f.X(tPeak) + f.X(t1)) / 2, y + 18, damp === "weak" ? "T" : "T0", { size: 13, anchor: "middle", fill: c, bold: true });
    }
    return svg(500, 215, s, c);
  },
};

// ---- Satellite ----
export const satelliteFigure: FigureDef = {
  id: "pc-satellite",
  name: "Satellite on a circular orbit",
  params: [
    { key: "force", label: "Force F", kind: "bool", row: "a" },
    { key: "speed", label: "Velocity v", kind: "bool", row: "a" },
    { key: "frenet", label: "Frenet frame (u, n)", kind: "bool", row: "b" },
    { key: "sizes", label: "R and h", kind: "bool", row: "b" },
  ],
  defaults: () => ({ force: true, speed: true, frenet: false, sizes: true }),
  build: (p) => {
    const c = ink(p);
    const O: Pt = [200, 200];
    const R = 80;
    const r = 160;
    const a = rad(-40);
    const S: Pt = [O[0] + r * Math.cos(a), O[1] + r * Math.sin(a)];
    const toO: Pt = [-Math.cos(a), -Math.sin(a)];
    const tan: Pt = [Math.sin(a), -Math.cos(a)]; // anticlockwise
    let s = `<circle cx="${O[0]}" cy="${O[1]}" r="${R}" fill="#e6e6e6" stroke-width="2"/>` + `<circle cx="${O[0]}" cy="${O[1]}" r="${r}" stroke-width="1.2" stroke-dasharray="6 4"/>`;
    s += disc(O, 2.5, c, `stroke="none"`) + say(O[0] - 6, O[1] + 16, "O", { size: 13, anchor: "end", fill: c, bold: true });
    s += `<rect x="${r1(S[0] - 9)}" y="${r1(S[1] - 6)}" width="18" height="12" fill="#ffffff" stroke-width="1.6" transform="rotate(-40 ${r1(S[0])} ${r1(S[1])})"/><path d="M${r1(S[0] - 22)} ${r1(S[1])}H${r1(S[0] + 22)}" stroke-width="1.6" transform="rotate(50 ${r1(S[0])} ${r1(S[1])})"/>`;
    s += say(S[0] + 14, S[1] + 22, "S", { size: 14, fill: c, bold: true });
    if (bool(p, "force")) s += vector(S, [S[0] + toO[0] * 70, S[1] + toO[1] * 70], c, 2.2) + vecName(S[0] + toO[0] * 70 + 6, S[1] + toO[1] * 70 + 22, "F", c, { size: 15 });
    if (bool(p, "speed")) s += vector(S, [S[0] + tan[0] * 80, S[1] + tan[1] * 80], c, 2.2) + vecName(S[0] + tan[0] * 80 - 12, S[1] + tan[1] * 80 - 6, "v", c, { size: 15 });
    if (bool(p, "frenet")) {
      s += vector(S, [S[0] + tan[0] * 36, S[1] + tan[1] * 36], c, 1.4) + vecName(S[0] + tan[0] * 36 + 12, S[1] + tan[1] * 36 + 6, "u", c, { size: 13 });
      s += vector(S, [S[0] + toO[0] * 36, S[1] + toO[1] * 36], c, 1.4) + vecName(S[0] + toO[0] * 36 + 4, S[1] + toO[1] * 36 - 10, "n", c, { size: 13 });
    }
    if (bool(p, "sizes")) {
      const b = rad(200);
      const E: Pt = [O[0] + R * Math.cos(b), O[1] + R * Math.sin(b)];
      const F: Pt = [O[0] + r * Math.cos(b), O[1] + r * Math.sin(b)];
      s += seg(O, E, `stroke-width="1"`) + say((O[0] + E[0]) / 2, (O[1] + E[1]) / 2 - 6, "R", { size: 14, anchor: "middle", fill: c, italic: true, bold: true });
      s += vector([(E[0] + F[0]) / 2, (E[1] + F[1]) / 2], E, c, 1) + vector([(E[0] + F[0]) / 2, (E[1] + F[1]) / 2], F, c, 1) + say((E[0] + F[0]) / 2, (E[1] + F[1]) / 2 - 8, "h", { size: 14, anchor: "middle", fill: c, italic: true, bold: true });
    }
    return svg(400, 400, s, c);
  },
};

// ---- Charged particle in a field ----
export const particleFigure: FigureDef = {
  id: "pc-particle",
  name: "Charged particle in a field",
  params: [
    {
      key: "field",
      label: "Field",
      kind: "select",
      options: [
        { value: "electric", label: "Electric (between two plates)" },
        { value: "magnetic", label: "Magnetic (uniform)" },
      ],
    },
    { key: "charge", label: "Charge", kind: "select", options: [{ value: "-", label: "Negative (electron)" }, { value: "+", label: "Positive" }] },
    { key: "vectors", label: "Vectors", kind: "bool", row: "o" },
    { key: "screen", label: "Screen", kind: "bool", row: "o", when: (p) => p.field !== "magnetic" },
  ],
  defaults: () => ({ field: "electric", charge: "-", vectors: true, screen: true }),
  build: (p) => {
    const c = ink(p);
    const neg = str(p, "charge", "-") === "-";
    const vectors = bool(p, "vectors");
    if (str(p, "field") === "magnetic") {
      // B into the page (⊗); the particle turns on a circle: a positive one anticlockwise here
      let s = "";
      for (let x = 160; x <= 440; x += 40) for (let y = 30; y <= 270; y += 40) s += `<circle cx="${x}" cy="${y}" r="6" stroke-width="1"/><path d="M${x - 4} ${y - 4}l8 8m0 -8l-8 8" stroke-width="1"/>`;
      s += vecName(452, 26, "B", c, { size: 15, anchor: "start" });
      const O: Pt = [150, 150];
      const r = 70;
      const C: Pt = [O[0], neg ? O[1] + r : O[1] - r]; // the center of the circle
      const pts: Pt[] = [];
      for (let t = 0; t <= 180; t += 3) {
        const a = rad(neg ? -90 + t : 90 - t);
        pts.push([C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)]);
      }
      s += seg([40, O[1]], O, `stroke-width="1.6"`) + `<path d="${path(pts)}" stroke-width="2" stroke-dasharray="7 4"/>` + disc(O, 4, c, `stroke="none"`) + say(O[0] - 8, O[1] - 10, "O", { size: 13, anchor: "end", fill: c, bold: true });
      if (vectors) {
        s += vector(O, [O[0] + 70, O[1]], c, 2.2) + vecName(O[0] + 60, O[1] - 12, "v0", c, { size: 15 });
        s += vector(O, [O[0], O[1] + (C[1] > O[1] ? 60 : -60)], c, 2.2) + vecName(O[0] + 14, O[1] + (C[1] > O[1] ? 50 : -40), "F", c, { size: 15, anchor: "start" });
      }
      s += disc(C, 2.5, c, `stroke="none"`) + dashed(O, C, 0.8) + say(C[0] + 6, (O[1] + C[1]) / 2, "R", { size: 13, fill: c, italic: true });
      return svg(480, 300, s, c);
    }
    // two plates; the particle enters at O with v0 along x and is bent toward the plate of the other sign
    const L = 220;
    const x0 = 80;
    const top = 70;
    const bottom = 230;
    const y = 150;
    let s = `<rect x="${x0}" y="${top - 10}" width="${L}" height="10" fill="#e6e6e6" stroke-width="1.6"/><rect x="${x0}" y="${bottom}" width="${L}" height="10" fill="#e6e6e6" stroke-width="1.6"/>`;
    s += say(x0 - 10, top - 1, "+", { size: 16, anchor: "end", fill: c, bold: true }) + say(x0 - 10, bottom + 10, "−", { size: 18, anchor: "end", fill: c, bold: true });
    // E from + to −: downward
    for (let x = x0 + 30; x < x0 + L; x += 60) s += vector([x, top + 10], [x, top + 40], c, 1);
    const up = neg; // an electron goes toward the + plate (up)
    const dy = 60;
    const pts: Pt[] = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      pts.push([x0 + t * L, y - (up ? 1 : -1) * dy * t * t]);
    }
    const exit = pts[pts.length - 1];
    const slope = (2 * dy) / L; // the line after the plates, tangent at the exit
    const screenX = 470;
    const end: Pt = [screenX, exit[1] - (up ? 1 : -1) * slope * (screenX - exit[0])];
    s += seg([20, y], [x0, y], `stroke-width="1.6"`) + `<path d="${path(pts)}" stroke-width="2"/>` + seg(exit, end, `stroke-width="1.6"`) + dashed([x0, y], [screenX, y], 0.8);
    s += disc([x0, y], 3.5, c, `stroke="none"`) + say(x0 - 4, y + 18, "O", { size: 13, anchor: "end", fill: c, bold: true });
    if (bool(p, "screen")) s += `<rect x="${screenX}" y="30" width="8" height="240" fill="#f2f2f2" stroke-width="1.6"/>`;
    if (vectors) {
      s += vector([x0, y], [x0 + 60, y], c, 2.2) + vecName(x0 + 50, y + 26, "v0", c, { size: 15 });
      s += vecName(x0 + 44, top + 34, "E", c, { size: 15 });
      const M = pts[36];
      s += disc(M, 3, c, `stroke="none"`) + vector(M, [M[0], M[1] - (up ? 1 : -1) * 46], c, 2) + vecName(M[0] + 14, M[1] - (up ? 1 : -1) * 34, "F", c, { size: 15, anchor: "start" });
    }
    s += say(x0 + L / 2, bottom + 30, "ℓ", { size: 14, anchor: "middle", fill: c, italic: true });
    return svg(500, 290, s, c);
  },
};

export const MECHANICS_FIGURES: FigureDef[] = [projectileFigure, fallSpeedFigure, oscillationFigure, satelliteFigure, particleFigure];
