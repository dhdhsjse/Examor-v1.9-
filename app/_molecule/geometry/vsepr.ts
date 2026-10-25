// VSEPR: the geometry around one atom, and the "justify your answer" sentence.
// Pure templating: no free-form generation. The Arabic wording (and the Arabic element and geometry
// names) follow the product spec and still have to be checked by a chemistry teacher.
import { neighbors } from "../chem";
import type { MolGraph } from "../model";

export type Lang = "ar" | "fr" | "en";

export type GeometryId = "terminal" | "linear" | "trigonal-planar" | "bent" | "tetrahedral" | "trigonal-pyramidal" | "trigonal-bipyramidal" | "octahedral" | "unknown";

export interface GeometryAnalysis {
  atomId: string;
  element: string;
  X: number; // bonded groups: a double or triple bond counts as ONE group
  E: number; // lone pairs on the atom
  code: string; // "AX3", "AX2E", "AX2E2"
  geometry: GeometryId;
  idealAngles: number[]; // [120]
  neighbors: string[];
  multipleBonds: number; // how many of the X groups are double or triple bonds
}

// [geometry, ideal angles] by X:E
const TABLE: Record<string, [GeometryId, number[]]> = {
  "2:0": ["linear", [180]],
  "3:0": ["trigonal-planar", [120]],
  "2:1": ["bent", [120]], // slightly less than 120
  "4:0": ["tetrahedral", [109.5]],
  "3:1": ["trigonal-pyramidal", [107]],
  "2:2": ["bent", [104.5]],
  "5:0": ["trigonal-bipyramidal", [90, 120]],
  "6:0": ["octahedral", [90]],
};

export const GEOMETRY_NAMES: Record<GeometryId, Record<Lang, string>> = {
  terminal: { en: "no geometry (a terminal atom)", fr: "pas de géométrie (atome terminal)", ar: "لا توجد هندسة (ذرة طرفية)" },
  linear: { en: "linear", fr: "linéaire", ar: "خطي" },
  "trigonal-planar": { en: "trigonal planar", fr: "trigonale plane", ar: "مثلثي مستوي" },
  bent: { en: "bent", fr: "coudée", ar: "زاوي (منحني)" },
  tetrahedral: { en: "tetrahedral", fr: "tétraédrique", ar: "رباعي الأوجه" },
  "trigonal-pyramidal": { en: "trigonal pyramidal", fr: "pyramidale", ar: "هرمي" },
  "trigonal-bipyramidal": { en: "trigonal bipyramidal", fr: "bipyramidale à base triangulaire", ar: "ثنائي الهرم ثلاثي القاعدة" },
  octahedral: { en: "octahedral", fr: "octaédrique", ar: "ثماني الأوجه" },
  unknown: { en: "not covered at school level", fr: "hors programme", ar: "خارج المقرر" },
};

const ELEMENT_NAMES: Record<string, Record<Lang, string>> = {
  H: { en: "hydrogen", fr: "hydrogène", ar: "الهيدروجين" },
  C: { en: "carbon", fr: "carbone", ar: "الكربون" },
  N: { en: "nitrogen", fr: "azote", ar: "الآزوت" },
  O: { en: "oxygen", fr: "oxygène", ar: "الأكسجين" },
  F: { en: "fluorine", fr: "fluor", ar: "الفلور" },
  Cl: { en: "chlorine", fr: "chlore", ar: "الكلور" },
  Br: { en: "bromine", fr: "brome", ar: "البروم" },
  I: { en: "iodine", fr: "iode", ar: "اليود" },
  S: { en: "sulfur", fr: "soufre", ar: "الكبريت" },
  P: { en: "phosphorus", fr: "phosphore", ar: "الفوسفور" },
  B: { en: "boron", fr: "bore", ar: "البور" },
  Si: { en: "silicon", fr: "silicium", ar: "السيليسيوم" },
};

export function analyzeAtom(g: MolGraph, atomId: string): GeometryAnalysis {
  const atom = g.atoms.find((a) => a.id === atomId);
  if (!atom) throw new Error(`Unknown atom ${atomId}`);
  const around = neighbors(g, atomId);
  const X = around.length;
  const E = atom.lonePairs;
  const code = `AX${X}${E === 0 ? "" : E === 1 ? "E" : `E${E}`}`;
  const [geometry, idealAngles]: [GeometryId, number[]] = X < 2 ? ["terminal", []] : (TABLE[`${X}:${E}`] ?? ["unknown", []]);
  return { atomId, element: atom.element, X, E, code, geometry, idealAngles, neighbors: around.map((n) => n.atom.id), multipleBonds: around.filter((n) => n.bond.order > 1).length };
}

