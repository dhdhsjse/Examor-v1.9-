// Chemistry: measuring conductance, titrations (set-ups, reading a burette, conductimetric and pH curves), following a
// transformation (x(t)), and systems moving toward equilibrium (cells, electrolysis, reflux, acid–base diagrams).
import { bool, clamp, fmt, ink, num, r1, str, svg, type Pt } from "../svg";
import type { FigureDef } from "../types";
import { labeledFigure, type Part } from "../sciences/labeled";
import { LIQUID, beaker, chem, curve, disc, frame, guide, head, node, path, place, say, seg, stand, stirrer, surface, vector } from "./draw";

// ---- Apparatus ----
// A burette: its tube from (x, top) down to `bottom`, filled down from `level` (px), its tap and its tip.
function burette(x: number, top: number, bottom: number, level: number) {
  let s = `<rect x="${x - 7}" y="${r1(level)}" width="14" height="${r1(bottom - level)}" fill="${LIQUID}" stroke="none"/>`;
  s += `<path d="M${x - 7} ${top}V${bottom}M${x + 7} ${top}V${bottom}" stroke-width="1.8"/>`;
  for (let y = top + 12; y < bottom - 6; y += 10) s += `<path d="M${x - 7} ${y}h${(y - top - 12) % 50 === 0 ? 8 : 4}" stroke-width="0.8"/>`;
  s += `<path d="M${x - 7} ${bottom}L${x - 3} ${bottom + 16}V${bottom + 34}L${x - 1} ${bottom + 44}H${x + 1}L${x + 3} ${bottom + 34}V${bottom + 16}L${x + 7} ${bottom}" fill="#ffffff" stroke-width="1.6"/>`;
  s += `<rect x="${x - 12}" y="${bottom + 18}" width="24" height="9" rx="2" fill="#ffffff" stroke-width="1.5"/><path d="M${x + 12} ${bottom + 22}h10" stroke-width="3"/>`;
  return s;
}
// A meter (pH-meter, conductimeter): a box with its display.
function meter(x: number, y: number, text: string, c: string) {
  return `<rect x="${x}" y="${y}" width="96" height="66" rx="6" fill="#ffffff" stroke-width="2"/><rect x="${x + 10}" y="${y + 10}" width="76" height="28" rx="3" stroke-width="1.4"/>` + say(x + 48, y + 30, text, { size: 14, anchor: "middle", fill: c, bold: true }) + `<circle cx="${x + 24}" cy="${y + 52}" r="5" stroke-width="1.2"/><circle cx="${x + 72}" cy="${y + 52}" r="5" stroke-width="1.2"/>`;
}
// A pH probe (a combined electrode) or a conductimetry cell (two plates), dipping down to y.
function probe(x: number, y: number, kind: "ph" | "cell") {
  if (kind === "ph") return `<rect x="${x - 6}" y="${y - 120}" width="12" height="108" rx="3" fill="#ffffff" stroke-width="1.6"/><path d="M${x - 6} ${y - 12}Q${x} ${y + 4} ${x + 6} ${y - 12}" fill="#ffffff" stroke-width="1.6"/>`;
  return `<rect x="${x - 9}" y="${y - 120}" width="18" height="90" rx="3" fill="#ffffff" stroke-width="1.6"/><path d="M${x - 9} ${y - 30}V${y}M${x + 9} ${y - 30}V${y}" stroke-width="1.6"/><rect x="${x - 7}" y="${y - 24}" width="3" height="22" fill="currentColor" stroke="none"/><rect x="${x + 4}" y="${y - 24}" width="3" height="22" fill="currentColor" stroke="none"/>`;
}

