// Electric circuits: series, parallel and mixed circuits (short-circuit, meters, currents), the symbols, the node law, the
// conventions for a dipole, characteristics; RC, RL and RLC circuits, their time responses, the oscilloscope screen.
import { bool, clamp, cornerNames, ink, num, r1, str, svg, type Pt } from "../svg";
import type { FigureDef } from "../types";
import { LABEL_MODES } from "../sciences/labeled";
import { GRID, chem, current, curve, frame, guide, node, path, place, say, seg, textWidth, tr, voltage, type Component } from "./draw";

const wire = (pts: Pt[]) => `<path d="${path(pts)}" stroke-width="2"/>`;
const name = (at: Pt, t: string, c: string) => chem(at[0], at[1], t, { size: 13, anchor: "middle", fill: c, bold: true });

// ---- Series, parallel and mixed circuits ----
export const circuitFigure: FigureDef = {
  id: "pc-circuit",
  name: "Circuit (series, parallel)",
  params: [
    {
      key: "layout",
      label: "Circuit",
      kind: "select",
      options: [
        { value: "series", label: "Series" },
        { value: "parallel", label: "Parallel" },
        { value: "mixed", label: "Mixed (1 + 2 in parallel)" },
      ],
    },
    {
      key: "dipole",
      label: "Dipoles",
      kind: "select",
      options: [
        { value: "lamp", label: "Lamps" },
        { value: "resistor", label: "Resistors" },
      ],
    },
    { key: "count", label: "How many", kind: "number", min: 2, max: 3, when: (p) => p.layout !== "mixed" },
    { key: "switch", label: "Switch", kind: "select", options: [{ value: "none", label: "None" }, { value: "open", label: "Open" }, { value: "closed", label: "Closed" }] },
    { key: "ammeter", label: "Ammeter", kind: "bool", row: "m" },
    { key: "voltmeter", label: "Voltmeter (on the first)", kind: "bool", row: "m" },
    { key: "short", label: "Short-circuit (on the second)", kind: "bool", row: "s" },
    { key: "currents", label: "Currents", kind: "bool", row: "s" },
    { key: "names", label: "Names (G, K, L1…)", kind: "bool" },
  ],
  defaults: () => ({ layout: "series", dipole: "lamp", count: 2, switch: "closed", ammeter: false, voltmeter: false, short: false, currents: false, names: true }),
  build: (p) => {
    const c = ink(p);
    const layout = str(p, "layout", "series");
    const dip: Component = str(p, "dipole") === "resistor" ? "resistor" : "lamp";
    const letter = dip === "lamp" ? "L" : "R";
    const n = layout === "mixed" ? 3 : Math.round(clamp(num(p, "count", 2), 2, 3));
    const sw = str(p, "switch", "closed");
    const names = bool(p, "names");
    const T = 60;
    const B = 250;
    const L = 60;
    let s = "";
    // the main branch, on the top wire: switch, ammeter, and the series dipoles
    const top: { type: Component; label: string; dipole?: number }[] = [];
    if (sw !== "none") top.push({ type: sw === "open" ? "switch-open" : "switch-closed", label: "K" });
    if (bool(p, "ammeter")) top.push({ type: "ammeter", label: "" });
    const inSeries = layout === "series" ? n : layout === "mixed" ? 1 : 0;
    for (let i = 0; i < inSeries; i++) top.push({ type: dip, label: `${letter}${i + 1}`, dipole: i });
    const slot = 92;
    let x = L + 40;
    let prev: Pt = [L, T];
    const spans: Record<number, [Pt, Pt]> = {};
    for (const part of top) {
      const a: Pt = [x, T];
      const b: Pt = [x + slot - 30, T];
      s += wire([prev, a]) + place(part.type, a, b, c);
      if (names && part.label) s += name([(a[0] + b[0]) / 2, T - 24], part.label, c);
      if (part.dipole !== undefined) spans[part.dipole] = [a, b];
      prev = b;
      x += slot;
    }
    const branches = n - inSeries;
    const gap = 120;
    const firstBranch = x + 20;
    const R = branches ? firstBranch + (branches - 1) * gap : Math.max(x, L + 200);
    // (with branches, the last one is the right side of the circuit: its wires are drawn with it)
    s += wire([prev, [R, T]]) + wire([[R, branches ? 185 : T], [R, B], [L, B], [L, 180]]) + wire([[L, 120], [L, T]]);
    // the generator, + at the top
    s += place("battery", [L, 120], [L, 180], c);
    if (names) s += name([L - 30, 155], "G", c);
    for (let j = 0; j < branches; j++) {
      const bx = firstBranch + j * gap;
      const i = inSeries + j;
      const a: Pt = [bx, 125];
      const b: Pt = [bx, 185];
      if (j < branches - 1) s += wire([[bx, T], a]) + wire([b, [bx, B]]) + node([bx, T], c) + node([bx, B], c);
      s += place(dip, a, b, c);
      if (names) s += name([bx + 30, 160], `${letter}${i + 1}`, c);
      spans[i] = [a, b];
    }
    // last branch: its wires are the corner of the circuit
    if (branches) s += wire([[R, T], [R, 125]]);
    const across = (k: number, side: number, el: (a: Pt, b: Pt) => string) => {
      const [a, b] = spans[k] ?? [];
      if (!a) return "";
      const vertical = a[0] === b[0];
      const off = 52 * side;
      const ea: Pt = vertical ? [a[0], a[1] - 18] : [a[0] - 10, a[1]];
      const eb: Pt = vertical ? [b[0], b[1] + 18] : [b[0] + 10, b[1]];
      const ma: Pt = vertical ? [ea[0] + off, ea[1]] : [ea[0], ea[1] + off];
      const mb: Pt = vertical ? [eb[0] + off, eb[1]] : [eb[0], eb[1] + off];
      return wire([ea, ma]) + el(ma, mb) + wire([mb, eb]) + node(ea, c) + node(eb, c);
    };
    if (bool(p, "voltmeter")) s += across(0, 1, (a, b) => place("voltmeter", a, b, c));
    if (bool(p, "short") && n > 1) s += across(1, -1, (a, b) => wire([a, b]));
    if (bool(p, "currents")) {
      s += current([L + 20, T], 0, "I", c);
      for (let j = 0; j < branches; j++) s += current([firstBranch + j * gap, 222], 90, `I${j + 1}`, c);
    }
    const W = Math.max(R + (branches ? 70 : 40), L + 260);
    return svg(W, B + 30, s, c);
  },
};

