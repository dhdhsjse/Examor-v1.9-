// Proteins in the body's defense (immunology): the antibody, the Ouchterlony test, HIV, the immune responses.
import { bool, ink, num, r1, rad, str, svg, type Pt } from "../svg";
import type { FigureDef } from "../types";
import type { Lang } from "../../types";
import { axes, head, polyline, say } from "./draw";
import { labeledFigure } from "./labeled";

// A point of a shape turned by deg around o (svg rotation).
const rot = (o: Pt, deg: number, [x, y]: Pt): Pt => {
  const a = rad(deg);
  return [o[0] + x * Math.cos(a) - y * Math.sin(a), o[1] + x * Math.sin(a) + y * Math.cos(a)];
};

// ---- Antibody (immunoglobulin G) ----
const GREY = "#d4d4d8";
const ARM_L: Pt = [143, 128];
const ARM_R: Pt = [157, 128];

function antibody(antigen: boolean, c: string) {
  let s = "";
  // the stem: the two heavy chains
  s += `<rect x="134" y="128" width="15" height="112" rx="6" fill="#ffffff" stroke-width="1.8"/><rect x="151" y="128" width="15" height="112" rx="6" fill="#ffffff" stroke-width="1.8"/>`;
  for (const [o, deg, outer] of [
    [ARM_L, -45, -1],
    [ARM_R, 45, 1],
  ] as const) {
    s += `<g transform="translate(${o[0]} ${o[1]}) rotate(${deg})">`;
    // heavy chain (constant part, then variable tip)
    s += `<rect x="-7.5" y="-106" width="15" height="110" rx="6" fill="#ffffff" stroke-width="1.8"/><rect x="-7.5" y="-106" width="15" height="34" rx="6" fill="${GREY}" stroke-width="1.8"/>`;
    // light chain beside it
    const lx = outer < 0 ? -25 : 10;
    s += `<rect x="${lx}" y="-106" width="15" height="64" rx="6" fill="#ffffff" stroke-width="1.8"/><rect x="${lx}" y="-106" width="15" height="34" rx="6" fill="${GREY}" stroke-width="1.8"/>`;
    // disulfide bridge between the light and the heavy chain
    s += `<path d="M${outer < 0 ? -10 : 7.5} -50H${outer < 0 ? -7.5 : 10}" stroke-width="3"/>`;
    // the antigen-binding site: a hollow between the two tips
    s += `<path d="M${outer < 0 ? -18 : 2} -106Q${outer < 0 ? -9 : 9} -96 ${outer < 0 ? 0 : 18} -106" fill="#ffffff" stroke-width="1.6"/>`;
    if (antigen) s += `<path d="M${outer < 0 ? -20 : 0} -110L${outer < 0 ? -9 : 9} -98L${outer < 0 ? 2 : 20} -110L${outer < 0 ? 2 : 20} -122L${outer < 0 ? -20 : 0} -122Z" fill="${c}" stroke="none"/>`;
    s += `</g>`;
  }
  // disulfide bridges between the heavy chains (hinge)
  s += `<path d="M148 142h4M148 152h4" stroke-width="3"/>`;
  return s;
}

export const antibodyFigure = labeledFigure({
  id: "sci-antibody",
  name: "Antibody",
  params: [{ key: "antigen", label: "With the antigen", kind: "bool" }],
  defaults: { antigen: false },
  w: 300,
  h: 250,
  draw: (p, c) => antibody(bool(p, "antigen"), c),
  parts: (p) => [
    { key: "site", at: rot(ARM_L, -45, [-9, -100]), side: "l", fr: "Site de fixation de l'antigène", ar: "موقع تثبيت مولد الضد" },
    { key: "variable", at: rot(ARM_L, -45, [-18, -86]), side: "l", fr: "Région variable", ar: "المنطقة المتغيرة" },
    { key: "constant", at: rot(ARM_L, -45, [-18, -54]), side: "l", fr: "Région constante", ar: "المنطقة الثابتة" },
    { key: "light", at: rot(ARM_R, 45, [17, -60]), side: "r", fr: "Chaîne légère", ar: "سلسلة خفيفة" },
    { key: "heavy", at: [159, 200], side: "r", fr: "Chaîne lourde", ar: "سلسلة ثقيلة" },
    { key: "ss", at: [150, 147], side: "r", fr: "Pont disulfure", ar: "جسر ثنائي الكبريت" },
    ...(bool(p, "antigen") ? [{ key: "antigen", at: rot(ARM_R, 45, [10, -116]), side: "r" as const, fr: "Antigène", ar: "مولد الضد" }] : []),
  ],
});

