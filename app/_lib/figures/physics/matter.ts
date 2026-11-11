// Structure and cohesion of matter: the atom and its electron shells, extracting and separating chemical species
// (hydrodistillation, separating funnel, thin-layer chromatography), the electrostatic interaction.
import { bool, clamp, ink, num, r1, str, svg, type Pt } from "../svg";
import type { FigureDef } from "../types";
import { labeledFigure } from "../sciences/labeled";
import { LIQUID, SOLID, beaker, chem, dashed, disc, head, say, stand, surface, tr, vecName, vector } from "./draw";

// ---- The atom: nucleus and shells K, L, M, N ----
const ELEMENTS = ["H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne", "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca"];
// The electrons of each shell (K, L, M, N) for Z ≤ 20.
export function shells(z: number): number[] {
  const out: number[] = [];
  let left = z;
  for (const cap of [2, 8, 8, 2]) {
    if (left <= 0) break;
    out.push(Math.min(cap, left));
    left -= cap;
  }
  return out;
}

export const atomFigure: FigureDef = {
  id: "pc-atom",
  name: "Atom: electron shells",
  params: [
    { key: "z", label: "Atomic number Z", kind: "number", min: 1, max: 20 },
    {
      key: "nucleus",
      label: "In the nucleus",
      kind: "select",
      options: [
        { value: "symbol", label: "Symbol" },
        { value: "charge", label: "Charge (Z+)" },
        { value: "none", label: "Nothing" },
      ],
    },
    { key: "electrons", label: "Electrons (dots)", kind: "bool", row: "e" },
    { key: "names", label: "Shell names (K, L, M)", kind: "bool", row: "e" },
    { key: "formula", label: "Electron formula", kind: "bool" },
  ],
  defaults: () => ({ z: 11, nucleus: "symbol", electrons: true, names: true, formula: false }),
  build: (p) => {
    const c = ink(p);
    const z = Math.round(clamp(num(p, "z", 11), 1, 20));
    const list = shells(z);
    const C: Pt = [150, 150];
    let s = disc(C, 24, SOLID, `stroke-width="2"`);
    const nucleus = str(p, "nucleus", "symbol");
    if (nucleus === "symbol") s += say(C[0], C[1] + 6, ELEMENTS[z - 1], { size: 17, anchor: "middle", fill: c, bold: true });
    if (nucleus === "charge") s += say(C[0], C[1] + 5, `${z}+`, { size: 14, anchor: "middle", fill: c, bold: true });
    const names = ["K", "L", "M", "N"];
    list.forEach((n, i) => {
      const r = 50 + i * 30;
      s += `<circle cx="${C[0]}" cy="${C[1]}" r="${r}" stroke-width="1.4"/>`;
      if (bool(p, "names")) s += say(C[0] + r * 0.72 + 4, C[1] + r * 0.72 + 14, names[i], { size: 12, fill: c, bold: true });
      if (bool(p, "electrons"))
        for (let k = 0; k < n; k++) {
          // in pairs, spread round the shell
          const pair = Math.floor(k / 2);
          const pairs = Math.ceil(n / 2);
          const a = ((pair / Math.max(pairs, 1)) * 360 - 90 + (k % 2 ? 9 : -9) * (n > 1 ? 1 : 0) + i * 20) * (Math.PI / 180);
          s += disc([C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)], 4.5, c, `stroke="none"`);
        }
    });
    const size = 150 + 50 + (list.length - 1) * 30 + 20;
    let H = 300;
    if (bool(p, "formula")) {
      const f = list.map((n, i) => `(${names[i]})^${n}`).join(" ");
      s += chem(C[0], 300 + 4, f, { size: 15, anchor: "middle", fill: c });
      H = 320;
    }
    return svg(Math.max(300, size), H, s, c);
  },
};

