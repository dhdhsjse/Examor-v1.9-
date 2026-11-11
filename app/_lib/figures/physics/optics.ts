// Light: refraction and total reflection (Snell–Descartes), the semicircular block, the prism, thin lenses and the
// optical bench; white light and its dispersion, spectra, diffraction by a slit, the wavelength scale.
import { bool, clamp, fmt, ink, num, r1, rad, str, svg, type Pt } from "../svg";
import type { FigureDef } from "../types";
import { labeledFigure } from "../sciences/labeled";
import { LIQUID, SOLID, chem, dashed, disc, head, say, seg, tr, vector } from "./draw";

const deg = (r: number) => (r * 180) / Math.PI;
// A ray from a to b, with an arrow head in its middle (the way the light goes).
function ray(a: Pt, b: Pt, c: string, extra = `stroke-width="1.8"`) {
  const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const d = deg(Math.atan2(b[1] - a[1], b[0] - a[0]));
  return seg(a, b, extra) + head([m[0] + Math.cos(rad(d)) * 5, m[1] + Math.sin(rad(d)) * 5], d, c, 10);
}
// The arc of an angle at o, from the direction `from` to `to` (degrees, screen: 0 = right, 90 = down), and its name.
function angle(o: Pt, from: number, to: number, r: number, name: string, c: string) {
  const a: Pt = [o[0] + r * Math.cos(rad(from)), o[1] + r * Math.sin(rad(from))];
  const b: Pt = [o[0] + r * Math.cos(rad(to)), o[1] + r * Math.sin(rad(to))];
  const sweep = ((to - from + 360) % 360) < 180 ? 1 : 0;
  const mid = rad(from + (((to - from + 540) % 360) - 180) / 2);
  return `<path d="M${r1(a[0])} ${r1(a[1])}A${r} ${r} 0 0 ${sweep} ${r1(b[0])} ${r1(b[1])}" stroke-width="1.2"/>` + chem(o[0] + (r + 13) * Math.cos(mid), o[1] + (r + 13) * Math.sin(mid) + 5, name, { size: 13, anchor: "middle", fill: c, bold: true });
}

// ---- Refraction at a plane surface ----
export const refractionFigure: FigureDef = {
  id: "pc-refraction",
  name: "Refraction (Snell–Descartes)",
  params: [
    { key: "n1", label: "n1 (top)", kind: "number", min: 1, max: 2.5, step: 0.01, row: "n" },
    { key: "n2", label: "n2 (bottom)", kind: "number", min: 1, max: 2.5, step: 0.01, row: "n" },
    { key: "i1", label: "Angle of incidence i1", kind: "number", min: 0, max: 89, unit: "°" },
    { key: "reflected", label: "Reflected ray", kind: "bool", row: "o" },
    { key: "angles", label: "Angles", kind: "bool", row: "o" },
    { key: "media", label: "Media (top ; bottom)", kind: "text", placeholder: "air ; eau" },
  ],
  defaults: (lang) => ({ n1: 1, n2: 1.33, i1: 40, reflected: false, angles: true, media: lang === "ar" ? "الهواء ; الماء" : "air ; eau" }),
  build: (p) => {
    const c = ink(p);
    const n1 = clamp(num(p, "n1", 1), 1, 2.5);
    const n2 = clamp(num(p, "n2", 1.33), 1, 2.5);
    const i1 = clamp(num(p, "i1", 40), 0, 89);
    const I: Pt = [230, 170];
    const L = 150;
    let s = `<rect x="20" y="${I[1]}" width="420" height="150" fill="${n2 >= n1 ? LIQUID : "#ffffff"}" stroke="none"/>`;
    if (n1 > n2) s += `<rect x="20" y="20" width="420" height="150" fill="${LIQUID}" stroke="none"/>`;
    s += seg([20, I[1]], [440, I[1]], `stroke-width="2"`) + dashed([I[0], 20], [I[0], 320], 1);
    const A: Pt = [I[0] - L * Math.sin(rad(i1)), I[1] - L * Math.cos(rad(i1))];
    s += ray(A, I, c);
    const sin2 = (n1 / n2) * Math.sin(rad(i1));
    const total = sin2 > 1;
    if (!total) {
      const i2 = deg(Math.asin(sin2));
      const Bp: Pt = [I[0] + L * Math.sin(rad(i2)), I[1] + L * Math.cos(rad(i2))];
      s += ray(I, Bp, c);
      if (bool(p, "angles") && i2 > 0.5) s += angle(I, 90, 90 - i2, 50, "i2", c);
    }
    if (bool(p, "reflected") || total) {
      const R: Pt = [I[0] + L * Math.sin(rad(i1)), I[1] - L * Math.cos(rad(i1))];
      s += ray(I, R, c, `stroke-width="${total ? 1.8 : 1.3}"${total ? "" : ' stroke-dasharray="6 3"'}`);
      if (bool(p, "angles") && i1 > 0.5) s += angle(I, -90, -90 + i1, 62, "r", c);
    }
    if (bool(p, "angles") && i1 > 0.5) s += angle(I, -90, -90 - i1, 50, "i1", c);
    const [m1, m2] = str(p, "media").split(";").map((t) => t.trim());
    s += chem(430, 44, `${m1 ? `${m1} : ` : ""}n1 = ${fmt(n1)}`, { size: 13, anchor: "end", fill: c });
    s += chem(430, 306, `${m2 ? `${m2} : ` : ""}n2 = ${fmt(n2)}`, { size: 13, anchor: "end", fill: c });
    s += say(I[0] - 8, I[1] + 18, "I", { size: 13, anchor: "end", fill: c, bold: true });
    return svg(460, 330, s, c);
  },
};