// ---- Titration set-up ----
function titration(kind: string, c: string) {
  let s = stand(40, 380, 20, 60, 110);
  s += burette(120, 30, 230, 70);
  s += beaker(76, 300, 92, 64, 0.5) + stirrer(62, 368, 120, [122, 356]);
  if (kind === "ph" || kind === "cell") {
    s += probe(150, 352, kind) + `<path d="M150 232Q150 200 200 196Q240 192 250 150" stroke-width="1.4"/>` + meter(220, 84, kind === "ph" ? "pH" : "σ", c);
  }
  return s.replace(/currentColor/g, c);
}
export const titrationFigure = labeledFigure({
  id: "pc-titration",
  name: "Titration set-up",
  params: [
    {
      key: "probe",
      label: "Followed with",
      kind: "select",
      options: [
        { value: "none", label: "An indicator (colour change)" },
        { value: "ph", label: "A pH-meter" },
        { value: "cell", label: "A conductimeter" },
      ],
    },
  ],
  defaults: { probe: "ph" },
  w: 330,
  h: 392,
  draw: (p, c) => titration(str(p, "probe", "ph"), c),
  parts: (p) => {
    const kind = str(p, "probe", "ph");
    const list: Part[] = [
      { key: "burette", at: [113, 120] as Pt, side: "l" as const, fr: "Burette graduée", ar: "سحاحة مدرجة" },
      { key: "titrant", at: [113, 180] as Pt, side: "l" as const, fr: "Solution titrante", ar: "المحلول المعاير" },
      { key: "support", at: [40, 250] as Pt, side: "l" as const, fr: "Support", ar: "حامل" },
      { key: "titrated", at: [86, 340] as Pt, side: "l" as const, fr: "Solution à titrer", ar: "المحلول المراد معايرته" },
      { key: "stirrer", at: [62, 380] as Pt, side: "l" as const, fr: "Agitateur magnétique", ar: "محرك مغناطيسي" },
    ];
    if (kind !== "none") {
      list.push({ key: "meter", at: [316, 110] as Pt, side: "r" as const, fr: kind === "ph" ? "pH-mètre" : "Conductimètre", ar: kind === "ph" ? "جهاز pH-متر" : "جهاز قياس المواصلة" });
      list.push({ key: "probe", at: [156, 280] as Pt, side: "r" as const, fr: kind === "ph" ? "Électrode (sonde) de pH" : "Cellule conductimétrique", ar: kind === "ph" ? "مسبار pH-متر" : "خلية قياس المواصلة" });
    }
    list.push({ key: "bar", at: [134, 356] as Pt, side: "r" as const, fr: "Barreau aimanté", ar: "قضيب مغناطيسي" });
    return list;
  },
});

// ---- Measuring a conductance ----
function conductance(setup: string, c: string) {
  let s = beaker(150, 170, 120, 90, 0.7);
  s += probe(210, 248, "cell");
  if (setup === "meter") return (s + `<path d="M210 128Q210 80 260 70" stroke-width="1.4"/>` + meter(260, 30, "G", c)).replace(/currentColor/g, c);
  // a low-frequency generator, an ammeter in series, a voltmeter across the cell
  const wire = (pts: Pt[]) => `<path d="${path(pts)}" stroke-width="2"/>`;
  s += wire([[201, 128], [201, 60], [150, 60]]) + place("ammeter", [150, 60], [90, 60], c) + wire([[90, 60], [40, 60], [40, 110]]);
  s += place("lowfreq", [40, 110], [40, 170], c) + wire([[40, 170], [40, 290], [330, 290], [330, 110], [219, 110], [219, 128]]);
  // the voltmeter across the cell
  s += wire([[201, 60], [290, 60]]) + place("voltmeter", [290, 60], [290, 110], c) + node([201, 60], c) + node([290, 110], c);
  return s.replace(/currentColor/g, c);
}
export const conductanceFigure = labeledFigure({
  id: "pc-conductance",
  name: "Measuring a conductance",
  params: [
    {
      key: "setup",
      label: "Measured with",
      kind: "select",
      options: [
        { value: "meter", label: "A conductimeter" },
        { value: "circuit", label: "A generator, an ammeter and a voltmeter" },
      ],
    },
  ],
  defaults: { setup: "meter" },
  w: 370,
  h: 300,
  draw: (p, c) => conductance(str(p, "setup", "meter"), c),
  parts: (p) => [
    ...(str(p, "setup", "meter") === "meter"
      ? [{ key: "meter", at: [356, 60] as Pt, side: "r" as const, fr: "Conductimètre", ar: "جهاز قياس المواصلة" }]
      : [
          { key: "gbf", at: [26, 140] as Pt, side: "l" as const, fr: "Générateur de basse fréquence (GBF)", ar: "مولد التردد المنخفض (GBF)" },
          { key: "ammeter", at: [120, 46] as Pt, side: "t" as const, fr: "Ampèremètre", ar: "أمبيرمتر" },
          { key: "voltmeter", at: [304, 85] as Pt, side: "r" as const, fr: "Voltmètre", ar: "فولطمتر" },
        ]),
    { key: "cell", at: [219, 236] as Pt, side: "r" as const, fr: "Cellule (deux plaques parallèles)", ar: "خلية (صفيحتان متوازيتان)" },
    { key: "solution", at: [160, 250] as Pt, side: "l" as const, fr: "Solution ionique", ar: "محلول أيوني" },
  ],
});

