// Nuclear transformations: the symbol of a nucleus, the decay curve N(t), the Segré diagram (N, Z), the Aston curve,
// the kinds of radioactivity, and the energy diagram of a nucleus or of a nuclear reaction.
import { bool, clamp, ink, num, r1, str, svg, type Pt } from "../svg";
import type { FigureDef } from "../types";
import { labeledFigure } from "../sciences/labeled";
import { chem, curve, dashed, disc, frame, guide, head, path, say, seg, tr, vector } from "./draw";

// A nucleus written ᴬ_Z X: the mass number above the charge number, both on the left of the symbol.
export function nuclide(x: number, y: number, A: string, Z: string, X: string, c: string, size = 16) {
  const small = Math.round(size * 0.62);
  const w = Math.max(A.length, Z.length) * small * 0.6;
  return (
    say(x + w, y - size * 0.55, A, { size: small, anchor: "end", fill: c }) +
    say(x + w, y + size * 0.28, Z, { size: small, anchor: "end", fill: c }) +
    say(x + w + 1, y, X, { size, fill: c, bold: true })
  );
}
const nuclideWidth = (A: string, Z: string, X: string, size = 16) => Math.max(A.length, Z.length) * size * 0.62 * 0.6 + X.length * size * 0.62 + 2;

// ---- The symbol of a nucleus ----
export const nuclideFigure = labeledFigure({
  id: "pc-nuclide",
  name: "Symbol of a nucleus",
  params: [
    { key: "A", label: "Mass number A", kind: "number", min: 1, max: 300, row: "n" },
    { key: "Z", label: "Charge number Z", kind: "number", min: 0, max: 120, row: "n" },
    { key: "X", label: "Symbol", kind: "text", placeholder: "U" },
  ],
  defaults: { A: 235, Z: 92, X: "U" },
  w: 220,
  h: 130,
  draw: (p, c) => nuclide(50, 86, String(Math.round(num(p, "A", 235))), String(Math.round(num(p, "Z", 92))), str(p, "X", "U"), c, 64),
  parts: [
    { key: "A", at: [74, 40], side: "l", fr: "Nombre de masse A (nucléons)", ar: "عدد الكتلة A (عدد النويات)" },
    { key: "Z", at: [74, 102], side: "l", fr: "Nombre de charge Z (protons)", ar: "عدد الشحنة Z (عدد البروتونات)" },
    { key: "X", at: [150, 64], side: "r", fr: "Symbole de l'élément", ar: "رمز العنصر" },
  ],
});

// ---- Radioactive decay ----
export const decayFigure: FigureDef = {
  id: "pc-decay",
  name: "Radioactive decay curve",
  params: [
    {
      key: "quantity",
      label: "Quantity",
      kind: "select",
      options: [
        { value: "N", label: "Number of nuclei N" },
        { value: "a", label: "Activity a" },
        { value: "m", label: "Mass m" },
      ],
    },
    { key: "half", label: "Half-life t½", kind: "number", min: 0.1, max: 100000, step: 0.1, row: "t" },
    { key: "unit", label: "Time unit", kind: "text", placeholder: "jours", row: "t" },
    { key: "steps", label: "Half-lives marked", kind: "number", min: 0, max: 4 },
    { key: "grid", label: "Grid", kind: "bool", row: "o" },
    { key: "tangent", label: "Tangent at t = 0 (τ)", kind: "bool", row: "o" },
  ],
  defaults: (lang) => ({ quantity: "N", half: 8, unit: lang === "ar" ? "يوم" : "jours", steps: 2, grid: true, tangent: false }),
  build: (p) => {
    const c = ink(p);
    const q = str(p, "quantity", "N");
    const T = Math.max(0.1, num(p, "half", 8));
    const unit = str(p, "unit");
    const tMax = T * 5;
    const step = (v: number) => {
      const raw = v / 10;
      const pow = 10 ** Math.floor(Math.log10(raw));
      return [1, 2, 2.5, 5, 10].map((k) => k * pow).find((k) => k >= raw) ?? raw;
    };
    const f = frame({ x0: 70, y0: 250, w: 380, h: 200, xMax: tMax, yMax: 1.1, xName: unit ? `t (${unit})` : "t", yName: q === "N" ? "N(t)" : q === "a" ? "a(t) (Bq)" : "m(t) (g)", c, xStep: step(tMax), grid: bool(p, "grid"), gridX: step(tMax) / 2, gridY: 0.05 });
    const fn = (t: number) => Math.exp((-Math.LN2 * t) / T);
    let s = f.s + `<path d="${path(curve(f, fn, 0, tMax, 200))}" stroke-width="2.2"/>`;
    const name0 = `${q}0`;
    s += chem(f.x0 - 8, f.Y(1) + 4, name0, { size: 12, anchor: "end", fill: c, bold: true });
    const n = Math.round(clamp(num(p, "steps", 2), 0, 4));
    for (let k = 1; k <= n; k++) s += guide(f, k * T, 2 ** -k, k === 1 ? "t½" : `${k}t½`, `${name0}/${2 ** k}`, c);
    if (bool(p, "tangent")) {
      const tau = T / Math.LN2;
      s += seg([f.X(0), f.Y(1)], [f.X(tau * 1.05), f.Y(-0.05)], `stroke-width="1.2"`) + say(f.X(tau), f.y0 - 6, "τ", { size: 13, anchor: "middle", fill: c, bold: true });
    }
    return svg(490, 300, s, c);
  },
};

