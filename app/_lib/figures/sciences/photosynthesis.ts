// Photosynthesis (light energy → chemical potential energy): the chloroplast, the leaf, the two phases, the Calvin cycle,
// the absorption and action spectra.
import { bool, ink, svg, type Pt } from "../svg";
import type { FigureDef } from "../types";
import type { Lang } from "../../types";
import { arcArrow, arrow, axes, box, head, polar, polyline, say, xTick } from "./draw";
import { labeledFigure } from "./labeled";

// ---- Chloroplast ----
function chloroplast(c: string) {
  let s = `<ellipse cx="170" cy="100" rx="160" ry="86" fill="#ffffff" stroke-width="2"/><ellipse cx="170" cy="100" rx="151" ry="78" stroke-width="1.4"/>`;
  // grana (stacks of thylakoids) joined by lamellae
  const grana: Pt[] = [
    [70, 80],
    [120, 120],
    [170, 74],
    [222, 118],
    [272, 86],
  ];
  s += `<path d="M40 100Q100 92 128 112M70 92Q120 100 170 86M170 86Q200 100 222 110M222 128Q250 110 272 98M272 98Q290 100 304 96M120 132Q170 140 222 130" stroke-width="1.2"/>`;
  for (const [x, y] of grana) for (let k = 0; k < 5; k++) s += `<rect x="${x - 16}" y="${y - 15 + k * 6}" width="32" height="5" rx="2.5" fill="#ffffff" stroke-width="1.2"/>`;
  // starch grain, lipid droplets, DNA, ribosomes
  s += `<ellipse cx="170" cy="140" rx="20" ry="11" fill="#ffffff" stroke-width="1.4"/><ellipse cx="170" cy="140" rx="12" ry="6" stroke-width="0.8"/>`;
  s += `<circle cx="96" cy="150" r="5" fill="${c}" stroke="none"/><circle cx="258" cy="150" r="4.5" fill="${c}" stroke="none"/><circle cx="120" cy="50" r="4" fill="${c}" stroke="none"/>`;
  s += `<path d="M224 48q6 -6 12 0t12 0t12 0" stroke-width="1.2"/>`;
  for (const [x, y] of [
    [60, 120],
    [144, 48],
    [206, 150],
    [300, 116],
    [92, 64],
  ])
    s += `<circle cx="${x}" cy="${y}" r="1.4" fill="${c}" stroke="none"/>`;
  return s;
}

export const chloroplastFigure = labeledFigure({
  id: "sci-chloroplast",
  name: "Chloroplast",
  w: 340,
  h: 200,
  draw: (_, c) => chloroplast(c),
  parts: [
    { key: "outer", at: [12, 100], side: "l", fr: "Membrane externe", ar: "الغشاء الخارجي" },
    { key: "inner", at: [21, 112], side: "l", fr: "Membrane interne", ar: "الغشاء الداخلي" },
    { key: "stroma", at: [56, 136], side: "l", fr: "Stroma", ar: "الحشوة (الستروما)" },
    { key: "lipid", at: [96, 150], side: "l", fr: "Plastoglobule (gouttelette lipidique)", ar: "قطيرة دهنية" },
    { key: "granum", at: [70, 74], side: "l", fr: "Granum", ar: "البذيرة (غرانا)" },
    { key: "thylakoid", at: [186, 71], side: "t", fr: "Thylakoïde", ar: "الكييس (تيلاكويد)" },
    { key: "dna", at: [248, 48], side: "t", fr: "ADN chloroplastique", ar: "ADN الصانعة" },
    { key: "lamella", at: [288, 97], side: "r", fr: "Lamelle intergranaire", ar: "صفيحة بين البذيرات" },
    { key: "starch", at: [186, 142], side: "r", fr: "Grain d'amidon", ar: "حبيبة نشاء" },
  ],
});