// ---- Reading a burette ----
export const buretteFigure: FigureDef = {
  id: "pc-burette",
  name: "Burette reading (close-up)",
  params: [{ key: "volume", label: "Volume poured", kind: "number", min: 0.5, max: 24.5, step: 0.05, unit: "mL" }],
  defaults: () => ({ volume: 12.4 }),
  build: (p) => {
    const c = ink(p);
    const v = clamp(num(p, "volume", 12.4), 0.5, 24.5);
    const lo = Math.max(0, Math.round((v - 1.4) * 10) / 10);
    const hi = lo + 2.8;
    const top = 20;
    const bottom = 300;
    const Y = (ml: number) => top + ((ml - lo) / (hi - lo)) * (bottom - top); // the burette is numbered downward
    const x = 100;
    const w = 90;
    const lv = Y(v);
    let s = `<path d="M${x} ${r1(lv - 8)}Q${x + w / 2} ${r1(lv + 8)} ${x + w} ${r1(lv - 8)}V${bottom}H${x}Z" fill="${LIQUID}" stroke="none"/>`;
    s += `<path d="M${x} ${r1(lv - 8)}Q${x + w / 2} ${r1(lv + 8)} ${x + w} ${r1(lv - 8)}" stroke-width="1.4"/>`;
    s += `<path d="M${x} ${top - 10}V${bottom}M${x + w} ${top - 10}V${bottom}" stroke-width="2.2"/>`;
    for (let i = Math.ceil(lo * 10); i <= Math.floor(hi * 10); i++) {
      const ml = i / 10;
      const whole = i % 10 === 0;
      const half = i % 5 === 0;
      s += `<path d="M${x} ${r1(Y(ml))}h${whole ? 50 : half ? 34 : 20}" stroke-width="${whole ? 1.6 : 1}"/>`;
      if (whole) s += say(x - 8, Y(ml) + 5, String(ml), { size: 15, anchor: "end", fill: c });
    }
    s += say(x + w + 8, top + 4, "mL", { size: 13, fill: c });
    return svg(x + w + 50, bottom + 10, s, c);
  },
};

// ---- Conductimetric titration curve ----
export const condCurveFigure: FigureDef = {
  id: "pc-cond-curve",
  name: "Conductimetric titration curve",
  params: [
    {
      key: "shape",
      label: "Shape",
      kind: "select",
      options: [
        { value: "v", label: "Down, then up" },
        { value: "up", label: "Up, then up faster" },
        { value: "flat", label: "Flat, then up" },
        { value: "down", label: "Down, then flat" },
      ],
    },
    { key: "veq", label: "Equivalence volume", kind: "number", min: 2, max: 30, step: 0.1, unit: "mL" },
    { key: "quantity", label: "Quantity measured", kind: "select", options: [{ value: "σ (mS·m^−1)", label: "σ" }, { value: "G (mS)", label: "G" }] },
    { key: "construction", label: "Equivalence point (lines)", kind: "bool", row: "o" },
    { key: "grid", label: "Grid", kind: "bool", row: "o" },
  ],
  defaults: () => ({ shape: "v", veq: 10, quantity: "σ (mS·m^−1)", construction: true, grid: false }),
  build: (p) => {
    const c = ink(p);
    const veq = clamp(num(p, "veq", 10), 2, 30);
    const vmax = Math.ceil((veq * 2) / 5) * 5;
    const shape = str(p, "shape", "v");
    const [a0, a1, a2] = shape === "v" ? [8, 3, 6.5] : shape === "up" ? [2, 3.2, 7] : shape === "flat" ? [3, 3, 6.5] : [7, 2.6, 2.6];
    // y at 0, at Veq, at Vmax (on a scale of 10)
    const fn = (v: number) => (v <= veq ? a0 + ((a1 - a0) * v) / veq : a1 + ((a2 - a1) * (v - veq)) / (vmax - veq));
    const f = frame({ x0: 60, y0: 250, w: 380, h: 200, xMax: vmax, yMax: 10, xName: "V (mL)", yName: str(p, "quantity", "σ (mS·m^−1)"), c, xStep: vmax / 10 >= 2 ? Math.round(vmax / 10) : 1, grid: bool(p, "grid") });
    let s = f.s;
    s += `<path d="${path(curve(f, fn, 0, vmax, 120))}" stroke-width="2.2"/>`;
    for (let k = 1; k <= 8; k++) {
      const v = (k * vmax) / 9;
      s += `<path d="M${r1(f.X(v) - 4)} ${r1(f.Y(fn(v)) - 4)}l8 8m0 -8l-8 8" stroke-width="1.4"/>`;
    }
    if (bool(p, "construction")) s += guide(f, veq, fn(veq), "VE", "", c) + disc([f.X(veq), f.Y(fn(veq))], 3.5, c, `stroke="none"`) + say(f.X(veq) + 8, f.Y(fn(veq)) - 10, "E", { size: 13, fill: c, bold: true });
    return svg(480, 290, s, c);
  },
};