// ---- Semicircular block on a protractor ----
export const halfCylinderFigure: FigureDef = {
  id: "pc-half-cylinder",
  name: "Semicircular block",
  params: [
    { key: "i1", label: "Angle of incidence", kind: "number", min: 0, max: 85, unit: "°" },
    { key: "n", label: "Index of the block", kind: "number", min: 1.1, max: 2.5, step: 0.01 },
    {
      key: "from",
      label: "The light comes",
      kind: "select",
      options: [
        { value: "air", label: "From the air (flat face)" },
        { value: "block", label: "From the block (curved face)" },
      ],
    },
    { key: "rays", label: "Rays", kind: "bool" },
  ],
  defaults: () => ({ i1: 40, n: 1.5, from: "air", rays: true }),
  build: (p) => {
    const c = ink(p);
    const i1 = clamp(num(p, "i1", 40), 0, 85);
    const n = clamp(num(p, "n", 1.5), 1.1, 2.5);
    const fromAir = str(p, "from", "air") === "air";
    const O: Pt = [200, 200];
    const R = 160;
    let s = `<circle cx="${O[0]}" cy="${O[1]}" r="${R + 14}" fill="#ffffff" stroke-width="1.6"/>`;
    // the degrees of the protractor, from the normal
    for (let a = 0; a < 360; a += 5) {
      const big = a % 10 === 0;
      const p1: Pt = [O[0] + (R + 14) * Math.cos(rad(a)), O[1] + (R + 14) * Math.sin(rad(a))];
      const p2: Pt = [O[0] + (R + (big ? 4 : 8)) * Math.cos(rad(a)), O[1] + (R + (big ? 4 : 8)) * Math.sin(rad(a))];
      s += seg(p1, p2, `stroke-width="${big ? 1.1 : 0.7}"`);
      if (a % 30 === 0) {
        const v = Math.abs(((a + 90) % 180) - 90);
        const t: Pt = [O[0] + (R + 26) * Math.cos(rad(a - 90)), O[1] + (R + 26) * Math.sin(rad(a - 90))];
        s += say(t[0], t[1] + 4, String(v), { size: 10, anchor: "middle", fill: c });
      }
    }
    // the block: the lower half
    s += `<path d="M${O[0] - R + 10} ${O[1]}A${R - 10} ${R - 10} 0 0 0 ${O[0] + R - 10} ${O[1]}Z" fill="${LIQUID}" stroke-width="2"/>`;
    s += seg([O[0] - R - 14, O[1]], [O[0] + R + 14, O[1]], `stroke-width="0.8"`) + dashed([O[0], O[1] - R - 14], [O[0], O[1] + R + 14], 0.8);
    if (bool(p, "rays")) {
      const L = R - 12;
      const [n1, n2] = fromAir ? [1, n] : [n, 1];
      // incident: from above (air) or from below, along a radius (not bent by the curved face)
      const dir = fromAir ? -1 : 1;
      const A: Pt = [O[0] - L * Math.sin(rad(i1)), O[1] + dir * L * Math.cos(rad(i1))];
      s += ray(A, O, c);
      const sin2 = (n1 / n2) * Math.sin(rad(i1));
      if (sin2 <= 1) {
        const i2 = deg(Math.asin(sin2));
        s += ray(O, [O[0] + L * Math.sin(rad(i2)), O[1] - dir * L * Math.cos(rad(i2))], c);
      }
      if (!fromAir || sin2 > 1) s += ray(O, [O[0] + L * Math.sin(rad(i1)), O[1] + dir * L * Math.cos(rad(i1))], c, `stroke-width="${sin2 > 1 ? 1.8 : 1.2}"${sin2 > 1 ? "" : ' stroke-dasharray="6 3"'}`);
    }
    return svg(400, 400, s, c);
  },
};