// ---- Hydrodistillation ----
function hydro(c: string) {
  let s = "";
  // heater and flask
  s += `<path d="M30 250Q30 300 90 300Q150 300 150 250Z" fill="#ffffff" stroke-width="2"/><rect x="24" y="300" width="132" height="22" rx="3" fill="#ffffff" stroke-width="2"/>`;
  s += `<circle cx="134" cy="311" r="5" stroke-width="1.4"/>`;
  s += `<path d="M78 140V188Q40 200 40 238Q40 288 90 288Q140 288 140 238Q140 200 102 188V140" fill="#ffffff" stroke-width="2"/>`;
  s += `<path d="M44 228Q90 236 136 228Q140 236 140 238Q140 288 90 288Q40 288 40 238Q40 236 44 228Z" fill="${LIQUID}" stroke="none"/>` + surface(44, 136, 228);
  // plant pieces
  for (const [x, y, a] of [
    [64, 250, 20], [96, 262, -30], [116, 246, 50], [80, 272, -10], [104, 238, 10],
  ])
    s += `<path d="M${x - 8} ${y}q8 -6 16 0q-8 6 -16 0z" transform="rotate(${a} ${x} ${y})" stroke-width="1.2"/>`;
  // still head with thermometer
  s += `<path d="M78 140V100H102V113M102 123V140" stroke-width="2"/>`;
  s += `<rect x="85" y="34" width="10" height="92" rx="5" fill="#ffffff" stroke-width="1.5"/><circle cx="90" cy="124" r="6" fill="${c}" stroke="none"/><path d="M80 98H100" stroke-width="3"/>`;
  // condenser: the inner tube, inclined down to the right, in its water jacket (water in at the bottom, out at the top)
  let k = `<path d="M0 -5H252M0 5H252" stroke-width="2"/>`;
  k += `<path d="M44 -5V-15H64V-28M74 -28V-15H200V-5M44 5V15H182V28M192 28V15H200V5" fill="#ffffff" stroke-width="2"/>`;
  k += `<path d="M44 -5H200M44 5H200" stroke-width="2"/>`;
  k += head([69, -40], -90, c, 8) + head([187, 22], -90, c, 8);
  s += `<g transform="translate(102 118) rotate(22)">${k}</g>`;
  // collecting flask: water and the oil on top
  s += `<path d="M334 222V232L300 300H392L358 232V222" fill="#ffffff" stroke-width="2"/>`;
  s += `<path d="M308 284H384L392 300H300Z" fill="${LIQUID}" stroke="none"/><path d="M312 276H380L384 284H308Z" fill="#9a9a9a" stroke="none"/><path d="M308 284H384" stroke-width="1"/>`;
  return s;
}
export const hydrodistillationFigure = labeledFigure({
  id: "pc-hydrodistillation",
  name: "Hydrodistillation",
  w: 400,
  h: 326,
  draw: (_p, c) => hydro(c),
  parts: [
    { key: "thermo", at: [90, 50], side: "l", fr: "Thermomètre", ar: "محرار" },
    { key: "flask", at: [44, 206], side: "l", fr: "Ballon", ar: "حوجلة" },
    { key: "mix", at: [64, 254], side: "l", fr: "Eau + matière végétale", ar: "ماء + مادة نباتية" },
    { key: "heater", at: [30, 306], side: "l", fr: "Chauffe-ballon", ar: "مسخن كهربائي" },
    { key: "out", at: [174, 100], side: "t", fr: "Sortie d'eau", ar: "خروج الماء" },
    { key: "condenser", at: [236, 160], side: "r", fr: "Réfrigérant", ar: "مبرد" },
    { key: "in", at: [272, 222], side: "r", fr: "Entrée d'eau froide", ar: "دخول الماء البارد" },
    { key: "oil", at: [376, 280], side: "r", fr: "Huile essentielle", ar: "الزيت العطري" },
    { key: "water", at: [386, 294], side: "r", fr: "Eau (distillat)", ar: "الماء (المقطر)" },
  ],
});

