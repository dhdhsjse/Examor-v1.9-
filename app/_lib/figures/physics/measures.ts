// Measurements and uncertainties: reading a graduated cylinder, a vernier caliper, a ruler, a needle meter and a digital
// meter; a result with its uncertainty interval; the histogram of repeated measurements.
import { bool, clamp, fmt, ink, num, parseNum, r1, rad, str, svg, type Pt } from "../svg";
import type { FigureDef } from "../types";
import { LIQUID, SOLID, chem, dashed, frame, head, say, seg, tr } from "./draw";

// ---- Graduated cylinder ----
// The steps of a cylinder's scale: [smallest step, numbered every].
const CYLINDER: Record<string, [number, number]> = { "10": [0.2, 1], "25": [0.5, 5], "50": [1, 10], "100": [1, 10], "250": [2, 50] };

function eye(x: number, y: number, c: string) {
  // an eye looking right, its pupil at (x, y)
  return `<path d="M${x - 22} ${y}Q${x - 8} ${y - 12} ${x + 6} ${y}Q${x - 8} ${y + 12} ${x - 22} ${y}Z" fill="#ffffff" stroke-width="1.5"/><circle cx="${x - 4}" cy="${y}" r="4" fill="${c}" stroke="none"/>`;
}

export const cylinderFigure: FigureDef = {
  id: "pc-cylinder",
  name: "Graduated cylinder",
  params: [
    { key: "capacity", label: "Capacity (mL)", kind: "select", options: ["10", "25", "50", "100", "250"].map((v) => ({ value: v, label: v })) },
    { key: "volume", label: "Volume", kind: "number", min: 0, max: 250, step: 0.1, unit: "mL" },
    {
      key: "view",
      label: "View",
      kind: "select",
      options: [
        { value: "whole", label: "Whole cylinder" },
        { value: "close", label: "Close-up of the scale" },
      ],
    },
    {
      key: "eye",
      label: "Eye",
      kind: "select",
      options: [
        { value: "none", label: "None" },
        { value: "correct", label: "Level with the meniscus" },
        { value: "above", label: "Too high" },
        { value: "below", label: "Too low" },
      ],
    },
  ],
  defaults: () => ({ capacity: "100", volume: 64, view: "whole", eye: "none" }),
  normalize: (p, changed) => (changed === "capacity" ? { ...p, volume: Math.min(num(p, "volume", 0), Number(p.capacity)) } : p),
  build: (p) => {
    const c = ink(p);
    const cap = Number(str(p, "capacity", "100")) || 100;
    const [step, every] = CYLINDER[String(cap)] ?? [1, 10];
    const v = clamp(num(p, "volume", 64), 0, cap);
    const close = str(p, "view") === "close";
    const eyeMode = str(p, "eye", "none");
    let s = "";
    // the scale: from `lo` to `hi` (mL) on the tube from y = top to y = bottom
    const span = close ? step * 14 : cap;
    const lo = close ? clamp(Math.round((v - span / 2) / step) * step, 0, Math.max(0, cap - span)) : 0;
    const hi = lo + span;
    const x = 110;
    const tw = close ? 120 : 46;
    const top = close ? 30 : 40;
    const bottom = close ? 270 : 250;
    const Y = (ml: number) => bottom - ((ml - lo) / (hi - lo)) * (bottom - top);
    const level = Y(v);
    // liquid and meniscus (concave: its bottom is the reading)
    const dip = close ? 9 : 4;
    const liquidTop = Math.max(top - 8, level);
    s += `<path d="M${x} ${r1(liquidTop - dip)}Q${x + tw / 2} ${r1(liquidTop + dip)} ${x + tw} ${r1(liquidTop - dip)}V${close ? bottom + 20 : bottom}H${x}Z" fill="${LIQUID}" stroke="none"/>`;
    s += `<path d="M${x} ${r1(liquidTop - dip)}Q${x + tw / 2} ${r1(liquidTop + dip)} ${x + tw} ${r1(liquidTop - dip)}" stroke-width="1.4"/>`;
    // tube
    if (close) s += `<path d="M${x} ${top - 20}V${bottom + 20}M${x + tw} ${top - 20}V${bottom + 20}" stroke-width="2.2"/>`;
    else {
      s += `<path d="M${x - 4} ${top - 12}Q${x} ${top - 10} ${x} ${top - 2}V${bottom}M${x + tw} ${top - 12}V${bottom}" stroke-width="2.2"/>`;
      s += `<path d="M${x} ${bottom}H${x + tw}M${x - 22} ${bottom + 14}H${x + tw + 22}L${x + tw + 14} ${bottom}H${x - 14}Z" fill="#ffffff" stroke-width="2"/>`;
    }
    // graduations (on the left side of the tube, numbers to their left)
    const n = Math.round(span / step);
    for (let i = 0; i <= n; i++) {
      const ml = lo + i * step;
      const y = Y(ml);
      const k = Math.round(ml / step);
      const numbered = Math.abs(ml / every - Math.round(ml / every)) < 1e-6;
      const half = !numbered && Math.abs((ml * 2) / every - Math.round((ml * 2) / every)) < 1e-6;
      const len = numbered ? (close ? 46 : 18) : half ? (close ? 32 : 12) : close ? 20 : 7;
      if (!close && k % (cap === 100 || cap === 50 ? 2 : 1) && !numbered && !half) continue; // (the whole cylinder: fewer small ticks)
      s += `<path d="M${x} ${r1(y)}h${len}" stroke-width="${numbered ? 1.6 : 1}"/>`;
      if (numbered && (close || ml > 0)) s += say(x - 6, y + 4, fmt(ml), { size: close ? 14 : 10.5, anchor: "end", fill: c });
    }
    s += say(x + tw + (close ? 10 : 6), top - 4, "mL", { size: close ? 13 : 11, fill: c });
    // the eye and its line of sight
    if (eyeMode !== "none") {
      const ex = x + tw + 92;
      const ey = eyeMode === "above" ? level - 50 : eyeMode === "below" ? level + 50 : level;
      s += eye(ex, ey, c) + dashed([ex - 24, ey], [x + tw / 2, level], 1.2);
    }
    const W = x + tw + (eyeMode !== "none" ? 120 : 40);
    return svg(W, close ? bottom + 30 : bottom + 26, s, c);
  },
};