// ---- Segré diagram ----
const stableN = (z: number) => z + 0.0065 * z * z;
export const segreFigure: FigureDef = {
  id: "pc-segre",
  name: "Segré diagram (N, Z)",
  params: [
    { key: "zones", label: "Zones (α, β−, β+)", kind: "bool", row: "o" },
    { key: "line", label: "Line N = Z", kind: "bool", row: "o" },
  ],
  defaults: () => ({ zones: true, line: true }),
  build: (p, lang) => {
    const c = ink(p);
    const f = frame({ x0: 50, y0: 300, w: 300, h: 260, xMax: 100, yMax: 160, xName: "Z", yName: "N", c, xStep: 20, yStep: 20 });
    let s = f.s;
    if (bool(p, "line")) s += `<path d="M${f.X(0)} ${f.Y(0)}L${f.X(100)} ${f.Y(100)}" stroke-width="1.2" stroke-dasharray="6 4"/>` + chem(f.X(100) + 4, f.Y(100) + 4, "N = Z", { size: 12, fill: c });
    // the stable nuclei: small squares along the valley
    let dots = "";
    for (let z = 2; z <= 83; z += 1.5) {
      const spread = 1 + z / 30;
      for (const k of [-1, 0, 1]) {
        const n = stableN(z) + k * spread;
        dots += `<rect x="${r1(f.X(z) - 1.6)}" y="${r1(f.Y(n) - 1.6)}" width="3.2" height="3.2" fill="${c}" stroke="none"/>`;
      }
    }
    s += dots;
    if (bool(p, "zones")) {
      s += say(f.X(28), f.Y(68), "β⁻", { size: 18, anchor: "middle", fill: c, bold: true }) + say(f.X(62), f.Y(52), "β⁺", { size: 18, anchor: "middle", fill: c, bold: true }) + say(f.X(92), f.Y(150), "α", { size: 18, anchor: "middle", fill: c, bold: true });
      s += say(f.X(86), f.Y(stableN(83)) + 4, tr(lang, { fr: "vallée de stabilité", ar: "منطقة الاستقرار" }), { size: 11.5, anchor: "start", fill: c, italic: true });
    }
    return svg(470, 340, s, c);
  },
};