// ---- The symbols ----
const SYMBOLS: { type: Component; fr: string; ar: string }[] = [
  { type: "battery", fr: "Pile", ar: "عمود" },
  { type: "generator", fr: "Générateur", ar: "مولد" },
  { type: "lowfreq", fr: "GBF", ar: "مولد التردد المنخفض" },
  { type: "lamp", fr: "Lampe", ar: "مصباح" },
  { type: "resistor", fr: "Conducteur ohmique", ar: "موصل أومي" },
  { type: "rheostat", fr: "Rhéostat", ar: "مقاومة متغيرة" },
  { type: "switch-open", fr: "Interrupteur ouvert", ar: "قاطع التيار مفتوح" },
  { type: "switch-closed", fr: "Interrupteur fermé", ar: "قاطع التيار مغلق" },
  { type: "motor", fr: "Moteur", ar: "محرك" },
  { type: "diode", fr: "Diode", ar: "صمام ثنائي" },
  { type: "led", fr: "DEL", ar: "صمام ثنائي باعث للضوء" },
  { type: "zener", fr: "Diode Zener", ar: "صمام زينر" },
  { type: "ammeter", fr: "Ampèremètre", ar: "أمبيرمتر" },
  { type: "voltmeter", fr: "Voltmètre", ar: "فولطمتر" },
  { type: "capacitor", fr: "Condensateur", ar: "مكثف" },
  { type: "coil", fr: "Bobine", ar: "وشيعة" },
];

