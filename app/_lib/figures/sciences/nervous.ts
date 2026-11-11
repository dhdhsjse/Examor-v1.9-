// Nervous and hormonal regulation: the neuron, the synapse, the reflex arc, the action potential, a regulation loop.
import { bool, ink, num, r1, str, svg, type Pt } from "../svg";
import type { FigureDef } from "../types";
import type { Lang } from "../../types";
import { arrow, axes, head, polyline, say, textWidth, wrapped, yTick } from "./draw";
import { LABEL_MODES, labeledFigure } from "./labeled";

// ---- Neuron ----
function neuron(myelin: boolean, c: string) {
  let s = "";
  // dendrites
  const dendrites = [
    "M48 74L24 52L10 50M24 52L20 34",
    "M44 92L18 96L6 88M18 96L8 110",
    "M54 110L38 134L24 140M38 134L40 152",
    "M64 66L58 38L46 24M58 38L70 22",
    "M78 72L92 50L106 46M92 50L90 34",
    "M74 112L86 136L100 142",
  ];
  s += dendrites.map((d) => `<path d="${d}" stroke-width="2"/>`).join("");
  // cell body and nucleus
  s += `<path d="M48 74Q56 64 64 66Q72 64 78 72Q92 82 96 90Q92 100 74 112Q64 118 54 110Q42 102 44 92Q42 82 48 74Z" fill="#ffffff" stroke-width="2"/>`;
  s += `<circle cx="66" cy="90" r="10" fill="#ffffff" stroke-width="1.6"/><circle cx="68" cy="88" r="3" fill="${c}" stroke="none"/>`;
  // axon
  s += `<path d="M96 90H338" stroke-width="3"/>`;
  if (myelin) {
    for (let x = 116; x < 320; x += 52) {
      s += `<rect x="${x}" y="80" width="44" height="20" rx="9" fill="#ffffff" stroke-width="1.6"/><path d="M${x + 4} 90H${x + 40}" stroke-width="3"/>`;
    }
    s += `<ellipse cx="190" cy="83.5" rx="7" ry="2.6" fill="${c}" stroke="none"/>`;
  }
  // axon terminals
  const ends: Pt[] = [
    [372, 58],
    [380, 82],
    [378, 108],
    [366, 128],
  ];
  s += ends.map(([x, y]) => `<path d="M338 90Q352 90 ${x - 8} ${y}" stroke-width="2"/><circle cx="${x - 4}" cy="${y}" r="4.5" fill="#ffffff" stroke-width="1.6"/>`).join("");
  return s;
}

export const neuronFigure = labeledFigure({
  id: "sci-neuron",
  name: "Neuron",
  params: [{ key: "myelin", label: "Myelin sheath", kind: "bool" }],
  defaults: { myelin: true },
  w: 390,
  h: 170,
  draw: (p, c) => neuron(bool(p, "myelin"), c),
  parts: (p) => [
    { key: "dendrite", at: [20, 34], side: "l", fr: "Dendrite", ar: "تغصن" },
    { key: "body", at: [52, 104], side: "l", fr: "Corps cellulaire", ar: "جسم خلوي" },
    { key: "nucleus", at: [66, 96], side: "l", fr: "Noyau", ar: "نواة" },
    ...(bool(p, "myelin")
      ? [
          { key: "myelin", at: [140, 80] as Pt, side: "t" as const, fr: "Gaine de myéline", ar: "غمد النخاعين" },
          { key: "schwann", at: [190, 83] as Pt, side: "t" as const, fr: "Noyau de cellule de Schwann", ar: "نواة خلية شفان" },
          { key: "ranvier", at: [164, 90] as Pt, side: "b" as const, fr: "Nœud de Ranvier", ar: "عقدة رانفييه" },
        ]
      : []),
    { key: "axon", at: [276, 92], side: "b", fr: "Axone", ar: "محور أسطواني" },
    { key: "terminal", at: [352, 96], side: "r", fr: "Arborisation terminale", ar: "التشجرات النهائية" },
    { key: "button", at: [374, 128], side: "r", fr: "Bouton synaptique", ar: "زر مشبكي" },
  ],
});

