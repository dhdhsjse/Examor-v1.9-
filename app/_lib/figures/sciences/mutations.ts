// Mutations and biological diversity: a gene mutation on a typed sequence, chromosome mutations, the human karyotype.
import { bool, ink, num, r1, str, svg } from "../svg";
import type { FigureDef } from "../types";
import type { Lang } from "../../types";
import { arrow, say, textWidth } from "./draw";
import { aminoAcid, cleanDNA, codonsOf, toRNA } from "./genetic";
import { LABEL_MODES } from "./labeled";

// ---- A gene mutation: the normal and the mutated allele, their mRNA and amino acids ----
const SEQ_TEXT: Record<Lang, { normal: string; mutated: string; dnaT: string; dnaN: string; rna: string; aa: string }> = {
  fr: { normal: "Allèle normal", mutated: "Allèle muté", dnaT: "ADN (brin transcrit)", dnaN: "ADN (brin non transcrit)", rna: "ARNm", aa: "Acides aminés" },
  ar: { normal: "الأليل العادي", mutated: "الأليل الطافر", dnaT: "ADN (السلسلة المستنسخة)", dnaN: "ADN (السلسلة غير المستنسخة)", rna: "ARNm", aa: "الأحماض الأمينية" },
};

export function mutate(dna: string, type: string, pos: number, base: string): { seq: string; at: number } {
  const i = Math.max(0, Math.min(dna.length - (type === "insertion" ? 0 : 1), Math.round(pos) - 1));
  const b = cleanDNA(base)[0] ?? "A";
  if (type === "deletion") return { seq: dna.slice(0, i) + dna.slice(i + 1), at: i };
  if (type === "insertion") return { seq: dna.slice(0, i) + b + dna.slice(i), at: i };
  // a substitution always changes the base
  const other = b !== dna[i] ? b : ({ A: "G", G: "A", C: "T", T: "C" } as Record<string, string>)[dna[i]] ?? "A";
  return { seq: dna.slice(0, i) + other + dna.slice(i + 1), at: i };
}

const CW = 15; // a base
const CG = 6; // between codons
const cellX = (i: number) => i * CW + Math.floor(i / 3) * CG;