export const symbolsFigure: FigureDef = {
  id: "pc-symbols",
  name: "Electrical symbols",
  params: [
    { key: "labels", label: "Labels", kind: "select", options: LABEL_MODES },
    { key: "own", label: "Own names (in the order of the numbers)", kind: "text", placeholder: "…, …, …", when: (p) => p.labels === "names" },
    { key: "columns", label: "Columns", kind: "number", min: 2, max: 6 },
  ],
  defaults: () => ({ labels: "names", own: "", columns: 4 }),
  build: (p, lang) => {
    const c = ink(p);
    const mode = str(p, "labels", "names");
    const cols = Math.round(clamp(num(p, "columns", 4), 2, 6));
    const own = str(p, "own").trim() ? cornerNames(str(p, "own").replace(/\n/g, ","), SYMBOLS.length) : [];
    const cw = 150;
    const ch = mode === "none" ? 70 : 96;
    let s = "";
    SYMBOLS.forEach((sym, i) => {
      const x = (i % cols) * cw + 15;
      const y = Math.floor(i / cols) * ch + 10;
      s += place(sym.type, [x + 25, y + 34], [x + cw - 25, y + 34], c);
      const word = mode === "names" ? own[i]?.trim() || tr(lang, sym) : mode === "numbers" ? String(i + 1) : mode === "lines" ? "………………" : "";
      if (word) s += say(x + cw / 2, y + 78, word, { size: mode === "numbers" ? 14 : textWidth(word, 12) > cw - 8 ? 10.5 : 12, anchor: "middle", fill: c, bold: mode === "numbers" });
    });
    const rows = Math.ceil(SYMBOLS.length / cols);
    return svg(cols * cw + 30, rows * ch + 16, s, c);
  },
};

// ---- Node law ----
export const nodeFigure: FigureDef = {
  id: "pc-node",
  name: "Node law (currents at a node)",
  hint: "Write one current per branch, separated by “;”: the first ones go in, the others come out.",
  params: [
    { key: "ins", label: "Currents in", kind: "number", min: 1, max: 3, row: "n" },
    { key: "outs", label: "Currents out", kind: "number", min: 1, max: 3, row: "n" },
    { key: "values", label: "Currents", kind: "text", placeholder: "I1 = 2 A; I2 = 0,5 A; I3 = ?" },
  ],
  defaults: () => ({ ins: 1, outs: 2, values: "I1 = 2 A; I2 = 0,5 A; I3 = ?" }),
  build: (p) => {
    const c = ink(p);
    const ins = Math.round(clamp(num(p, "ins", 1), 1, 3));
    const outs = Math.round(clamp(num(p, "outs", 2), 1, 3));
    const texts = str(p, "values").split(";").map((t) => t.trim());
    const N: Pt = [230, 130];
    let s = node(N, c).replace('r="3"', 'r="5"') + say(N[0], N[1] - 14, "N", { size: 14, anchor: "middle", fill: c, bold: true });
    const spread = (k: number, i: number, center: number) => center + (k === 1 ? 0 : (i - (k - 1) / 2) * (k === 2 ? 60 : 45));
    let k = 0;
    for (let i = 0; i < ins; i++, k++) {
      const deg = spread(ins, i, 180);
      const end: Pt = [N[0] + 150 * Math.cos((deg * Math.PI) / 180), N[1] + 150 * Math.sin((deg * Math.PI) / 180)];
      s += seg(end, N, `stroke-width="2"`) + current([(end[0] + N[0]) / 2, (end[1] + N[1]) / 2], deg + 180, "", c);
      s += chem(end[0] - 4, end[1] + (end[1] >= N[1] ? 20 : -8), texts[k] ?? `I${k + 1}`, { size: 13, anchor: "start", fill: c });
    }
    for (let i = 0; i < outs; i++, k++) {
      const deg = spread(outs, i, 0);
      const end: Pt = [N[0] + 150 * Math.cos((deg * Math.PI) / 180), N[1] + 150 * Math.sin((deg * Math.PI) / 180)];
      s += seg(N, end, `stroke-width="2"`) + current([(end[0] + N[0]) / 2, (end[1] + N[1]) / 2], deg, "", c);
      s += chem(end[0] + 4, end[1] + (end[1] >= N[1] ? 20 : -8), texts[k] ?? `I${k + 1}`, { size: 13, anchor: "end", fill: c });
    }
    return svg(460, 260, s, c);
  },
};

