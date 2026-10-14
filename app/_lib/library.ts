import { DIAGRAMS } from "./diagrams";
import type { Cycle, SchoolSubject } from "./subjects";

export type AssetKind = "diagram" | "table" | "image";

// One item of the smart library (right panel).
export interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  subjects: SchoolSubject[] | "all";
  cycles: Cycle[];
  years?: string[]; // missing = every year of its cycles
  svg?: string; // diagrams
  src?: string; // imported images (data URL)
  ratio?: number; // imported images
  cells?: string[][]; // tables
}

const empty = (rows: number, cols: number) => Array.from({ length: rows }, () => Array<string>(cols).fill(""));

export const BUILTIN_ASSETS: Asset[] = [
  // Math
  { id: "math-triangle", name: "Right triangle", kind: "diagram", subjects: ["Math"], cycles: ["college", "lycee"], svg: DIAGRAMS.triangle },
  { id: "math-circle", name: "Circle", kind: "diagram", subjects: ["Math"], cycles: ["primaire", "college"], svg: DIAGRAMS.circle },
  { id: "math-axes", name: "Coordinate plane", kind: "diagram", subjects: ["Math", "Physics"], cycles: ["college", "lycee"], svg: DIAGRAMS.axes },
  { id: "math-parabola", name: "Function curve", kind: "diagram", subjects: ["Math"], cycles: ["college", "lycee"], years: ["3AC", "TC", "1BAC", "2BAC"], svg: DIAGRAMS.parabola },
  { id: "math-numberline", name: "Number line", kind: "diagram", subjects: ["Math"], cycles: ["primaire", "college"], years: ["4AP", "5AP", "6AP", "1AC", "2AC"], svg: DIAGRAMS.numberLine },
  { id: "math-cube", name: "Cube", kind: "diagram", subjects: ["Math"], cycles: ["primaire", "college"], svg: DIAGRAMS.cube },
  { id: "math-grid", name: "Grid paper", kind: "diagram", subjects: "all", cycles: ["primaire", "college", "lycee"], svg: DIAGRAMS.grid },
  { id: "table-values", name: "Table of values", kind: "table", subjects: ["Math"], cycles: ["college", "lycee"], cells: [["x", "-2", "-1", "0", "1", "2"], ["f(x)", "", "", "", "", ""]] },
  // Physics
  { id: "phys-circuit", name: "Electric circuit", kind: "diagram", subjects: ["Physics"], cycles: ["primaire", "college"], svg: DIAGRAMS.circuit },
  { id: "phys-incline", name: "Inclined plane", kind: "diagram", subjects: ["Physics"], cycles: ["lycee"], svg: DIAGRAMS.incline },
  { id: "phys-thermometer", name: "Thermometer", kind: "diagram", subjects: ["Physics", "Sciences"], cycles: ["primaire", "college"], svg: DIAGRAMS.thermometer },
  { id: "phys-lens", name: "Converging lens", kind: "diagram", subjects: ["Physics"], cycles: ["college", "lycee"], years: ["3AC", "1BAC", "2BAC"], svg: DIAGRAMS.lens },
  { id: "table-units", name: "Quantities & units", kind: "table", subjects: ["Physics"], cycles: ["college", "lycee"], cells: [["Grandeur", "Symbole", "Unité", "Symbole de l'unité"], ...empty(3, 4)] },
  // Sciences
  { id: "sci-cell", name: "Plant cell", kind: "diagram", subjects: ["Sciences"], cycles: ["college", "lycee"], svg: DIAGRAMS.cell },
  { id: "sci-foodchain", name: "Food chain", kind: "diagram", subjects: ["Sciences"], cycles: ["primaire", "college"], svg: DIAGRAMS.foodChain },
  { id: "sci-watercycle", name: "Water cycle", kind: "diagram", subjects: ["Sciences"], cycles: ["primaire", "college"], svg: DIAGRAMS.waterCycle },
  { id: "table-classify", name: "Classification table", kind: "table", subjects: ["Sciences"], cycles: ["primaire", "college", "lycee"], cells: [["Être vivant", "Groupe", "Caractéristique"], ...empty(4, 3)] },
  // Languages
  { id: "table-conjugation", name: "Conjugation table", kind: "table", subjects: ["French"], cycles: ["primaire", "college"], cells: [["Pronom", "Présent", "Imparfait", "Futur"], ["je", "", "", ""], ["tu", "", "", ""], ["il / elle", "", "", ""], ["nous", "", "", ""], ["vous", "", "", ""], ["ils / elles", "", "", ""]] },
  { id: "table-irab", name: "I'rab table", kind: "table", subjects: ["Arabic"], cycles: ["primaire", "college", "lycee"], cells: [["الكلمة", "إعرابها"], ...empty(4, 2)] },
  // Everyone
  { id: "table-2x3", name: "Table 3 × 3", kind: "table", subjects: "all", cycles: ["primaire", "college", "lycee"], cells: empty(3, 3) },
  { id: "table-4x4", name: "Table 4 × 4", kind: "table", subjects: "all", cycles: ["primaire", "college", "lycee"], cells: empty(4, 4) },
];

export interface LibraryFilter {
  query: string;
  cycle: Cycle | "all";
  year: string | "all";
  subject: SchoolSubject | "all";
  kind: AssetKind | "all";
}

export function matchesFilter(a: Asset, f: LibraryFilter): boolean {
  if (f.kind !== "all" && a.kind !== f.kind) return false;
  if (f.cycle !== "all" && !a.cycles.includes(f.cycle)) return false;
  if (f.year !== "all" && a.years && !a.years.includes(f.year)) return false;
  if (f.subject !== "all" && a.subjects !== "all" && !a.subjects.includes(f.subject)) return false;
  return !f.query || a.name.toLowerCase().includes(f.query.toLowerCase());
}

// Size of an svg string (from its width/height attributes).
export function svgSize(svg: string): { w: number; h: number } {
  const w = Number(/width="([\d.]+)"/.exec(svg)?.[1] ?? 200);
  const h = Number(/height="([\d.]+)"/.exec(svg)?.[1] ?? 200);
  return { w, h };
}

export const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