// ---- Advancement x(t) ----
export const advancementFigure: FigureDef = {
  id: "pc-advancement",
  name: "Advancement over time x(t)",
  params: [
    { key: "half", label: "Half-reaction time t½", kind: "bool", row: "a" },
    { key: "equilibrium", label: "Equilibrium (xf < xmax)", kind: "bool", row: "a" },
    { key: "tangent", label: "Tangent (rate at a time)", kind: "bool", row: "b" },
    { key: "grid", label: "Grid", kind: "bool", row: "b" },
    { key: "xName", label: "y axis", kind: "text", placeholder: "x (mmol)", row: "n" },
    { key: "tName", label: "x axis", kind: "text", placeholder: "t (min)", row: "n" },
  ],
  defaults: () => ({ half: true, equilibrium: false, tangent: false, grid: true, xName: "x (mmol)", tName: "t (min)" }),
  build: (p) => {
    const c = ink(p);
    const eq = bool(p, "equilibrium");
    const xf = eq ? 0.7 : 1;
    const k = 4.2;
    const fn = (t: number) => xf * (1 - Math.exp(-k * t));
    const f = frame({ x0: 60, y0: 250, w: 380, h: 200, xMax: 1, yMax: 1.15, xName: str(p, "tName", "t (min)"), yName: str(p, "xName", "x (mmol)"), c, ticks: false, grid: bool(p, "grid"), gridX: 0.1, gridY: 0.1 });
    let s = f.s + `<path d="${path(curve(f, fn, 0, 1))}" stroke-width="2.4"/>`;
    s += `<path d="M${f.x0} ${r1(f.Y(xf))}H${r1(f.X(1))}" stroke-width="1" stroke-dasharray="6 4"/>` + chem(f.x0 - 8, f.Y(xf) + 4, eq ? "xf" : "xmax", { size: 12, anchor: "end", fill: c });
    if (eq) s += `<path d="M${f.x0} ${r1(f.Y(1))}H${r1(f.X(1))}" stroke-width="1" stroke-dasharray="2 4"/>` + chem(f.x0 - 8, f.Y(1) + 4, "xmax", { size: 12, anchor: "end", fill: c });
    if (bool(p, "half")) {
      const th = Math.log(2) / k;
      s += guide(f, th, xf / 2, "t½", eq ? "xf/2" : "xmax/2", c);
    }
    if (bool(p, "tangent")) {
      const t0 = 0.12;
      const slope = xf * k * Math.exp(-k * t0);
      const a = t0 - fn(t0) / slope;
      const b = Math.min(1, t0 + (1.1 - fn(t0)) / slope);
      s += seg([f.X(Math.max(0, a)), f.Y(fn(t0) + slope * (Math.max(0, a) - t0))], [f.X(b), f.Y(fn(t0) + slope * (b - t0))], `stroke-width="1.2"`) + disc([f.X(t0), f.Y(fn(t0))], 3.5, c, `stroke="none"`);
      s += chem(f.X(t0) + 8, f.Y(fn(t0)) + 16, "M", { size: 12, fill: c, bold: true });
    }
    return svg(480, 290, s, c);
  },
};