// ---- A dipole and its conventions ----
const DIPOLES: Component[] = ["resistor", "lamp", "capacitor", "coil", "generator", "battery", "motor", "diode"];
export const dipoleFigure: FigureDef = {
  id: "pc-dipole",
  name: "Dipole: voltage and current",
  params: [
    { key: "dipole", label: "Dipole", kind: "select", options: DIPOLES.map((d) => ({ value: d, label: d[0].toUpperCase() + d.slice(1) })) },
    {
      key: "convention",
      label: "Convention",
      kind: "select",
      options: [
        { value: "receiver", label: "Receiver (arrows opposite)" },
        { value: "generator", label: "Generator (arrows the same way)" },
      ],
    },
    { key: "value", label: "Name beside it", kind: "text", placeholder: "R" },
    { key: "charges", label: "Charges q and −q", kind: "bool", when: (p) => p.dipole === "capacitor" },
  ],
  defaults: () => ({ dipole: "resistor", convention: "receiver", value: "R", charges: false }),
  normalize: (p, changed) => {
    if (changed !== "dipole") return p;
    const d = String(p.dipole);
    const value: Record<string, string> = { resistor: "R", capacitor: "C", coil: "(L, r)", generator: "E", battery: "E", lamp: "", motor: "", diode: "" };
    return { ...p, value: value[d] ?? "", convention: d === "generator" || d === "battery" ? "generator" : "receiver" };
  },
  build: (p) => {
    const c = ink(p);
    const d = (DIPOLES as string[]).includes(str(p, "dipole")) ? (str(p, "dipole") as Component) : "resistor";
    const gen = str(p, "convention") === "generator";
    const A: Pt = [60, 110];
    const B: Pt = [340, 110];
    const a: Pt = [150, 110];
    const b: Pt = [250, 110];
    const [na, nb] = gen ? ["N", "P"] : ["A", "B"];
    let s = wire([A, a]) + wire([b, B]) + place(d, gen ? b : a, gen ? a : b, c);
    s += node(A, c) + node(B, c) + say(A[0], A[1] + 24, na, { size: 14, anchor: "middle", fill: c, bold: true }) + say(B[0], B[1] + 24, nb, { size: 14, anchor: "middle", fill: c, bold: true });
    const v = str(p, "value");
    if (v) s += chem(200, 150, v, { size: 14, anchor: "middle", fill: c, bold: true });
    // the current goes A → B; the voltage arrow points to the first letter of its name
    if (gen) s += current([300, 110], 0, "I", c) + voltage(B, A, `U_${nb}${na}`, c, -40);
    else s += current([100, 110], 0, "I", c) + voltage(A, B, `U_${na}${nb}`, c, 40);
    if (d === "capacitor" && bool(p, "charges")) s += say(184, 90, "q", { size: 14, anchor: "middle", fill: c, italic: true }) + say(218, 90, "−q", { size: 14, anchor: "middle", fill: c, italic: true });
    return svg(400, 170, s, c);
  },
};