// ---- Leaf cross-section ----
function leafSection(c: string) {
  let s = `<path d="M10 14H350M10 196H350" stroke-width="2.6"/>`;
  // upper epidermis
  for (let x = 10; x <= 324; x += 26) s += `<rect x="${x}" y="16" width="26" height="16" fill="#ffffff" stroke-width="1.3"/>`;
  // palisade
  for (let x = 12; x < 346; x += 16) {
    s += `<rect x="${x}" y="34" width="14" height="46" rx="6" fill="#ffffff" stroke-width="1.3"/>`;
    for (const y of [42, 54, 66]) s += `<circle cx="${x + 7}" cy="${y + ((x / 16) % 2) * 4}" r="2" fill="${c}" stroke="none"/>`;
  }
  // spongy tissue with air spaces
  const blobs: Pt[] = [
    [24, 96], [62, 104], [30, 132], [72, 140], [108, 100], [104, 150], [240, 98], [276, 108], [312, 96], [338, 120], [246, 140], [290, 146], [328, 152], [216, 112],
  ];
  for (const [x, y] of blobs) s += `<ellipse cx="${x}" cy="${y}" rx="15" ry="11" fill="#ffffff" stroke-width="1.3"/><circle cx="${x - 4}" cy="${y}" r="1.8" fill="${c}" stroke="none"/>`;
  // vein: xylem above, phloem below, in a sheath
  s += `<ellipse cx="166" cy="124" rx="40" ry="34" fill="#ffffff" stroke-width="1.6"/>`;
  for (const [x, y, r] of [
    [150, 110, 7],
    [166, 106, 8],
    [182, 110, 7],
    [158, 124, 6],
    [174, 124, 6],
  ])
    s += `<circle cx="${x}" cy="${y}" r="${r}" stroke-width="2"/>`;
  for (let x = 146; x <= 186; x += 8) s += `<circle cx="${x}" cy="142" r="3.4" stroke-width="1"/>`;
  // lower epidermis with a stoma
  for (let x = 10; x <= 324; x += 26) if (x < 270 || x > 300) s += `<rect x="${x}" y="178" width="26" height="16" fill="#ffffff" stroke-width="1.3"/>`;
  s += `<path d="M270 178H300" stroke-width="1.3"/><ellipse cx="279" cy="187" rx="8" ry="7" fill="#ffffff" stroke-width="1.6"/><ellipse cx="292" cy="187" rx="8" ry="7" fill="#ffffff" stroke-width="1.6"/>`;
  s += `<path d="M262 176Q285 160 308 176" stroke-width="1" stroke-dasharray="3 2"/>`;
  return s;
}

export const leafSectionFigure = labeledFigure({
  id: "sci-leaf-section",
  name: "Leaf cross-section",
  w: 360,
  h: 210,
  draw: (_, c) => leafSection(c),
  parts: [
    { key: "cuticle", at: [20, 14], side: "l", fr: "Cuticule", ar: "طبقة الكيوتين" },
    { key: "upper", at: [24, 26], side: "l", fr: "Épiderme supérieur", ar: "البشرة العلوية" },
    { key: "palisade", at: [19, 60], side: "l", fr: "Parenchyme palissadique", ar: "النسيج العمادي" },
    { key: "spongy", at: [30, 132], side: "l", fr: "Parenchyme lacuneux", ar: "النسيج الإسفنجي" },
    { key: "lower", at: [40, 190], side: "l", fr: "Épiderme inférieur", ar: "البشرة السفلى" },
    { key: "xylem", at: [182, 110], side: "r", fr: "Xylème (bois)", ar: "الخشب" },
    { key: "phloem", at: [182, 142], side: "r", fr: "Phloème (liber)", ar: "اللحاء" },
    { key: "space", at: [258, 124], side: "r", fr: "Lacune (méat)", ar: "فراغ هوائي" },
    { key: "chamber", at: [285, 170], side: "r", fr: "Chambre sous-stomatique", ar: "الحجرة تحت الثغرية" },
    { key: "stoma", at: [292, 192], side: "r", fr: "Stomate", ar: "ثغر" },
  ],
});

// ---- The two phases of photosynthesis ----
const PHASES: Record<Lang, [string, string, string, string]> = {
  fr: ["Phase photochimique", "(thylakoïde)", "Phase chimique", "(cycle de Calvin — stroma)"],
  ar: ["المرحلة الكيموضوئية", "(التيلاكويد)", "المرحلة الكيموحيوية", "(حلقة كالفن — الحشوة)"],
};
const LIGHT: Record<Lang, string> = { fr: "Lumière", ar: "الضوء" };

