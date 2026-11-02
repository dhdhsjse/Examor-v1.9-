// The drawing of the Probability Studio: probability trees, Venn diagrams, urns, dice, coins and spinners placed freely on a
// sheet, plus the drawings, shapes and text boxes of the floating tool bar. Pure data (no React): the canvas, the picture for the
// page and the tests all start from a ProbaConfig.
import type { ShapeItem } from "@/app/_lib/shapes";

/** A node of a probability tree: the event written at the end of its branch, and the probability written on the branch. */
export type ProbNode = {
  id: string;
  /** The event, like "A" or "R" (the root's is written before the first branches, often empty) */
  label: string;
  /** The event is a complement: drawn with a bar over it (Ā) */
  bar?: boolean;
  /** The probability on the branch that leads here, as typed: "0.3", "0,3", "1/4", "30 %", "p"… (unused for the root) */
  prob: string;
  /** For the exercise: the probability is written as dots, for the student to find */
  hideProb?: boolean;
  children: ProbNode[];
};

export type TreeDirection = "right" | "down";

export type ProbTree = {
  id: string;
  kind: "tree";
  /** The top-left corner of the tree on the sheet */
  x: number;
  y: number;
  root: ProbNode;
  /** Left to right (the usual) or top to bottom */
  direction: TreeDirection;
  /** The length of a level of branches, px */
  levelGap: number;
  /** The room between two leaves, px */
  leafGap: number;
  /** The size of the texts, px */
  fontSize: number;
  /** A column at the end of each path with the outcome (A ∩ B) */
  showOutcomes?: boolean;
  /** A column at the end of each path with its probability (the product along the path) */
  showResults?: boolean;
};

/** A region of a Venn diagram: one letter per set, 1 = inside it, 0 = outside ("10" = in A, not in B; "00" = in none). */
export type VennRegion = string;

export type Venn = {
  id: string;
  kind: "venn";
  x: number;
  y: number;
  sets: 2 | 3;
  /** The names of the sets */
  labels: string[];
  /** The name of the universe (Ω), written in its frame */
  universe: string;
  showUniverse: boolean;
  /** What is written in each region (a count, a probability…) */
  values: Record<VennRegion, string>;
  /** The regions shaded */
  shaded: VennRegion[];
};

export type Ball = { color: string; count: number; text: string };

export type Urn = {
  id: string;
  kind: "urn";
  x: number;
  y: number;
  balls: Ball[];
  /** A name under the urn ("U₁") */
  label: string;
};

export type Dice = {
  id: string;
  kind: "dice";
  x: number;
  y: number;
  /** The face shown by each die (1 to 6) */
  faces: number[];
};

export type Coin = {
  id: string;
  kind: "coin";
  x: number;
  y: number;
  /** The text on each coin ("P", "F", "H", "T", "1 €"…) */
  sides: string[];
};

export type Sector = { label: string; weight: number; color: string };

export type Spinner = {
  id: string;
  kind: "spinner";
  x: number;
  y: number;
  radius: number;
  sectors: Sector[];
};

/** A card or a token with a text, like the cards drawn from a box ("1", "A", "♥ 7"). */
export type Cards = {
  id: string;
  kind: "cards";
  x: number;
  y: number;
  texts: string[];
};

export type ProbItem = ProbTree | Venn | Urn | Dice | Coin | Spinner | Cards;
export type ItemKind = ProbItem["kind"];

export type ProbaConfig = {
  /** The size of the drawing area in pixels */
  width: number;
  height: number;
  items: ProbItem[];
  /** Drawings, shapes and text boxes of the floating tool bar */
  shapes?: ShapeItem[];
};

export const DEFAULT_PROBA_CONFIG: ProbaConfig = { width: 900, height: 620, items: [] };

export const MIN_AREA = 200;
export const MAX_AREA = 2000;

/** The colors of balls and sectors: light enough to print, each with a name for the panel. */
export const PROBA_COLORS: { id: string; name: string; fill: string; ink: string }[] = [
  { id: "white", name: "White", fill: "#ffffff", ink: "#111827" },
  { id: "red", name: "Red", fill: "#ef4444", ink: "#ffffff" },
  { id: "blue", name: "Blue", fill: "#3b82f6", ink: "#ffffff" },
  { id: "green", name: "Green", fill: "#22c55e", ink: "#ffffff" },
  { id: "yellow", name: "Yellow", fill: "#facc15", ink: "#111827" },
  { id: "orange", name: "Orange", fill: "#fb923c", ink: "#111827" },
  { id: "gray", name: "Gray", fill: "#9ca3af", ink: "#111827" },
  { id: "black", name: "Black", fill: "#1f2937", ink: "#ffffff" },
];

export const colorOf = (id: string) => PROBA_COLORS.find((c) => c.id === id) ?? PROBA_COLORS[0];
