// Protein synthesis: a DNA molecule (two strands), transcription and translation.
import { bool, ink, r1, str, svg, type Pt } from "../svg";
import type { FigureDef } from "../types";
import { arrow, say } from "./draw";
import { cleanDNA, complement } from "./genetic";
import { labeledFigure } from "./labeled";

// ---- DNA: the two strands, their bases paired ----
export const dnaStrandsFigure: FigureDef = {
  id: "sci-dna-strands",
  name: "DNA molecule",
  hint: "Type the bases of one strand: the other strand is its complement.",
  params: [
    { key: "seq", label: "DNA sequence", kind: "text", placeholder: "ATGCCG…" },
    { key: "blank", label: "Second strand to fill", kind: "bool" },
    { key: "bonds", label: "Hydrogen bonds (2 or 3)", kind: "bool" },
    { key: "ends", label: "5' and 3' ends", kind: "bool" },
  ],
  defaults: () => ({ seq: "ATGCCGTTAGCA", blank: false, bonds: true, ends: true }),
  build: (p) => {
    const c = ink(p);
    const top = Array.from(cleanDNA(str(p, "seq")).slice(0, 40) || "ATGC");
    const bottom = Array.from(complement(top.join("")));
    const blank = bool(p, "blank");
    const ends = bool(p, "ends");
    const x0 = ends ? 34 : 12;
    const step = 24;
    const w = top.length * step;
    let s = `<path d="M${x0 - 4} 20H${x0 + w}M${x0 - 4} 96H${x0 + w}" stroke-width="3"/>`;
    top.forEach((b, i) => {
      const x = x0 + i * step + 4;
      s += `<path d="M${x + 8} 20V26M${x + 8} 90V96" stroke-width="2"/>`;
      s += `<rect x="${x}" y="26" width="16" height="24" rx="2" fill="#ffffff" stroke-width="1.4"/><rect x="${x}" y="66" width="16" height="24" rx="2" fill="#ffffff" stroke-width="1.4"/>`;
      s += say(x + 8, 43, b, { size: 13, anchor: "middle", fill: c, bold: true });
      if (!blank) s += say(x + 8, 83, bottom[i], { size: 13, anchor: "middle", fill: c, bold: true });
      if (bool(p, "bonds")) {
        const n = b === "C" || b === "G" ? 3 : 2;
        for (let k = 0; k < n; k++) s += `<path d="M${r1(x + 8 + (k - (n - 1) / 2) * 4.5)} 53V63" stroke-width="1.2" stroke-dasharray="2 2"/>`;
      }
    });
    if (ends) {
      s += say(4, 25, "5'", { size: 12, fill: c, bold: true }) + say(x0 + w + 6, 25, "3'", { size: 12, fill: c, bold: true });
      s += say(4, 101, "3'", { size: 12, fill: c, bold: true }) + say(x0 + w + 6, 101, "5'", { size: 12, fill: c, bold: true });
    }
    return svg(x0 + w + (ends ? 26 : 10), 110, s, c);
  },
};

// ---- Transcription ----
function transcription(c: string) {
  let s = `<ellipse cx="196" cy="104" rx="54" ry="46" fill="#f4f4f5" stroke-width="1.6"/>`;
  s += `<path d="M10 100H120C140 100 150 62 182 62C212 62 222 100 242 100H332" stroke-width="2.6"/>`;
  s += `<path d="M10 122H120C140 122 152 136 182 136C212 136 222 122 242 122H332" stroke-width="2.6"/>`;
  for (let x = 16; x <= 116; x += 10) s += `<path d="M${x} 100V122" stroke-width="1.2"/>`;
  for (let x = 248; x <= 328; x += 10) s += `<path d="M${x} 100V122" stroke-width="1.2"/>`;
  // mRNA: paired with the transcribed strand in the bubble, then free
  s += `<path d="M232 118C214 124 196 126 176 125C156 124 146 112 132 90C116 66 86 44 40 34" stroke-width="2.6" stroke-dasharray="7 2"/>`;
  for (let x = 168; x <= 226; x += 9) s += `<path d="M${x} ${x < 200 ? 126 : 124}V${x < 200 ? 135 : 131}" stroke-width="1.1"/>`;
  // free ribonucleotides
  for (const [x, y] of [
    [272, 54],
    [292, 70],
    [256, 36],
    [306, 44],
    [282, 28],
  ])
    s += `<path d="M${x} ${y}v8" stroke-width="1.6"/><circle cx="${x}" cy="${y}" r="3.2" fill="${c}" stroke="none"/>`;
  s += arrow([240, 176], [300, 176], c, `stroke-width="1.8"`);
  return s;
}

export const transcriptionFigure = labeledFigure({
  id: "sci-transcription",
  name: "Transcription",
  w: 340,
  h: 190,
  draw: (_, c) => transcription(c),
  parts: [
    { key: "dna", at: [50, 111], side: "l", fr: "ADN", ar: "ADN" },
    { key: "mrna", at: [70, 40], side: "l", fr: "ARNm", ar: "ARNm" },
    { key: "coding", at: [170, 63], side: "t", fr: "Brin non transcrit", ar: "السلسلة غير المستنسخة" },
    { key: "nucleotides", at: [292, 70], side: "r", fr: "Ribonucléotides libres", ar: "نيكليوتيدات ريبية حرة" },
    { key: "pol", at: [244, 86], side: "r", fr: "ARN polymérase", ar: "إنزيم ARN بوليميراز" },
    { key: "template", at: [290, 122], side: "r", fr: "Brin transcrit", ar: "السلسلة المستنسخة" },
    { key: "direction", at: [270, 176], side: "r", fr: "Sens de la transcription", ar: "اتجاه الاستنساخ" },
  ],
});

