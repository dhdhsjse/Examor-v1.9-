// Protein structure and function: the amino acid (and its charged forms), the peptide bond, electrophoresis.
import { bool, ink, r1, str, svg } from "../svg";
import type { FigureDef } from "../types";
import type { Lang } from "../../types";
import { arrow, chem, chemWidth, say } from "./draw";
import { labeledFigure } from "./labeled";

const bond = (x1: number, y1: number, x2: number, y2: number) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke-width="1.6"/>`;
const atom = (x: number, y: number, s: string, c: string, anchor: "start" | "middle" | "end" = "middle") => chem(x, y + 5, s, { size: 15, anchor, fill: c });
// A carbon with its double-bonded oxygen above.
const carbonyl = (x: number, y: number, c: string) => atom(x, y, "C", c) + bond(x - 3, y - 9, x - 3, y - 26) + bond(x + 3, y - 9, x + 3, y - 26) + atom(x, y - 34, "O", c);
// An alpha carbon with its radical above and its hydrogen below.
const alpha = (x: number, y: number, r: string, c: string) => atom(x, y, "C", c) + bond(x, y - 9, x, y - 24) + atom(x, y - 32, r, c) + bond(x, y + 9, x, y + 22) + atom(x, y + 31, "H", c);

// ---- Amino acid ----
const FORMS: Record<string, [string, string]> = {
  neutral: ["H2N", "COOH"],
  zwitterion: ["H3N^+", "COO^−"],
  cation: ["H3N^+", "COOH"],
  anion: ["H2N", "COO^−"],
};

export const aminoAcidFigure = labeledFigure({
  id: "sci-amino-acid",
  name: "Amino acid",
  params: [
    {
      key: "form",
      label: "Form",
      kind: "select",
      options: [
        { value: "neutral", label: "General formula" },
        { value: "zwitterion", label: "Dipolar ion (pH = pHi)" },
        { value: "cation", label: "Cation (pH < pHi)" },
        { value: "anion", label: "Anion (pH > pHi)" },
      ],
    },
    { key: "r", label: "Radical", kind: "text", placeholder: "R, CH3, H…" },
    { key: "frames", label: "Frame the groups", kind: "bool" },
  ],
  defaults: { form: "neutral", r: "R", frames: true, labels: "names" },
  w: 290,
  h: 150,
  draw: (p, c) => {
    const [left, right] = FORMS[str(p, "form", "neutral")] ?? FORMS.neutral;
    const x = 145;
    const y = 80;
    let s = alpha(x, y, str(p, "r", "R") || "R", c);
    s += bond(x - 10, y, x - 30, y) + atom(x - 34, y, left, c, "end");
    s += bond(x + 10, y, x + 30, y) + atom(x + 34, y, right, c, "start");
    if (bool(p, "frames")) {
      const lw = chemWidth(left, 15) + 10;
      const rw = chemWidth(right, 15) + 10;
      s += `<rect x="${r1(x - 36 - lw)}" y="${y - 14}" width="${r1(lw + 4)}" height="28" rx="5" stroke-width="1.1" stroke-dasharray="4 3"/>`;
      s += `<rect x="${r1(x + 30)}" y="${y - 14}" width="${r1(rw + 4)}" height="28" rx="5" stroke-width="1.1" stroke-dasharray="4 3"/>`;
      s += `<rect x="${x - 20}" y="${y - 50}" width="40" height="24" rx="5" stroke-width="1.1" stroke-dasharray="4 3"/>`;
    }
    return s;
  },
  parts: [
    { key: "amine", at: [70, 94], side: "b", fr: "Groupement amine", ar: "المجموعة الأمينية" },
    { key: "alpha", at: [150, 86], side: "b", fr: "Carbone α", ar: "ذرة الكربون α" },
    { key: "carboxyl", at: [222, 94], side: "b", fr: "Groupement carboxyle", ar: "المجموعة الكربوكسيلية" },
    { key: "radical", at: [165, 42], side: "r", fr: "Radical (chaîne latérale)", ar: "الجذر (السلسلة الجانبية)" },
  ],
});

// ---- The peptide bond: two amino acids → a dipeptide and water ----
const BOND_NAME: Record<Lang, string> = { fr: "Liaison peptidique", ar: "رابطة ببتيدية" };

export const peptideBondFigure: FigureDef = {
  id: "sci-peptide-bond",
  name: "Peptide bond",
  params: [
    { key: "r1", label: "Radical 1", kind: "text", row: "r" },
    { key: "r2", label: "Radical 2", kind: "text", row: "r" },
    { key: "water", label: "Show the water given off", kind: "bool" },
    { key: "frame", label: "Frame the peptide bond", kind: "bool" },
    { key: "name", label: "Name the peptide bond", kind: "bool", when: (p) => p.frame === true },
  ],
  defaults: () => ({ r1: "R1", r2: "R2", water: true, frame: true, name: true }),
  build: (p, lang) => {
    const c = ink(p);
    const R1 = str(p, "r1") || "R1";
    const R2 = str(p, "r2") || "R2";
    let s = "";
    // first line: the two amino acids
    let y = 74;
    s += atom(52, y, "H2N", c, "end") + bond(56, y, 70, y) + alpha(78, y, R1, c) + bond(86, y, 100, y) + carbonyl(108, y, c) + bond(116, y, 128, y) + atom(132, y, "OH", c, "start");
    s += atom(176, y, "+", c);
    s += atom(204, y, "H", c) + bond(211, y, 224, y) + atom(232, y, "N", c) + bond(232, y + 9, 232, y + 22) + atom(232, y + 31, "H", c);
    s += bond(240, y, 254, y) + alpha(262, y, R2, c) + bond(270, y, 284, y) + carbonyl(292, y, c) + bond(300, y, 312, y) + atom(316, y, "OH", c, "start");
    if (bool(p, "water")) s += `<rect x="128" y="${y - 13}" width="30" height="26" rx="8" stroke-width="1.2" stroke-dasharray="4 3"/><rect x="194" y="${y - 13}" width="20" height="26" rx="8" stroke-width="1.2" stroke-dasharray="4 3"/>`;
    // second line: the dipeptide
    y = 210;
    s += arrow([14, y], [42, y], c, `stroke-width="1.8"`);
    s += atom(86, y, "H2N", c, "end") + bond(90, y, 104, y) + alpha(112, y, R1, c) + bond(120, y, 134, y) + carbonyl(142, y, c) + bond(150, y, 164, y);
    s += atom(172, y, "N", c) + bond(172, y + 9, 172, y + 22) + atom(172, y + 31, "H", c) + bond(180, y, 194, y) + alpha(202, y, R2, c) + bond(210, y, 224, y) + carbonyl(232, y, c) + bond(240, y, 252, y) + atom(256, y, "OH", c, "start");
    s += chem(296, y + 5, "+  H2O", { size: 15, fill: c });
    if (bool(p, "frame")) {
      s += `<rect x="132" y="${y - 50}" width="50" height="94" rx="6" stroke-width="1.4" stroke-dasharray="5 3"/>`;
      if (bool(p, "name")) s += say(157, y + 62, BOND_NAME[lang] ?? BOND_NAME.fr, { size: 12, anchor: "middle", fill: c });
    }
    return svg(360, y + 72, s, c);
  },
};

// ---- Electrophoresis ----
export const electrophoresisFigure: FigureDef = {
  id: "sci-electrophoresis",
  name: "Electrophoresis",
  hint: "Spots: a name and its place from the deposit line (− towards the cathode), e.g. Lys:-3, Gly:0, Asp:2.",
  params: [
    { key: "ph", label: "pH of the buffer", kind: "text" },
    { key: "spots", label: "Spots", kind: "text" },
    { key: "before", label: "Before migration (on the deposit line)", kind: "bool" },
  ],
  defaults: () => ({ ph: "6", spots: "A:-3, B:0, C:2", before: false }),
  build: (p) => {
    const c = ink(p);
    const spots = str(p, "spots")
      .split(/[,;،]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => {
        const [name, at] = t.split(":");
        return { name: name.trim(), at: Math.max(-5, Math.min(5, Number((at ?? "0").replace(",", ".")) || 0)) };
      });
    const before = bool(p, "before");
    const mid = 230;
    let s = `<rect x="50" y="46" width="360" height="56" rx="3" fill="#ffffff" stroke-width="1.8"/>`;
    s += `<rect x="8" y="40" width="38" height="68" rx="4" fill="#ffffff" stroke-width="1.6"/><rect x="414" y="40" width="38" height="68" rx="4" fill="#ffffff" stroke-width="1.6"/>`;
    s += `<circle cx="27" cy="74" r="11" fill="#ffffff" stroke-width="1.4"/><path d="M21 74h12" stroke-width="2.2"/><circle cx="433" cy="74" r="11" fill="#ffffff" stroke-width="1.4"/><path d="M427 74h12M433 68v12" stroke-width="2.2"/>`;
    s += `<path d="M${mid} 40V108" stroke-width="1.2" stroke-dasharray="4 3"/>`;
    const ph = str(p, "ph").trim();
    if (ph) s += say(mid, 28, `pH = ${ph}`, { size: 13, anchor: "middle", fill: c, bold: true });
    // spots side by side when they share a place
    spots.forEach((spot, i) => {
      const x = before ? mid : mid + spot.at * 34;
      const y = 60 + ((i % 3) * 14);
      s += `<ellipse cx="${r1(x)}" cy="${y + 6}" rx="${before ? 4 : 8}" ry="5" fill="${c}" stroke="none"/>`;
      s += say(x, 124 + (i % 2) * 14, spot.name, { size: 12, anchor: "middle", fill: c });
      if (!before) s += `<path d="M${r1(x)} ${y + 12}V${116 + (i % 2) * 14}" stroke-width="0.6" stroke-dasharray="2 2"/>`;
    });
    return svg(460, 150, s, c);
  },
};

export const STRUCTURE_FIGURES: FigureDef[] = [aminoAcidFigure, peptideBondFigure, electrophoresisFigure];