// ---- Vernier caliper ----
export const caliperFigure: FigureDef = {
  id: "pc-caliper",
  name: "Vernier caliper",
  hint: "Type the length: the vernier moves to it.",
  params: [
    { key: "value", label: "Length", kind: "number", min: 0, max: 120, step: 0.02, unit: "mm" },
    {
      key: "vernier",
      label: "Vernier (mm)",
      kind: "select",
      options: [
        { value: "10", label: "1/10" },
        { value: "20", label: "1/20" },
        { value: "50", label: "1/50" },
      ],
    },
    { key: "jaws", label: "The whole caliper (jaws)", kind: "bool" },
  ],
  defaults: () => ({ value: 23.4, vernier: "10", jaws: true }),
  build: (p) => {
    const c = ink(p);
    const N = Number(str(p, "vernier", "10")) || 10;
    const prec = 1 / N;
    const v = Math.round(clamp(num(p, "value", 23.4), 0, 120) / prec) * prec;
    const jaws = bool(p, "jaws");
    const vLen = N - 1; // the vernier: N divisions over N − 1 mm
    const from = jaws ? 0 : Math.max(0, Math.floor(v / 10) * 10 - 10);
    const to = Math.ceil((v + vLen + 8) / 10) * 10;
    const k = clamp(860 / (to - from + 6), 6, 17); // px per mm
    const L = jaws ? 70 : 30;
    const X = (mm: number) => L + (mm - from) * k;
    const beamY = jaws ? 90 : 40; // the edge between the main scale (above) and the vernier (below)
    let s = "";
    if (jaws) {
      // beam, fixed jaw (left of 0), sliding jaw (at v), the object between the jaws
      s += `<rect x="${L - 40}" y="${beamY - 40}" width="${r1(X(to) - L + 50)}" height="40" fill="#ffffff" stroke-width="2"/>`;
      s += `<path d="M${L - 40} ${beamY}V${beamY + 100}H${L}V${beamY}" fill="#ffffff" stroke-width="2"/>`;
      if (v > 0.5) s += `<rect x="${r1(X(0) + 1)}" y="${beamY + 50}" width="${r1(X(v) - X(0) - 2)}" height="44" fill="${SOLID}" stroke-width="1.4"/>`;
    }
    // the main scale (mm): numbered every 10 mm, in cm
    for (let mm = from; mm <= to; mm++) {
      const big = mm % 10 === 0;
      const mid = mm % 5 === 0;
      s += `<path d="M${r1(X(mm))} ${beamY}v${big ? -16 : mid ? -11 : -7}" stroke-width="${big ? 1.4 : 1}"/>`;
      if (big) s += say(X(mm), beamY - 21, String(mm / 10), { size: 12, anchor: "middle", fill: c });
    }
    s += say(X(to) + 8, beamY - 21, "cm", { size: 11, fill: c });
    // the slider and its vernier scale
    const sx = X(v) - (jaws ? 0 : 10);
    const vw = vLen * k + 24;
    if (jaws) s += `<path d="M${r1(X(v))} ${beamY}V${beamY + 100}H${r1(X(v) + 40)}V${beamY + 34}H${r1(sx + vw)}V${beamY}Z" fill="#ffffff" stroke-width="2"/>`;
    else s += `<rect x="${r1(sx)}" y="${beamY}" width="${r1(vw + 10)}" height="34" fill="#ffffff" stroke-width="2"/>`;
    const labelEvery = N === 10 ? 1 : N === 20 ? 2 : 5;
    for (let i = 0; i <= N; i++) {
      const x = X(v) + (i * vLen * k) / N;
      const numbered = i % labelEvery === 0;
      s += `<path d="M${r1(x)} ${beamY}v${numbered ? 14 : 8}" stroke-width="${numbered ? 1.3 : 0.9}"/>`;
      if (numbered) s += say(x, beamY + 27, String(i / labelEvery), { size: 10.5, anchor: "middle", fill: c });
    }
    const W = Math.max(X(to) + 30, sx + vw + 30);
    return svg(W, beamY + (jaws ? 112 : 44), s, c);
  },
};