// ---- Synapse ----
function synapse(c: string) {
  let s = "";
  // presynaptic terminal (from the axon above)
  s += `<path d="M120 0V30Q120 40 100 52Q50 80 52 120Q54 150 90 150H210Q246 150 248 120Q250 80 200 52Q180 40 180 30V0" fill="#ffffff" stroke-width="2.2"/>`;
  // vesicles (full of neurotransmitter)
  const ves: Pt[] = [
    [100, 90],
    [130, 76],
    [160, 92],
    [196, 96],
    [118, 116],
    [182, 122],
    [150, 122],
  ];
  for (const [x, y] of ves) s += `<circle cx="${x}" cy="${y}" r="9" fill="#ffffff" stroke-width="1.4"/><circle cx="${x - 3}" cy="${y - 2}" r="1.3" fill="${c}" stroke="none"/><circle cx="${x + 3}" cy="${y + 1}" r="1.3" fill="${c}" stroke="none"/><circle cx="${x}" cy="${y + 4}" r="1.3" fill="${c}" stroke="none"/>`;
  // exocytosis: a vesicle open on the cleft
  s += `<path d="M138 150Q138 138 150 138Q162 138 162 150" fill="#ffffff" stroke-width="1.4"/><path d="M136 150H164" stroke="#ffffff" stroke-width="3"/>`;
  // mitochondrion
  s += `<g transform="translate(150 50)"><ellipse rx="20" ry="8" fill="#ffffff" stroke-width="1.4"/><path d="M-12 -5v8M-4 5v-8M4 -5v8M12 5v-8" stroke-width="0.9"/></g>`;
  // neurotransmitter in the cleft
  for (const [x, y] of [
    [140, 158],
    [150, 162],
    [160, 157],
    [146, 166],
    [156, 168],
    [168, 164],
    [132, 164],
  ])
    s += `<circle cx="${x}" cy="${y}" r="1.6" fill="${c}" stroke="none"/>`;
  // postsynaptic membrane and receptors
  s += `<path d="M20 176Q150 172 280 176V260M20 176V260" stroke-width="2.2"/>`;
  for (const x of [104, 136, 168, 200]) s += `<path d="M${x - 6} 172V180H${x + 6}V172" fill="#ffffff" stroke-width="1.6"/><path d="M${x - 2} 172v4h4v-4" fill="${c}" stroke="none"/>`;
  return s;
}

export const synapseFigure = labeledFigure({
  id: "sci-synapse",
  name: "Synapse",
  w: 300,
  h: 262,
  draw: (_, c) => synapse(c),
  parts: [
    { key: "pre", at: [62, 100], side: "l", fr: "Élément présynaptique", ar: "العنصر قبل المشبكي" },
    { key: "vesicle", at: [91, 90], side: "l", fr: "Vésicule synaptique", ar: "حويصلة مشبكية" },
    { key: "mito", at: [130, 50], side: "l", fr: "Mitochondrie", ar: "ميتوكوندري" },
    { key: "exo", at: [150, 140], side: "r", fr: "Exocytose", ar: "إطراح خلوي" },
    { key: "nt", at: [168, 164], side: "r", fr: "Neurotransmetteur", ar: "الوسيط الكيميائي" },
    { key: "cleft", at: [230, 163], side: "r", fr: "Fente synaptique", ar: "الشق المشبكي" },
    { key: "receptor", at: [200, 176], side: "r", fr: "Récepteur", ar: "مستقبل غشائي" },
    { key: "post", at: [60, 220], side: "l", fr: "Élément postsynaptique", ar: "العنصر بعد المشبكي" },
    { key: "postm", at: [40, 176], side: "l", fr: "Membrane postsynaptique", ar: "الغشاء بعد المشبكي" },
  ],
});

