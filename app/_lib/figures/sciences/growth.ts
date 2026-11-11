// Growth and cell renewal: mitosis, the root tip and its meristem, the chromosome, the cell cycle, DNA during the cycle.
import { bool, ink, num, r1, str, svg, type Pt } from "../svg";
import type { FigureDef } from "../types";
import type { Lang } from "../../types";
import { arcArrow, axes, chem, polar, polyline, say, yTick } from "./draw";
import { LABEL_MODES, labeledFigure } from "./labeled";

const PHASES = ["interphase", "prophase", "metaphase", "anaphase", "telophase"] as const;
type Phase = (typeof PHASES)[number];
const PHASE_NAMES: Record<Lang, string[]> = {
  fr: ["Interphase", "Prophase", "Métaphase", "Anaphase", "Télophase"],
  ar: ["المرحلة البينية", "الطور التمهيدي", "الطور الاستوائي", "الطور الانفصالي", "الطور النهائي"],
};
const MIXED = [2, 0, 4, 1, 3]; // the "to put in order" strip

// One chromatid: a thick line, black or white with a black edge (the two chromosomes of a pair).
const bar = (d: string, hollow: boolean, c: string) =>
  hollow ? `<path d="${d}" stroke="${c}" stroke-width="4.6"/><path d="${d}" stroke="#ffffff" stroke-width="1.8"/>` : `<path d="${d}" stroke="${c}" stroke-width="4.2"/>`;

// A chromosome of two chromatids, standing at (x, y) (its centromere), turned by `deg`.
function double(x: number, y: number, len: number, hollow: boolean, deg: number, c: string) {
  const up = r1(len * 0.42);
  const down = r1(len * 0.58);
  const d = (dx: number) => `M${dx} ${-up}L${dx} ${down}`;
  return `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${deg})">${bar(d(-3.2), hollow, c)}${bar(d(3.2), hollow, c)}<circle r="2.4" fill="${c}" stroke="none"/></g>`;
}

// One chromatid pulled to a pole by its centromere (dir -1: to the left pole).
function pulled(x: number, y: number, len: number, hollow: boolean, dir: number, c: string) {
  const a = 7 * -dir;
  const d = `M${r1(x + a)} ${r1(y - len * 0.42)}L${r1(x)} ${r1(y)}L${r1(x + a)} ${r1(y + len * 0.58)}`;
  return bar(d, hollow, c) + `<circle cx="${r1(x)}" cy="${r1(y)}" r="2.2" fill="${c}" stroke="none"/>`;
}

const aster = (x: number, y: number, c: string) => {
  let s = `<rect x="${x - 4}" y="${y - 1.5}" width="8" height="3" fill="${c}" stroke="none"/><rect x="${x - 1.5}" y="${y - 4}" width="3" height="8" fill="${c}" stroke="none"/>`;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + 0.3;
    s += `<path d="M${r1(x + Math.cos(a) * 6)} ${r1(y + Math.sin(a) * 6)}L${r1(x + Math.cos(a) * 12)} ${r1(y + Math.sin(a) * 12)}" stroke-width="1"/>`;
  }
  return s;
};

// The chromosomes of the cell: n pairs, the second of each pair white.
const chromosomes = (pairs: number) => {
  const lens = [18, 12, 8].slice(0, pairs);
  return [...lens.map((l) => ({ len: l, hollow: false })), ...lens.map((l) => ({ len: l, hollow: true }))];
};

// Places along the equator (y), for chromosomes of these lengths.
function along(lens: number[], cy: number, gap = 4) {
  const total = lens.reduce((s, l) => s + l, 0) + gap * (lens.length - 1);
  let y = cy - total / 2;
  return lens.map((l) => {
    const at = y + l * 0.42;
    y += l + gap;
    return at;
  });
}

