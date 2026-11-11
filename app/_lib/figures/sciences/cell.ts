// The cell, a structural unit: the cell under the electron microscope, the light microscope, the plasma membrane.
import { r1, str, type Pt } from "../svg";
import type { FigureDef } from "../types";
import { labeledFigure, type Part } from "./labeled";

// ---- Organelles (drawn at their place) ----
const dots = (pts: Pt[], r = 1.6, c = "currentColor") => pts.map(([x, y]) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r}" fill="${c}" stroke="none"/>`).join("");

// A mitochondrion at (x, y), turned by deg.
export const mito = (x: number, y: number, deg: number, c: string, rx = 24, ry = 11) =>
  `<g transform="translate(${x} ${y}) rotate(${deg})"><ellipse rx="${rx}" ry="${ry}" fill="#ffffff" stroke-width="1.6"/><ellipse rx="${rx - 3}" ry="${ry - 3}" stroke-width="0.9"/>` +
  `<path d="M${-rx + 9} ${-ry + 3}v${ry}M${-rx + 17} ${ry - 3}v${-ry}M${-rx + 25} ${-ry + 3}v${ry}M${-rx + 33} ${ry - 3}v${-ry}M${-rx + 41} ${-ry + 4}v${ry - 2}" stroke-width="0.9" stroke="${c}"/></g>`;

// The nucleus: double envelope with pores, nucleolus, chromatin.
const nucleus = (x: number, y: number, r: number, c: string) => {
  let s = `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" stroke-width="1.6"/><circle cx="${x}" cy="${y}" r="${r - 4}" stroke-width="1"/>`;
  for (const a of [20, 80, 150, 215, 290]) {
    const t = (a * Math.PI) / 180;
    s += `<path d="M${r1(x + Math.cos(t) * (r - 5))} ${r1(y + Math.sin(t) * (r - 5))}L${r1(x + Math.cos(t) * (r + 1))} ${r1(y + Math.sin(t) * (r + 1))}" stroke="#ffffff" stroke-width="3.2"/>`;
  }
  s += `<circle cx="${x + 6}" cy="${y - 6}" r="${r * 0.28}" fill="${c}" stroke="none"/>`;
  s += dots([
    [x - 14, y + 6],
    [x - 8, y + 14],
    [x + 4, y + 16],
    [x + 14, y + 8],
    [x - 16, y - 8],
    [x - 4, y - 18],
    [x - 2, y + 4],
  ], 1.3, c);
  return s;
};

// Rough endoplasmic reticulum: parallel curved sacs dotted with ribosomes, around (x, y).
const rer = (x: number, y: number, c: string) => {
  let s = "";
  for (let k = 0; k < 3; k++) {
    const r = 10 + k * 7;
    s += `<path d="M${x} ${y - r}a${r} ${r} 0 0 1 0 ${2 * r}" stroke-width="1.1"/>`;
    for (let a = -70; a <= 70; a += 28) {
      const t = (a * Math.PI) / 180;
      s += `<circle cx="${r1(x + Math.cos(t) * (r + 2))}" cy="${r1(y + Math.sin(t) * (r + 2))}" r="1.3" fill="${c}" stroke="none"/>`;
    }
  }
  return s;
};

// Golgi apparatus: a stack of curved sacs and vesicles.
const golgi = (x: number, y: number) => {
  let s = "";
  for (let k = 0; k < 4; k++) s += `<path d="M${x - 18 + k * 2} ${y + k * 6}q${18 - k * 2} -8 ${36 - k * 4} 0" stroke-width="2.2"/>`;
  s += `<circle cx="${x + 24}" cy="${y + 4}" r="2.6" stroke-width="1"/><circle cx="${x + 22}" cy="${y + 16}" r="2.2" stroke-width="1"/><circle cx="${x - 22}" cy="${y + 12}" r="2.4" stroke-width="1"/>`;
  return s;
};

const chloroplast = (x: number, y: number, deg: number, c: string) => {
  let s = `<g transform="translate(${x} ${y}) rotate(${deg})"><ellipse rx="22" ry="10" fill="#ffffff" stroke-width="1.6"/>`;
  for (const gx of [-12, -3, 6, 14]) s += `<path d="M${gx - 3} -4h6M${gx - 3} -1h6M${gx - 3} 2h6M${gx - 3} 5h6" stroke-width="1" stroke="${c}"/>`;
  return s + `<path d="M-16 0.5H18" stroke-width="0.6"/></g>`;
};