// ---- Reflex arc (spinal cord section, roots, receptor, muscle) ----
function reflexArc(inter: boolean, arrows: boolean, c: string) {
  let s = "";
  // spinal cord: white matter and the grey "butterfly"
  s += `<ellipse cx="300" cy="120" rx="66" ry="56" fill="#ffffff" stroke-width="2"/>`;
  s += `<path d="M300 104Q284 74 266 72Q258 78 270 100Q258 112 262 128Q250 150 262 162Q278 160 290 138Q300 134 310 138Q322 160 338 162Q350 150 338 128Q342 112 330 100Q342 78 334 72Q316 74 300 104Z" fill="#e4e4e7" stroke-width="1.4"/><circle cx="300" cy="120" r="3"/>`;
  // skin and receptor
  s += `<path d="M10 40Q40 34 80 40" stroke-width="2"/><path d="M40 44l-4 8M40 44l4 8M40 44v-2" stroke-width="1.4"/>`;
  // sensory neuron: receptor → spinal ganglion → dorsal horn
  s += `<path d="M40 44Q90 50 150 52Q200 52 246 82Q262 92 ${inter ? "276 98" : "282 134"}" stroke-width="1.8"/>`;
  s += `<ellipse cx="190" cy="58" rx="22" ry="13" fill="#ffffff" stroke-width="1.6"/><circle cx="190" cy="56" r="5.5" fill="#ffffff" stroke-width="1.6"/><path d="M190 61V70" stroke-width="1.6"/>`;
  s += `<path d="M150 52Q170 60 186 59M194 59Q214 56 230 66" stroke-width="1.8"/>`;
  // interneuron
  if (inter) s += `<path d="M276 98Q270 116 280 140" stroke-width="1.8"/><circle cx="276" cy="98" r="3.5" fill="#ffffff" stroke-width="1.4"/>`;
  // motor neuron: ventral horn → ventral root → muscle
  s += `<path d="M280 136l-6 -4M280 136l-2 7M280 136l7 -2" stroke-width="1.4"/><circle cx="280" cy="136" r="5.5" fill="${c}" stroke="none"/>`;
  s += `<path d="M276 140Q250 160 200 172Q140 186 96 196" stroke-width="1.8"/>`;
  s += `<path d="M260 82Q230 66 206 64M262 158Q232 172 210 176" stroke-width="7" stroke="#d4d4d8"/>`;
  // muscle
  s += `<path d="M20 206Q60 176 100 196Q60 222 20 206Z" fill="#ffffff" stroke-width="1.8"/><path d="M30 204Q60 192 90 198M34 210Q60 204 88 202" stroke-width="0.9"/><path d="M96 196l-6 -4M96 196l-6 5" stroke-width="1.6"/>`;
  if (arrows) {
    s += head([118, 52], 0, c, 9) + head([238, 76], 30, c, 9) + head([150, 186], 165, c, 9);
  }
  return s;
}

export const reflexArcFigure = labeledFigure({
  id: "sci-reflex-arc",
  name: "Reflex arc",
  params: [
    { key: "inter", label: "With an interneuron", kind: "bool" },
    { key: "arrows", label: "Direction of the nerve message", kind: "bool" },
  ],
  defaults: { inter: false, arrows: true },
  w: 380,
  h: 230,
  draw: (p, c) => reflexArc(bool(p, "inter"), bool(p, "arrows"), c),
  parts: (p) => [
    { key: "receptor", at: [40, 48], side: "l", fr: "Récepteur sensoriel", ar: "مستقبل حسي" },
    { key: "sensory", at: [100, 51], side: "l", fr: "Neurone sensitif", ar: "عصبون حسي" },
    { key: "ganglion", at: [204, 50], side: "r", fr: "Ganglion spinal", ar: "عقدة شوكية" },
    { key: "dorsal", at: [236, 72], side: "r", fr: "Racine dorsale", ar: "الجذر الخلفي" },
    { key: "grey", at: [326, 148], side: "r", fr: "Substance grise", ar: "المادة الرمادية" },
    { key: "white", at: [352, 100], side: "r", fr: "Substance blanche", ar: "المادة البيضاء" },
    ...(bool(p, "inter") ? [{ key: "inter", at: [274, 112] as Pt, side: "r" as const, fr: "Interneurone", ar: "عصبون جامع" }] : []),
    { key: "motor", at: [280, 136], side: "r", fr: "Motoneurone", ar: "عصبون حركي" },
    { key: "ventral", at: [230, 168], side: "r", fr: "Racine ventrale", ar: "الجذر الأمامي" },
    { key: "muscle", at: [50, 200], side: "l", fr: "Muscle (effecteur)", ar: "العضلة (المنفذ)" },
  ],
});