// ---- Ruler ----
export const rulerFigure: FigureDef = {
  id: "pc-ruler",
  name: "Ruler and object",
  params: [
    { key: "start", label: "Start of the object", kind: "number", min: 0, max: 6, step: 0.1, unit: "cm", row: "r" },
    { key: "length", label: "Length", kind: "number", min: 0.5, max: 12, step: 0.1, unit: "cm", row: "r" },
  ],
  defaults: () => ({ start: 1, length: 7.4 }),
  build: (p) => {
    const c = ink(p);
    const a = clamp(num(p, "start", 1), 0, 6);
    const l = clamp(num(p, "length", 7.4), 0.5, 15 - a);
    const k = 36; // px per cm
    const X = (cm: number) => 20 + cm * k;
    let s = `<rect x="${X(a)}" y="20" width="${r1(l * k)}" height="26" rx="3" fill="${SOLID}" stroke-width="1.6"/>`;
    s += `<rect x="6" y="46" width="${15 * k + 28}" height="50" rx="3" fill="#ffffff" stroke-width="2"/>`;
    for (let mm = 0; mm <= 150; mm++) {
      const big = mm % 10 === 0;
      s += `<path d="M${r1(X(mm / 10))} 46v${big ? 16 : mm % 5 === 0 ? 11 : 7}" stroke-width="${big ? 1.3 : 0.8}"/>`;
      if (big) s += say(X(mm / 10), 78, String(mm / 10), { size: 11, anchor: "middle", fill: c });
    }
    s += say(X(15) + 4, 90, "cm", { size: 10, anchor: "end", fill: c });
    s += dashed([X(a), 14], [X(a), 46], 0.9) + dashed([X(a + l), 14], [X(a + l), 46], 0.9);
    return svg(15 * k + 44, 104, s, c);
  },
};

// ---- Needle meter ----
// The scales: [divisions, small step, numbered every].
const DIALS: Record<string, [number, number]> = { "10": [0.2, 1], "30": [1, 5], "100": [1, 10], "150": [2, 30] };