function ultra(plant: boolean, c: string) {
  let s = "";
  if (plant) {
    s += `<rect x="12" y="14" width="296" height="214" rx="10" stroke-width="2.4"/><rect x="20" y="22" width="280" height="198" rx="6" fill="#ffffff" stroke-width="1.2"/>`;
    // central vacuole
    s += `<path d="M160 52C200 40 270 46 280 90C290 140 270 186 220 192C180 198 150 180 152 140C154 110 130 70 160 52Z" stroke-width="1.4"/>`;
    s += nucleus(78, 84, 34, c) + rer(116, 84, c) + golgi(84, 170);
    s += chloroplast(46, 150, 70, c) + chloroplast(130, 205, 0, c) + chloroplast(222, 34, 0, c) + chloroplast(286, 140, 90, c);
    s += mito(126, 136, -30, c, 18, 9);
    s += dots([
      [40, 40],
      [120, 40],
      [140, 170],
      [46, 200],
      [176, 210],
      [260, 205],
    ], 1.4, c);
  } else {
    s += `<path d="M30 120C25 50 110 15 175 20C260 26 300 70 296 125C292 190 220 228 150 222C80 216 35 185 30 120Z" fill="#ffffff" stroke-width="2.2"/>`;
    s += nucleus(122, 118, 40, c) + rer(166, 118, c) + golgi(232, 84);
    s += mito(222, 168, -15, c) + mito(78, 58, 30, c);
    s += `<circle cx="266" cy="126" r="9" stroke-width="1.4"/>` + dots([
      [263, 123],
      [268, 128],
      [264, 130],
      [270, 122],
    ], 1.1, c);
    // centrioles
    s += `<rect x="186" y="188" width="14" height="6" stroke-width="1.4"/><rect x="204" y="184" width="6" height="14" stroke-width="1.4"/>`;
    s += dots([
      [70, 150],
      [80, 176],
      [150, 196],
      [250, 60],
      [270, 160],
      [196, 50],
      [56, 110],
    ], 1.4, c);
  }
  return s;
}

const ULTRA_ANIMAL: Part[] = [
  { key: "membrane", at: [33, 140], fr: "Membrane plasmique", ar: "الغشاء الهيولي" },
  { key: "hyalo", at: [70, 194], fr: "Hyaloplasme", ar: "الهيولى الأساسية" },
  { key: "mito", at: [74, 54], fr: "Mitochondrie", ar: "ميتوكوندري" },
  { key: "envelope", at: [84, 108], fr: "Enveloppe nucléaire", ar: "الغلاف النووي" },
  { key: "pore", at: [159, 103], fr: "Pore nucléaire", ar: "ثقب نووي" },
  { key: "nucleolus", at: [130, 110], fr: "Nucléole", ar: "النوية" },
  { key: "rer", at: [190, 118], fr: "Réticulum endoplasmique granuleux", ar: "الشبكة الهيولية الفعالة" },
  { key: "golgi", at: [232, 84], fr: "Appareil de Golgi", ar: "جهاز غولجي" },
  { key: "lyso", at: [272, 126], fr: "Lysosome", ar: "جسيم حال" },
  { key: "ribo", at: [250, 60], fr: "Ribosome", ar: "ريبوزوم" },
  { key: "mito2", at: [238, 170], fr: "Mitochondrie", ar: "ميتوكوندري" },
  { key: "centri", at: [207, 194], fr: "Centrioles", ar: "الجسيمان المركزيان" },
];
const ULTRA_PLANT: Part[] = [
  { key: "wall", at: [13, 60], fr: "Paroi cellulosique", ar: "الجدار الهيكلي" },
  { key: "membrane", at: [21, 112], fr: "Membrane plasmique", ar: "الغشاء الهيولي" },
  { key: "chloro", at: [46, 150], fr: "Chloroplaste", ar: "صانعة خضراء" },
  { key: "golgi", at: [84, 172], fr: "Appareil de Golgi", ar: "جهاز غولجي" },
  { key: "nucleolus", at: [84, 78], fr: "Nucléole", ar: "النوية" },
  { key: "envelope", at: [46, 72], fr: "Enveloppe nucléaire", ar: "الغلاف النووي" },
  { key: "rer", at: [140, 84], side: "r", fr: "Réticulum endoplasmique granuleux", ar: "الشبكة الهيولية الفعالة" },
  { key: "vacuole", at: [220, 120], fr: "Vacuole", ar: "فجوة عصارية" },
  { key: "mito", at: [126, 136], side: "r", fr: "Mitochondrie", ar: "ميتوكوندري" },
  { key: "hyalo", at: [176, 210], fr: "Hyaloplasme", ar: "الهيولى الأساسية" },
];