// ---- Prism ----
export const prismFigure: FigureDef = {
  id: "pc-prism",
  name: "Ray through a prism",
  params: [
    { key: "A", label: "Apex angle A", kind: "number", min: 30, max: 75, unit: "°", row: "a" },
    { key: "n", label: "Index n", kind: "number", min: 1.2, max: 2, step: 0.01, row: "a" },
    { key: "i", label: "Angle of incidence i", kind: "number", min: 0, max: 85, unit: "°" },
    { key: "angles", label: "Angles (i, r, r′, i′, D)", kind: "bool", row: "o" },
    { key: "normals", label: "Normals", kind: "bool", row: "o" },
  ],
  defaults: () => ({ A: 60, n: 1.5, i: 45, angles: true, normals: true }),
  build: (p) => {
    const c = ink(p);
    const A = clamp(num(p, "A", 60), 30, 75);
    const n = clamp(num(p, "n", 1.5), 1.2, 2);
    const i = clamp(num(p, "i", 45), 0, 85);
    const S: Pt = [250, 50]; // apex
    const side = 260;
    const Lb: Pt = [S[0] - side * Math.sin(rad(A / 2)), S[1] + side * Math.cos(rad(A / 2))];
    const Rb: Pt = [S[0] + side * Math.sin(rad(A / 2)), S[1] + side * Math.cos(rad(A / 2))];
    let s = `<polygon points="${[S, Rb, Lb].map((q) => `${r1(q[0])},${r1(q[1])}`).join(" ")}" fill="${LIQUID}" stroke-width="2"/>`;
    s += say(S[0], S[1] - 8, "A", { size: 14, anchor: "middle", fill: c, bold: true });
    // Directions are screen angles (degrees, 0 = right, 90 = down). The outward normal of the left face points at
    // 180 + A/2 (left and up), the one of the right face at −A/2 (right and up). Rays are bent toward the base.
    const half = A / 2;
    const dir = (a: number, l: number, from: Pt): Pt => [from[0] + Math.cos(rad(a)) * l, from[1] + Math.sin(rad(a)) * l];
    const I: Pt = [S[0] + (Lb[0] - S[0]) * 0.45, S[1] + (Lb[1] - S[1]) * 0.45];
    const P0 = dir(180 + half - i, 150, I); // where the incident ray comes from
    s += ray(P0, I, c);
    const r = deg(Math.asin(Math.sin(rad(i)) / n));
    const inside = half - r; // the ray in the glass
    // where it meets the right face: I + t·d = S + u·(Rb − S)
    const d: Pt = [Math.cos(rad(inside)), Math.sin(rad(inside))];
    const e: Pt = [Rb[0] - S[0], Rb[1] - S[1]];
    const t = ((S[0] - I[0]) * e[1] - (S[1] - I[1]) * e[0]) / (d[0] * e[1] - d[1] * e[0]);
    const J: Pt = [I[0] + d[0] * t, I[1] + d[1] * t];
    s += ray(I, J, c);
    const rp = A - r;
    const sinip = n * Math.sin(rad(rp));
    if (bool(p, "normals")) s += dashed(dir(half, 50, I), dir(180 + half, 60, I), 0.9) + dashed(dir(180 - half, 50, J), dir(-half, 60, J), 0.9);
    if (sinip <= 1) {
      const ip = deg(Math.asin(sinip));
      s += ray(J, dir(-half + ip, 150, J), c);
      if (bool(p, "angles")) {
        s += angle(I, 180 + half, 180 + half - i, 34, "i", c) + angle(I, half, inside, 40, "r", c);
        s += angle(J, 180 - half, 180 + inside, 40, "r′", c) + angle(J, -half, -half + ip, 34, "i′", c);
        // the deviation D, between the incident ray carried on and the emerging ray
        const D = i + ip - A;
        s += dashed(I, dir(half - i, 230, I), 0.8);
        if (D > 1) s += chem(J[0] + 110, J[1] + 40, `D = ${fmt(Math.round(D * 10) / 10)}°`, { size: 13, fill: c, bold: true });
      }
    } else {
      // total reflection on the right face: the ray goes back into the glass
      s += ray(J, dir(180 - 3 * half + r, 90, J), c);
      if (bool(p, "angles")) s += angle(I, 180 + half, 180 + half - i, 34, "i", c) + angle(I, half, inside, 40, "r", c);
    }
    return svg(500, 360, s, c);
  },
};