export const dialFigure: FigureDef = {
  id: "pc-dial",
  name: "Needle meter",
  hint: "The reading is: calibre × reading ÷ scale.",
  params: [
    { key: "scale", label: "Scale (divisions)", kind: "select", options: Object.keys(DIALS).map((v) => ({ value: v, label: v })) },
    { key: "value", label: "Needle on", kind: "number", min: 0, max: 150, step: 0.5 },
    { key: "unit", label: "Meter", kind: "select", options: [{ value: "A", label: "A" }, { value: "V", label: "V" }, { value: "mA", label: "mA" }] },
    { key: "calibre", label: "Calibre", kind: "text", placeholder: "1 A" },
    { key: "knob", label: "Calibres knob", kind: "bool" },
  ],
  defaults: () => ({ scale: "100", value: 64, unit: "A", calibre: "1 A", knob: true }),
  normalize: (p, changed) => (changed === "scale" ? { ...p, value: Math.min(num(p, "value", 0), Number(p.scale)) } : p),
  build: (p) => {
    const c = ink(p);
    const N = Number(str(p, "scale", "100")) || 100;
    const [step, every] = DIALS[String(N)] ?? [1, 10];
    const v = clamp(num(p, "value", 64), 0, N);
    const knob = bool(p, "knob");
    const C: Pt = [190, 230];
    const R = 180;
    const span = 100; // degrees
    const at = (val: number, r: number): Pt => {
      const a = rad(-90 - span / 2 + (val / N) * span);
      return [C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)];
    };
    let s = `<rect x="10" y="10" width="360" height="${knob ? 300 : 250}" rx="10" fill="#ffffff" stroke-width="2.2"/>`;
    // scale arc and ticks
    const a0 = at(0, R);
    const a1 = at(N, R);
    s += `<path d="M${r1(a0[0])} ${r1(a0[1])}A${R} ${R} 0 0 1 ${r1(a1[0])} ${r1(a1[1])}" stroke-width="1.4"/>`;
    for (let i = 0; i <= Math.round(N / step); i++) {
      const val = i * step;
      const numbered = Math.abs(val / every - Math.round(val / every)) < 1e-6;
      const half = !numbered && Math.abs((val * 2) / every - Math.round((val * 2) / every)) < 1e-6;
      const l = numbered ? 14 : half ? 10 : 6;
      s += seg(at(val, R), at(val, R + l), `stroke-width="${numbered ? 1.5 : 0.8}"`);
      if (numbered) {
        const t = at(val, R + 26);
        s += say(t[0], t[1] + 4, fmt(val), { size: 12, anchor: "middle", fill: c });
      }
    }
    // unit, needle, pivot
    s += say(C[0], C[1] - 70, str(p, "unit", "A"), { size: 26, anchor: "middle", fill: c, bold: true });
    s += seg(C, at(v, R + 10), `stroke-width="1.8"`) + `<circle cx="${C[0]}" cy="${C[1]}" r="9" fill="${c}" stroke="none"/>`;
    // the calibres knob and the terminals
    if (knob) {
      s += `<rect x="130" y="256" width="120" height="30" rx="4" fill="#ffffff" stroke-width="1.6"/>`;
      s += say(190, 277, str(p, "calibre", "1 A"), { size: 15, anchor: "middle", fill: c, bold: true });
      s += `<circle cx="60" cy="272" r="9" fill="#ffffff" stroke-width="2"/><circle cx="320" cy="272" r="9" fill="#ffffff" stroke-width="2"/>`;
      s += say(60, 300, "COM", { size: 10, anchor: "middle", fill: c }) + say(320, 300, "+", { size: 13, anchor: "middle", fill: c, bold: true });
    }
    return svg(380, knob ? 320 : 270, s, c);
  },
};

// ---- Digital multimeter ----
export const multimeterFigure: FigureDef = {
  id: "pc-multimeter",
  name: "Digital multimeter",
  params: [
    { key: "value", label: "Display", kind: "text", placeholder: "12.45", row: "d" },
    { key: "unit", label: "Unit", kind: "text", placeholder: "V", row: "d" },
    {
      key: "mode",
      label: "Knob on",
      kind: "select",
      options: [
        { value: "V", label: "V (DC)" },
        { value: "A", label: "A (DC)" },
        { value: "ohm", label: "Ω" },
      ],
    },
  ],
  defaults: () => ({ value: "12.45", unit: "V", mode: "V" }),
  build: (p) => {
    const c = ink(p);
    const mode = str(p, "mode", "V");
    let s = `<rect x="10" y="10" width="200" height="300" rx="16" fill="#ffffff" stroke-width="2.2"/>`;
    s += `<rect x="28" y="28" width="164" height="70" rx="5" fill="#ffffff" stroke-width="1.8"/>`;
    s += `<text x="150" y="78" fill="${c}" stroke="none" font-size="36" font-family="'Courier New', monospace" font-weight="bold" text-anchor="end">${str(p, "value", "12.45").replace(/[<>&"]/g, "")}</text>`;
    s += say(184, 78, str(p, "unit", "V"), { size: 18, anchor: "end", fill: c, bold: true });
    // the knob and its positions
    const K: Pt = [110, 170];
    s += `<circle cx="${K[0]}" cy="${K[1]}" r="38" fill="#ffffff" stroke-width="2"/><circle cx="${K[0]}" cy="${K[1]}" r="24" stroke-width="1.4"/>`;
    const pos: Record<string, number> = { V: -50, A: 50, ohm: 180 };
    for (const [m, deg] of Object.entries(pos)) {
      const a = rad(deg - 90);
      s += say(K[0] + Math.cos(a) * 54, K[1] + Math.sin(a) * 54 + 5, m === "ohm" ? "Ω" : m === "V" ? "V⎓" : "A⎓", { size: 13, anchor: "middle", fill: c, bold: true });
    }
    const a = rad((pos[mode] ?? -50) - 90);
    s += seg(K, [K[0] + Math.cos(a) * 30, K[1] + Math.sin(a) * 30], `stroke-width="5"`);
    // terminals
    for (const [x, t] of [
      [50, "A"],
      [110, "COM"],
      [170, "VΩ"],
    ] as const) {
      s += `<circle cx="${x}" cy="268" r="11" fill="#ffffff" stroke-width="2"/><circle cx="${x}" cy="268" r="4" fill="${c}" stroke="none"/>`;
      s += say(x, 298, t, { size: 11, anchor: "middle", fill: c, bold: true });
    }
    return svg(220, 320, s, c);
  },
};