// ---- Separating funnel ----
function funnel(organicTop: boolean, c: string) {
  let s = stand(40, 330, 20, 150, 120);
  // the ring and the funnel (pear shape), stopper, tap, stem
  s += `<path d="M106 150H170" stroke-width="2.4"/>`;
  s += `<path d="M128 30V40Q80 70 92 130L128 196V220M152 30V40Q200 70 188 130L152 196V220" fill="#ffffff" stroke-width="2"/>`;
  s += `<rect x="126" y="16" width="28" height="16" rx="3" fill="#ffffff" stroke-width="1.8"/>`;
  s += `<path d="M94 92Q140 98 186 92Q192 112 188 130L152 196H128L92 130Q90 112 94 92Z" fill="${organicTop ? LIQUID : "#9a9a9a"}" stroke="none"/>`;
  s += `<path d="M90 120Q140 126 190 120Q190 126 188 130L152 196H128L92 130Q90 126 90 120Z" fill="${organicTop ? "#9a9a9a" : LIQUID}" stroke="none"/>`;
  s += `<path d="M94 92Q140 98 186 92M90 120Q140 126 190 120" stroke-width="1.2"/>`;
  s += `<path d="M128 220V250M152 220V250" stroke-width="2"/><rect x="118" y="226" width="44" height="12" rx="3" fill="#ffffff" stroke-width="1.6"/><path d="M162 232H176" stroke-width="3"/>`;
  s += `<path d="M134 250V268M146 250V268" stroke-width="1.6"/>`;
  s += beaker(100, 278, 80, 52, 0.3);
  return s.replace(/currentColor/g, c);
}
export const funnelFigure = labeledFigure({
  id: "pc-funnel",
  name: "Separating funnel",
  params: [
    {
      key: "organic",
      label: "Organic phase",
      kind: "select",
      options: [
        { value: "top", label: "On top (less dense)" },
        { value: "bottom", label: "At the bottom (denser)" },
      ],
    },
  ],
  defaults: { organic: "top" },
  w: 240,
  h: 344,
  draw: (p, c) => funnel(str(p, "organic", "top") === "top", c),
  parts: (p) => {
    const top = str(p, "organic", "top") === "top";
    return [
      { key: "stopper", at: [154, 24], side: "r", fr: "Bouchon", ar: "سدادة" },
      { key: "upper", at: [186, 104], side: "r", fr: top ? "Phase organique" : "Phase aqueuse", ar: top ? "الطور العضوي" : "الطور المائي" },
      { key: "lower", at: [176, 150], side: "r", fr: top ? "Phase aqueuse" : "Phase organique", ar: top ? "الطور المائي" : "الطور العضوي" },
      { key: "tap", at: [176, 232], side: "r", fr: "Robinet", ar: "صنبور" },
      { key: "funnel", at: [96, 70], side: "l", fr: "Ampoule à décanter", ar: "أنبوب التصفيق" },
      { key: "support", at: [40, 200], side: "l", fr: "Support", ar: "حامل" },
      { key: "beaker", at: [100, 300], side: "l", fr: "Bécher", ar: "كأس" },
    ];
  },
});

// ---- Thin-layer chromatography ----
const lanes = (s: string) =>
  s.split(";").map((lane) =>
    lane
      .trim()
      .split(/\s+/)
      .map((v) => Number(v.replace(",", ".")))
      .filter((v) => Number.isFinite(v) && v > 0 && v < 1),
  );