// ---- Thin lens ----
export const thinLensFigure: FigureDef = {
  id: "pc-thinlens",
  name: "Thin lens: image construction",
  params: [
    {
      key: "type",
      label: "Lens",
      kind: "select",
      options: [
        { value: "converging", label: "Converging" },
        { value: "diverging", label: "Diverging" },
      ],
    },
    { key: "focal", label: "Focal length (squares)", kind: "number", min: 1, max: 6, row: "d" },
    { key: "object", label: "Object distance (squares)", kind: "number", min: 0.5, max: 10, step: 0.5, row: "d" },
    { key: "height", label: "Object height (squares)", kind: "number", min: 0.5, max: 4, step: 0.5 },
    { key: "rays", label: "Rays", kind: "select", options: [{ value: "0", label: "None" }, { value: "2", label: "Two" }, { value: "3", label: "Three" }] },
    { key: "image", label: "Image A′B′", kind: "bool", row: "o" },
    { key: "grid", label: "Squares", kind: "bool", row: "o" },
  ],
  defaults: () => ({ type: "converging", focal: 2, object: 5, height: 2, rays: "3", image: true, grid: false }),
  build: (p) => {
    const c = ink(p);
    const conv = str(p, "type", "converging") !== "diverging";
    const q = 26; // px per square
    const f = Math.round(clamp(num(p, "focal", 2), 1, 6)) * (conv ? 1 : -1);
    const d = clamp(num(p, "object", 5), 0.5, 10);
    const h = clamp(num(p, "height", 2), 0.5, 4);
    const nRays = Number(str(p, "rays", "3")) || 0;
    // the image (in squares, signed from O: right +, up +): 1/v − 1/u = 1/f with u = −d
    const v = Math.abs(d - f) < 1e-6 ? Infinity : (f * d) / (d - f);
    const hi = Number.isFinite(v) ? (-v * h) / d : 0;
    const showImage = bool(p, "image") && Number.isFinite(v) && Math.abs(v) <= 14 && Math.abs(hi) <= 6;
    const left = Math.max(d, Math.abs(f), showImage && v < 0 ? -v : 0) + 1.5;
    const right = Math.max(Math.abs(f), showImage && v > 0 ? v : 0, 3) + 1.5;
    const up = Math.max(h, showImage ? hi : 0) + 1.2;
    const down = Math.max(1.2, showImage ? -hi + 0.8 : 0, 1.6);
    const O: Pt = [left * q + 10, up * q + 10];
    const X = (u: number) => O[0] + u * q;
    const Y = (u: number) => O[1] - u * q;
    const W = (left + right) * q + 20;
    const H = (up + down) * q + 20;
    let s = "";
    if (bool(p, "grid")) {
      let g = "";
      for (let u = -Math.floor(left); u <= right; u++) g += `M${r1(X(u))} 10V${r1(H - 10)}`;
      for (let u = -Math.floor(down); u <= up; u++) g += `M10 ${r1(Y(u))}H${r1(W - 10)}`;
      s += `<path d="${g}" stroke="#c8c8c8" stroke-width="0.6"/>`;
    }
    s += seg([10, O[1]], [W - 10, O[1]], `stroke-width="1.3"`) + head([W - 6, O[1]], 0, c, 8);
    // the lens
    const lt = Y(up - 0.4);
    const lb = Y(-down + 0.4);
    s += seg([O[0], lt], [O[0], lb], `stroke-width="2.2"`) + head([O[0], lt - (conv ? 2 : -10)], conv ? -90 : 90, c, 10) + head([O[0], lb + (conv ? 2 : -10)], conv ? 90 : -90, c, 10);
    const F: Pt = [X(-f), O[1]];
    const Fp: Pt = [X(f), O[1]];
    s += disc(F, 2.5, c, `stroke="none"`) + disc(Fp, 2.5, c, `stroke="none"`) + disc(O, 2.5, c, `stroke="none"`);
    s += say(F[0], O[1] + 18, "F", { size: 13, anchor: "middle", fill: c, bold: true }) + say(Fp[0], O[1] + 18, "F′", { size: 13, anchor: "middle", fill: c, bold: true }) + say(O[0] + 9, O[1] + 18, "O", { size: 13, anchor: "start", fill: c, bold: true });
    // the object AB
    const Ao: Pt = [X(-d), O[1]];
    const Bo: Pt = [X(-d), Y(h)];
    s += seg(Ao, Bo, `stroke-width="2.4"`) + head(Bo, -90, c, 10) + say(Ao[0], O[1] + 18, "A", { size: 13, anchor: "middle", fill: c, bold: true }) + say(Bo[0] - 8, Bo[1] + 4, "B", { size: 13, anchor: "end", fill: c, bold: true });
    // rays from B: through O; parallel then through F′; through F then parallel
    const edge = (a: Pt, b: Pt): Pt => {
      // b extended to the edge of the picture
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const k = dx > 0 ? (W - 12 - a[0]) / dx : dx < 0 ? (12 - a[0]) / dx : 1;
      return [a[0] + dx * k, a[1] + dy * k];
    };
    const back = (a: Pt, b: Pt): Pt => {
      // the line from b back through a, to the left edge (virtual rays)
      const dx = a[0] - b[0];
      const dy = a[1] - b[1];
      const k = dx < 0 ? (12 - b[0]) / dx : 1;
      return [b[0] + dx * k, b[1] + dy * k];
    };
    const virtual = `stroke-width="1" stroke-dasharray="5 4"`;
    if (nRays >= 1) s += ray(Bo, O, c, `stroke-width="1.5"`) + seg(O, edge(Bo, O), `stroke-width="1.5"`);
    // a magnifier: the virtual image is beyond the object, on the backward extension of the ray through O
    if (nRays >= 1 && conv && Number.isFinite(v) && v < 0) s += seg(Bo, back(Bo, O), virtual);
    if (nRays >= 2) {
      const L1: Pt = [O[0], Bo[1]];
      const out = edge(L1, [L1[0] + q, L1[1] + (h / f) * q]);
      s += ray(Bo, L1, c, `stroke-width="1.5"`) + seg(L1, out, `stroke-width="1.5"`);
      if (!conv || (Number.isFinite(v) && v < 0)) s += seg(L1, back(L1, out), virtual);
    }
    if (nRays >= 3 && Math.abs(d - f) > 0.05 && (conv ? d !== f : true)) {
      // aimed at F (converging: through F before the lens; diverging: toward F′ behind it)
      const aim: Pt = conv ? F : [X(-f), O[1]];
      const k = (O[0] - Bo[0]) / (aim[0] - Bo[0]);
      const L2: Pt = [O[0], Bo[1] + (aim[1] - Bo[1]) * k];
      if (Math.abs(L2[1] - O[1]) < (up + down) * q) {
        const out = edge(L2, [L2[0] + q, L2[1]]);
        s += ray(Bo, L2, c, `stroke-width="1.5"`) + seg(L2, out, `stroke-width="1.5"`);
        if (!conv) s += seg(L2, aim, virtual);
        if (Number.isFinite(v) && v < 0) s += seg(L2, back(L2, out), virtual);
      }
    }
    if (showImage) {
      const Ai: Pt = [X(v), O[1]];
      const Bi: Pt = [X(v), Y(hi)];
      const real = v > 0;
      s += seg(Ai, Bi, real ? `stroke-width="2.4"` : `stroke-width="2" stroke-dasharray="6 4"`) + head(Bi, hi > 0 ? -90 : 90, c, 10);
      s += say(Ai[0], O[1] + (hi > 0 ? 18 : -8), "A′", { size: 13, anchor: "middle", fill: c, bold: true }) + say(Bi[0] + 8, Bi[1] + (hi > 0 ? 4 : 14), "B′", { size: 13, fill: c, bold: true });
    }
    return svg(W, H, s, c);
  },
};