// ---- Characteristics ----
export const characteristicFigure: FigureDef = {
  id: "pc-characteristic",
  name: "Characteristic of a dipole",
  params: [
    {
      key: "dipole",
      label: "Dipole",
      kind: "select",
      options: [
        { value: "resistor", label: "Resistor (U = R·I)" },
        { value: "generator", label: "Generator (U = E − r·I)" },
        { value: "receiver", label: "Active receiver (U = E′ + r′·I)" },
        { value: "diode", label: "Diode" },
        { value: "lamp", label: "Lamp" },
      ],
    },
    { key: "e", label: "E, E′ or R", kind: "number", min: 0.1, max: 1000, step: 0.1, row: "v", when: (p) => p.dipole !== "diode" && p.dipole !== "lamp" },
    { key: "r", label: "r or r′ (Ω)", kind: "number", min: 0, max: 1000, step: 0.1, row: "v", when: (p) => p.dipole === "generator" || p.dipole === "receiver" },
    { key: "iMax", label: "I max", kind: "number", min: 0.01, max: 100, step: 0.01, unit: "A", when: (p) => p.dipole !== "diode" && p.dipole !== "lamp" },
    { key: "grid", label: "Grid", kind: "bool", row: "o" },
    { key: "guides", label: "Remarkable points", kind: "bool", row: "o" },
  ],
  defaults: () => ({ dipole: "generator", e: 6, r: 2, iMax: 3, grid: true, guides: true }),
  normalize: (p, changed) => (changed === "dipole" ? { ...p, ...(p.dipole === "resistor" ? { e: 10, iMax: 0.5 } : p.dipole === "receiver" ? { e: 3, r: 4, iMax: 1 } : { e: 6, r: 2, iMax: 3 }) } : p),
  build: (p) => {
    const c = ink(p);
    const d = str(p, "dipole", "generator");
    const grid = bool(p, "grid");
    if (d === "diode" || d === "lamp") {
      const diode = d === "diode";
      const f = frame({ x0: 60, y0: 250, w: 360, h: 200, xMax: diode ? 1 : 6, yMax: diode ? 50 : 0.5, xName: "U (V)", yName: diode ? "I (mA)" : "I (A)", c, xStep: diode ? 0.2 : 1, yStep: diode ? 10 : 0.1, grid });
      const fn = diode ? (u: number) => (u < 0.6 ? 0 : Math.min(55, (u - 0.6) * 150)) : (u: number) => 0.5 * Math.sqrt(u / 6) * (0.6 + 0.4 * (u / 6));
      let s = f.s + `<path d="${path(curve(f, fn, 0, diode ? 0.93 : 6, 200))}" stroke-width="2.2"/>`;
      if (diode && bool(p, "guides")) s += say(f.X(0.6), f.y0 + 34, "Us", { size: 12, anchor: "middle", fill: c, bold: true }) + `<path d="M${r1(f.X(0.6))} ${f.y0}v-10" stroke-width="1.6"/>`;
      return svg(460, 290, s, c);
    }
    const E = Math.max(0.1, num(p, "e", 6));
    const r = Math.max(0, num(p, "r", 2));
    const iMax = Math.max(0.01, num(p, "iMax", 3));
    const fn = d === "resistor" ? (i: number) => E * i : d === "generator" ? (i: number) => E - r * i : (i: number) => E + r * i;
    const uMax = Math.max(fn(0), fn(iMax));
    const niceStep = (v: number) => {
      const raw = v / 6;
      const pow = 10 ** Math.floor(Math.log10(raw));
      return [1, 2, 5, 10].map((k) => k * pow).find((k) => k >= raw) ?? raw;
    };
    const yStep = niceStep(uMax);
    const xStep = niceStep(iMax);
    const f = frame({ x0: 60, y0: 250, w: 360, h: 200, xMax: Math.ceil(iMax / xStep) * xStep, yMax: Math.ceil((uMax * 1.1) / yStep) * yStep, xName: "I (A)", yName: "U (V)", c, xStep, yStep, grid });
    const end = d === "generator" && r > 0 ? Math.min(iMax, E / r) : iMax;
    let s = f.s + `<path d="${path(curve(f, fn, 0, end, 2))}" stroke-width="2.2"/>`;
    if (bool(p, "guides")) {
      if (d === "generator") s += chem(f.x0 + 10, f.Y(E) - 8, "E", { size: 13, fill: c, bold: true }) + (r > 0 && E / r <= iMax ? chem(f.X(E / r) + 6, f.y0 - 8, "Icc", { size: 12, fill: c, bold: true }) : "");
      if (d === "receiver") s += chem(f.x0 + 10, f.Y(E) + 18, "E′", { size: 13, fill: c, bold: true });
    }
    return svg(460, 290, s, c);
  },
};