export const tlcFigure: FigureDef = {
  id: "pc-tlc",
  name: "Thin-layer chromatography",
  hint: "One lane per deposit, separated by “;”: the heights of its spots (Rf between 0 and 1).",
  params: [
    { key: "spots", label: "Spots (Rf) of each lane", kind: "text", placeholder: "0,3 ; 0,3 0,7 ; 0,7" },
    { key: "deposits", label: "Names of the deposits", kind: "text", placeholder: "A B C" },
    { key: "tank", label: "In its tank", kind: "bool", row: "t" },
    { key: "names", label: "Names (front, line)", kind: "bool", row: "t" },
    { key: "heights", label: "Heights h and H", kind: "bool" },
  ],
  defaults: () => ({ spots: "0,3 ; 0,3 0,72 ; 0,72 ; 0,45", deposits: "A M B C", tank: false, names: true, heights: false }),
  build: (p, lang) => {
    const c = ink(p);
    const all = lanes(str(p, "spots"));
    const names = str(p, "deposits").trim().split(/\s+/);
    const n = Math.max(1, Math.min(6, all.length));
    const tank = bool(p, "tank");
    const pw = 60 + n * 46;
    const X0 = tank ? 70 : 40;
    const top = tank ? 70 : 30;
    const ph = 260;
    const line = top + ph - 36; // deposit line
    const front = top + 34;
    const Y = (rf: number) => line - rf * (line - front);
    let s = "";
    if (tank) {
      s += `<path d="M${X0 - 34} ${top - 30}V${top + ph + 10}Q${X0 - 34} ${top + ph + 20} ${X0 - 24} ${top + ph + 20}H${X0 + pw + 24}Q${X0 + pw + 34} ${top + ph + 20} ${X0 + pw + 34} ${top + ph + 10}V${top - 30}" stroke-width="2"/>`;
      s += `<rect x="${X0 - 44}" y="${top - 44}" width="${pw + 88}" height="14" rx="3" fill="#ffffff" stroke-width="2"/>`;
      s += `<path d="M${X0 - 34} ${top + ph - 16}H${X0 + pw + 34}V${top + ph + 10}Q${X0 + pw + 34} ${top + ph + 20} ${X0 + pw + 24} ${top + ph + 20}H${X0 - 24}Q${X0 - 34} ${top + ph + 20} ${X0 - 34} ${top + ph + 10}Z" fill="${LIQUID}" stroke="none"/>`;
      s += surface(X0 - 34, X0 + pw + 34, top + ph - 16);
    }
    s += `<rect x="${X0}" y="${top}" width="${pw}" height="${ph}" fill="#ffffff" stroke-width="2"/>`;
    if (tank) s += `<rect x="${X0}" y="${top + ph - 16}" width="${pw}" height="16" fill="${LIQUID}" stroke="none"/>` + `<path d="M${X0} ${top + ph - 16}H${X0 + pw}" stroke-width="1"/>`;
    s += `<path d="M${X0 + 10} ${line}H${X0 + pw - 10}" stroke-width="1.1" stroke-dasharray="4 3"/>`;
    s += `<path d="M${X0 + 4} ${front}H${X0 + pw - 4}" stroke-width="1.4"/>`;
    for (let i = 0; i < n; i++) {
      const x = X0 + 30 + 23 + i * 46;
      s += `<path d="M${x - 3} ${line - 3}l6 6m0 -6l-6 6" stroke-width="1.4"/>`;
      s += say(x, line + 22, names[i] ?? "", { size: 13, anchor: "middle", fill: c, bold: true });
      for (const rf of all[i] ?? []) s += `<ellipse cx="${x}" cy="${r1(Y(rf))}" rx="9" ry="6" fill="#8c8c8c" stroke-width="1.2"/>`;
    }
    let W = X0 + pw + (tank ? 44 : 10);
    if (bool(p, "names")) {
      s += say(X0 + pw + (tank ? 40 : 12), front + 4, tr(lang, { fr: "front de l'éluant", ar: "جبهة المذيب" }), { size: 12, fill: c });
      s += say(X0 + pw + (tank ? 40 : 12), line + 4, tr(lang, { fr: "ligne de dépôt", ar: "خط الإيداع" }), { size: 12, fill: c });
      if (tank) s += say(X0 + pw + 40, top + ph, tr(lang, { fr: "éluant", ar: "المذيب" }), { size: 12, fill: c });
      W += 110;
    }
    if (bool(p, "heights")) {
      const rf = all[0]?.[0];
      const x = X0 + 14;
      s += vector([x, line], [x, front], c, 1.2) + say(x - 4, (line + front) / 2, "H", { size: 13, anchor: "end", fill: c, bold: true });
      if (rf) {
        const xs = X0 + 30 + 23 - 16;
        s += vector([xs, line], [xs, Y(rf)], c, 1.2) + say(xs - 3, (line + Y(rf)) / 2 + 4, "h", { size: 13, anchor: "end", fill: c, bold: true });
      }
    }
    return svg(W, top + ph + (tank ? 30 : 10), s, c);
  },
};