// One cell at one phase, in a 140 × 125 box.
function cellAt(phase: Phase, plant: boolean, pairs: number, c: string) {
  const cx = 70;
  const cy = 62;
  let s = "";
  const chromos = chromosomes(pairs);
  // the cell
  if (phase === "telophase" && !plant) {
    s += `<path d="M${cx} ${cy - 20}C${cx - 10} ${cy - 44} ${cx - 64} ${cy - 48} ${cx - 64} ${cy}C${cx - 64} ${cy + 48} ${cx - 10} ${cy + 44} ${cx} ${cy + 20}C${cx + 10} ${cy + 44} ${cx + 64} ${cy + 48} ${cx + 64} ${cy}C${cx + 64} ${cy - 48} ${cx + 10} ${cy - 44} ${cx} ${cy - 20}Z"/>`;
  } else if (plant) {
    s += `<rect x="${cx - 62}" y="${cy - 56}" width="124" height="112" rx="5"/><rect x="${cx - 58}" y="${cy - 52}" width="116" height="104" rx="3" stroke-width="1"/>`;
  } else {
    const rx = phase === "metaphase" || phase === "anaphase" ? 64 : 56;
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="56"/>`;
  }
  const poleX = phase === "anaphase" ? 56 : 50;
  const poles: Pt[] = [
    [cx - poleX, cy],
    [cx + poleX, cy],
  ];
  const spindle = (spread: number[]) =>
    spread.map((dy) => `<path d="M${poles[0][0]} ${cy}Q${cx} ${cy + dy} ${poles[1][0]} ${cy}" stroke-width="0.9"/>`).join("");
  switch (phase) {
    case "interphase": {
      s += `<circle cx="${cx}" cy="${cy}" r="28" fill="#ffffff"/>`;
      s += `<circle cx="${cx + 7}" cy="${cy - 6}" r="5.5" fill="${c}" stroke="none"/>`;
      s += `<path d="M${cx - 18} ${cy - 8}q5 -8 10 0t10 0M${cx - 16} ${cy + 8}q4 6 9 0t9 2t8 -4M${cx - 6} ${cy + 18}q4 -5 8 0t8 0M${cx - 20} ${cy + 2}q3 -4 6 0M${cx + 6} ${cy + 6}q4 -5 8 0t7 3" stroke-width="1"/>`;
      if (!plant) s += aster(cx + 32, cy - 32, c);
      break;
    }
    case "prophase": {
      s += `<circle cx="${cx}" cy="${cy}" r="32" stroke-dasharray="5 4"/>`;
      const spots: [number, number, number][] = [
        [-13, -11, 30],
        [12, -12, -40],
        [-12, 12, 70],
        [14, 11, -15],
        [1, -3, 100],
        [1, 17, 15],
      ];
      chromos.forEach((ch, i) => {
        const [dx, dy, deg] = spots[(i % pairs) * 2 + (ch.hollow ? 1 : 0)] ?? spots[i];
        s += double(cx + dx, cy + dy, ch.len * 0.9, ch.hollow, deg, c);
      });
      if (!plant) s += aster(cx - 44, cy - 22, c) + aster(cx + 44, cy + 22, c);
      break;
    }
    case "metaphase": {
      s += spindle([-70, -40, 40, 70]);
      const order = chromos.map((_, i) => i).sort((a, b) => (a % pairs) - (b % pairs) || a - b);
      const ys = along(
        order.map((i) => chromos[i].len),
        cy,
        5,
      );
      order.forEach((i, k) => {
        s += `<path d="M${poles[0][0]} ${cy}L${cx - 3} ${r1(ys[k])}M${poles[1][0]} ${cy}L${cx + 3} ${r1(ys[k])}" stroke-width="0.9"/>`;
        s += double(cx, ys[k], chromos[i].len, chromos[i].hollow, 0, c);
      });
      if (!plant) s += aster(poles[0][0], cy, c) + aster(poles[1][0], cy, c);
      break;
    }
    case "anaphase": {
      s += spindle([-60, 60]);
      const order = chromos.map((_, i) => i).sort((a, b) => (a % pairs) - (b % pairs) || a - b);
      const ys = along(
        order.map((i) => chromos[i].len * 0.85),
        cy,
        2,
      );
      for (const dir of [-1, 1]) {
        const x = cx + dir * 27;
        order.forEach((i, k) => {
          s += `<path d="M${poles[dir < 0 ? 0 : 1][0]} ${cy}L${x} ${r1(ys[k])}" stroke-width="0.9"/>`;
          s += pulled(x, ys[k], chromos[i].len * 0.85, chromos[i].hollow, dir, c);
        });
      }
      if (!plant) s += aster(poles[0][0], cy, c) + aster(poles[1][0], cy, c);
      break;
    }
    case "telophase": {
      for (const dir of [-1, 1]) {
        const x = cx + dir * 34;
        s += `<circle cx="${x}" cy="${cy}" r="19" fill="#ffffff" stroke-dasharray="4 3"/>`;
        s += `<path d="M${x - 10} ${cy - 5}q4 -6 8 0t8 0M${x - 8} ${cy + 6}q4 5 8 0t7 1M${x - 2} ${cy - 13}q3 4 6 0" stroke-width="2.2"/>`;
      }
      if (plant) {
        s += `<path d="M${cx} ${cy - 44}V${cy + 44}" stroke-width="2.4" stroke-dasharray="3 3"/>`;
        s += `<path d="M${cx - 12} ${cy - 30}Q${cx} ${cy - 40} ${cx + 12} ${cy - 30}M${cx - 12} ${cy + 30}Q${cx} ${cy + 40} ${cx + 12} ${cy + 30}" stroke-width="0.9"/>`;
      } else s += `<path d="M${cx - 12} ${cy - 6}H${cx + 12}M${cx - 12} ${cy + 6}H${cx + 12}" stroke-width="0.9"/>`;
      break;
    }
  }
  return s;
}

const label = (x: number, y: number, mode: string, name: string, n: number, c: string) =>
  mode === "names" ? say(x, y, name, { size: 12, anchor: "middle", fill: c }) : mode === "lines" ? say(x, y, `${n} ………………`, { size: 12, anchor: "middle", fill: c }) : mode === "numbers" ? say(x, y, String(n), { size: 14, anchor: "middle", fill: c, bold: true }) : "";

// The phases of mitosis (or one of them), in an animal or plant cell, with n pairs of chromosomes.
export const mitosisFigure: FigureDef = {
  id: "sci-mitosis",
  name: "Mitosis",
  params: [
    {
      key: "phase",
      label: "Phase",
      kind: "select",
      options: [
        { value: "all", label: "All the phases" },
        { value: "interphase", label: "Interphase" },
        { value: "prophase", label: "Prophase" },
        { value: "metaphase", label: "Metaphase" },
        { value: "anaphase", label: "Anaphase" },
        { value: "telophase", label: "Telophase" },
      ],
    },
    {
      key: "cell",
      label: "Cell",
      kind: "select",
      options: [
        { value: "animal", label: "Animal" },
        { value: "plant", label: "Plant" },
      ],
    },
    { key: "pairs", label: "Chromosome pairs", kind: "number", min: 1, max: 3 },
    { key: "mixed", label: "Mixed order (to put in order)", kind: "bool", when: (p) => p.phase === "all" },
    { key: "labels", label: "Labels", kind: "select", options: LABEL_MODES },
  ],
  defaults: () => ({ phase: "all", cell: "animal", pairs: 2, mixed: false, labels: "names" }),
  build: (p, lang) => {
    const c = ink(p);
    const plant = str(p, "cell") === "plant";
    const pairs = Math.round(Math.min(3, Math.max(1, num(p, "pairs", 2))));
    const mode = str(p, "labels", "names");
    const phase = str(p, "phase", "all");
    const one = PHASES.indexOf(phase as Phase);
    const list = one >= 0 ? [one] : bool(p, "mixed") ? MIXED : [0, 1, 2, 3, 4];
    const names = PHASE_NAMES[lang] ?? PHASE_NAMES.fr;
    let body = "";
    list.forEach((k, i) => {
      body += `<g transform="translate(${i * 144} 0)">${cellAt(PHASES[k], plant, pairs, c)}${label(70, 143, mode, names[k], i + 1, c)}</g>`;
    });
    return svg(list.length * 144 - 4, mode === "none" ? 128 : 152, body, c);
  },
};

// ---- The root tip: cap, meristem, elongation, root hairs ----
const ROOT_COLS = [-30, -22.5, -15, -7.5, 0, 7.5, 15, 22.5, 30];
function rootTip() {
  const x = (v: number) => r1(70 + v);
  let s = `<path d="M${x(-30)} 0V246Q${x(-30)} 284 ${x(0)} 286Q${x(30)} 284 ${x(30)} 246V0"/>`;
  // root cap (around the tip)
  s += `<path d="M${x(-33)} 236Q${x(-35)} 298 ${x(0)} 300Q${x(35)} 298 ${x(33)} 236" fill="none"/>`;
  s += `<path d="M${x(-31)} 262L${x(-20)} 270M${x(31)} 262L${x(20)} 270M${x(-22)} 285L${x(-12)} 280M${x(22)} 285L${x(12)} 280M${x(0)} 286V300" stroke-width="1"/>`;
  // cells: small near the tip (meristem), long above (elongation, differentiation)
  const rows = [246, 239, 232, 225, 218, 211, 204, 190, 172, 150, 124, 92, 56, 18];
  for (const y of rows) s += `<path d="M${x(-30)} ${y}H${x(30)}" stroke-width="0.8"/>`;
  for (const v of ROOT_COLS.slice(1, -1)) s += `<path d="M${x(v)} 0V246" stroke-width="0.8"/>`;
  // a few dividing cells in the meristem
  s += `<path d="M${x(-11)} 228h7M${x(4)} 214h7M${x(12)} 235h6" stroke-width="2"/>`;
  // root hairs
  const hairs: [number, number][] = [
    [100, 36],
    [84, 44],
    [68, 50],
    [52, 54],
    [36, 56],
    [20, 58],
  ];
  for (const [y, l] of hairs) {
    s += `<path d="M${x(-30)} ${y}q${-l / 2} -4 ${-l} -14" stroke-width="1.3"/><path d="M${x(30)} ${y + 6}q${l / 2} -4 ${l} -14" stroke-width="1.3"/>`;
  }
  return s;
}

export const rootTipFigure = labeledFigure({
  id: "sci-root-tip",
  name: "Root tip",
  w: 140,
  h: 302,
  draw: () => rootTip(),
  parts: [
    { key: "hair", at: [128, 80], side: "r", fr: "Poil absorbant", ar: "وبر ماص" },
    { key: "diff", at: [52, 70], side: "l", fr: "Zone de différenciation", ar: "منطقة التمايز" },
    { key: "elong", at: [58, 165], side: "l", fr: "Zone d'élongation", ar: "منطقة الاستطالة" },
    { key: "meri", at: [82, 222], side: "r", fr: "Zone méristématique", ar: "المنطقة المرستيمية" },
    { key: "cap", at: [92, 292], side: "r", fr: "Coiffe", ar: "القلنسوة" },
  ],
});

// ---- A chromosome: one chromatid, or two (after the DNA has doubled) ----
function chromatid(cx: number) {
  // a long tube pinched at the centromere (y = 72)
  return `<path d="M${cx - 12} 22Q${cx - 13} 8 ${cx} 8Q${cx + 13} 8 ${cx + 12} 22L${cx + 11} 60Q${cx + 6} 72 ${cx + 11} 84L${cx + 13} 198Q${cx + 13} 212 ${cx} 212Q${cx - 13} 212 ${cx - 13} 198L${cx - 11} 84Q${cx - 6} 72 ${cx - 11} 60Z" fill="#ffffff"/>` +
    [30, 44, 100, 120, 150, 176].map((y, i) => `<path d="M${cx - 11} ${y}H${cx + 11}" stroke-width="${i % 2 ? 1 : 3}"/>`).join("");
}

export const chromosomeFigure = labeledFigure({
  id: "sci-chromosome",
  name: "Chromosome",
  params: [
    {
      key: "kind",
      label: "Chromosome",
      kind: "select",
      options: [
        { value: "double", label: "Two chromatids" },
        { value: "single", label: "One chromatid" },
      ],
    },
  ],
  defaults: { kind: "double" },
  w: 120,
  h: 220,
  draw: (p, c) => (str(p, "kind") === "single" ? chromatid(60) : chromatid(47) + chromatid(73) + `<circle cx="60" cy="72" r="5" fill="${c}" stroke="none"/>`),
  parts: (p) =>
    str(p, "kind") === "single"
      ? [
          { key: "short", at: [50, 36], side: "l", fr: "Bras court", ar: "ذراع قصير" },
          { key: "centro", at: [68, 72], side: "r", fr: "Centromère", ar: "الجزيء المركزي" },
          { key: "long", at: [70, 140], side: "r", fr: "Bras long", ar: "ذراع طويل" },
          { key: "chromatid", at: [50, 180], side: "l", fr: "Chromatide", ar: "صبيغي" },
        ]
      : [
          { key: "chromatid", at: [38, 140], side: "l", fr: "Chromatide", ar: "صبيغي" },
          { key: "sister", at: [84, 160], side: "r", fr: "Chromatide sœur", ar: "صبيغي شقيق" },
          { key: "centro", at: [64, 72], side: "r", fr: "Centromère", ar: "الجزيء المركزي" },
          { key: "short", at: [40, 34], side: "l", fr: "Bras court", ar: "ذراع قصير" },
        ],
});

// ---- The cell cycle: G1, S, G2 and M around a circle ----
const CYCLE: { key: string; from: number; to: number; fr: string; ar: string }[] = [
  { key: "G1", from: 0, to: 150, fr: "G1", ar: "G1" },
  { key: "S", from: 150, to: 255, fr: "S", ar: "S" },
  { key: "G2", from: 255, to: 310, fr: "G2", ar: "G2" },
  { key: "M", from: 310, to: 360, fr: "M", ar: "M" },
];
const CYCLE_NAMES: Record<Lang, { inter: string; parts: string[] }> = {
  fr: { inter: "Interphase", parts: ["Phase G1", "Phase S (réplication de l'ADN)", "Phase G2", "Mitose"] },
  ar: { inter: "المرحلة البينية", parts: ["المرحلة G1", "المرحلة S (تضاعف ADN)", "المرحلة G2", "الانقسام المتساوي"] },
};

const sector = (c: Pt, r0: number, r1_: number, a: number, b: number, extra = "") => {
  const p1 = polar(c, r1_, a);
  const p2 = polar(c, r1_, b);
  const p3 = polar(c, r0, b);
  const p4 = polar(c, r0, a);
  const large = b - a > 180 ? 1 : 0;
  return `<path d="M${r1(p1[0])} ${r1(p1[1])}A${r1_} ${r1_} 0 ${large} 1 ${r1(p2[0])} ${r1(p2[1])}L${r1(p3[0])} ${r1(p3[1])}A${r0} ${r0} 0 ${large} 0 ${r1(p4[0])} ${r1(p4[1])}Z" ${extra}/>`;
};

export const cellCycleFigure: FigureDef = {
  id: "sci-cell-cycle",
  name: "Cell cycle",
  params: [{ key: "labels", label: "Labels", kind: "select", options: LABEL_MODES }],
  defaults: () => ({ labels: "names" }),
  build: (p, lang) => {
    const c = ink(p);
    const mode = str(p, "labels", "names");
    const C: Pt = [150, 150];
    const names = CYCLE_NAMES[lang] ?? CYCLE_NAMES.fr;
    let s = "";
    CYCLE.forEach((seg, i) => {
      s += sector(C, 58, 92, seg.from, seg.to, seg.key === "M" ? `fill="#e4e4e7"` : `fill="#ffffff"`);
      const at = polar(C, 75, (seg.from + seg.to) / 2);
      const say = mode === "names" ? seg.fr : mode === "none" ? "" : String(i + 1);
      s += chem(at[0], at[1] + 5, say, { size: mode === "names" ? 15 : 14, anchor: "middle", fill: c, bold: true });
    });
    s += arcArrow(C, 104, 8, 300, c, `stroke-width="1.6"`);
    // the interphase: a bracket inside the ring
    s += `<path d="${(() => {
      const a = polar(C, 48, 2);
      const b = polar(C, 48, 308);
      return `M${r1(a[0])} ${r1(a[1])}A48 48 0 1 1 ${r1(b[0])} ${r1(b[1])}`;
    })()}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
    const inter = mode === "names" ? names.inter : mode === "none" ? "" : "5";
    s += say(150, 154, inter, { size: mode === "names" ? 12 : 14, anchor: "middle", fill: c, bold: mode !== "names" });
    let w = 300;
    if (mode === "names" || mode === "lines") {
      // a legend on the right: the full names, or lines to write them
      const rows = mode === "names" ? names.parts.map((n, i) => `${CYCLE[i].key} : ${n}`) : [1, 2, 3, 4, 5].map((n) => `${n} ……………………………`);
      if (mode === "names") rows.push(`G1 + S + G2 : ${names.inter}`);
      rows.forEach((r, i) => (s += say(lang === "ar" ? 590 : 316, 98 + i * 24, r, { size: 12, fill: c, anchor: lang === "ar" ? "end" : "start" })));
      w = 600;
    }
    return svg(w, 300, s, c);
  },
};