// ---- Aston curve ----
// Binding energy per nucleon (MeV): measured for light nuclei, the semi-empirical formula beyond.
const LIGHT: [number, number][] = [
  [2, 1.11],
  [3, 2.83],
  [4, 7.07],
  [6, 5.33],
  [7, 5.61],
  [9, 6.46],
  [12, 7.68],
  [16, 7.98],
];
function bindingPerNucleon(A: number) {
  const Z = A / (1.98 + 0.0155 * A ** (2 / 3));
  const B = 15.75 * A - 17.8 * A ** (2 / 3) - (0.711 * Z * Z) / A ** (1 / 3) - (23.7 * (A - 2 * Z) ** 2) / A;
  return B / A;
}
export const astonFigure: FigureDef = {
  id: "pc-aston",
  name: "Aston curve",
  params: [
    { key: "zones", label: "Fusion and fission zones", kind: "bool", row: "o" },
    { key: "nuclei", label: "Some nuclei", kind: "bool", row: "o" },
  ],
  defaults: () => ({ zones: true, nuclei: true }),
  build: (p, lang) => {
    const c = ink(p);
    // the y axis points down: −El/A from 0 to −9
    const x0 = 70;
    const y0 = 40;
    const w = 400;
    const h = 220;
    const X = (A: number) => x0 + (A / 250) * w;
    const Y = (e: number) => y0 + (e / 9) * h; // e = El/A > 0, drawn down
    let s = `<path d="M${x0} ${y0 + h + 10}V${y0}H${x0 + w + 12}" stroke-width="1.6"/>` + head([x0 + w + 18, y0], 0, c) + head([x0, y0 + h + 16], 90, c);
    s += chem(x0 + w + 14, y0 - 10, "A", { size: 13, anchor: "end", fill: c, bold: true });
    s += chem(x0 + 8, y0 + h + 22, `−El/A (MeV/${tr(lang, { fr: "nucléon", ar: "نوية" })})`, { size: 12, fill: c });
    for (let e = 1; e <= 9; e++) s += `<path d="M${x0} ${r1(Y(e))}h-5" stroke-width="1"/>` + say(x0 - 8, Y(e) + 4, `−${e}`, { size: 10.5, anchor: "end", fill: c });
    for (let A = 50; A <= 250; A += 50) s += `<path d="M${r1(X(A))} ${y0}v-5" stroke-width="1"/>` + say(X(A), y0 - 9, String(A), { size: 10.5, anchor: "middle", fill: c });
    const pts: Pt[] = LIGHT.map(([A, e]) => [X(A), Y(e)]);
    for (let A = 20; A <= 240; A += 2) pts.push([X(A), Y(bindingPerNucleon(A))]);
    s += `<path d="${path(pts)}" stroke-width="2.2"/>`;
    if (bool(p, "nuclei"))
      for (const [A, label] of [
        [2, "²H"],
        [4, "⁴He"],
        [56, "⁵⁶Fe"],
        [235, "²³⁵U"],
      ] as [number, string][]) {
        const e = A < 20 ? (LIGHT.find((l) => l[0] === A)?.[1] ?? 0) : bindingPerNucleon(A);
        s += disc([X(A), Y(e)], 3.2, c, `stroke="none"`) + say(X(A) + (A > 200 ? -6 : 8), Y(e) + (A === 2 ? -6 : 18), label, { size: 12, anchor: A > 200 ? "end" : "start", fill: c, bold: true });
      }
    if (bool(p, "zones")) {
      s += dashed([X(25), y0 + 4], [X(25), y0 + h], 0.9) + dashed([X(190), y0 + 4], [X(190), y0 + h], 0.9);
      s += say(x0 + 4, y0 + 60, tr(lang, { fr: "fusion", ar: "الاندماج" }), { size: 11, anchor: "start", fill: c, bold: true });
      s += say(X(220), y0 + 60, tr(lang, { fr: "fission", ar: "الانشطار" }), { size: 12, anchor: "middle", fill: c, bold: true });
      s += say(X(100), y0 + 120, tr(lang, { fr: "noyaux les plus stables", ar: "النوى الأكثر استقرارا" }), { size: 11, anchor: "middle", fill: c, italic: true });
    }
    return svg(500, 300, s, c);
  },
};

// ---- Kinds of radioactivity ----
// A nucleus: a cluster of protons (grey) and neutrons (white), n balls round (x, y).
function cluster(x: number, y: number, n: number, c: string, r = 7) {
  let s = "";
  for (let k = 0; k < n; k++) {
    const a = k * 2.4;
    const d = r * 0.95 * Math.sqrt(k);
    s += `<circle cx="${r1(x + d * Math.cos(a))}" cy="${r1(y + d * Math.sin(a))}" r="${r}" fill="${k % 2 ? "#ffffff" : "#a6a6a6"}" stroke="${c}" stroke-width="1.2"/>`;
  }
  return s;
}
export const decayTypeFigure: FigureDef = {
  id: "pc-decay-type",
  name: "Kinds of radioactivity",
  params: [
    {
      key: "kind",
      label: "Radioactivity",
      kind: "select",
      options: [
        { value: "alpha", label: "α" },
        { value: "beta-", label: "β−" },
        { value: "beta+", label: "β+" },
        { value: "gamma", label: "γ" },
      ],
    },
    { key: "equation", label: "Equation", kind: "bool" },
  ],
  defaults: () => ({ kind: "alpha", equation: true }),
  build: (p) => {
    const c = ink(p);
    const kind = str(p, "kind", "alpha");
    let s = cluster(80, 90, 22, c) + vector([140, 90], [210, 90], c, 2);
    s += cluster(280, 90, kind === "alpha" ? 18 : 22, c);
    const P: Pt = [400, 70];
    if (kind === "alpha") s += cluster(P[0], P[1], 4, c, 6) + say(P[0], P[1] + 34, "α", { size: 16, anchor: "middle", fill: c, bold: true });
    else if (kind === "gamma") s += `<path d="M340 76q6 -10 12 0t12 0t12 0t12 0t12 0" stroke-width="1.8"/>` + head([418, 76], 0, c) + say(P[0], P[1] + 34, "γ", { size: 18, anchor: "middle", fill: c, bold: true });
    else s += disc(P, 6, "#ffffff", `stroke-width="1.4"`) + say(P[0], P[1] + 4, kind === "beta-" ? "−" : "+", { size: 11, anchor: "middle", fill: c, bold: true }) + say(P[0], P[1] + 30, kind === "beta-" ? "e⁻" : "e⁺", { size: 16, anchor: "middle", fill: c, bold: true });
    if (kind !== "gamma") s += vector([320, 82], [380, 72], c, 1.4);
    if (bool(p, "equation")) {
      const eq: Record<string, [string, string, string][]> = {
        alpha: [["A", "Z", "X"], ["A−4", "Z−2", "Y"], ["4", "2", "He"]],
        "beta-": [["A", "Z", "X"], ["A", "Z+1", "Y"], ["0", "−1", "e"]],
        "beta+": [["A", "Z", "X"], ["A", "Z−1", "Y"], ["0", "1", "e"]],
        gamma: [["A", "Z", "Y*"], ["A", "Z", "Y"], ["", "", "γ"]],
      };
      const [a, b, e] = eq[kind] ?? eq.alpha;
      let x = 80;
      const y = 180;
      s += nuclide(x, y, ...a, c, 20);
      x += nuclideWidth(...a, 20) + 18;
      s += vector([x, y - 6], [x + 40, y - 6], c, 1.6);
      x += 56;
      s += nuclide(x, y, ...b, c, 20);
      x += nuclideWidth(...b, 20) + 14;
      s += say(x, y, "+", { size: 20, fill: c });
      x += 22;
      s += nuclide(x, y, ...e, c, 20);
    }
    return svg(460, bool(p, "equation") ? 210 : 140, s, c);
  },
};