// ---- Electrostatic interaction (Coulomb) ----
export const coulombFigure: FigureDef = {
  id: "pc-coulomb",
  name: "Electrostatic interaction",
  params: [
    {
      key: "charges",
      label: "Charges",
      kind: "select",
      options: [
        { value: "+-", label: "+ and − (attraction)" },
        { value: "++", label: "+ and + (repulsion)" },
        { value: "--", label: "− and − (repulsion)" },
      ],
    },
    { key: "forces", label: "Forces", kind: "bool", row: "o" },
    { key: "distance", label: "Distance d", kind: "bool", row: "o" },
  ],
  defaults: () => ({ charges: "+-", forces: true, distance: true }),
  build: (p) => {
    const c = ink(p);
    const q = str(p, "charges", "+-");
    const A: Pt = [120, 90];
    const B: Pt = [340, 90];
    let s = disc(A, 26, SOLID, `stroke-width="2"`) + disc(B, 26, SOLID, `stroke-width="2"`);
    s += say(A[0], A[1] - 5, q[0] === "+" ? "+" : "−", { size: 20, anchor: "middle", fill: c, bold: true });
    s += say(B[0], B[1] - 5, q[1] === "+" ? "+" : "−", { size: 20, anchor: "middle", fill: c, bold: true });
    s += disc(A, 2.5, c, `stroke="none"`) + disc(B, 2.5, c, `stroke="none"`);
    s += say(A[0], A[1] + 50, "A", { size: 14, anchor: "middle", fill: c, bold: true }) + say(B[0], B[1] + 50, "B", { size: 14, anchor: "middle", fill: c, bold: true });
    if (bool(p, "forces")) {
      const attract = q === "+-";
      const len = 70;
      const fa: [Pt, Pt] = attract ? [A, [A[0] + len, A[1]]] : [A, [A[0] - len, A[1]]];
      const fb: [Pt, Pt] = attract ? [B, [B[0] - len, B[1]]] : [B, [B[0] + len, B[1]]];
      s += vector(fa[0], fa[1], c, 2.2) + vector(fb[0], fb[1], c, 2.2);
      s += vecName((fa[0][0] + fa[1][0]) / 2, A[1] - 34, "F_B/A", c, { size: 14 });
      s += vecName((fb[0][0] + fb[1][0]) / 2, B[1] - 34, "F_A/B", c, { size: 14 });
    }
    if (bool(p, "distance")) {
      s += dashed([A[0], A[1] + 30], [A[0], 170], 0.8) + dashed([B[0], B[1] + 30], [B[0], 170], 0.8);
      s += vector([A[0] + 40, 162], [A[0], 162], c, 1.1) + vector([B[0] - 40, 162], [B[0], 162], c, 1.1) + `<path d="M${A[0] + 40} 162H${B[0] - 40}" stroke-width="1.1"/>`;
      s += say((A[0] + B[0]) / 2, 156, "d", { size: 15, anchor: "middle", fill: c, bold: true });
    }
    return svg(460, 184, s, c);
  },
};

export const MATTER_FIGURES: FigureDef[] = [atomFigure, hydrodistillationFigure, funnelFigure, tlcFigure, coulombFigure];
