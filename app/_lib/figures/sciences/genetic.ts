// DNA, RNA and the genetic code, for the figures that write sequences (mutations, the DNA strand).

const BASES = "UCAG";
// The standard genetic code: [first base][second base] → the amino acids of the 4 codons (third base U, C, A, G).
const TABLE = [
  [["Phe", "Phe", "Leu", "Leu"], ["Ser", "Ser", "Ser", "Ser"], ["Tyr", "Tyr", "Stop", "Stop"], ["Cys", "Cys", "Stop", "Trp"]],
  [["Leu", "Leu", "Leu", "Leu"], ["Pro", "Pro", "Pro", "Pro"], ["His", "His", "Gln", "Gln"], ["Arg", "Arg", "Arg", "Arg"]],
  [["Ile", "Ile", "Ile", "Met"], ["Thr", "Thr", "Thr", "Thr"], ["Asn", "Asn", "Lys", "Lys"], ["Ser", "Ser", "Arg", "Arg"]],
  [["Val", "Val", "Val", "Val"], ["Ala", "Ala", "Ala", "Ala"], ["Asp", "Asp", "Glu", "Glu"], ["Gly", "Gly", "Gly", "Gly"]],
];

export const CODONS: Record<string, string> = {};
for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) CODONS[BASES[a] + BASES[b] + BASES[c]] = TABLE[a][b][c];

// The amino acid of an mRNA codon ("" for an incomplete one).
export const aminoAcid = (codon: string) => CODONS[codon] ?? "";

// Only the bases of a typed sequence: "tac cga-ttg" → "TACCGATTG".
export const cleanDNA = (s: string) => s.toUpperCase().replace(/U/g, "T").replace(/[^ATCG]/g, "");

const PAIR: Record<string, string> = { A: "T", T: "A", C: "G", G: "C" };
export const complement = (dna: string) => Array.from(dna, (b) => PAIR[b] ?? b).join("");

// The mRNA of a DNA strand: copied from the transcribed strand (its complement), or the same as the other strand with U for T.
export const toRNA = (dna: string, transcribed: boolean) => Array.from(dna, (b) => (transcribed ? { A: "U", T: "A", C: "G", G: "C" }[b] : b === "T" ? "U" : b) ?? b).join("");

export const codonsOf = (rna: string) => Array.from({ length: Math.ceil(rna.length / 3) }, (_, i) => rna.slice(i * 3, i * 3 + 3));
