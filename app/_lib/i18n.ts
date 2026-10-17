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
    lastName: "Nom",
    firstName: "Prénom",
    number: "N°",
    date: "Date",
    appreciation: "Appréciation",
    signature: "Signature des parents",
    teacher: "Visa du professeur",
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
    lastName: "النسب",
    firstName: "الاسم",
    number: "الرقم",
    date: "التاريخ",
    appreciation: "الملاحظة",
    signature: "توقيع ولي الأمر",
    teacher: "توقيع الأستاذ(ة)",
  },
};

// Languages an exam paper can be written in, as offered in Exam settings. Adding one here also
// needs its words above, its option labels below and its value in `Lang` (types.ts).
export const EXAM_LANGS: { value: Lang; label: string }[] = [
  { value: "fr", label: "Français" },
  { value: "ar", label: "العربية" },
];

export function words(lang: Lang) {
  return WORDS[lang];
}

export const isRtl = (lang: Lang) => lang === "ar";

// Option labels: A B C... in French, أ ب ج... in Arabic.
const LABELS = { fr: ["A", "B", "C", "D", "E", "F", "G", "H"], ar: ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"] };
export function optionLabel(i: number, lang: Lang): string {
  return LABELS[lang][i] ?? String(i + 1);
}