export const ultrastructureFigure = labeledFigure({
  id: "sci-ultrastructure",
  name: "Cell under the electron microscope",
  params: [
    {
      key: "type",
      label: "Cell",
      kind: "select",
      options: [
        { value: "animal", label: "Animal" },
        { value: "plant", label: "Plant" },
      ],
    },
  ],
  defaults: { type: "animal" },
  w: 320,
  h: 240,
  draw: (p, c) => ultra(str(p, "type") === "plant", c),
  parts: (p) => (str(p, "type") === "plant" ? ULTRA_PLANT : ULTRA_ANIMAL),
});

// ---- The light microscope (side view) ----
function microscope(lamp: boolean, c: string) {
  let s = "";
  // base and arm
  s += `<path d="M30 268H200Q206 268 204 260L196 246H40L32 260Q28 268 30 268Z" fill="#ffffff"/>`;
  s += `<path d="M150 246V214Q186 200 184 150Q182 100 150 70" stroke-width="16" stroke="${c}"/><path d="M150 246V214Q186 200 184 150Q182 100 150 70" stroke-width="11" stroke="#ffffff"/>`;
  // tube and eyepiece
  s += `<rect x="78" y="40" width="30" height="74" fill="#ffffff"/><rect x="82" y="14" width="22" height="26" fill="#ffffff"/><path d="M78 14H108" stroke-width="3"/>`;
  s += `<path d="M108 76H150" stroke-width="10"/><path d="M108 76H150" stroke-width="5" stroke="#ffffff"/>`;
  // nosepiece and objectives
  s += `<path d="M66 122Q93 106 120 122Z" fill="#ffffff"/><path d="M66 122H120" />`;
  s += `<rect x="76" y="122" width="10" height="22" fill="#ffffff"/><rect x="88" y="122" width="10" height="28" fill="#ffffff"/><rect x="100" y="122" width="9" height="16" fill="#ffffff"/>`;
  // stage, clips, slide
  s += `<rect x="40" y="166" width="132" height="9" fill="#ffffff"/><path d="M70 160H112" stroke-width="2.4"/><path d="M50 162L66 158M150 162L134 158" stroke-width="2.4"/>`;
  s += `<path d="M93 175V190" stroke-width="2"/><rect x="82" y="190" width="22" height="9" fill="#ffffff"/>`;
  // focus knobs
  s += `<circle cx="178" cy="150" r="13" fill="#ffffff"/><circle cx="178" cy="150" r="4"/><circle cx="174" cy="200" r="8" fill="#ffffff"/>`;
  // light: lamp or mirror
  if (lamp) s += `<path d="M84 238Q84 220 93 216Q102 220 102 238Z" fill="#ffffff"/><path d="M93 212V204M80 214l-5 -5M106 214l5 -5" stroke-width="1.4"/>`;
  else s += `<ellipse cx="93" cy="226" rx="20" ry="6" fill="#ffffff" transform="rotate(-12 93 226)"/><path d="M93 232V246" stroke-width="2.4"/>`;
  return s;
}

export const microscopeFigure = labeledFigure({
  id: "sci-microscope",
  name: "Light microscope",
  params: [
    {
      key: "light",
      label: "Light",
      kind: "select",
      options: [
        { value: "mirror", label: "Mirror" },
        { value: "lamp", label: "Lamp" },
      ],
    },
  ],
  defaults: { light: "mirror" },
  w: 220,
  h: 276,
  draw: (p, c) => microscope(str(p, "light") === "lamp", c),
  parts: (p) => [
    { key: "eyepiece", at: [84, 24], side: "l", fr: "Oculaire", ar: "العينية" },
    { key: "tube", at: [80, 80], side: "l", fr: "Tube", ar: "الأنبوب" },
    { key: "revolver", at: [72, 118], side: "l", fr: "Revolver", ar: "القرص الدوار" },
    { key: "objective", at: [78, 140], side: "l", fr: "Objectif", ar: "الشيئية" },
    { key: "clip", at: [54, 161], side: "l", fr: "Valet", ar: "الماسك" },
    { key: "stage", at: [42, 172], side: "l", fr: "Platine", ar: "المنصة" },
    { key: "diaphragm", at: [84, 196], side: "l", fr: "Diaphragme", ar: "الحجاب القزحي" },
    { key: "light", at: [76, 228], side: "l", fr: str(p, "light") === "lamp" ? "Lampe" : "Miroir", ar: str(p, "light") === "lamp" ? "المصباح" : "المرآة" },
    { key: "arm", at: [178, 104], side: "r", fr: "Potence", ar: "الذراع" },
    { key: "macro", at: [190, 148], side: "r", fr: "Vis macrométrique", ar: "اللولب الكبير" },
    { key: "micro", at: [182, 202], side: "r", fr: "Vis micrométrique", ar: "اللولب الصغير" },
    { key: "base", at: [200, 262], side: "r", fr: "Pied (socle)", ar: "القاعدة" },
  ],
});