// ---- Optical bench ----
function bench(c: string) {
  let s = `<rect x="10" y="150" width="520" height="16" rx="3" fill="#ffffff" stroke-width="2"/>`;
  for (let x = 20; x <= 520; x += 10) s += `<path d="M${x} 150v${(x - 20) % 50 === 0 ? 8 : 4}" stroke-width="0.8"/>`;
  // lamp housing
  s += `<rect x="24" y="64" width="64" height="56" rx="6" fill="#ffffff" stroke-width="2"/><path d="M56 120V150M44 150H68" stroke-width="2"/><circle cx="56" cy="92" r="12" stroke-width="1.6"/>`;
  // the object: a slide with a letter F
  s += `<rect x="116" y="62" width="10" height="60" fill="#ffffff" stroke-width="1.8"/><path d="M121 122V150M111 150H131" stroke-width="2"/><path d="M118 104V80H125M118 92H123" stroke-width="2"/>`;
  // lens on its holder
  s += `<path d="M260 50Q276 92 260 134Q244 92 260 50Z" fill="${LIQUID}" stroke-width="1.8"/><path d="M260 134V150M248 150H272" stroke-width="2"/>`;
  // screen
  s += `<rect x="440" y="40" width="10" height="100" fill="${SOLID}" stroke-width="1.8"/><path d="M445 140V150M433 150H457" stroke-width="2"/>`;
  s += seg([88, 92], [440, 92], `stroke-width="0.9" stroke-dasharray="8 4 2 4"`);
  return s.replace(/currentColor/g, c);
}
export const benchFigure = labeledFigure({
  id: "pc-bench",
  name: "Optical bench",
  w: 540,
  h: 172,
  draw: (_p, c) => bench(c),
  parts: [
    { key: "source", at: [40, 68], side: "t", fr: "Source lumineuse", ar: "منبع ضوئي" },
    { key: "object", at: [121, 64], side: "t", fr: "Objet (lettre F)", ar: "شيء (الحرف F)" },
    { key: "lens", at: [262, 52], side: "t", fr: "Lentille convergente", ar: "عدسة مجمعة" },
    { key: "screen", at: [445, 42], side: "t", fr: "Écran", ar: "شاشة" },
    { key: "bench", at: [330, 166], side: "b", fr: "Banc d'optique", ar: "مقعد بصري" },
    { key: "axis", at: [360, 92], side: "b", fr: "Axe optique", ar: "المحور البصري" },
  ],
});

// ---- Colours of light ----
// The colour of a wavelength (nm), as #rrggbb (a usual approximation of the visible spectrum).
export function waveColor(nm: number): string {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm < 440) [r, g, b] = [-(nm - 440) / 60, 0, 1];
  else if (nm < 490) [r, g, b] = [0, (nm - 440) / 50, 1];
  else if (nm < 510) [r, g, b] = [0, 1, -(nm - 510) / 20];
  else if (nm < 580) [r, g, b] = [(nm - 510) / 70, 1, 0];
  else if (nm < 645) [r, g, b] = [1, -(nm - 645) / 65, 0];
  else [r, g, b] = [1, 0, 0];
  const fade = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (780 - nm)) / 80 : 1;
  const hex = (v: number) => Math.round(clamp(v * fade, 0, 1) * 255).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