// ---- Result and uncertainty ----
export const uncertaintyFigure: FigureDef = {
  id: "pc-uncertainty",
  name: "Result and uncertainty interval",
  params: [
    { key: "name", label: "Quantity", kind: "text", placeholder: "m", row: "a" },
    { key: "unit", label: "Unit", kind: "text", placeholder: "g", row: "a" },
    { key: "value", label: "Value", kind: "number", min: -1000, max: 1000, step: 0.01, row: "v" },
    { key: "u", label: "Uncertainty", kind: "number", min: 0, max: 100, step: 0.01, row: "v" },
    { key: "numbers", label: "Write the values", kind: "bool" },
    { key: "second", label: "A second result (to compare)", kind: "bool" },
    { key: "value2", label: "Value 2", kind: "number", min: -1000, max: 1000, step: 0.01, row: "v2", when: (p) => p.second === true },
    { key: "u2", label: "Uncertainty 2", kind: "number", min: 0, max: 100, step: 0.01, row: "v2", when: (p) => p.second === true },
  ],
  defaults: () => ({ name: "m", unit: "g", value: 12.5, u: 0.3, numbers: true, second: false, value2: 13.1, u2: 0.4 }),
  build: (p) => {
    const c = ink(p);
    const name = str(p, "name", "m");
    const unit = str(p, "unit");
    const m = num(p, "value", 12.5);
    const u = Math.abs(num(p, "u", 0.3));
    const two = bool(p, "second");
    const m2 = num(p, "value2", 13.1);
    const u2 = Math.abs(num(p, "u2", 0.4));
    const lo = Math.min(m - u, two ? m2 - u2 : Infinity);
    const hi = Math.max(m + u, two ? m2 + u2 : -Infinity);
    const pad = (hi - lo || 1) * 0.35;
    const a = lo - pad;
    const b = hi + pad;
    const X = (v: number) => 30 + ((v - a) / (b - a)) * 440;
    const y = two ? 120 : 70;
    let s = `<path d="M20 ${y}H${490}" stroke-width="1.6"/>` + head([496, y], 0, c);
    s += chem(492, y + 26, unit ? `${name} (${unit})` : name, { size: 13, anchor: "end", fill: c });
    const interval = (mv: number, uv: number, yy: number, sub: string, up: boolean) => {
      let t = `<path d="M${r1(X(mv - uv))} ${yy}H${r1(X(mv + uv))}" stroke-width="5"/>`;
      t += `<path d="M${r1(X(mv - uv) + 6)} ${yy - 10}H${r1(X(mv - uv))}V${yy + 10}H${r1(X(mv - uv) + 6)}M${r1(X(mv + uv) - 6)} ${yy - 10}H${r1(X(mv + uv))}V${yy + 10}H${r1(X(mv + uv) - 6)}" stroke-width="1.8"/>`;
      t += `<circle cx="${r1(X(mv))}" cy="${yy}" r="4.5" fill="#ffffff" stroke-width="2"/>`;
      const ty = up ? yy - 18 : yy + 28;
      const n = name + sub;
      const words = bool(p, "numbers") ? [fmt(mv - uv), fmt(mv), fmt(mv + uv)] : [`${n} − U${sub}`, n, `${n} + U${sub}`];
      t += chem(X(mv - uv), ty, words[0], { size: 12, anchor: "middle", fill: c }) + chem(X(mv), ty, words[1], { size: 12, anchor: "middle", fill: c, bold: true }) + chem(X(mv + uv), ty, words[2], { size: 12, anchor: "middle", fill: c });
      return t;
    };
    s += interval(m, u, y, two ? "1" : "", true);
    if (two) s += dashed([X(m2), y], [X(m2), y + 40], 0.8) + interval(m2, u2, y + 40, "2", false);
    return svg(510, two ? 200 : 110, s, c);
  },
};

