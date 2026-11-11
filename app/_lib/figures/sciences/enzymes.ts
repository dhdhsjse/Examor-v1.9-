// Enzyme activity: enzyme and substrate (active site, complex, products), the activity curves.
import { bool, ink, num, r1, str, svg, type Pt } from "../svg";
import type { FigureDef } from "../types";
import type { Lang } from "../../types";
import { arrow, axes, polyline, say, xTick } from "./draw";
import { labeledFigure } from "./labeled";

// The enzyme (100 × 80, its active site a hollow at the top) and the substrate that fits it, drawn from (x, y).
const ENZYME = "M0 20Q0 0 20 0L30 0L38 22L50 14L62 22L70 0L80 0Q100 0 100 20L100 60Q100 80 80 80L20 80Q0 80 0 60Z";
const SUBSTRATE = "M30 -14L70 -14L70 0L62 22L50 14L38 22L30 0Z";
const PRODUCT_L = "M30 -14L50 -14L50 14L38 22L30 0Z";
const PRODUCT_R = "M50 -14L70 -14L70 0L62 22L50 14Z";
const at = (x: number, y: number, d: string, fill: string) => `<path transform="translate(${x} ${y})" d="${d}" fill="${fill}" stroke-width="1.8"/>`;
const GREY = "#d4d4d8";

function enzymeScene(steps: string, letters: boolean, c: string) {
  let s = "";
  const letter = (x: number, t: string) => (letters ? say(x, 152, t, { size: 14, anchor: "middle", fill: c, bold: true }) : "");
  s += at(10, 56, ENZYME, "#ffffff") + letter(60, "E");
  if (steps === "complex") return s + at(10, 56, SUBSTRATE, GREY);
  s += say(126, 104, "+", { size: 20, anchor: "middle", fill: c });
  s += at(110, 72, SUBSTRATE, GREY) + letter(160, "S");
  if (steps === "pair") return s;
  s += arrow([196, 96], [228, 96], c, `stroke-width="1.8"`);
  s += at(236, 56, ENZYME, "#ffffff") + at(236, 56, SUBSTRATE, GREY) + letter(286, "E–S");
  s += arrow([348, 96], [380, 96], c, `stroke-width="1.8"`);
  s += at(388, 56, ENZYME, "#ffffff") + at(372, 16, PRODUCT_L, GREY) + at(404, 16, PRODUCT_R, GREY) + letter(438, "E + P");
  return s;
}

export const enzymeSubstrateFigure = labeledFigure({
  id: "sci-enzyme-substrate",
  name: "Enzyme and substrate",
  params: [
    {
      key: "steps",
      label: "Show",
      kind: "select",
      options: [
        { value: "all", label: "The whole reaction" },
        { value: "pair", label: "Enzyme and substrate" },
        { value: "complex", label: "Enzyme–substrate complex" },
      ],
    },
    { key: "letters", label: "Letters (E, S, P)", kind: "bool" },
  ],
  defaults: { steps: "all", letters: true },
  w: (p) => (str(p, "steps") === "all" ? 500 : str(p, "steps") === "pair" ? 200 : 120),
  h: 160,
  draw: (p, c) => enzymeScene(str(p, "steps", "all"), bool(p, "letters"), c),
  parts: (p) => {
    const steps = str(p, "steps", "all");
    if (steps === "complex")
      return [
        { key: "substrate", at: [60, 46], side: "t", fr: "Substrat", ar: "مادة التفاعل" },
        { key: "site", at: [48, 74], side: "r", fr: "Site actif", ar: "الموقع الفعال" },
        { key: "enzyme", at: [40, 120], side: "b", fr: "Enzyme", ar: "إنزيم" },
      ];
    const list = [
      { key: "site", at: [60, 66] as Pt, side: "t" as const, fr: "Site actif", ar: "الموقع الفعال" },
      { key: "enzyme", at: [40, 120] as Pt, side: "b" as const, fr: "Enzyme", ar: "إنزيم" },
      { key: "substrate", at: [160, 62] as Pt, side: "t" as const, fr: "Substrat", ar: "مادة التفاعل" },
    ];
    if (steps === "all")
      list.push(
        { key: "complex", at: [322, 116], side: "b", fr: "Complexe enzyme–substrat", ar: "المعقد إنزيم–مادة التفاعل" },
        { key: "products", at: [412, 10], side: "t", fr: "Produits", ar: "نواتج التفاعل" },
      );
    return list;
  },
});