// ---- Dispersion by a prism ----
export const dispersionFigure: FigureDef = {
  id: "pc-dispersion",
  name: "Light through a prism",
  params: [
    {
      key: "light",
      label: "Kind of light",
      kind: "select",
      options: [
        { value: "white", label: "White light" },
        { value: "mono", label: "Monochromatic light (laser)" },
      ],
    },
    { key: "colors", label: "In colour", kind: "bool", row: "o" },
    { key: "screen", label: "Screen", kind: "bool", row: "o" },
  ],
  defaults: () => ({ light: "white", colors: false, screen: true }),
  build: (p, lang) => {
    const c = ink(p);
    const white = str(p, "light", "white") === "white";
    const colors = bool(p, "colors");
    const S: Pt = [220, 40];
    const Lb: Pt = [120, 230];
    const Rb: Pt = [320, 230];
    let s = `<polygon points="${[S, Rb, Lb].map((q) => `${r1(q[0])},${r1(q[1])}`).join(" ")}" fill="${LIQUID}" stroke-width="2"/>`;
    const I: Pt = [S[0] + (Lb[0] - S[0]) * 0.5, S[1] + (Lb[1] - S[1]) * 0.5];
    s += ray([20, 150], I, c, `stroke-width="2.4"`);
    s += chem(30, 140, white ? tr(lang, { fr: "lumière blanche", ar: "ضوء أبيض" }) : "laser", { size: 12, fill: c });
    const J: Pt = [S[0] + (Rb[0] - S[0]) * 0.52, S[1] + (Rb[1] - S[1]) * 0.52];
    const screenX = 470;
    if (white) {
      // the fan: red bent least (top), violet most (bottom)
      const n = colors ? 14 : 2;
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1);
        const J2: Pt = [J[0] + t * 6, J[1] + t * 10];
        const end: Pt = [screenX, 150 + t * 90];
        const col = colors ? waveColor(700 - t * 300) : c;
        s += `<path d="M${r1(I[0])} ${r1(I[1])}L${r1(J2[0])} ${r1(J2[1])}L${r1(end[0])} ${r1(end[1])}" stroke="${col}" stroke-width="${colors ? 2.2 : 1.6}"/>`;
      }
      if (!colors) s += `<path d="M${r1(J[0])} ${r1(J[1])}L${screenX} 150M${r1(J[0] + 6)} ${r1(J[1] + 10)}L${screenX} 240" stroke-width="1.6"/>`;
      s += chem(screenX + 16, 156, tr(lang, { fr: "rouge", ar: "أحمر" }), { size: 12, fill: c }) + chem(screenX + 16, 244, tr(lang, { fr: "violet", ar: "بنفسجي" }), { size: 12, fill: c });
    } else {
      s += seg(I, J, `stroke-width="2"`) + ray(J, [screenX, 190], c, `stroke-width="2"`);
    }
    if (bool(p, "screen")) s += `<rect x="${screenX}" y="110" width="8" height="160" fill="${SOLID}" stroke-width="1.6"/>`;
    return svg(540, 290, s, c);
  },
};