// ---- RC, RL and RLC circuits ----
export const rcrlFigure: FigureDef = {
  id: "pc-rcrl",
  name: "RC, RL or RLC circuit",
  params: [
    {
      key: "kind",
      label: "Circuit",
      kind: "select",
      options: [
        { value: "RC", label: "RC" },
        { value: "RL", label: "RL" },
        { value: "RLC", label: "RLC" },
      ],
    },
    {
      key: "switch",
      label: "Switch",
      kind: "select",
      options: [
        { value: "simple", label: "Simple" },
        { value: "two", label: "Two positions (1 and 2)" },
      ],
    },
    { key: "arrows", label: "Voltages and current", kind: "bool", row: "o" },
    { key: "scope", label: "Oscilloscope inputs", kind: "bool", row: "o" },
  ],
  defaults: () => ({ kind: "RC", switch: "two", arrows: true, scope: false }),
  build: (p) => {
    const c = ink(p);
    const kind = str(p, "kind", "RC");
    const two = str(p, "switch", "two") === "two";
    const arrows = bool(p, "arrows");
    const T = 60;
    const B = 260;
    const L = 50;
    const R = 400;
    let s = "";
    // generator on the left, + at the top
    s += place("battery", [L, 130], [L, 190], c) + wire([[L, 130], [L, T]]) + wire([[L, 190], [L, B]]) + name([L - 30, 165], "E", c);
    if (two) {
      // K: its blade turns about P; 1 joins the generator (charge), 2 the bottom wire (discharge)
      const P: Pt = [200, T];
      const k1: Pt = [150, T];
      const k2: Pt = [176, T + 50];
      s += wire([[L, T], k1]) + wire([k2, [176, B]]) + node([176, B], c);
      s += `<circle cx="${k1[0]}" cy="${k1[1]}" r="3" fill="#ffffff" stroke-width="1.6"/><circle cx="${k2[0]}" cy="${k2[1]}" r="3" fill="#ffffff" stroke-width="1.6"/>` + node(P, c);
      s += seg(P, [k1[0] + 4, T - 6], `stroke-width="2"`) + say(k1[0], T - 12, "1", { size: 12, anchor: "middle", fill: c, bold: true }) + say(k2[0] - 12, k2[1] + 4, "2", { size: 12, anchor: "middle", fill: c, bold: true }) + name([P[0] - 20, T - 16], "K", c);
      s += wire([P, [230, T]]);
    } else s += wire([[L, T], [110, T]]) + place("switch-closed", [110, T], [170, T], c) + name([140, T - 24], "K", c) + wire([[170, T], [230, T]]);
    // R on the top wire
    s += place("resistor", [230, T], [310, T], c) + name([270, arrows ? T + 30 : T - 22], "R", c) + wire([[310, T], [R, T], [R, 120]]);
    // C, or the coil, on the right; RLC: the coil on the right, C on the bottom wire
    const right: Component = kind === "RC" ? "capacitor" : "coil";
    s += place(right, [R, 120], [R, 200], c) + name([R + 34, 166], kind === "RC" ? "C" : "(L, r)", c) + wire([[R, 200], [R, B]]);
    if (kind === "RLC") s += wire([[R, B], [320, B]]) + place("capacitor", [320, B], [250, B], c) + name([285, B + 30], "C", c) + wire([[250, B], [L, B]]);
    else s += wire([[R, B], [L, B]]);
    if (arrows) {
      s += current([340, T], 0, "i", c);
      s += voltage([230, T], [310, T], "u_R", c, 26);
      s += voltage([R, 120], [R, 200], kind === "RC" ? "u_C" : "u_L", c, -30);
      if (kind === "RLC") s += voltage([320, B], [250, B], "u_C", c, -26);
    }
    if (bool(p, "scope")) {
      const probe = (at: Pt, t: string) => node(at, c) + seg(at, [at[0], at[1] - 24], `stroke-width="1.4"`) + `<circle cx="${at[0]}" cy="${at[1] - 28}" r="4" fill="#ffffff" stroke-width="1.4"/>` + chem(at[0] + 8, at[1] - 30, t, { size: 13, fill: c, bold: true });
      s += probe([215, T], "Y1") + probe([R, T], "Y2");
      s += node([R - 60, B], c) + seg([R - 60, B], [R - 60, B + 14], `stroke-width="2"`) + `<path d="M${R - 72} ${B + 14}H${R - 48}M${R - 67} ${B + 19}H${R - 53}M${R - 63} ${B + 24}H${R - 57}" stroke-width="2"/>`;
    }
    return svg(R + 70, B + 44, s, c);
  },
};

// ---- Time responses ----
const RESPONSES: Record<string, { y: string; fn: (t: number, tau: number) => number; label: string }> = {
  "uc-charge": { y: "uC (V)", fn: (t, tau) => 1 - Math.exp(-t / tau), label: "uC charge" },
  "uc-discharge": { y: "uC (V)", fn: (t, tau) => Math.exp(-t / tau), label: "uC discharge" },
  "i-rc": { y: "i (mA)", fn: (t, tau) => Math.exp(-t / tau), label: "i (RC)" },
  "i-rl-rise": { y: "i (mA)", fn: (t, tau) => 1 - Math.exp(-t / tau), label: "i (RL) rise" },
  "i-rl-decay": { y: "i (mA)", fn: (t, tau) => Math.exp(-t / tau), label: "i (RL) decay" },
};