export const geneMutationFigure: FigureDef = {
  id: "sci-gene-mutation",
  name: "Gene mutation",
  hint: "Type the DNA sequence: the mRNA and the amino acids follow it.",
  params: [
    { key: "seq", label: "DNA sequence", kind: "text", placeholder: "TAC AAA CGT…" },
    {
      key: "strand",
      label: "The sequence is",
      kind: "select",
      options: [
        { value: "transcribed", label: "The transcribed strand" },
        { value: "coding", label: "The non-transcribed strand" },
      ],
    },
    {
      key: "type",
      label: "Mutation",
      kind: "select",
      options: [
        { value: "substitution", label: "Substitution" },
        { value: "deletion", label: "Deletion" },
        { value: "insertion", label: "Insertion" },
      ],
    },
    { key: "pos", label: "Position", kind: "number", min: 1, max: 90, row: "where" },
    { key: "base", label: "New base", kind: "text", row: "where", when: (p) => p.type !== "deletion" },
    {
      key: "rows",
      label: "Rows",
      kind: "select",
      options: [
        { value: "dna", label: "DNA" },
        { value: "rna", label: "DNA and mRNA" },
        { value: "all", label: "DNA, mRNA and amino acids" },
      ],
    },
    { key: "blank", label: "mRNA and amino acids to fill", kind: "bool", when: (p) => p.rows !== "dna" },
    { key: "mark", label: "Mark the change", kind: "bool" },
  ],
  defaults: () => ({ seq: "TAC AAA CGT GGT TCA ACT", strand: "transcribed", type: "substitution", pos: 5, base: "T", rows: "all", blank: false, mark: true }),
  build: (p, lang) => {
    const c = ink(p);
    const T = SEQ_TEXT[lang] ?? SEQ_TEXT.fr;
    const dna = cleanDNA(str(p, "seq")) || "TACAAACGTGGTTCAACT";
    const transcribed = str(p, "strand", "transcribed") !== "coding";
    const type = str(p, "type", "substitution");
    const { seq: mutated, at } = mutate(dna, type, num(p, "pos", 1), str(p, "base", "A"));
    const rows = str(p, "rows", "all");
    const blank = bool(p, "blank");
    const mark = bool(p, "mark");
    const rtl = lang === "ar";
    const titles = [transcribed ? T.dnaT : T.dnaN, T.rna, T.aa, T.normal, T.mutated];
    const titleW = Math.max(...titles.map((t) => textWidth(t, 12))) + 14;
    const longest = Math.max(dna.length, mutated.length);
    const seqW = cellX(longest - 1) + CW;
    const x0 = rtl ? 10 : titleW + 6; // the sequences
    const tx = rtl ? x0 + seqW + titleW + 4 : titleW - 4; // the row titles end there (on the right in Arabic)
    let s = "";
    let y = 6;
    const title = (text: string, bold = false) => say(tx, y + 15, text, { size: 12, anchor: "end", fill: c, bold });
    const strip = (letters: string[], hl: number) =>
      letters
        .map((l, i) => {
          const x = x0 + cellX(i);
          const on = mark && i === hl;
          return `<rect x="${r1(x)}" y="${y}" width="${CW}" height="20" fill="${on ? "#d4d4d8" : "#ffffff"}" stroke-width="${on ? 2.2 : 1}"/>` + say(x + CW / 2, y + 15, l, { size: 12, anchor: "middle", fill: c, bold: on });
        })
        .join("");
    for (const [name, seq, hl] of [
      [T.normal, dna, type === "deletion" ? at : -1],
      [T.mutated, mutated, type === "deletion" ? -1 : at],
    ] as [string, string, number][]) {
      s += title(name, true);
      y += 24;
      s += title(titles[0]) + strip(Array.from(seq), hl);
      y += 24;
      if (rows === "dna") {
        y += 8;
        continue;
      }
      const rna = toRNA(seq, transcribed);
      s += title(T.rna) + strip(Array.from(rna, (b) => (blank ? "" : b)), -1);
      y += 24;
      if (rows === "all") {
        s += title(T.aa);
        let stopped = false;
        codonsOf(rna).forEach((codon, k) => {
          const x = x0 + cellX(k * 3);
          const w = Math.min(3, rna.length - k * 3) * CW;
          const aa = codon.length === 3 && !stopped ? aminoAcid(codon) : "";
          if (aa === "Stop") stopped = true;
          s += `<rect x="${r1(x)}" y="${y}" width="${w}" height="20" rx="9" fill="#ffffff" stroke-width="1"/>`;
          if (!blank && aa) s += say(x + w / 2, y + 14.5, aa, { size: 11, anchor: "middle", fill: c });
        });
        y += 24;
      }
      y += 8;
    }
    return svg(rtl ? tx + 6 : x0 + seqW + 10, y, s, c);
  },
};

// ---- Chromosome mutations: deletion, duplication, inversion, translocation ----
const KINDS = ["deletion", "duplication", "inversion", "translocation"] as const;
const KIND_NAMES: Record<Lang, string[]> = {
  fr: ["Délétion", "Duplication", "Inversion", "Translocation"],
  ar: ["الحذف", "التضاعف", "الانقلاب", "الانتقال"],
};
// Genes of the chromosomes: "|" is the centromere, lower case is a changed segment (drawn grey).
const BEFORE: Record<string, string[]> = { deletion: ["AB|CdEF"], duplication: ["AB|CdeF"], inversion: ["AB|CdeF"], translocation: ["AB|CDef", "MN|OPqr"] };
const AFTER: Record<string, string[]> = { deletion: ["AB|CEF"], duplication: ["AB|CdedeF"], inversion: ["AB|CedF"], translocation: ["AB|CDqr", "MN|OPef"] };

