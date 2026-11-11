// Cellular respiration (chemical potential energy → ATP): the mitochondrion and the three stages.
import { bool, ink, r1, svg, type Pt } from "../svg";
import type { FigureDef } from "../types";
import type { Lang } from "../../types";
import { arcArrow, arrow, box, say } from "./draw";
import { labeledFigure } from "./labeled";

// ---- Mitochondrion ----
const CX = 160;
const CY = 90;
const RX = 136;
const RY = 58;
const yTop = (x: number) => CY - RY * Math.sqrt(Math.max(0, 1 - ((x - CX) / RX) ** 2));
const yBottom = (x: number) => 2 * CY - yTop(x);

// The inner membrane: along the inside of the outer one, folded into cristae (from the top and from the bottom).
function innerMembrane() {
  const top = [70, 122, 174, 226];
  const bottom = [96, 148, 200, 252];
  let d = `M${CX - RX} ${CY}`;
  const go = (x: number, y: number) => `L${r1(x)} ${r1(y)}`;
  // top side, left to right
  let x = CX - RX;
  for (const fx of top) {
    for (; x < fx - 5; x += 4) d += go(x, yTop(x));
    d += go(fx - 5, yTop(fx - 5)) + `L${fx - 5} ${CY + 8}Q${fx} ${CY + 16} ${fx + 5} ${CY + 8}` + go(fx + 5, yTop(fx + 5));
    x = fx + 5;
  }
  for (; x <= CX + RX; x += 4) d += go(x, yTop(x));
  // bottom side, right to left
  x = CX + RX;
  for (const fx of [...bottom].reverse()) {
    for (; x > fx + 5; x -= 4) d += go(x, yBottom(x));
    d += go(fx + 5, yBottom(fx + 5)) + `L${fx + 5} ${CY - 8}Q${fx} ${CY - 16} ${fx - 5} ${CY - 8}` + go(fx - 5, yBottom(fx - 5));
    x = fx - 5;
  }
  for (; x >= CX - RX; x -= 4) d += go(x, yBottom(x));
  return d + "Z";
}

function mitochondrion(spheres: boolean, c: string) {
  let s = `<ellipse cx="${CX}" cy="${CY}" rx="${RX + 10}" ry="${RY + 10}" fill="#ffffff" stroke-width="2"/>`;
  // (the inner membrane's path is drawn a bit smaller than the outer one)
  s += `<g transform="translate(${CX} ${CY}) scale(0.97 0.9) translate(${-CX} ${-CY})"><path d="${innerMembrane()}" fill="#ffffff" stroke-width="1.8"/>`;
  if (spheres)
    for (const fx of [70, 122, 174, 226, 96, 148, 200, 252]) {
      const down = [70, 122, 174, 226].includes(fx);
      for (const k of [0.35, 0.7]) {
        const y = down ? yTop(fx) + (CY + 8 - yTop(fx)) * k : yBottom(fx) - (yBottom(fx) - CY + 8) * k;
        s += `<path d="M${fx - 5} ${r1(y)}h-4M${fx + 5} ${r1(y)}h4" stroke-width="1"/><circle cx="${fx - 11}" cy="${r1(y)}" r="2.2" fill="${c}" stroke="none"/><circle cx="${fx + 11}" cy="${r1(y)}" r="2.2" fill="${c}" stroke="none"/>`;
      }
    }
  s += `</g>`;
  // DNA and ribosomes in the matrix
  s += `<path d="M44 82q5 -6 10 0t10 0t10 0" stroke-width="1.3"/>`;
  for (const [x, y] of [
    [48, 100],
    [110, 76],
    [262, 104],
    [186, 70],
  ])
    s += `<circle cx="${x}" cy="${y}" r="1.4" fill="${c}" stroke="none"/>`;
  return s;
}

export const mitochondrionFigure = labeledFigure({
  id: "sci-mitochondrion",
  name: "Mitochondrion",
  params: [{ key: "spheres", label: "ATP synthases (stalked particles)", kind: "bool" }],
  defaults: { spheres: true },
  w: 320,
  h: 180,
  draw: (p, c) => mitochondrion(bool(p, "spheres"), c),
  parts: (p) => [
    { key: "outer", at: [16, 84], side: "l", fr: "Membrane externe", ar: "الغشاء الخارجي" },
    { key: "space", at: [27, 108], side: "l", fr: "Espace intermembranaire", ar: "الفراغ بين الغشائين" },
    { key: "inner", at: [34, 126], side: "l", fr: "Membrane interne", ar: "الغشاء الداخلي" },
    { key: "dna", at: [59, 82], side: "l", fr: "ADN mitochondrial", ar: "ADN الميتوكوندري" },
    { key: "crista", at: [175, 50], side: "t", fr: "Crête mitochondriale", ar: "عرف" },
    { key: "matrix", at: [262, 104], side: "r", fr: "Matrice", ar: "المادة الأساسية (الحشوة)" },
    ...(p.spheres === true ? [{ key: "atpase", at: [237, 60] as Pt, side: "r" as const, fr: "Sphère pédonculée (ATP synthase)", ar: "الكرية المذنبة (ATP synthase)" }] : []),
    { key: "ribo", at: [186, 70], side: "t", fr: "Ribosome", ar: "ريبوزوم" },
  ],
});