// ---- Activity curves: temperature, pH, substrate concentration, product over time ----
const CURVE_TEXT: Record<Lang, Record<string, [string, string]>> = {
  fr: {
    temperature: ["Température (°C)", "Vitesse initiale de la réaction"],
    ph: ["pH", "Vitesse initiale de la réaction"],
    substrate: ["Concentration du substrat", "Vitesse initiale de la réaction"],
    time: ["Temps (min)", "Quantité de produit formé"],
  },
  ar: {
    temperature: ["درجة الحرارة (°C)", "السرعة الابتدائية للتفاعل"],
    ph: ["pH", "السرعة الابتدائية للتفاعل"],
    substrate: ["تركيز مادة التفاعل", "السرعة الابتدائية للتفاعل"],
    time: ["الزمن (min)", "كمية الناتج المتشكل"],
  },
};

export const enzymeCurveFigure: FigureDef = {
  id: "sci-enzyme-curve",
  name: "Enzyme activity curve",
  params: [
    {
      key: "factor",
      label: "Factor",
      kind: "select",
      options: [
        { value: "temperature", label: "Temperature" },
        { value: "ph", label: "pH" },
        { value: "substrate", label: "Substrate concentration" },
        { value: "time", label: "Time (product formed)" },
      ],
    },
    { key: "optimum", label: "Optimum", kind: "number", min: 1, max: 80, when: (p) => p.factor === "temperature" || p.factor === "ph" },
    { key: "guides", label: "Dashed guide lines", kind: "bool" },
    { key: "empty", label: "Without the curve (the student draws it)", kind: "bool" },
  ],
  defaults: () => ({ factor: "temperature", optimum: 37, guides: true, empty: false }),
  normalize: (p, changed) => {
    if (changed !== "factor") return p;
    return { ...p, optimum: p.factor === "ph" ? 7 : 37 };
  },
  build: (p, lang) => {
    const c = ink(p);
    const factor = str(p, "factor", "temperature");
    const [xName, yName] = (CURVE_TEXT[lang] ?? CURVE_TEXT.fr)[factor] ?? CURVE_TEXT.fr.temperature;
    const x0 = 50;
    const y0 = 210;
    const W = 340;
    const Hh = 170;
    let s = axes(x0, y0, W, Hh, xName, yName, c);
    const pts: Pt[] = [];
    const guides = bool(p, "guides");
    const top = y0 - 140;
    if (factor === "temperature" || factor === "ph") {
      const ph = factor === "ph";
      const max = ph ? 14 : 80;
      const opt = Math.min(max - 1, Math.max(1, num(p, "optimum", ph ? 7 : 37)));
      const X = (v: number) => x0 + (v / max) * W;
      for (let i = 0; i <= 200; i++) {
        const v = (i / 200) * max;
        let a: number;
        if (ph) a = Math.exp(-(((v - opt) / 1.6) ** 2));
        else a = v <= opt ? Math.max(0, (v / opt) ** 2.2) : Math.max(0, 1 - ((v - opt) / Math.min(22, max - opt)) ** 1.6);
        pts.push([X(v), y0 - a * 140]);
      }
      const ticks = ph ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 10, 20, 30, 40, 50, 60, 70, 80];
      for (const t of ticks) s += xTick(X(t), y0, String(t), c);
      if (guides) s += `<path d="M${r1(X(opt))} ${y0}V${top}H${x0}" stroke-width="1" stroke-dasharray="4 3"/>` + say(X(opt), top - 8, ph ? `pH opt = ${opt}` : `T opt = ${opt} °C`, { size: 11, anchor: "middle", fill: c });
    } else if (factor === "substrate") {
      for (let i = 0; i <= 200; i++) {
        const v = i / 200;
        pts.push([x0 + v * (W - 10), y0 - 140 * (v / (v + 0.18)) * 1.18]);
      }
      if (guides) s += `<path d="M${x0} ${r1(y0 - 140 * 1.18 * (1 / 1.18))}H${x0 + W - 10}" stroke-width="1" stroke-dasharray="4 3"/>` + say(x0 + W - 10, y0 - 148, "Vmax", { size: 12, anchor: "end", fill: c });
    } else {
      for (let i = 0; i <= 200; i++) {
        const v = i / 200;
        pts.push([x0 + v * (W - 10), y0 - 140 * (1 - Math.exp(-v * 5))]);
      }
      if (guides) s += `<path d="M${x0} ${top}H${x0 + W - 10}" stroke-width="1" stroke-dasharray="4 3"/>`;
    }
    if (!bool(p, "empty")) s += polyline(pts, `stroke-width="2.4"`);
    return svg(x0 + W + 20, y0 + 40, s, c);
  },
};

export const ENZYME_FIGURES: FigureDef[] = [enzymeSubstrateFigure, enzymeCurveFigure];