const SEG = 17;
function chromosomeBar(x: number, y: number, genes: string, c: string) {
  let s = "";
  let cx = x;
  const segs = Array.from(genes);
  const width = segs.reduce((w, g) => w + (g === "|" ? 8 : SEG), 0);
  s += `<rect x="${x}" y="${y}" width="${width}" height="20" rx="9" fill="#ffffff" stroke-width="1.8"/>`;
  segs.forEach((g, i) => {
    if (g === "|") {
      s += `<rect x="${cx - 1}" y="${y - 2}" width="10" height="24" fill="#ffffff" stroke="none"/><path d="M${cx} ${y}Q${cx + 4} ${y + 6} ${cx + 8} ${y}M${cx} ${y + 20}Q${cx + 4} ${y + 14} ${cx + 8} ${y + 20}" stroke-width="1.8"/><circle cx="${cx + 4}" cy="${y + 10}" r="2.6" fill="${c}" stroke="none"/>`;
      cx += 8;
      return;
    }
    const changed = g !== g.toUpperCase();
    if (changed) s += `<rect x="${cx + 0.8}" y="${y + 0.8}" width="${SEG - 1.6}" height="18.4" fill="#d4d4d8" stroke="none"/>`;
    if (i > 0 && segs[i - 1] !== "|") s += `<path d="M${cx} ${y}V${y + 20}" stroke-width="1"/>`;
    s += say(cx + SEG / 2, y + 14.5, g.toUpperCase(), { size: 11, anchor: "middle", fill: c, bold: changed });
    cx += SEG;
  });
  return { svg: s, width };
}

export const chromosomeMutationFigure: FigureDef = {
  id: "sci-chromosome-mutation",
  name: "Chromosome mutations",
  params: [
    {
      key: "kind",
      label: "Mutation",
      kind: "select",
      options: [
        { value: "all", label: "All four" },
        { value: "deletion", label: "Deletion" },
        { value: "duplication", label: "Duplication" },
        { value: "inversion", label: "Inversion" },
        { value: "translocation", label: "Translocation" },
      ],
    },
    { key: "labels", label: "Labels", kind: "select", options: LABEL_MODES },
  ],
  defaults: () => ({ kind: "all", labels: "numbers" }),
  build: (p, lang) => {
    const c = ink(p);
    const mode = str(p, "labels", "numbers");
    const kind = str(p, "kind", "all");
    const list = kind === "all" ? [...KINDS] : KINDS.filter((k) => k === kind);
    const names = KIND_NAMES[lang] ?? KIND_NAMES.fr;
    const W = 168;
    let s = "";
    // (the names go under the tallest panel)
    const H = Math.max(...list.map((k) => 8 + BEFORE[k].length * 28 + 30 + AFTER[k].length * 28));
    list.forEach((k, i) => {
      const x = i * (W + 12) + 8;
      let y = 8;
      for (const g of BEFORE[k]) {
        s += chromosomeBar(x, y, g, c).svg;
        y += 28;
      }
      s += arrow([x + 60, y], [x + 60, y + 22], c, `stroke-width="1.6"`);
      y += 30;
      for (const g of AFTER[k]) {
        s += chromosomeBar(x, y, g, c).svg;
        y += 28;
      }
      const n = KINDS.indexOf(k);
      const word = mode === "names" ? names[n] : mode === "lines" ? `${i + 1} ……………` : mode === "numbers" ? String(i + 1) : "";
      s += say(x + 60, H + 14, word, { size: mode === "numbers" ? 14 : 12, anchor: "middle", fill: c, bold: mode !== "names" && mode !== "lines" });
    });
    return svg(list.length * (W + 12), mode === "none" ? H : H + 24, s, c);
  },
};

// ---- The human karyotype ----
// Relative length and the share of the short arm of each chromosome (1 … 22, X, Y).
const KARYO: Record<string, [number, number]> = {
  1: [249, 0.48], 2: [243, 0.39], 3: [198, 0.47], 4: [191, 0.27], 5: [181, 0.26], 6: [171, 0.39], 7: [159, 0.38], 8: [146, 0.32],
  9: [141, 0.33], 10: [136, 0.3], 11: [135, 0.39], 12: [133, 0.26], 13: [115, 0.14], 14: [107, 0.14], 15: [102, 0.16], 16: [90, 0.42],
  17: [83, 0.3], 18: [80, 0.26], 19: [59, 0.45], 20: [64, 0.43], 21: [47, 0.22], 22: [51, 0.24], X: [156, 0.38], Y: [57, 0.2],
};
const ROWS = [
  ["1", "2", "3", "4", "5"],
  ["6", "7", "8", "9", "10", "11", "12"],
  ["13", "14", "15", "16", "17", "18"],
  ["19", "20", "21", "22", "sex"],
];

