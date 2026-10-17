import type { BlockPreset } from "./blocks";
import type { Params } from "./figures";
import type { Cycle, SchoolSubject } from "./subjects";
import type { BlockType } from "./types";

// "block" = a block the teacher saved (My blocks).
export type AssetKind = "diagram" | "table" | "image" | "block";

// One item of the smart library (right panel).
export interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  subjects: SchoolSubject[] | "all";
  cycles: Cycle[];
  years?: string[]; // missing = every year of its cycles
  figure?: { id: string; params?: Params }; // diagrams drawn from settings (see figures/), editable on the page
  svg?: string; // a fixed drawing (or the preview of a `block` item)
  src?: string; // imported images (data URL)
  ratio?: number; // imported images
  cells?: string[][]; // tables
  block?: { type: BlockType; preset: BlockPreset }; // saved blocks, and ready-made blocks
}

const empty = (rows: number, cols: number) => Array.from({ length: rows }, () => Array<string>(cols).fill(""));
const ALL3: Cycle[] = ["primaire", "college", "lycee"];

// Preview of the "Function curve" item (it adds a function graph, edited with its formulas).
const CURVE_PREVIEW = (() => {
  let pts = "";
  for (let x = -3.2; x <= 3.2; x += 0.2) pts += `${(130 + x * 30).toFixed(1)},${(130 - (0.5 * x * x - 2) * 30).toFixed(1)} `;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 260" width="260" height="260" fill="none" stroke="#111" stroke-width="2"><path d="M10 130H250M130 250V10" /><polyline points="${pts}" stroke="#4f46e5" stroke-width="3"/></svg>`;
})();

const fig = (id: string, params?: Params) => ({ id, params });