// ---- DNA in a cell during the cell cycle ----
const DNA_AXES: Record<Lang, [string, string]> = {
  fr: ["Temps", "Quantité d'ADN par cellule (u.a.)"],
  ar: ["الزمن", "كمية ADN في الخلية (و.إ)"],
};

export const dnaCurveFigure: FigureDef = {
  id: "sci-dna-curve",
  name: "DNA during the cell cycle",
  params: [
    { key: "cycles", label: "Cycles", kind: "number", min: 1, max: 3 },
    { key: "phases", label: "Show the phases (G1, S, G2, M)", kind: "bool" },
    { key: "empty", label: "Without the curve (the student draws it)", kind: "bool" },
  ],
  defaults: () => ({ cycles: 2, phases: true, empty: false }),
  build: (p, lang) => {
    const c = ink(p);
    const n = Math.round(Math.min(3, Math.max(1, num(p, "cycles", 2))));
    const [xName, yName] = DNA_AXES[lang] ?? DNA_AXES.fr;
    const x0 = 50;
    const y0 = 190;
    const W = 400;
    let s = axes(x0, y0, W, 160, xName, yName, c);
    const yQ = y0 - 55;
    const y2Q = y0 - 110;
    s += yTick(x0, yQ, "Q", c) + yTick(x0, y2Q, "2Q", c);
    s += `<path d="M${x0} ${y2Q}H${x0 + W}M${x0} ${yQ}H${x0 + W}" stroke-width="0.6" stroke-dasharray="2 4"/>`;
    const per = (W - 20) / n;
    const pts: Pt[] = [[x0, yQ]];
    for (let k = 0; k < n; k++) {
      const a = x0 + k * per;
      const g1 = a + per * 0.35;
      const sEnd = g1 + per * 0.25;
      const g2 = sEnd + per * 0.18;
      const m = a + per;
      pts.push([g1, yQ], [sEnd, y2Q], [m - per * 0.04, y2Q], [m - per * 0.04, yQ], [m, yQ]);
      if (bool(p, "phases")) {
        for (const [from, to, name] of [
          [a, g1, "G1"],
          [g1, sEnd, "S"],
          [sEnd, g2, "G2"],
          [g2, m, "M"],
        ] as [number, number, string][]) {
          s += chem((from + to) / 2, y0 - 8, name, { size: 11, anchor: "middle", fill: c });
          s += `<path d="M${r1(to)} ${y0}V${y0 - 140}" stroke-width="0.6" stroke-dasharray="3 3"/>`;
        }
      }
    }
    if (!bool(p, "empty")) s += polyline(pts, `stroke-width="2.4"`);
    return svg(x0 + W + 20, y0 + 40, s, c);
  },
};

export const GROWTH_FIGURES: FigureDef[] = [mitosisFigure, rootTipFigure, chromosomeFigure, cellCycleFigure, dnaCurveFigure];