// ---- Spectra ----
const LINES: Record<string, number[]> = {
  H: [410.2, 434.0, 486.1, 656.3],
  He: [447.1, 471.3, 492.2, 501.6, 587.6, 667.8, 706.5],
  Na: [589.0, 589.6],
  Hg: [404.7, 435.8, 546.1, 577.0, 579.1],
};
export const spectrumFigure: FigureDef = {
  id: "pc-spectrum",
  name: "Spectrum",
  params: [
    {
      key: "kind",
      label: "Spectrum",
      kind: "select",
      options: [
        { value: "continuous", label: "Continuous" },
        { value: "emission", label: "Emission (lines)" },
        { value: "absorption", label: "Absorption (lines)" },
      ],
    },
    { key: "element", label: "Element", kind: "select", options: [{ value: "H", label: "H" }, { value: "He", label: "He" }, { value: "Na", label: "Na" }, { value: "Hg", label: "Hg" }, { value: "own", label: "Own lines" }], when: (p) => p.kind !== "continuous" },
    { key: "lines", label: "Wavelengths (nm)", kind: "text", placeholder: "450 520 610", when: (p) => p.kind !== "continuous" && p.element === "own" },
    { key: "scale", label: "Wavelength scale", kind: "bool", row: "o" },
    { key: "colors", label: "In colour", kind: "bool", row: "o" },
    { key: "values", label: "Wavelengths of the lines", kind: "bool", when: (p) => p.kind !== "continuous" },
  ],
  defaults: () => ({ kind: "emission", element: "H", lines: "450 520 610", scale: true, colors: false, values: false }),
  build: (p, lang) => {
    const c = ink(p);
    const kind = str(p, "kind", "emission");
    const colors = bool(p, "colors");
    const lo = 400;
    const hi = 750;
    const X = (nm: number) => 30 + ((nm - lo) / (hi - lo)) * 460;
    const top = bool(p, "values") ? 40 : 20;
    const h = 60;
    let s = "";
    const el = str(p, "element", "H");
    const lines = el === "own" ? str(p, "lines").split(/[\s;]+/).map((v) => Number(v.replace(",", "."))).filter((v) => v >= lo && v <= hi) : (LINES[el] ?? []);
    // the band
    if (kind === "emission") s += `<rect x="${X(lo)}" y="${top}" width="${X(hi) - X(lo)}" height="${h}" fill="${c}" stroke="none"/>`;
    else if (colors) for (let nm = lo; nm < hi; nm += 2) s += `<rect x="${r1(X(nm))}" y="${top}" width="${r1(X(nm + 2) - X(nm) + 0.4)}" height="${h}" fill="${waveColor(nm + 1)}" stroke="none"/>`;
    else s += `<rect x="${X(lo)}" y="${top}" width="${X(hi) - X(lo)}" height="${h}" fill="#d4d4d4" stroke="none"/>`;
    if (kind !== "continuous")
      for (const nm of lines) {
        const col = kind === "emission" ? (colors ? waveColor(nm) : "#ffffff") : c;
        s += `<rect x="${r1(X(nm) - 1.4)}" y="${top}" width="2.8" height="${h}" fill="${col}" stroke="none"/>`;
        if (bool(p, "values")) s += say(X(nm), top - 6, fmt(Math.round(nm)), { size: 10, anchor: "middle", fill: c });
      }
    s += `<rect x="${X(lo)}" y="${top}" width="${X(hi) - X(lo)}" height="${h}" stroke-width="1.6"/>`;
    let H = top + h + 14;
    if (bool(p, "scale")) {
      for (let nm = lo; nm <= hi; nm += 10) s += `<path d="M${r1(X(nm))} ${top + h}v${nm % 50 === 0 ? 8 : 4}" stroke-width="1"/>` + (nm % 50 === 0 ? say(X(nm), top + h + 22, String(nm), { size: 11, anchor: "middle", fill: c }) : "");
      s += chem(X(hi) + 18, top + h + 22, "λ (nm)", { size: 11, fill: c });
      H = top + h + 34;
    }
    if (kind === "continuous" && !colors) s += say(X(lo) + 4, top + h / 2 + 4, tr(lang, { fr: "violet", ar: "بنفسجي" }), { size: 11, fill: c }) + say(X(hi) - 4, top + h / 2 + 4, tr(lang, { fr: "rouge", ar: "أحمر" }), { size: 11, anchor: "end", fill: c });
    return svg(560, H, s, c);
  },
};