// ---- The plasma membrane (fluid mosaic) ----
function membrane(c: string) {
  let s = "";
  const skip = (x: number) => (x > 88 && x < 136) || (x > 186 && x < 222);
  for (let x = 12; x <= 338; x += 12) {
    if (skip(x)) continue;
    for (const [y, dir] of [
      [70, 1],
      [150, -1],
    ] as const) {
      s += `<path d="M${x - 2.4} ${y + dir * 5}q-2 ${dir * 8} 0 ${dir * 14}t0 ${dir * 14}M${x + 2.4} ${y + dir * 5}q2 ${dir * 8} 0 ${dir * 14}t0 ${dir * 14}" stroke-width="1"/>`;
      s += `<circle cx="${x}" cy="${y}" r="5" fill="#ffffff" stroke-width="1.4"/>`;
    }
  }
  // integral protein (with a channel)
  s += `<path d="M90 60Q92 44 104 46Q110 40 110 56V164Q108 178 96 174Q86 168 90 150Z" fill="#ffffff" stroke-width="1.8"/><path d="M116 56Q116 40 124 46Q136 44 136 62V150Q140 170 128 174Q116 176 116 164Z" fill="#ffffff" stroke-width="1.8"/>`;
  // glycoprotein
  s += `<path d="M188 74Q186 52 204 50Q222 52 220 74V146Q222 166 204 166Q186 166 188 146Z" fill="#ffffff" stroke-width="1.8"/>`;
  s += `<path d="M204 50V38L196 28M204 38L212 28M196 28L190 18M196 28V16M212 28L218 18" stroke-width="1.2"/>` + dots([
    [204, 38],
    [196, 28],
    [212, 28],
    [190, 18],
    [196, 16],
    [218, 18],
  ], 2.6, c);
  // glycolipid
  s += `<path d="M300 65V50L292 40M300 50L308 42" stroke-width="1.2"/>` + dots([
    [300, 50],
    [292, 40],
    [308, 42],
    [292, 30],
  ], 2.6, c) + `<path d="M292 40V30" stroke-width="1.2"/>`;
  // peripheral protein (inside face)
  s += `<path d="M244 158Q240 176 258 180Q280 182 282 166Q280 154 262 156Q250 154 244 158Z" fill="#ffffff" stroke-width="1.8"/>`;
  return s;
}

export const membraneFigure = labeledFigure({
  id: "sci-membrane",
  name: "Plasma membrane",
  w: 350,
  h: 190,
  draw: (_, c) => membrane(c),
  parts: [
    { key: "glycolipid", at: [292, 30], side: "r", fr: "Glycolipide", ar: "ليبيد سكري" },
    { key: "glycoprotein", at: [190, 18], side: "l", fr: "Glycoprotéine", ar: "بروتين سكري" },
    { key: "head", at: [60, 70], side: "l", fr: "Tête hydrophile", ar: "رأس محب للماء" },
    { key: "tails", at: [48, 96], side: "l", fr: "Queues hydrophobes", ar: "ذيول كارهة للماء" },
    { key: "integral", at: [96, 120], side: "l", fr: "Protéine intrinsèque", ar: "بروتين ضمني" },
    { key: "phospholipid", at: [24, 150], side: "l", fr: "Phospholipide", ar: "فوسفوليبيد" },
    { key: "bilayer", at: [336, 110], side: "r", fr: "Bicouche lipidique", ar: "طبقة فوسفوليبيدية مضاعفة" },
    { key: "peripheral", at: [270, 178], side: "r", fr: "Protéine extrinsèque", ar: "بروتين سطحي" },
  ],
});

export const CELL_FIGURES: FigureDef[] = [ultrastructureFigure, microscopeFigure, membraneFigure];