// ---- Histogram of repeated measurements ----
const parseList = (s: string) =>
  s
    .split(/[\s;]+/)
    .map(parseNum)
    .filter((v) => Number.isFinite(v));

export const histogramFigure: FigureDef = {
  id: "pc-histogram",
  name: "Repeated measurements (histogram)",
  hint: "Type the measured values, separated by spaces.",
  params: [
    { key: "values", label: "Measured values", kind: "text", placeholder: "2,01 1,99 2,00 …" },
    { key: "bin", label: "Class width", kind: "number", min: 0.001, max: 100, step: 0.001, row: "a" },
    { key: "name", label: "Quantity", kind: "text", placeholder: "T (s)", row: "a" },
    { key: "mean", label: "Mean value", kind: "bool" },
  ],
  defaults: () => ({
    values: "1,98 2,01 2,00 1,99 2,02 2,00 2,01 1,97 2,00 2,03 1,99 2,00 2,01 1,98 2,00 2,02 1,99 2,00 2,01 2,00",
    bin: 0.01,
    name: "T (s)",
    mean: true,
  }),
  build: (p, lang) => {
    const c = ink(p);
    const vals = parseList(str(p, "values"));
    const list = vals.length ? vals : [0];
    const bin = Math.max(1e-6, num(p, "bin", 0.01));
    const k0 = Math.floor(Math.min(...list) / bin + 0.5);
    const k1 = Math.floor(Math.max(...list) / bin + 0.5);
    const bins = Math.min(40, k1 - k0 + 1);
    const counts = Array.from({ length: bins }, () => 0);
    for (const v of list) {
      const i = Math.floor(v / bin + 0.5) - k0;
      if (i >= 0 && i < bins) counts[i]++;
    }
    const top = Math.max(1, ...counts);
    const yStep = top > 12 ? 5 : top > 6 ? 2 : 1;
    const f = frame({ x0: 50, y0: 220, w: 380, h: 180, xMax: bins + 1, yMax: Math.ceil(top / yStep) * yStep, xName: str(p, "name", "T (s)"), yName: tr(lang, { fr: "Effectif", ar: "الحصيص" }), c, yStep, ticks: true });
    let s = f.s.replace(/<text[^>]*>O<\/text>/, "");
    const bw = f.X(1) - f.X(0);
    counts.forEach((n, i) => {
      const x = f.X(i + 0.5);
      if (n) s += `<rect x="${r1(x)}" y="${r1(f.Y(n))}" width="${r1(bw)}" height="${r1(f.y0 - f.Y(n))}" fill="${LIQUID}" stroke-width="1.4"/>`;
      const v = (k0 + i) * bin;
      if (bins <= 14 || i % 2 === 0) s += say(x + bw / 2, f.y0 + 17, fmt(Math.round(v / bin) * bin), { size: 10, anchor: "middle", fill: c });
    });
    if (bool(p, "mean") && vals.length) {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const x = f.X(0.5 + (mean / bin - k0) + 0.5);
      s += `<path d="M${r1(x)} ${f.y0}V${r1(f.Y(top) - 18)}" stroke-width="1.3" stroke-dasharray="5 3"/>`;
      s += chem(x, f.Y(top) - 24, `${tr(lang, { fr: "moyenne", ar: "المتوسط" })} = ${fmt(Math.round(mean * 1e4) / 1e4)}`, { size: 11.5, anchor: "middle", fill: c });
    }
    return svg(470, 262, s, c);
  },
};

export const MEASURE_FIGURES: FigureDef[] = [cylinderFigure, caliperFigure, rulerFigure, dialFigure, multimeterFigure, uncertaintyFigure, histogramFigure];
