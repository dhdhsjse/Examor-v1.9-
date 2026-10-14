import type { Lang } from "./types";

// Words printed ON the exam paper (the app interface itself stays in English).
const WORDS = {
  fr: {
    true: "Vrai",
    false: "Faux",
    pts: (n: number) => `(${n} pt${n > 1 ? "s" : ""})`,
    school: "Établissement",
    subject: "Matière",
    level: "Niveau",
    duration: "Durée",
    year: "Année scolaire",
    name: "Nom et prénom",
    class: "Classe",
    score: "Note",
    key: "Corrigé",
  },
  ar: {
    true: "صحيح",
    false: "خطأ",
    pts: (n: number) => `(${n} ن)`,
    school: "المؤسسة",
    subject: "المادة",
    level: "المستوى",
    duration: "المدة",
    year: "السنة الدراسية",
    name: "الاسم الكامل",
    class: "القسم",
    score: "النقطة",
    key: "التصحيح",
  },
};

export function words(lang: Lang) {
  return WORDS[lang];
}

export const isRtl = (lang: Lang) => lang === "ar";

// Option labels: A B C... in French, أ ب ج... in Arabic.
const LABELS = { fr: ["A", "B", "C", "D", "E", "F"], ar: ["أ", "ب", "ج", "د", "هـ", "و"] };
export function optionLabel(i: number, lang: Lang): string {
  return LABELS[lang][i] ?? String(i + 1);
}