export const photosynthesisFigure: FigureDef = {
  id: "sci-photosynthesis",
  name: "Photosynthesis (the two phases)",
  params: [
    { key: "names", label: "Names of the phases", kind: "bool" },
    { key: "blank", label: "Molecules to fill (empty boxes)", kind: "bool" },
  ],
  defaults: () => ({ names: true, blank: false }),
  build: (p, lang) => {
    const c = ink(p);
    const blank = bool(p, "blank");
    const T = PHASES[lang] ?? PHASES.fr;
    let s = `<rect x="10" y="40" width="460" height="210" rx="70" fill="#ffffff" stroke-width="2"/>`;
    // the thylakoid (left) and the stroma's cycle (right)
    s += `<rect x="60" y="90" width="130" height="110" rx="14" fill="#ffffff" stroke-width="1.6"/>`;
    s += arcArrow([350, 150], 46, 20, 340, c, `stroke-width="1.8"`);
    if (bool(p, "names")) {
      s += say(125, 140, T[0], { size: 12, anchor: "middle", fill: c, bold: true }) + say(125, 156, T[1], { size: 11, anchor: "middle", fill: c });
      s += say(322, 76, T[2], { size: 12, anchor: "middle", fill: c, bold: true }) + say(322, 92, T[3], { size: 11, anchor: "middle", fill: c });
    }
    // light
    s += `<path d="M80 6l10 12l-6 2l12 14M110 4l8 12l-6 2l10 14" stroke-width="1.6"/>` + head([96, 36], 60, c) + head([124, 34], 60, c) + say(140, 18, LIGHT[lang] ?? LIGHT.fr, { size: 12, fill: c });
    const mol = (at: Pt, t: string) => box(at, t, blank, c, { size: 12, frame: false, minW: 48 }).svg;
    // water in, oxygen out
    s += arrow([40, 226], [80, 196], c, `stroke-width="1.6"`) + mol([34, 240], "H2O");
    s += arrow([170, 196], [206, 228], c, `stroke-width="1.6"`) + mol([222, 238], "O2");
    // from one phase to the other
    s += arrow([192, 116], [296, 116], c, `stroke-width="1.6"`) + mol([244, 106], "ATP, NADPH,H^+");
    s += arrow([296, 176], [192, 176], c, `stroke-width="1.6"`) + mol([244, 192], "ADP + Pi, NADP^+");
    // carbon dioxide in, organic matter out
    s += arrow([440, 24], [386, 116], c, `stroke-width="1.6"`) + mol([446, 12], "CO2");
    s += arrow([386, 188], [434, 270], c, `stroke-width="1.6"`) + mol([434, 282], "C6H12O6");
    return svg(486, 296, s, c);
  },
};

// ---- Calvin cycle ----
const CALVIN: Record<Lang, [string, string, string, string]> = {
  fr: ["Carboxylation", "Réduction", "Régénération du RuDP", "Matière organique (glucose)"],
  ar: ["التثبيت (الكربكسلة)", "الإرجاع", "تجديد RuDP", "مادة عضوية (غلوكوز)"],
};

export const calvinFigure: FigureDef = {
  id: "sci-calvin",
  name: "Calvin cycle",
  params: [
    { key: "names", label: "Names of the steps", kind: "bool" },
    { key: "counts", label: "Numbers of molecules (6 CO2…)", kind: "bool" },
    { key: "blank", label: "Molecules to fill (empty boxes)", kind: "bool" },
  ],
  defaults: () => ({ names: true, counts: false, blank: false }),
  build: (p, lang) => {
    const c = ink(p);
    const T = CALVIN[lang] ?? CALVIN.fr;
    const blank = bool(p, "blank");
    const n = bool(p, "counts");
    const C: Pt = [230, 170];
    const R = 92;
    let s = "";
    s += arcArrow(C, R, 22, 98, c, `stroke-width="2"`) + arcArrow(C, R, 142, 218, c, `stroke-width="2"`) + arcArrow(C, R, 262, 338, c, `stroke-width="2"`);
    const mol = (at: Pt, t: string) => box(at, t, blank, c, { size: 12, minW: 62 }).svg;
    s += mol(polar(C, R, 0), n ? "6 RuDP (C5)" : "RuDP (C5)");
    s += mol(polar(C, R, 120), n ? "12 APG (C3)" : "APG (C3)");
    s += mol(polar(C, R, 240), n ? "12 PGAL (C3)" : "PGAL (C3)");
    // CO2 in, ATP and NADPH used, organic matter out
    const co2 = polar(C, R + 70, 60);
    s += arrow(co2, polar(C, R + 6, 60), c, `stroke-width="1.6"`) + mol([co2[0], co2[1] - 12], n ? "6 CO2" : "CO2");
    const red = polar(C, R + 66, 180);
    s += arrow([red[0] + 60, red[1] - 6], polar(C, R + 8, 182), c, `stroke-width="1.4"`) + mol([red[0] + 80, red[1] - 6], n ? "12 ATP, 12 NADPH" : "ATP, NADPH,H^+");
    const reg = polar(C, R + 70, 300);
    s += arrow(reg, polar(C, R + 8, 300), c, `stroke-width="1.4"`) + mol([reg[0] - 10, reg[1] - 12], n ? "6 ATP" : "ATP");
    const out = polar(C, R + 4, 240);
    s += arrow([out[0] - 30, out[1] + 14], [out[0] - 70, out[1] + 70], c, `stroke-width="1.6"`) + say(out[0] - 74, out[1] + 88, T[3], { size: 11, anchor: "middle", fill: c }) + (n ? say(out[0] - 30, out[1] + 46, "2 PGAL", { size: 11, anchor: "end", fill: c }) : "");
    if (bool(p, "names")) {
      s += say(polar(C, R - 28, 60)[0], polar(C, R - 28, 60)[1] + 4, T[0], { size: 11, anchor: "middle", fill: c, bold: true });
      s += say(polar(C, R - 28, 180)[0], polar(C, R - 28, 180)[1] + 4, T[1], { size: 11, anchor: "middle", fill: c, bold: true });
      s += say(polar(C, R - 30, 300)[0] + 6, polar(C, R - 30, 300)[1] + 4, T[2], { size: 11, anchor: "middle", fill: c, bold: true });
    }
    return svg(470, 360, s, c);
  },
};