// ---- pH titration curve (worked out from the charge balance) ----
// pH of the mixture when V mL of titrant are poured on 20 mL of the titrated solution (0.1 mol/L).
export function titrationPH(kind: string, pKa: number, veq: number, v: number): number {
  const Va = 20;
  const Ca = 0.1;
  const Ct = (Ca * Va) / veq; // the titrant
  const total = Va + v;
  const acidSide = kind === "strong-acid" || kind === "weak-acid";
  const Ka = 10 ** -(kind === "strong-acid" ? -8 : kind === "strong-base" ? 22 : pKa);
  const n = (Ca * Va) / total; // the titrated species
  const t = (Ct * v) / total; // the titrant ions
  const balance = (ph: number) => {
    const h = 10 ** -ph;
    const oh = 1e-14 / h;
    // titrated acid HA (+ Na+ from the base) or titrated base B (+ Cl− from the acid)
    return acidSide ? h + t - oh - (n * Ka) / (Ka + h) : h + (n * h) / (h + Ka) - oh - t;
  };
  let lo = 0;
  let hi = 14;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (balance(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export const phCurveFigure: FigureDef = {
  id: "pc-ph-curve",
  name: "pH titration curve",
  params: [
    {
      key: "kind",
      label: "Titration",
      kind: "select",
      options: [
        { value: "weak-acid", label: "Weak acid by a strong base" },
        { value: "strong-acid", label: "Strong acid by a strong base" },
        { value: "weak-base", label: "Weak base by a strong acid" },
        { value: "strong-base", label: "Strong base by a strong acid" },
      ],
    },
    { key: "veq", label: "Equivalence volume", kind: "number", min: 5, max: 25, step: 0.1, unit: "mL", row: "v" },
    { key: "pKa", label: "pKa", kind: "number", min: 2, max: 12, step: 0.1, row: "v", when: (p) => p.kind === "weak-acid" || p.kind === "weak-base" },
    { key: "equivalence", label: "Equivalence point E", kind: "bool", row: "o" },
    { key: "halfway", label: "Half-equivalence (pH = pKa)", kind: "bool", row: "o" },
    { key: "grid", label: "Grid", kind: "bool" },
  ],
  defaults: () => ({ kind: "weak-acid", veq: 10, pKa: 4.8, equivalence: true, halfway: false, grid: true }),
  build: (p) => {
    const c = ink(p);
    const kind = str(p, "kind", "weak-acid");
    const veq = clamp(num(p, "veq", 10), 5, 25);
    const pKa = clamp(num(p, "pKa", 4.8), 2, 12);
    const vmax = Math.ceil((veq * 2) / 5) * 5;
    const fn = (v: number) => titrationPH(kind, pKa, veq, v);
    const f = frame({ x0: 50, y0: 260, w: 400, h: 224, xMax: vmax, yMax: 14, xName: kind.endsWith("acid") ? "VB (mL)" : "VA (mL)", yName: "pH", c, xStep: vmax >= 30 ? 5 : 2, yStep: 2, grid: bool(p, "grid"), gridX: vmax >= 30 ? 2.5 : 1, gridY: 1 });
    let s = f.s + `<path d="${path(curve(f, fn, 0, vmax, 400))}" stroke-width="2.2"/>`;
    if (bool(p, "equivalence")) s += guide(f, veq, fn(veq), "VE", "pHE", c) + disc([f.X(veq), f.Y(fn(veq))], 3.5, c, `stroke="none"`) + say(f.X(veq) + 8, f.Y(fn(veq)) + 4, "E", { size: 13, fill: c, bold: true });
    if (bool(p, "halfway") && (kind === "weak-acid" || kind === "weak-base")) s += guide(f, veq / 2, fn(veq / 2), "VE/2", "pKa", c);
    return svg(490, 300, s, c);
  },
};

// ---- Electrochemical cell ----
// The usual ion of a metal of school cells (an unknown metal keeps its name).
const IONS: Record<string, string> = { Zn: "Zn²⁺", Cu: "Cu²⁺", Ag: "Ag⁺", Fe: "Fe²⁺", Al: "Al³⁺", Pb: "Pb²⁺", Ni: "Ni²⁺", Mg: "Mg²⁺", Sn: "Sn²⁺", Co: "Co²⁺" };
const ionOf = (metal: string) => IONS[metal.trim()] ?? metal;
function cell(m1: string, m2: string, external: string, arrows: boolean, c: string) {
  let s = beaker(30, 150, 130, 110, 0.75) + beaker(250, 150, 130, 110, 0.75);
  // the electrodes
  s += `<rect x="78" y="90" width="18" height="150" fill="#d9d9d9" stroke-width="1.8"/><rect x="314" y="90" width="18" height="150" fill="#ffffff" stroke-width="1.8"/>`;
  // salt bridge
  s += `<path d="M120 230V140Q120 112 148 112H262Q290 112 290 140V230H272V140Q272 130 262 130H148Q138 130 138 140V230Z" fill="#ffffff" stroke-width="1.8"/>`;
  // the external circuit
  const wire = (pts: Pt[]) => `<path d="${path(pts)}" stroke-width="2"/>`;
  if (external === "voltmeter") s += wire([[87, 90], [87, 40], [165, 40]]) + place("voltmeter", [165, 40], [245, 40], c) + wire([[245, 40], [323, 40], [323, 90]]);
  else s += wire([[87, 90], [87, 40], [120, 40]]) + place("resistor", [120, 40], [190, 40], c) + place("ammeter", [220, 40], [290, 40], c) + wire([[190, 40], [220, 40]]) + wire([[290, 40], [323, 40], [323, 90]]);
  s += say(87, 270, m1, { size: 14, anchor: "middle", fill: c, bold: true }) + say(323, 270, m2, { size: 14, anchor: "middle", fill: c, bold: true });
  if (arrows) {
    // electrons leave the anode (m1, −) through the wire; the current goes the other way
    s += say(66, 70, "−", { size: 20, anchor: "middle", fill: c, bold: true }) + say(346, 70, "+", { size: 18, anchor: "middle", fill: c, bold: true });
    s += vector([100, 16], [150, 16], c, 1.4) + say(125, 10, "e⁻", { size: 13, anchor: "middle", fill: c });
    s += vector([310, 16], [260, 16], c, 1.4) + say(285, 10, "I", { size: 13, anchor: "middle", fill: c, italic: true });
  }
  return s;
}
export const cellFigure = labeledFigure({
  id: "pc-cell",
  name: "Electrochemical cell",
  params: [
    { key: "m1", label: "Metal 1 (anode)", kind: "text", placeholder: "Zn", row: "m" },
    { key: "m2", label: "Metal 2 (cathode)", kind: "text", placeholder: "Cu", row: "m" },
    {
      key: "external",
      label: "Outside circuit",
      kind: "select",
      options: [
        { value: "load", label: "Resistor and ammeter" },
        { value: "voltmeter", label: "Voltmeter" },
      ],
    },
    { key: "arrows", label: "Poles, electrons and current", kind: "bool" },
  ],
  defaults: { m1: "Zn", m2: "Cu", external: "load", arrows: false },
  w: 410,
  h: 290,
  draw: (p, c) => cell(str(p, "m1", "Zn"), str(p, "m2", "Cu"), str(p, "external", "load"), bool(p, "arrows"), c),
  parts: (p) => {
    const m1 = str(p, "m1", "Zn") || "M1";
    const m2 = str(p, "m2", "Cu") || "M2";
    return [
      { key: "e1", at: [78, 130], side: "l", fr: `Lame de ${m1}`, ar: `صفيحة ${m1}` },
      { key: "s1", at: [40, 220], side: "l", fr: `Solution d'ions ${ionOf(m1)}`, ar: `محلول أيونات ${ionOf(m1)}` },
      { key: "bridge", at: [205, 112], side: "t", fr: "Pont salin", ar: "القنطرة الملحية" },
      { key: "e2", at: [332, 130], side: "r", fr: `Lame de ${m2}`, ar: `صفيحة ${m2}` },
      { key: "s2", at: [370, 220], side: "r", fr: `Solution d'ions ${ionOf(m2)}`, ar: `محلول أيونات ${ionOf(m2)}` },
    ];
  },
});

// ---- Electrolysis ----
function electrolysis(c: string) {
  let s = beaker(60, 150, 220, 130, 0.8);
  // the two electrodes, each under a test tube collecting its gas
  for (const x of [120, 220]) {
    s += `<path d="M${x - 16} 214V80Q${x - 16} 64 ${x} 64Q${x + 16} 64 ${x + 16} 80V214" fill="#ffffff" stroke-width="1.8"/>`;
    s += `<path d="M${x - 16} 120H${x + 16}V214H${x - 16}Z" fill="${LIQUID}" stroke="none"/><path d="M${x - 16} 120H${x + 16}" stroke-width="1"/>`;
    s += `<rect x="${x - 4}" y="170" width="8" height="90" fill="#d9d9d9" stroke-width="1.4"/>`;
    for (const [dx, dy] of [
      [-6, 158], [5, 142], [-3, 130], [7, 166],
    ])
      s += `<circle cx="${x + dx}" cy="${dy}" r="2.6" stroke-width="1"/>`;
  }
  // wires under the beaker to the generator
  s += `<path d="M120 260V300H140M220 260V300H200" stroke-width="2"/>`;
  // the + plate on the anode side (right)
  s += place("battery", [200, 300], [140, 300], c) + say(150, 324, "−", { size: 16, anchor: "middle", fill: c, bold: true });
  return s;
}
export const electrolysisFigure = labeledFigure({
  id: "pc-electrolysis",
  name: "Electrolysis",
  w: 340,
  h: 330,
  draw: (_p, c) => electrolysis(c),
  parts: [
    { key: "tube1", at: [104, 96], side: "l", fr: "Tube à essai (gaz)", ar: "أنبوب اختبار (غاز)" },
    { key: "cathode", at: [116, 240], side: "l", fr: "Cathode", ar: "الكاثود" },
    { key: "solution", at: [64, 200], side: "l", fr: "Électrolyte", ar: "المحلول الإلكتروليتي" },
    { key: "tube2", at: [236, 96], side: "r", fr: "Tube à essai (gaz)", ar: "أنبوب اختبار (غاز)" },
    { key: "anode", at: [224, 240], side: "r", fr: "Anode", ar: "الأنود" },
    { key: "generator", at: [200, 300], side: "r", fr: "Générateur", ar: "مولد" },
  ],
});

// ---- Heating under reflux ----
function reflux(c: string) {
  let s = stand(40, 360, 20, 250, 130);
  s += `<path d="M30 300Q30 350 100 350Q170 350 170 300Z" fill="#ffffff" stroke-width="2"/><rect x="24" y="350" width="152" height="20" rx="3" fill="#ffffff" stroke-width="2"/>`;
  s += `<path d="M88 220V250Q46 262 46 296Q46 340 100 340Q154 340 154 296Q154 262 112 250V220" fill="#ffffff" stroke-width="2"/>`;
  s += `<path d="M50 288Q100 296 150 288Q154 292 154 296Q154 340 100 340Q46 340 46 296Q46 292 50 288Z" fill="${LIQUID}" stroke="none"/>` + surface(50, 150, 288);
  for (const [x, y] of [
    [80, 318], [104, 326], [122, 314],
  ])
    s += `<path d="M${x - 5} ${y}l4 -5l6 1l2 5l-5 4z" fill="#8c8c8c" stroke-width="1"/>`;
  // the condenser, upright: inner tube in its jacket, water in at the bottom, out at the top
  s += `<path d="M92 20V222M108 20V222" stroke-width="1.8"/>`;
  s += `<path d="M92 50H80V190H92M108 50H120V190H108" fill="#ffffff" stroke-width="2"/><path d="M92 50V190M108 50V190" stroke-width="1.8"/>`;
  s += `<path d="M120 172H146M120 168H146M120 72H146M120 68H146" stroke-width="1"/><path d="M120 176H148V164H120M120 76H148V64H120" fill="#ffffff" stroke-width="1.6"/>`;
  s += head([120, 170], 180, c, 8) + head([158, 70], 0, c, 8);
  return s;
}
export const refluxFigure = labeledFigure({
  id: "pc-reflux",
  name: "Heating under reflux",
  w: 200,
  h: 376,
  draw: (_p, c) => reflux(c),
  parts: [
    { key: "condenser", at: [80, 110], side: "l", fr: "Réfrigérant", ar: "مبرد" },
    { key: "support", at: [40, 160], side: "l", fr: "Support", ar: "حامل" },
    { key: "flask", at: [56, 270], side: "l", fr: "Ballon", ar: "حوجلة" },
    { key: "heater", at: [30, 360], side: "l", fr: "Chauffe-ballon", ar: "مسخن كهربائي" },
    { key: "out", at: [148, 70], side: "r", fr: "Sortie d'eau", ar: "خروج الماء" },
    { key: "in", at: [148, 170], side: "r", fr: "Entrée d'eau", ar: "دخول الماء" },
    { key: "mix", at: [140, 304], side: "r", fr: "Mélange réactionnel", ar: "الخليط التفاعلي" },
    { key: "pumice", at: [122, 314], side: "r", fr: "Pierre ponce", ar: "حجر الخفان" },
  ],
});

// ---- Predominance diagram ----
export const predominanceFigure: FigureDef = {
  id: "pc-predominance",
  name: "Predominance diagram",
  params: [
    { key: "acid", label: "Acid", kind: "text", placeholder: "CH3COOH", row: "c" },
    { key: "base", label: "Base", kind: "text", placeholder: "CH3COO^−", row: "c" },
    { key: "pKa", label: "pKa", kind: "number", min: 0, max: 14, step: 0.01 },
    { key: "second", label: "A second couple", kind: "bool" },
    { key: "base2", label: "Base 2", kind: "text", placeholder: "", when: (p) => p.second === true, row: "c2" },
    { key: "pKa2", label: "pKa 2", kind: "number", min: 0, max: 14, step: 0.01, when: (p) => p.second === true, row: "c2" },
    { key: "empty", label: "Empty boxes (the student fills them)", kind: "bool" },
  ],
  defaults: () => ({ acid: "CH3COOH", base: "CH3COO^−", pKa: 4.8, second: false, base2: "", pKa2: 9.2, empty: false }),
  build: (p) => {
    const c = ink(p);
    const X = (ph: number) => 40 + (ph / 14) * 440;
    const y = 80;
    let s = `<path d="M30 ${y}H490" stroke-width="2"/>` + head([496, y], 0, c) + say(500, y - 10, "pH", { size: 14, anchor: "end", fill: c, bold: true });
    for (let ph = 0; ph <= 14; ph++) s += `<path d="M${r1(X(ph))} ${y - 4}v8" stroke-width="1"/>` + (ph % 2 === 0 ? say(X(ph), y + 22, String(ph), { size: 11, anchor: "middle", fill: c }) : "");
    const marks = [clamp(num(p, "pKa", 4.8), 0, 14)];
    const names = [str(p, "acid"), str(p, "base")];
    if (bool(p, "second")) {
      marks.push(clamp(num(p, "pKa2", 9.2), marks[0], 14));
      names.push(str(p, "base2"));
    }
    const edges = [0, ...marks, 14];
    marks.forEach((m, i) => {
      const name = marks.length > 1 ? `pKa${i + 1}` : "pKa";
      s += `<path d="M${r1(X(m))} ${y - 44}V${y + 6}" stroke-width="1.6"/>` + chem(X(m), y - 50, `${name} = ${fmt(m)}`, { size: 12, anchor: "middle", fill: c });
    });
    for (let i = 0; i < edges.length - 1; i++) {
      const mid = (X(edges[i]) + X(edges[i + 1])) / 2;
      if (bool(p, "empty")) s += `<rect x="${r1(mid - 40)}" y="${y - 36}" width="80" height="24" fill="#ffffff" stroke-width="1" stroke-dasharray="3 3"/>`;
      else s += chem(mid, y - 18, names[i] ?? "", { size: 15, anchor: "middle", fill: c, bold: true });
    }
    return svg(520, 116, s, c);
  },
};

// ---- Distribution diagram ----
export const distributionFigure: FigureDef = {
  id: "pc-distribution",
  name: "Distribution diagram",
  params: [
    { key: "acid", label: "Acid", kind: "text", placeholder: "HA", row: "c" },
    { key: "base", label: "Base", kind: "text", placeholder: "A^−", row: "c" },
    { key: "pKa", label: "pKa", kind: "number", min: 1, max: 13, step: 0.01 },
    { key: "guide", label: "Crossing point (50 %)", kind: "bool", row: "o" },
    { key: "grid", label: "Grid", kind: "bool", row: "o" },
  ],
  defaults: () => ({ acid: "HA", base: "A^−", pKa: 4.8, guide: true, grid: true }),
  build: (p) => {
    const c = ink(p);
    const pKa = clamp(num(p, "pKa", 4.8), 1, 13);
    const f = frame({ x0: 60, y0: 250, w: 380, h: 200, xMax: 14, yMax: 100, xName: "pH", yName: "%", c, xStep: 2, yStep: 20, grid: bool(p, "grid"), gridX: 1, gridY: 10 });
    const acid = (ph: number) => 100 / (1 + 10 ** (ph - pKa));
    let s = f.s + `<path d="${path(curve(f, acid, 0, 14, 200))}" stroke-width="2.2"/>` + `<path d="${path(curve(f, (ph) => 100 - acid(ph), 0, 14, 200))}" stroke-width="2.2" stroke-dasharray="8 5"/>`;
    const at = (ph: number, fn: (x: number) => number, t: string) => chem(f.X(ph), f.Y(fn(ph)) - 10, t, { size: 13, anchor: "middle", fill: c, bold: true });
    s += at(Math.max(0.8, pKa - 3), acid, `%${str(p, "acid", "HA")}`) + at(Math.min(13.2, pKa + 3), (ph) => 100 - acid(ph), `%${str(p, "base", "A^−")}`);
    if (bool(p, "guide")) s += guide(f, pKa, 50, "pKa", "50", c);
    return svg(480, 290, s, c);
  },
};

export const CHEMISTRY_FIGURES: FigureDef[] = [conductanceFigure, titrationFigure, buretteFigure, condCurveFigure, advancementFigure, phCurveFigure, cellFigure, electrolysisFigure, refluxFigure, predominanceFigure, distributionFigure];