export const responseFigure: FigureDef = {
  id: "pc-response",
  name: "Time response curve",
  params: [
    {
      key: "kind",
      label: "Curve",
      kind: "select",
      options: [
        { value: "uc-charge", label: "uC(t): charging" },
        { value: "uc-discharge", label: "uC(t): discharging" },
        { value: "i-rc", label: "i(t) in an RC circuit" },
        { value: "i-rl-rise", label: "i(t) in an RL circuit: rising" },
        { value: "i-rl-decay", label: "i(t) in an RL circuit: falling" },
        { value: "rlc", label: "uC(t): damped oscillations (RLC)" },
      ],
    },
    { key: "max", label: "Top value (E or I0)", kind: "number", min: 0.1, max: 1000, step: 0.1, row: "v" },
    { key: "tau", label: "τ (or T)", kind: "number", min: 0.1, max: 1000, step: 0.1, unit: "ms", row: "v" },
    { key: "tangent", label: "Tangent at t = 0", kind: "bool", row: "a", when: (p) => p.kind !== "rlc" },
    { key: "mark", label: "τ at 63 % (37 %)", kind: "bool", row: "a", when: (p) => p.kind !== "rlc" },
    { key: "grid", label: "Grid", kind: "bool", row: "b" },
    { key: "empty", label: "Without the curve (the student draws it)", kind: "bool", row: "b" },
  ],
  defaults: () => ({ kind: "uc-charge", max: 6, tau: 1, tangent: true, mark: false, grid: true, empty: false }),
  build: (p) => {
    const c = ink(p);
    const kind = str(p, "kind", "uc-charge");
    const E = Math.max(0.1, num(p, "max", 6));
    const tau = Math.max(0.1, num(p, "tau", 1));
    const rlc = kind === "rlc";
    const resp = RESPONSES[kind] ?? RESPONSES["uc-charge"];
    const tMax = rlc ? tau * 4 : tau * 5;
    const step = (v: number) => {
      const raw = v / 8;
      const pow = 10 ** Math.floor(Math.log10(raw));
      return [1, 2, 2.5, 5, 10].map((k) => k * pow).find((k) => k >= raw) ?? raw;
    };
    const yStep = step(E);
    const yMax = Math.ceil((E * 1.1) / yStep) * yStep;
    const f = frame({ x0: 60, y0: rlc ? 160 : 250, w: 380, h: rlc ? 130 : 200, xMax: tMax, yMax, yMin: rlc ? -yMax : 0, xName: "t (ms)", yName: rlc ? "uC (V)" : resp.y, c, xStep: step(tMax), yStep: rlc ? yStep * 2 : yStep, grid: bool(p, "grid"), gridX: step(tMax) / 2, gridY: yStep / (rlc ? 1 : 2) });
    let s = f.s;
    const fn = rlc ? (t: number) => E * Math.exp(-t / (tau * 1.6)) * Math.cos((2 * Math.PI * t) / tau) : (t: number) => E * resp.fn(t, tau);
    if (!bool(p, "empty")) s += `<path d="${path(curve(f, fn, 0, tMax, 300))}" stroke-width="2.2"/>`;
    if (!rlc) {
      const rising = fn(0) < fn(tau);
      if (bool(p, "tangent")) {
        // tangent at 0: it meets the asymptote (rising) or the axis (falling) at t = τ
        const target = rising ? E : 0;
        s += seg([f.X(0), f.Y(fn(0))], [f.X(tau * 1.25), f.Y(fn(0) + ((target - fn(0)) / tau) * tau * 1.25)], `stroke-width="1.2"`);
        if (rising) s += `<path d="M${f.x0} ${r1(f.Y(E))}H${r1(f.X(tMax))}" stroke-width="1" stroke-dasharray="6 4"/>`;
      }
      if (bool(p, "mark")) s += guide(f, tau, fn(tau), "τ", rising ? "0,63E" : "0,37E", c);
    }
    return svg(480, rlc ? 200 : 290, s, c);
  },
};