// ---- Absorption and action spectra ----
const g = (x: number, m: number, w: number) => Math.exp(-(((x - m) / w) ** 2));
const SPECTRA: Record<string, (l: number) => number> = {
  a: (l) => 0.95 * g(l, 430, 18) + 0.78 * g(l, 662, 14) + 0.2 * g(l, 615, 18) + 0.12 * g(l, 580, 20),
  b: (l) => 0.9 * g(l, 455, 16) + 0.55 * g(l, 642, 13) + 0.12 * g(l, 595, 18),
  car: (l) => 0.55 * g(l, 425, 14) + 0.75 * g(l, 450, 16) + 0.7 * g(l, 480, 14),
  action: (l) => 0.82 * g(l, 440, 34) + 0.86 * g(l, 668, 24) + 0.2 * g(l, 560, 70) + 0.08,
};
const SPECTRA_TEXT: Record<Lang, { x: string; y: string; a: string; b: string; car: string; action: string }> = {
  fr: { x: "λ (nm)", y: "Absorption — intensité de la photosynthèse", a: "Chlorophylle a", b: "Chlorophylle b", car: "Caroténoïdes", action: "Spectre d'action" },
  ar: { x: "λ (nm)", y: "الامتصاص — شدة التركيب الضوئي", a: "اليخضور أ", b: "اليخضور ب", car: "الكاروتينات", action: "طيف النشاط" },
};
const DASH: Record<string, string> = { a: "", b: `stroke-dasharray="7 4"`, car: `stroke-dasharray="2 3"`, action: `stroke-dasharray="10 3 2 3"` };

export const spectrumFigure: FigureDef = {
  id: "sci-spectrum",
  name: "Absorption and action spectra",
  params: [
    { key: "a", label: "Chlorophyll a", kind: "bool", row: "chl" },
    { key: "b", label: "Chlorophyll b", kind: "bool", row: "chl" },
    { key: "car", label: "Carotenoids", kind: "bool", row: "other" },
    { key: "action", label: "Action spectrum", kind: "bool", row: "other" },
  ],
  defaults: () => ({ a: true, b: true, car: false, action: true }),
  build: (p, lang) => {
    const c = ink(p);
    const T = SPECTRA_TEXT[lang] ?? SPECTRA_TEXT.fr;
    const x0 = 50;
    const y0 = 230;
    const W = 360;
    const X = (l: number) => x0 + ((l - 380) / 340) * W;
    let s = axes(x0, y0, W, 190, T.x, T.y, c);
    for (const l of [400, 450, 500, 550, 600, 650, 700]) s += xTick(X(l), y0, String(l), c);
    const shown = (["a", "b", "car", "action"] as const).filter((k) => bool(p, k));
    shown.forEach((k, i) => {
      const pts: Pt[] = [];
      for (let l = 380; l <= 720; l += 2) pts.push([X(l), y0 - SPECTRA[k](l) * 170]);
      s += polyline(pts, `stroke-width="${k === "action" ? 2.6 : 2}" ${DASH[k]}`);
      // legend
      const ly = 58 + i * 16;
      s += `<path d="M${x0 + 124} ${ly}h26" stroke-width="2" ${DASH[k]}/>` + say(x0 + 156, ly + 4, T[k], { size: 11, fill: c });
    });
    return svg(x0 + W + 30, y0 + 40, s, c);
  },
};

export const PHOTOSYNTHESIS_FIGURES: FigureDef[] = [chloroplastFigure, leafSectionFigure, photosynthesisFigure, calvinFigure, spectrumFigure];