// ---- Ouchterlony double immunodiffusion ----
export const ouchterlonyFigure: FigureDef = {
  id: "sci-ouchterlony",
  name: "Ouchterlony test",
  hint: "Precipitation arcs: the wells (by their names) where antigen and antibody meet.",
  params: [
    { key: "center", label: "Central well", kind: "text", row: "w" },
    { key: "wells", label: "Wells around", kind: "text", row: "w" },
    { key: "arcs", label: "Precipitation arcs", kind: "text" },
  ],
  defaults: (lang) => ({ center: lang === "ar" ? "مصل" : "S", wells: "1, 2, 3, 4, 5, 6", arcs: "1, 3" }),
  build: (p) => {
    const c = ink(p);
    const C: Pt = [150, 150];
    const names = str(p, "wells")
      .split(/[,;،]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8);
    const arcs = new Set(
      str(p, "arcs")
        .split(/[,;،]/)
        .map((t) => t.trim())
        .filter(Boolean),
    );
    let s = `<circle cx="${C[0]}" cy="${C[1]}" r="134" fill="#ffffff" stroke-width="2.2"/><circle cx="${C[0]}" cy="${C[1]}" r="128" stroke-width="0.9"/>`;
    s += `<circle cx="${C[0]}" cy="${C[1]}" r="15" fill="#ffffff" stroke-width="1.8"/>` + say(C[0], C[1] + 5, str(p, "center"), { size: 13, anchor: "middle", fill: c, bold: true });
    const n = Math.max(1, names.length);
    names.forEach((name, i) => {
      const a = rad(-90 + (i * 360) / n);
      const w: Pt = [C[0] + Math.cos(a) * 76, C[1] + Math.sin(a) * 76];
      s += `<circle cx="${r1(w[0])}" cy="${r1(w[1])}" r="15" fill="#ffffff" stroke-width="1.8"/>` + say(w[0], w[1] + 5, name, { size: 13, anchor: "middle", fill: c, bold: true });
      if (arcs.has(name)) {
        // an arc across the line between the wells, nearer the antibodies' well
        const m: Pt = [C[0] + Math.cos(a) * 40, C[1] + Math.sin(a) * 40];
        const t: Pt = [-Math.sin(a), Math.cos(a)];
        const p1: Pt = [m[0] + t[0] * 16, m[1] + t[1] * 16];
        const p2: Pt = [m[0] - t[0] * 16, m[1] - t[1] * 16];
        const q: Pt = [m[0] - Math.cos(a) * 7, m[1] - Math.sin(a) * 7];
        s += `<path d="M${r1(p1[0])} ${r1(p1[1])}Q${r1(q[0])} ${r1(q[1])} ${r1(p2[0])} ${r1(p2[1])}" stroke-width="3.2"/>`;
      }
    });
    return svg(300, 300, s, c);
  },
};

// ---- HIV ----
function hiv(c: string) {
  let s = `<circle cx="140" cy="130" r="96" fill="#ffffff" stroke-width="2"/><circle cx="140" cy="130" r="89" stroke-width="1.2"/>`;
  // glycoproteins: gp41 through the envelope, gp120 on top
  for (let i = 0; i < 12; i++) {
    const a = rad(i * 30 + 8);
    const p1: Pt = [140 + Math.cos(a) * 89, 130 + Math.sin(a) * 89];
    const p2: Pt = [140 + Math.cos(a) * 106, 130 + Math.sin(a) * 106];
    s += `<path d="M${r1(p1[0])} ${r1(p1[1])}L${r1(p2[0])} ${r1(p2[1])}" stroke-width="2.4"/><circle cx="${r1(140 + Math.cos(a) * 112)}" cy="${r1(130 + Math.sin(a) * 112)}" r="7" fill="${i % 2 ? "#ffffff" : "#ffffff"}" stroke-width="1.8"/>`;
  }
  // matrix (inner layer) and the cone-shaped capsid
  s += `<circle cx="140" cy="130" r="80" stroke-width="1" stroke-dasharray="3 3"/>`;
  s += `<path d="M104 76L176 76Q184 76 182 84L164 186Q162 194 154 194L126 194Q118 194 116 186L98 84Q96 76 104 76Z" fill="#ffffff" stroke-width="2"/>`;
  // two RNA strands and the reverse transcriptase
  s += `<path d="M124 92q6 8 0 16t0 16t0 16t0 16t0 16" stroke-width="1.8"/><path d="M152 92q6 8 0 16t0 16t0 16t0 16t0 16" stroke-width="1.8"/>`;
  s += `<ellipse cx="138" cy="114" rx="5" ry="3.5" fill="${c}" stroke="none"/><ellipse cx="140" cy="164" rx="5" ry="3.5" fill="${c}" stroke="none"/>`;
  return s;
}