// ---- Oscilloscope screen ----
const SIGNALS = [
  { value: "none", label: "None" },
  { value: "sine", label: "Sine wave" },
  { value: "square", label: "Square wave" },
  { value: "triangle", label: "Triangle wave" },
  { value: "rc", label: "RC response to a square" },
  { value: "dc", label: "Constant" },
];
function signal(kind: string, amp: number, period: number, t: number) {
  const ph = ((t / period) % 1 + 1) % 1;
  switch (kind) {
    case "sine":
      return amp * Math.sin(2 * Math.PI * ph);
    case "square":
      return ph < 0.5 ? amp : -amp;
    case "triangle":
      return ph < 0.5 ? amp * (4 * ph - 1) : amp * (3 - 4 * ph);
    case "rc": {
      // a square between 0 and amp, through RC (τ = period / 10, so each half period is 5τ): charge, then discharge
      const tau = period / 10;
      const end = 1 - Math.exp(-period / 2 / tau);
      return ph < 0.5 ? amp * (1 - Math.exp(-(ph * period) / tau)) : amp * end * Math.exp(-((ph - 0.5) * period) / tau);
    }
    case "dc":
      return amp;
    default:
      return NaN;
  }
}
export const oscilloFigure: FigureDef = {
  id: "pc-oscillo",
  name: "Oscilloscope screen",
  params: [
    { key: "signal", label: "Channel 1", kind: "select", options: SIGNALS },
    { key: "amp", label: "Amplitude (div)", kind: "number", min: 0, max: 4, step: 0.2, row: "a" },
    { key: "period", label: "Period (div)", kind: "number", min: 1, max: 10, step: 0.2, row: "a" },
    { key: "signal2", label: "Channel 2", kind: "select", options: SIGNALS },
    { key: "amp2", label: "Amplitude 2 (div)", kind: "number", min: 0, max: 4, step: 0.2, when: (p) => p.signal2 !== "none" },
    { key: "sens", label: "Sensitivities", kind: "text", placeholder: "2 V/div ; 0,5 ms/div" },
  ],
  defaults: () => ({ signal: "sine", amp: 3, period: 4, signal2: "none", amp2: 2, sens: "2 V/div ; 0,5 ms/div" }),
  build: (p) => {
    const c = ink(p);
    const d = 34;
    const X0 = 20;
    const Y0 = 20;
    const W = 10 * d;
    const H = 8 * d;
    let s = `<rect x="${X0 - 8}" y="${Y0 - 8}" width="${W + 16}" height="${H + 16}" rx="10" fill="#ffffff" stroke-width="2.2"/>`;
    let g = "";
    for (let i = 1; i < 10; i++) g += `M${X0 + i * d} ${Y0}V${Y0 + H}`;
    for (let j = 1; j < 8; j++) g += `M${X0} ${Y0 + j * d}H${X0 + W}`;
    s += `<rect x="${X0}" y="${Y0}" width="${W}" height="${H}" stroke-width="1.6"/><path d="${g}" stroke="${GRID}" stroke-width="0.8"/>`;
    // the small marks on the middle axes (fifths of a division)
    let m = "";
    for (let i = 1; i < 50; i++) m += `M${r1(X0 + (i * d) / 5)} ${Y0 + H / 2 - 3}v6`;
    for (let j = 1; j < 40; j++) m += `M${X0 + W / 2 - 3} ${r1(Y0 + (j * d) / 5)}h6`;
    s += `<path d="${m}" stroke-width="0.8"/>`;
    const draw = (kind: string, amp: number, period: number, dash: string) => {
      if (kind === "none") return "";
      const pts: Pt[] = [];
      for (let i = 0; i <= 400; i++) {
        const t = (i / 400) * 10;
        const v = clamp(signal(kind, amp, period, t), -4, 4);
        pts.push([X0 + t * d, Y0 + H / 2 - v * d]);
      }
      return `<path d="${path(pts)}" stroke-width="2.2" ${dash}/>`;
    };
    s += draw(str(p, "signal", "sine"), num(p, "amp", 3), Math.max(1, num(p, "period", 4)), "");
    s += draw(str(p, "signal2", "none"), num(p, "amp2", 2), Math.max(1, num(p, "period", 4)), `stroke-dasharray="7 4"`);
    const sens = str(p, "sens").split(";").map((t) => t.trim()).filter(Boolean);
    sens.forEach((t, i) => (s += chem(X0 + (i ? W : 0), Y0 + H + 34, t, { size: 13, anchor: i ? "end" : "start", fill: c })));
    return svg(W + 40, H + (sens.length ? 62 : 30), s, c);
  },
};

export const CIRCUIT_FIGURES: FigureDef[] = [circuitFigure, symbolsFigure, nodeFigure, dipoleFigure, characteristicFigure, rcrlFigure, responseFigure, oscilloFigure];