// ---- Action potential ----
const AP_TEXT: Record<Lang, { x: string; y: string; phases: string[] }> = {
  fr: { x: "t (ms)", y: "Potentiel de membrane (mV)", phases: ["Potentiel de repos", "Dépolarisation", "Repolarisation", "Hyperpolarisation"] },
  ar: { x: "t (ms)", y: "كمون الغشاء (mV)", phases: ["كمون الراحة", "زوال الاستقطاب", "عودة الاستقطاب", "فرط الاستقطاب"] },
};

export const actionPotentialFigure: FigureDef = {
  id: "sci-action-potential",
  name: "Action potential",
  params: [
    { key: "rest", label: "Resting potential", kind: "number", min: -90, max: -50, unit: "mV", row: "mv" },
    { key: "peak", label: "Peak", kind: "number", min: 10, max: 50, unit: "mV", row: "mv" },
    { key: "stimulus", label: "Stimulation artefact", kind: "bool" },
    { key: "labels", label: "Labels", kind: "select", options: LABEL_MODES },
  ],
  defaults: () => ({ rest: -70, peak: 30, stimulus: true, labels: "names" }),
  build: (p, lang) => {
    const c = ink(p);
    const T = AP_TEXT[lang] ?? AP_TEXT.fr;
    const rest = num(p, "rest", -70);
    const peak = num(p, "peak", 30);
    const mode = str(p, "labels", "names");
    const x0 = 70;
    const top = 50;
    const y = (mv: number) => top + ((50 - mv) / 150) * 210; // +50 … −100 mV
    const yZero = y(0);
    let s = axes(x0, y(-100), 330, 230, T.x, T.y, c);
    s += `<path d="M${x0} ${r1(yZero)}H${x0 + 330}" stroke-width="0.8" stroke-dasharray="4 3"/>`;
    s += yTick(x0, yZero, "0", c) + yTick(x0, y(rest), String(rest), c) + yTick(x0, y(peak), `+${peak}`, c);
    s += `<path d="M${x0} ${r1(y(rest))}H${x0 + 330}M${x0} ${r1(y(peak))}H${x0 + 140}" stroke-width="0.6" stroke-dasharray="2 4"/>`;
    // the curve: rest, rise, fall, undershoot, back to rest
    const pts: Pt[] = [];
    const hyper = rest - 12;
    for (let i = 0; i <= 300; i++) {
      const t = i / 300;
      let v = rest;
      if (t > 0.2 && t <= 0.32) v = rest + (peak - rest) * Math.sin(((t - 0.2) / 0.12) * (Math.PI / 2)) ** 2;
      else if (t > 0.32 && t <= 0.5) v = peak + (hyper - peak) * Math.sin(((t - 0.32) / 0.18) * (Math.PI / 2)) ** 1.4;
      else if (t > 0.5 && t <= 0.75) v = hyper + (rest - hyper) * Math.sin(((t - 0.5) / 0.25) * (Math.PI / 2));
      pts.push([x0 + 10 + t * 310, y(v)]);
    }
    if (bool(p, "stimulus")) {
      const sx = x0 + 10 + 0.12 * 310;
      s += `<path d="M${r1(sx)} ${r1(y(rest))}l3 -10l3 18l3 -8" stroke-width="1.4"/>` + say(sx + 3, y(rest) + 26, "S", { size: 12, anchor: "middle", fill: c, bold: true });
    }
    s += polyline(pts, `stroke-width="2.4"`);
    if (mode !== "none") {
      const spots: [Pt, "start" | "end"][] = [
        [[x0 + 300, y(rest) - 8], "end"],
        [[x0 + 10 + 0.26 * 310 - 8, y((rest + peak) / 2)], "end"],
        [[x0 + 10 + 0.4 * 310 + 8, y((rest + peak) / 2)], "start"],
        [[x0 + 10 + 0.5 * 310 + 4, y(hyper) + 18], "start"],
      ];
      spots.forEach(([[sx, sy], anchor], i) => {
        const word = mode === "names" ? T.phases[i] : mode === "lines" ? (anchor === "end" ? `……………… ${i + 1}` : `${i + 1} ………………`) : String(i + 1);
        s += say(sx, sy, word, { size: mode === "numbers" ? 13 : 11, anchor, fill: c, bold: mode === "numbers" });
      });
    }
    return svg(x0 + 360, y(-100) + 40, s, c);
  },
};