const elementName = (el: string, lang: Lang) => ELEMENT_NAMES[el]?.[lang] ?? el;
const startsWithVowel = (s: string) => /^[aeiouyéèh]/i.test(s);

function angleText(a: GeometryAnalysis, lang: Lang): string {
  if (!a.idealAngles.length) return "";
  const n = (x: number) => (lang === "fr" ? String(x).replace(".", ",") : String(x));
  if (a.geometry === "bent" && a.E === 1) return lang === "en" ? "slightly less than 120°" : lang === "fr" ? "légèrement inférieurs à 120°" : "أقل قليلًا من 120°";
  if (a.idealAngles.length === 2) return lang === "ar" ? `${a.idealAngles[0]}° و${a.idealAngles[1]}°` : lang === "fr" ? `${a.idealAngles[0]}° et ${a.idealAngles[1]}°` : `${a.idealAngles[0]}° and ${a.idealAngles[1]}°`;
  const approx = a.geometry === "trigonal-pyramidal" || (a.geometry === "bent" && a.E === 2);
  const v = `${n(a.idealAngles[0])}°`;
  return approx ? (lang === "en" ? `about ${v}` : lang === "fr" ? `d'environ ${v}` : `حوالي ${v}`) : v;
}

function groupsPhrase(X: number, multi: number, lang: Lang): string {
  if (lang === "en") return `${X} bonded group${X > 1 ? "s" : ""}${multi ? " (a double or triple bond counts as one group)" : ""}`;
  if (lang === "fr") return `${X} groupe${X > 1 ? "s" : ""} liant${X > 1 ? "s" : ""}${multi ? " (une liaison double ou triple compte pour un seul groupe)" : ""}`;
  const g = X === 1 ? "مجموعة رابطة واحدة" : X === 2 ? "مجموعتان رابطتان" : `${X} مجموعات رابطة`;
  return g + (multi ? " (الرابطة المزدوجة أو الثلاثية تُحسب مجموعة واحدة)" : "");
}

function lonePhrase(E: number, lang: Lang): string {
  if (lang === "en") return E === 0 ? "no lone pair" : `${E} lone pair${E > 1 ? "s" : ""}`;
  if (lang === "fr") return E === 0 ? "aucun doublet non liant" : `${E} doublet${E > 1 ? "s" : ""} non liant${E > 1 ? "s" : ""}`;
  return E === 0 ? "لا يوجد زوج غير رابط" : E === 1 ? "زوج واحد غير رابط" : E === 2 ? "زوجان غير رابطين" : `${E} أزواج غير رابطة`;
}

// The sentence of the answer key: number of groups, lone pairs, therefore AXnEm, therefore geometry and angle.
export function explainGeometry(a: GeometryAnalysis, lang: Lang): string {
  const el = elementName(a.element, lang);
  const groups = groupsPhrase(a.X, a.multipleBonds, lang);
  const lone = lonePhrase(a.E, lang);
  const geom = GEOMETRY_NAMES[a.geometry][lang];
  if (a.geometry === "terminal") {
    return lang === "en"
      ? `The ${el} atom has only ${a.X} bonded group: it is at the end of the molecule, so there is no geometry to describe around it.`
      : lang === "fr"
        ? `L'atome ${startsWithVowel(el) ? "d'" : "de "}${el} n'a que ${a.X} groupe liant : il est en bout de molécule, il n'y a donc pas de géométrie à décrire autour de lui.`
        : `ذرة ${el} لها مجموعة رابطة واحدة فقط: فهي في طرف الجزيء، فلا توجد هندسة تُوصف حولها.`;
  }
  if (a.geometry === "unknown") {
    return lang === "en"
      ? `Around the ${el} atom there are ${groups} and ${lone}: type ${a.code}, a geometry that is not part of the school programme.`
      : lang === "fr"
        ? `Autour de l'atome ${startsWithVowel(el) ? "d'" : "de "}${el} il y a ${groups} et ${lone} : type ${a.code}, une géométrie hors programme.`
        : `حول ذرة ${el} توجد ${groups} و${lone}: النمط ${a.code}، وهي هندسة خارج المقرر.`;
  }
  const angle = angleText(a, lang);
  if (lang === "en") return `Around the ${el} atom (the central atom) there are ${groups} and ${lone}, so it is of type ${a.code}: the geometry is ${geom}, with bond angles of ${angle}.`;
  if (lang === "fr") return `Autour de l'atome ${startsWithVowel(el) ? "d'" : "de "}${el} (l'atome central) il y a ${groups} et ${lone} : il est donc de type ${a.code}, la géométrie est ${geom}, avec des angles de liaison ${angle}.`;
  return `حول ذرة ${el} (الذرة المركزية) توجد ${groups}، و${lone}. إذن النمط هو ${a.code}، والهندسة ${geom}، وزوايا الروابط ${angle}.`;
}