export const BUILTIN_ASSETS: Asset[] = [
  // Math
  { id: "math-triangle", name: "Right triangle", kind: "diagram", subjects: ["Math"], cycles: ["college", "lycee"], figure: fig("triangle") },
  { id: "math-triangle-any", name: "Triangle", kind: "diagram", subjects: ["Math"], cycles: ALL3, figure: fig("triangle", { shape: "custom", A: 50, B: 60, C: 70, values: true }) },
  { id: "math-quad", name: "Quadrilateral", kind: "diagram", subjects: ["Math"], cycles: ALL3, figure: fig("quadrilateral") },
  { id: "math-circle", name: "Circle", kind: "diagram", subjects: ["Math"], cycles: ALL3, figure: fig("circle") },
  { id: "math-angle", name: "Angle", kind: "diagram", subjects: ["Math"], cycles: ["primaire", "college"], figure: fig("angle") },
  { id: "math-axes", name: "Coordinate plane", kind: "diagram", subjects: ["Math", "Physics"], cycles: ["college", "lycee"], figure: fig("axes") },
  {
    id: "math-parabola",
    name: "Function curve",
    kind: "diagram",
    subjects: ["Math"],
    cycles: ["college", "lycee"],
    years: ["3AC", "TC", "1BAC", "2BAC"],
    svg: CURVE_PREVIEW,
    block: { type: "graph", preset: { functions: ["0.5*x^2 - 2"], xMin: -5, xMax: 5, yMin: -4, yMax: 6, grid: true } },
  },
  { id: "math-numberline", name: "Number line", kind: "diagram", subjects: ["Math"], cycles: ["primaire", "college"], figure: fig("number-line") },
  { id: "math-cube", name: "Cube", kind: "diagram", subjects: ["Math"], cycles: ["primaire", "college"], figure: fig("solid") },
  { id: "math-cuboid", name: "Cuboid", kind: "diagram", subjects: ["Math"], cycles: ["primaire", "college"], figure: fig("solid", { kind: "cuboid", w: 140, h: 80, d: 90 }) },
  { id: "math-pyramid", name: "Pyramid", kind: "diagram", subjects: ["Math"], cycles: ["college", "lycee"], figure: fig("solid", { kind: "pyramid", w: 130, h: 110, d: 90, names: "ABCDS" }) },
  { id: "math-cylinder", name: "Cylinder", kind: "diagram", subjects: ["Math"], cycles: ["primaire", "college"], figure: fig("solid", { kind: "cylinder", w: 110, h: 120 }) },
  { id: "math-cone", name: "Cone", kind: "diagram", subjects: ["Math"], cycles: ["college", "lycee"], figure: fig("solid", { kind: "cone", w: 120, h: 130 }) },
  { id: "math-fraction", name: "Fraction shape", kind: "diagram", subjects: ["Math"], cycles: ["primaire", "college"], figure: fig("fraction") },
  { id: "math-grid", name: "Grid paper", kind: "diagram", subjects: "all", cycles: ALL3, figure: fig("grid") },
  { id: "table-values", name: "Table of values", kind: "table", subjects: ["Math"], cycles: ["college", "lycee"], cells: [["x", "-2", "-1", "0", "1", "2"], ["f(x)", "", "", "", "", ""]] },
  // Physics
  { id: "phys-circuit", name: "Electric circuit", kind: "diagram", subjects: ["Physics"], cycles: ["primaire", "college"], figure: fig("circuit") },
  { id: "phys-incline", name: "Inclined plane", kind: "diagram", subjects: ["Physics"], cycles: ["lycee"], figure: fig("incline") },
  { id: "phys-thermometer", name: "Thermometer", kind: "diagram", subjects: ["Physics", "Sciences"], cycles: ["primaire", "college"], figure: fig("thermometer") },
  { id: "phys-lens", name: "Converging lens", kind: "diagram", subjects: ["Physics"], cycles: ["college", "lycee"], years: ["3AC", "1BAC", "2BAC"], figure: fig("lens") },
  { id: "table-units", name: "Quantities & units", kind: "table", subjects: ["Physics"], cycles: ["college", "lycee"], cells: [["Grandeur", "Symbole", "Unité", "Symbole de l'unité"], ...empty(3, 4)] },
  // Sciences
  { id: "sci-cell", name: "Plant cell", kind: "diagram", subjects: ["Sciences"], cycles: ["college", "lycee"], figure: fig("cell") },
  { id: "sci-cell-animal", name: "Animal cell", kind: "diagram", subjects: ["Sciences"], cycles: ["college", "lycee"], figure: fig("cell", { type: "animal" }) },
  { id: "sci-foodchain", name: "Food chain", kind: "diagram", subjects: ["Sciences"], cycles: ["primaire", "college"], figure: fig("food-chain") },
  { id: "sci-watercycle", name: "Water cycle", kind: "diagram", subjects: ["Sciences"], cycles: ["primaire", "college"], figure: fig("water-cycle") },
  { id: "table-classify", name: "Classification table", kind: "table", subjects: ["Sciences"], cycles: ALL3, cells: [["Être vivant", "Groupe", "Caractéristique"], ...empty(4, 3)] },
  // Languages
  { id: "table-conjugation", name: "Conjugation table", kind: "table", subjects: ["French"], cycles: ["primaire", "college"], cells: [["Pronom", "Présent", "Imparfait", "Futur"], ["je", "", "", ""], ["tu", "", "", ""], ["il / elle", "", "", ""], ["nous", "", "", ""], ["vous", "", "", ""], ["ils / elles", "", "", ""]] },
  { id: "table-irab", name: "I'rab table", kind: "table", subjects: ["Arabic"], cycles: ALL3, cells: [["الكلمة", "إعرابها"], ...empty(4, 2)] },
  // Everyone
  { id: "table-2x3", name: "Table 3 × 3", kind: "table", subjects: "all", cycles: ALL3, cells: empty(3, 3) },
  { id: "table-4x4", name: "Table 4 × 4", kind: "table", subjects: "all", cycles: ALL3, cells: empty(4, 4) },
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