// ---- A regulation loop (hormonal): stimulus → gland → hormone → target → response, with negative feedback ----
const LOOP: Record<Lang, string[]> = {
  fr: ["Hyperglycémie", "Pancréas (cellules β)", "Insuline", "Foie, muscles, tissu adipeux", "Baisse de la glycémie"],
  ar: ["ارتفاع نسبة السكر في الدم", "البنكرياس (خلايا β)", "الأنسولين", "الكبد، العضلات، النسيج الدهني", "انخفاض نسبة السكر في الدم"],
};

export const regulationLoopFigure: FigureDef = {
  id: "sci-regulation-loop",
  name: "Regulation loop",
  hint: "Write your own words in the boxes (another hormone, another gland…).",
  params: [
    { key: "b1", label: "Change (stimulus)", kind: "text" },
    { key: "b2", label: "Gland (sensor)", kind: "text" },
    { key: "b3", label: "Hormone", kind: "text" },
    { key: "b4", label: "Target organs", kind: "text" },
    { key: "b5", label: "Response (correction)", kind: "text" },
    { key: "feedback", label: "Negative feedback", kind: "bool" },
    { key: "empty", label: "Empty boxes (the student fills them)", kind: "bool" },
  ],
  defaults: (lang) => {
    const t = LOOP[lang] ?? LOOP.fr;
    return { b1: t[0], b2: t[1], b3: t[2], b4: t[3], b5: t[4], feedback: true, empty: false };
  },
  build: (p, lang) => {
    const c = ink(p);
    const empty = bool(p, "empty");
    const words = [1, 2, 3, 4, 5].map((i) => (empty ? "" : str(p, `b${i}`)));
    const W = 120;
    const H = 52;
    const gap = 34;
    const total = 20 + 4 * W + 3 * gap;
    // (the loop reads in the direction of the language: left to right, or right to left in Arabic)
    const rtl = lang === "ar";
    const X = (x: number) => (rtl ? total - x : x);
    const centers: Pt[] = [0, 1, 2, 3].map((i) => [X(10 + W / 2 + i * (W + gap)), 40]);
    centers.push([centers[3][0], 40 + H + 46]);
    const d = rtl ? -1 : 1;
    let s = "";
    centers.forEach(([x, y], i) => {
      const hormone = i === 2;
      s += hormone ? `<ellipse cx="${x}" cy="${y}" rx="${W / 2}" ry="${H / 2}" fill="#ffffff" stroke-width="1.6"/>` : `<rect x="${x - W / 2}" y="${y - H / 2}" width="${W}" height="${H}" rx="6" fill="#ffffff" stroke-width="1.6"/>`;
      if (words[i]) s += wrapped([x, y], words[i], W - 14, c, textWidth(words[i], 12) > (W - 14) * 3 ? 10 : 12).svg;
    });
    for (let i = 0; i < 3; i++) s += arrow([centers[i][0] + d * (W / 2 + 2), 40], [centers[i + 1][0] - d * (W / 2 + 3), 40], c, `stroke-width="1.8"`);
    s += arrow([centers[3][0], 40 + H / 2 + 2], [centers[4][0], centers[4][1] - H / 2 - 3], c, `stroke-width="1.8"`);
    if (bool(p, "feedback")) {
      const y = centers[4][1];
      const from = centers[4][0] - d * (W / 2 + 2);
      const mid = (centers[0][0] + from) / 2;
      s += `<path d="M${from} ${y}H${centers[0][0]}V${40 + H / 2 + 6}" stroke-width="1.8" stroke-dasharray="6 4"/>` + head([centers[0][0], 40 + H / 2 + 2], -90, c);
      s += `<circle cx="${mid}" cy="${y}" r="10" fill="#ffffff" stroke-width="1.4"/><path d="M${mid - 5} ${y}h10" stroke-width="2"/>`;
    }
    return svg(total, centers[4][1] + H / 2 + 10, s, c);
  },
};

export const NERVOUS_FIGURES: FigureDef[] = [neuronFigure, synapseFigure, reflexArcFigure, actionPotentialFigure, regulationLoopFigure];