// ---- The three stages of respiration ----
const STAGES: Record<Lang, string[]> = {
  fr: ["Glycolyse", "(hyaloplasme)", "Cycle de Krebs", "(matrice)", "Chaîne respiratoire", "(membrane interne)", "Mitochondrie"],
  ar: ["التحلل السكري", "(الهيولى)", "حلقة كريبس", "(المادة الأساسية)", "السلسلة التنفسية", "(الغشاء الداخلي)", "الميتوكوندري"],
};

export const respirationFigure: FigureDef = {
  id: "sci-respiration",
  name: "Cellular respiration (the stages)",
  params: [
    { key: "names", label: "Names of the stages", kind: "bool" },
    { key: "blank", label: "Molecules to fill (empty boxes)", kind: "bool" },
  ],
  defaults: () => ({ names: true, blank: false }),
  build: (p, lang) => {
    const c = ink(p);
    const T = STAGES[lang] ?? STAGES.fr;
    const blank = bool(p, "blank");
    const names = bool(p, "names");
    const mol = (at: Pt, t: string, frame = true) => box(at, t, blank, c, { size: 12, minW: 50, frame }).svg;
    let s = "";
    // glycolysis, in the cytoplasm
    s += mol([100, 40], "C6H12O6");
    s += arrow([100, 54], [100, 170], c, `stroke-width="1.8"`);
    s += arrow([104, 96], [136, 96], c, `stroke-width="1.2"`) + mol([164, 96], "2 ATP", false);
    s += arrow([104, 124], [136, 124], c, `stroke-width="1.2"`) + mol([174, 124], "2 NADH,H^+", false);
    s += mol([100, 186], "2 pyruvate");
    if (names) s += say(92, 104, T[0], { size: 12, anchor: "end", fill: c, bold: true }) + say(92, 120, T[1], { size: 11, anchor: "end", fill: c });
    // the mitochondrion
    s += `<rect x="230" y="22" width="292" height="314" rx="60" fill="#ffffff" stroke-width="2"/><rect x="240" y="32" width="272" height="294" rx="52" stroke-width="1.2"/>`;
    if (names) s += say(376, 14, T[6], { size: 12, anchor: "middle", fill: c, bold: true });
    s += arrow([150, 182], [266, 74], c, `stroke-width="1.8"`);
    s += mol([316, 64], "acétyl-CoA");
    s += arrow([372, 64], [410, 64], c, `stroke-width="1.2"`) + mol([440, 64], "CO2", false);
    // Krebs cycle
    s += arcArrow([340, 164], 40, 30, 330, c, `stroke-width="1.8"`) + arrow([320, 80], [330, 120], c, `stroke-width="1.6"`);
    if (names) s += say(340, 162, T[2], { size: 11, anchor: "middle", fill: c, bold: true }) + say(340, 176, T[3], { size: 10, anchor: "middle", fill: c });
    s += arrow([382, 140], [414, 124], c, `stroke-width="1.2"`) + mol([446, 120], "CO2", false);
    s += arrow([382, 188], [414, 204], c, `stroke-width="1.2"`) + mol([446, 206], "ATP", false);
    // respiratory chain on the inner membrane
    s += `<path d="M252 266H500" stroke-width="5"/><path d="M252 266H500" stroke="#ffffff" stroke-width="2"/>`;
    s += arrow([340, 206], [340, 256], c, `stroke-width="1.4"`) + mol([392, 232], "NADH, FADH2", false);
    s += mol([272, 232], "O2", false) + arrow([272, 244], [272, 260], c, `stroke-width="1.2"`);
    s += arrow([272, 272], [272, 290], c, `stroke-width="1.2"`) + mol([272, 304], "H2O", false);
    s += mol([468, 300], "ADP + Pi", false) + arrow([468, 288], [468, 248], c, `stroke-width="1.4"`) + mol([468, 236], "ATP", false);
    if (names) s += say(370, 290, T[4], { size: 11, anchor: "middle", fill: c, bold: true }) + say(370, 304, T[5], { size: 10, anchor: "middle", fill: c });
    return svg(530, 344, s, c);
  },
};

export const RESPIRATION_FIGURES: FigureDef[] = [mitochondrionFigure, respirationFigure];