// ---- Translation ----
const MRNA = "AUGUUUGCACCAAGUGGCUUAGAUCGAUAA";
function trna(x: number, c: string) {
  return (
    `<path d="M${x} 146V134" stroke-width="2"/><circle cx="${x}" cy="127" r="7.5" fill="#ffffff" stroke-width="1.8"/>` +
    `<circle cx="${x - 11}" cy="162" r="6" fill="#ffffff" stroke-width="1.4"/><circle cx="${x + 11}" cy="162" r="6" fill="#ffffff" stroke-width="1.4"/>` +
    `<rect x="${x - 6}" y="146" width="12" height="40" rx="3" fill="#ffffff" stroke-width="1.6"/>` +
    `<rect x="${x - 11}" y="186" width="22" height="10" fill="#ffffff" stroke-width="1.4"/><path d="M${x - 3.7} 186v10M${x + 3.7} 186v10" stroke-width="1"/>` +
    `<path d="M${x - 11} 196h22" stroke="${c}" stroke-width="1.4"/>`
  );
}

function translation(bases: boolean, c: string) {
  let s = `<ellipse cx="180" cy="212" rx="80" ry="15" fill="#ffffff" stroke-width="1.8"/>`;
  s += `<path d="M102 198Q92 112 168 100Q262 90 260 172Q260 196 250 198Z" fill="#ffffff" stroke-width="1.8"/>`;
  // the mRNA and its codons
  s += `<path d="M8 204H352" stroke-width="2.6"/>`;
  for (let i = 0; i < MRNA.length; i++) {
    const x = 10 + i * 7.6;
    if (i % 3 === 0) s += `<path d="M${r1(x - 1)} 198V210" stroke-width="1"/>`;
    if (bases) s += say(x + 3, 240, MRNA[i], { size: 8, anchor: "middle", fill: c });
  }
  s += `<path d="M${r1(10 + 27 * 7.6 - 1)} 198V210" stroke-width="1"/>`;
  // two tRNAs in the ribosome, the chain on the first one
  s += trna(158, c) + trna(204, c);
  s += `<path d="M165 127H197" stroke-width="1.4" stroke-dasharray="3 3"/>`;
  const chain: Pt[] = [
    [146, 114],
    [136, 100],
    [126, 86],
    [116, 72],
    [104, 60],
    [90, 52],
    [76, 46],
  ];
  let prev: Pt = [158, 127];
  for (const pt of chain) {
    s += `<path d="M${prev[0]} ${prev[1]}L${pt[0]} ${pt[1]}" stroke-width="1.6"/>`;
    prev = pt;
  }
  s += [...chain].reverse().map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="#ffffff" stroke-width="1.6"/>`).join("") + `<circle cx="158" cy="127" r="7.5" fill="#ffffff" stroke-width="1.8"/>`;
  // a tRNA coming with its amino acid
  s += `<g transform="translate(140 -60)">${trna(170, c)}</g>`;
  s += arrow([296, 140], [262, 150], c, `stroke-width="1.4"`);
  s += arrow([230, 256], [290, 256], c, `stroke-width="1.6"`);
  return s;
}

export const translationFigure = labeledFigure({
  id: "sci-translation",
  name: "Translation",
  params: [{ key: "bases", label: "Bases of the mRNA", kind: "bool" }],
  defaults: { bases: false },
  w: 360,
  h: 262,
  draw: (p, c) => translation(bool(p, "bases"), c),
  parts: [
    { key: "chain", at: [104, 60], side: "l", fr: "Chaîne polypeptidique", ar: "سلسلة ببتيدية" },
    { key: "aa", at: [146, 114], side: "l", fr: "Acide aminé", ar: "حمض أميني" },
    { key: "mrna", at: [40, 204], side: "l", fr: "ARNm", ar: "ARNm" },
    { key: "small", at: [116, 222], side: "l", fr: "Petite sous-unité du ribosome", ar: "تحت الوحدة الصغرى للريبوزوم" },
    { key: "large", at: [244, 120], side: "r", fr: "Grande sous-unité du ribosome", ar: "تحت الوحدة الكبرى للريبوزوم" },
    { key: "bond", at: [181, 127], side: "t", fr: "Liaison peptidique", ar: "رابطة ببتيدية" },
    { key: "trna", at: [326, 96], side: "r", fr: "ARNt", ar: "ARNt" },
    { key: "anticodon", at: [214, 191], side: "r", fr: "Anticodon", ar: "الرامزة المضادة" },
    { key: "codon", at: [314, 204], side: "r", fr: "Codon", ar: "رامزة" },
    { key: "direction", at: [270, 256], side: "r", fr: "Sens de la traduction", ar: "اتجاه الترجمة" },
  ],
});

export const SYNTHESIS_FIGURES: FigureDef[] = [dnaStrandsFigure, transcriptionFigure, translationFigure];