export const hivFigure = labeledFigure({
  id: "sci-hiv",
  name: "HIV (AIDS virus)",
  w: 280,
  h: 260,
  draw: (_, c) => hiv(c),
  parts: [
    { key: "gp120", at: [52, 61], side: "l", fr: "gp120", ar: "gp120" },
    { key: "gp41", at: [66, 72], side: "l", fr: "gp41", ar: "gp41" },
    { key: "envelope", at: [46, 150], side: "l", fr: "Enveloppe (bicouche lipidique)", ar: "الغلاف (طبقة ليبيدية مضاعفة)" },
    { key: "matrix", at: [72, 196], side: "l", fr: "Matrice protéique", ar: "الطبقة البروتينية (المطرس)" },
    { key: "capsid", at: [178, 100], side: "r", fr: "Capside", ar: "المحفظة (القفيصة)" },
    { key: "rna", at: [158, 140], side: "r", fr: "ARN viral", ar: "ARN الفيروسي" },
    { key: "rt", at: [144, 164], side: "r", fr: "Transcriptase inverse", ar: "إنزيم النسخ العكسي" },
  ],
});

// ---- Primary and secondary immune responses ----
const RESPONSE_TEXT: Record<Lang, { x: string; y: string; first: string; second: string; p1: string; p2: string }> = {
  fr: { x: "Temps (jours)", y: "Concentration des anticorps (u.a.)", first: "1er contact", second: "2e contact", p1: "Réponse primaire", p2: "Réponse secondaire" },
  ar: { x: "الزمن (أيام)", y: "تركيز الأجسام المضادة (و.إ)", first: "التماس الأول", second: "التماس الثاني", p1: "الاستجابة الأولية", p2: "الاستجابة الثانوية" },
};

export const immuneResponseFigure: FigureDef = {
  id: "sci-immune-response",
  name: "Immune responses",
  params: [
    { key: "second", label: "Second contact (day)", kind: "number", min: 20, max: 60 },
    { key: "show2", label: "Secondary response", kind: "bool" },
    { key: "names", label: "Names of the responses", kind: "bool" },
    { key: "empty", label: "Without the curve (the student draws it)", kind: "bool" },
  ],
  defaults: () => ({ second: 40, show2: true, names: true, empty: false }),
  build: (p, lang) => {
    const c = ink(p);
    const T = RESPONSE_TEXT[lang] ?? RESPONSE_TEXT.fr;
    const x0 = 50;
    const y0 = 230;
    const W = 400;
    const days = 80;
    const X = (d: number) => x0 + (d / days) * W;
    const day2 = Math.min(60, Math.max(20, num(p, "second", 40)));
    let s = axes(x0, y0, W, 190, T.x, T.y, c);
    for (let d = 0; d <= days; d += 10) s += `<path d="M${r1(X(d))} ${y0}v5" stroke-width="1.2"/>` + say(X(d), y0 + 17, String(d), { size: 11, anchor: "middle", fill: c });
    const show2 = bool(p, "show2");
    const pts: Pt[] = [];
    for (let i = 0; i <= 400; i++) {
      const d = (i / 400) * days;
      // primary: late and low; secondary: fast and high
      let v = 30 * Math.exp(-(((d - 14) / 6) ** 2));
      if (show2 && d > day2) v += 130 * Math.exp(-(((d - day2 - 9) / (d < day2 + 9 ? 4 : 10)) ** 2));
      pts.push([X(d), y0 - v]);
    }
    if (!bool(p, "empty")) s += polyline(pts, `stroke-width="2.4"`);
    for (const [d, name] of show2 ? [
      [0, T.first],
      [day2, T.second],
    ] as const : ([[0, T.first]] as const)) {
      s += `<path d="M${r1(X(d) + 2)} ${y0 + 40}V${y0 + 26}" stroke-width="1.6"/>` + head([X(d) + 2, y0 + 22], -90, c, 7);
      s += say(X(d) + 6, y0 + 52, name, { size: 11, anchor: d ? "middle" : "start", fill: c });
    }
    if (bool(p, "names")) {
      s += say(X(14), y0 - 42, T.p1, { size: 11, anchor: "middle", fill: c });
      if (show2) s += say(X(day2 + 9) + 14, y0 - 140, T.p2, { size: 11, anchor: "start", fill: c });
    }
    return svg(x0 + W + 20, y0 + 62, s, c);
  },
};

export const IMMUNITY_FIGURES: FigureDef[] = [antibodyFigure, ouchterlonyFigure, hivFigure, immuneResponseFigure];