// ---- Diffraction by a slit ----
export const diffractionFigure: FigureDef = {
  id: "pc-diffraction",
  name: "Diffraction of light",
  params: [
    {
      key: "view",
      label: "View",
      kind: "select",
      options: [
        { value: "setup", label: "The set-up (a, D, L, θ)" },
        { value: "pattern", label: "The pattern on the screen" },
      ],
    },
    {
      key: "obstacle",
      label: "Obstacle",
      kind: "select",
      options: [
        { value: "slit", label: "A slit" },
        { value: "wire", label: "A wire" },
      ],
    },
  ],
  defaults: () => ({ view: "setup", obstacle: "slit" }),
  build: (p) => {
    const c = ink(p);
    const slit = str(p, "obstacle", "slit") === "slit";
    if (str(p, "view") === "pattern") {
      // the spots, along a line (perpendicular to the slit): the middle one twice as wide
      let s = "";
      const cx = 260;
      const spots: [number, number, number][] = [
        [0, 80, 1],
        [80, 40, 0.55],
        [-80, 40, 0.55],
        [140, 40, 0.3],
        [-140, 40, 0.3],
        [200, 40, 0.18],
        [-200, 40, 0.18],
      ];
      for (const [dx, w, k] of spots) {
        const g = Math.round(255 - k * 200).toString(16).padStart(2, "0");
        s += `<ellipse cx="${cx + dx}" cy="70" rx="${w / 2 - 4}" ry="${k === 1 ? 26 : 20}" fill="#${g}${g}${g}" stroke-width="1.2"/>`;
      }
      s += vector([cx, 120], [cx - 40, 120], c, 1.2) + vector([cx, 120], [cx + 40, 120], c, 1.2) + say(cx, 140, "L", { size: 14, anchor: "middle", fill: c, bold: true, italic: true });
      return svg(520, 150, s, c);
    }
    const sx = 140; // slit
    const ex = 470; // screen
    const y = 130;
    const Lh = 54; // half the central spot
    let s = `<rect x="20" y="${y - 16}" width="70" height="32" rx="4" fill="#ffffff" stroke-width="2"/>` + say(55, y + 5, "laser", { size: 12, anchor: "middle", fill: c, bold: true });
    s += seg([90, y], [sx, y], `stroke-width="2.4"`);
    if (slit) s += `<path d="M${sx} 40V${y - 5}M${sx} ${y + 5}V220" stroke-width="3"/>`;
    else s += `<path d="M${sx} ${y - 4}V${y + 4}" stroke-width="3"/>`;
    s += `<rect x="${ex}" y="40" width="8" height="180" fill="${SOLID}" stroke-width="1.6"/>`;
    s += dashed([sx, y], [ex, y], 0.9) + seg([sx, y], [ex, y - Lh], `stroke-width="1.2"`) + seg([sx, y], [ex, y + Lh], `stroke-width="1.2"`);
    // the central spot on the screen
    s += `<rect x="${ex - 4}" y="${y - Lh}" width="4" height="${2 * Lh}" fill="${c}" stroke="none"/>`;
    const r = 120;
    const th = Math.atan2(Lh, ex - sx);
    s += `<path d="M${sx + r} ${y}A${r} ${r} 0 0 0 ${r1(sx + r * Math.cos(th))} ${r1(y - r * Math.sin(th))}" stroke-width="1.2"/>` + say(sx + r + 12, y - 6, "θ", { size: 15, fill: c, italic: true });
    s += vector([(sx + ex) / 2, 240], [sx, 240], c, 1.2) + vector([(sx + ex) / 2, 240], [ex, 240], c, 1.2) + say((sx + ex) / 2, 234, "D", { size: 14, anchor: "middle", fill: c, bold: true, italic: true });
    s += vector([ex + 30, y], [ex + 30, y - Lh], c, 1.2) + vector([ex + 30, y], [ex + 30, y + Lh], c, 1.2) + say(ex + 38, y + 5, "L", { size: 14, fill: c, bold: true, italic: true });
    s += dashed([ex + 8, y - Lh], [ex + 34, y - Lh], 0.8) + dashed([ex + 8, y + Lh], [ex + 34, y + Lh], 0.8);
    s += say(sx - 8, 34, "a", { size: 14, anchor: "end", fill: c, bold: true, italic: true });
    return svg(530, 256, s, c);
  },
};

// ---- Wavelength scale: UV, visible, IR ----
export const emScaleFigure: FigureDef = {
  id: "pc-em-scale",
  name: "UV, visible and infrared",
  params: [{ key: "colors", label: "In colour", kind: "bool" }],
  defaults: () => ({ colors: false }),
  build: (p, lang) => {
    const c = ink(p);
    const X = (nm: number) => 40 + ((nm - 200) / 800) * 460;
    const y = 50;
    let s = "";
    if (bool(p, "colors")) for (let nm = 400; nm < 800; nm += 4) s += `<rect x="${r1(X(nm))}" y="${y}" width="${r1(X(nm + 4) - X(nm) + 0.3)}" height="36" fill="${waveColor(nm + 2)}" stroke="none"/>`;
    else s += `<rect x="${X(400)}" y="${y}" width="${X(800) - X(400)}" height="36" fill="#d4d4d4" stroke="none"/>`;
    s += `<rect x="${X(200)}" y="${y}" width="${X(1000) - X(200)}" height="36" stroke-width="1.6"/><path d="M${r1(X(400))} ${y}v36M${r1(X(800))} ${y}v36" stroke-width="1.6"/>`;
    s += say((X(200) + X(400)) / 2, y + 23, tr(lang, { fr: "UV", ar: "فوق البنفسجي" }), { size: 13, anchor: "middle", fill: c, bold: true });
    s += say((X(400) + X(800)) / 2, y + 23, tr(lang, { fr: "visible", ar: "المرئي" }), { size: 13, anchor: "middle", fill: c, bold: true });
    s += say((X(800) + X(1000)) / 2, y + 23, tr(lang, { fr: "IR", ar: "تحت الأحمر" }), { size: 13, anchor: "middle", fill: c, bold: true });
    s += seg([X(200) - 10, y + 56], [X(1000) + 16, y + 56], `stroke-width="1.4"`) + head([X(1000) + 22, y + 56], 0, c);
    for (const nm of [400, 800]) s += `<path d="M${r1(X(nm))} ${y + 52}v8" stroke-width="1.4"/>` + say(X(nm), y + 76, String(nm), { size: 12, anchor: "middle", fill: c });
    s += chem(X(1000) + 20, y + 76, "λ (nm)", { size: 12, anchor: "end", fill: c });
    return svg(540, y + 90, s, c);
  },
};

export const OPTICS_FIGURES: FigureDef[] = [refractionFigure, halfCylinderFigure, prismFigure, thinLensFigure, benchFigure, dispersionFigure, spectrumFigure, diffractionFigure, emScaleFigure];