// One chromosome (two chromatids) standing on its centromere's line.
function karyoChromosome(x: number, base: number, name: string, c: string) {
  const [len, p] = KARYO[name];
  const h = (len / 249) * 64;
  const top = base - h;
  const cen = top + h * p;
  const ch = (dx: number) =>
    `<path d="M${r1(x + dx - 2.6)} ${r1(top + 2)}Q${r1(x + dx)} ${r1(top - 1)} ${r1(x + dx + 2.6)} ${r1(top + 2)}L${r1(x + dx + 2.2)} ${r1(cen)}L${r1(x + dx + 2.6)} ${r1(base - 2)}Q${r1(x + dx)} ${r1(base + 1)} ${r1(x + dx - 2.6)} ${r1(base - 2)}L${r1(x + dx - 2.2)} ${r1(cen)}Z" fill="#ffffff" stroke-width="1.1"/>`;
  // a few dark bands
  let bands = "";
  const seed = Number(name) || (name === "X" ? 23 : 24);
  for (let k = 1; k <= 3; k++) {
    const yb = top + ((((seed * 7 + k * 13) % 10) + k * 6) / 30) * h;
    if (Math.abs(yb - cen) > 3 && yb < base - 3) bands += `<path d="M${r1(x - 4.5)} ${r1(yb)}h9" stroke-width="2"/>`;
  }
  return ch(-2.8) + ch(2.8) + bands + `<circle cx="${r1(x)}" cy="${r1(cen)}" r="1.7" fill="${c}" stroke="none"/>`;
}

export const karyotypeFigure: FigureDef = {
  id: "sci-karyotype",
  name: "Karyotype",
  params: [
    {
      key: "sex",
      label: "Sex chromosomes",
      kind: "select",
      options: [
        { value: "XY", label: "XY (man)" },
        { value: "XX", label: "XX (woman)" },
        { value: "X0", label: "X (Turner)" },
        { value: "XXY", label: "XXY (Klinefelter)" },
      ],
    },
    {
      key: "trisomy",
      label: "Trisomy",
      kind: "select",
      options: [
        { value: "none", label: "None" },
        { value: "21", label: "21" },
        { value: "18", label: "18" },
        { value: "13", label: "13" },
      ],
    },
    { key: "numbers", label: "Numbers of the pairs", kind: "bool" },
  ],
  defaults: () => ({ sex: "XY", trisomy: "none", numbers: true }),
  build: (p) => {
    const c = ink(p);
    const tri = str(p, "trisomy", "none");
    const sex = str(p, "sex", "XY");
    const numbers = bool(p, "numbers");
    let s = "";
    const rowBase = [80, 168, 248, 316];
    let W = 0;
    ROWS.forEach((row, r) => {
      let x = 14;
      for (const name of row) {
        const set = name === "sex" ? (sex === "X0" ? ["X"] : Array.from(sex)) : Array(name === tri ? 3 : 2).fill(name);
        const start = x;
        for (const one of set) {
          s += karyoChromosome(x + 6, rowBase[r], one, c);
          x += 15;
        }
        const mid = (start + x - 3) / 2;
        s += `<path d="M${r1(start)} ${rowBase[r] + 4}H${r1(x - 3)}" stroke-width="1"/>`;
        if (numbers) s += say(mid + 3, rowBase[r] + 17, name === "sex" ? sex.replace("0", "") : name, { size: 11, anchor: "middle", fill: c });
        x += 14;
      }
      W = Math.max(W, x);
    });
    return svg(W + 6, 340, s, c);
  },
};

export const MUTATION_FIGURES: FigureDef[] = [geneMutationFigure, chromosomeMutationFigure, karyotypeFigure];