// ---- Energy diagram ----
export const nuclearEnergyFigure: FigureDef = {
  id: "pc-nuclear-energy",
  name: "Energy diagram (nuclear)",
  hint: "Write the particles of each level; leave a level empty for the student.",
  params: [
    {
      key: "kind",
      label: "Diagram",
      kind: "select",
      options: [
        { value: "binding", label: "Binding energy of a nucleus" },
        { value: "reaction", label: "Energy of a reaction" },
      ],
    },
    { key: "top", label: "Top level", kind: "text", placeholder: "92 p + 143 n" },
    { key: "middle", label: "Reactants", kind: "text", placeholder: "²³⁵U + n", when: (p) => p.kind === "reaction" },
    { key: "bottom", label: "Bottom level", kind: "text", placeholder: "²³⁵U" },
    { key: "energies", label: "Energy arrows (El, ΔE)", kind: "bool" },
  ],
  defaults: () => ({ kind: "reaction", top: "92 p + 144 n", middle: "²³⁵U + ¹n", bottom: "⁹⁴Sr + ¹⁴⁰Xe + 2 ¹n", energies: true }),
  normalize: (p, changed) => (changed === "kind" ? (p.kind === "binding" ? { ...p, top: "92 p + 143 n", bottom: "²³⁵U" } : { ...p, top: "92 p + 144 n", middle: "²³⁵U + ¹n", bottom: "⁹⁴Sr + ¹⁴⁰Xe + 2 ¹n" }) : p),
  build: (p) => {
    const c = ink(p);
    const reaction = str(p, "kind", "reaction") === "reaction";
    const x0 = 60;
    let s = `<path d="M${x0} 270V20" stroke-width="1.6"/>` + head([x0, 14], -90, c) + chem(x0 + 8, 22, "E (MeV)", { size: 12, fill: c });
    const levels: [number, string][] = reaction
      ? [
          [50, str(p, "top")],
          [150, str(p, "middle")],
          [240, str(p, "bottom")],
        ]
      : [
          [60, str(p, "top")],
          [230, str(p, "bottom")],
        ];
    for (const [y, t] of levels) {
      s += `<path d="M${x0 + 20} ${y}H${x0 + 200}" stroke-width="2.4"/>`;
      s += t ? say(x0 + 214, y + 5, t, { size: 14, fill: c }) : `<rect x="${x0 + 214}" y="${y - 12}" width="150" height="22" fill="#ffffff" stroke-width="1" stroke-dasharray="3 3"/>`;
    }
    if (bool(p, "energies")) {
      if (reaction) {
        s += vector([x0 + 60, 50], [x0 + 60, 150], c, 1.6) + vector([x0 + 140, 50], [x0 + 140, 240], c, 1.6) + vector([x0 + 100, 150], [x0 + 100, 240], c, 1.6);
        s += chem(x0 + 54, 104, "El1", { size: 12, anchor: "end", fill: c, bold: true }) + chem(x0 + 146, 104, "El2", { size: 12, fill: c, bold: true }) + chem(x0 + 106, 200, "|ΔE|", { size: 12, fill: c, bold: true });
      } else s += vector([x0 + 110, 230], [x0 + 110, 60], c, 1.6) + chem(x0 + 118, 150, "El", { size: 13, fill: c, bold: true });
    }
    return svg(460, 280, s, c);
  },
};

export const NUCLEAR_FIGURES: FigureDef[] = [nuclideFigure, decayFigure, segreFigure, astonFigure, decayTypeFigure, nuclearEnergyFigure];
