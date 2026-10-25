// Molecule Studio data model. Two layers: the graph (chemistry + layout) and the edit overlay
// (what is shown / blank / hidden). Visibility edits never change the graph, so the answer key
// can always be rebuilt from the same data.

export type Representation = "molecular" | "semi-structural" | "structural" | "skeletal" | "lewis" | "cram";

export type Visibility = "shown" | "blank" | "hidden";

export interface MolAtom {
  id: string; // stable: "a1", "a2"… never reused after deletion
  element: string; // "C", "H", "O"…
  charge: number; // formal charge
  x: number; // 2D layout in bond-length units, y down
  y: number;
  lonePairs: number; // computed default, may be overridden
  isotope?: number;
  // Where the skeletal formula puts this atom (bond lengths, y down): a depiction made WITHOUT the hydrogens, so a
  // chain zigzags. Missing in older documents and on added hydrogens: x, y are used.
  sx?: number;
  sy?: number;
}

// How a covalent bond is drawn when it is not just its order: a display style only (the chemistry is `order`).
export type BondStyle = "quadruple" | "aromatic" | "partial" | "shared" | "wedge-open" | "bold" | "wavy";

export interface MolBond {
  id: string;
  a: string; // atom ids
  b: string;
  order: 1 | 2 | 3;
  stereo?: "wedge" | "dash" | "none"; // Cram: 'wedge' points from a to b
  style?: BondStyle; // the drawing lab's bond library (an open wedge is narrow at a)
}

// A bond that is not covalent (a dative arrow from a to b, an ionic or a hydrogen bond): drawn by the structural drawings
// between two atoms, but not part of the graph (it uses no valence, and a hydrogen bond joins two molecules).
export interface OverlayBond {
  id: string;
  a: string;
  b: string;
  style: "dative" | "ionic" | "hydrogen";
}

// Hydrogens are explicit atoms in the graph.
export interface MolGraph {
  atoms: MolAtom[];
  bonds: MolBond[];
  // Next number for a new atom / bond id: ids are never reused after a deletion.
  nextAtom?: number;
  nextBond?: number;
}

export interface AtomEdit {
  vis?: Visibility; // missing = shown
  label?: string; // override text; "" = empty box
  x?: number; // manual position override
  y?: number;
}

export interface BondEdit {
  vis?: Visibility;
  orderOverride?: 1 | 2 | 3; // display only
}

export interface MoleculeEdits {
  atoms: Record<string, AtomEdit>;
  bonds: Record<string, BondEdit>;
  lonePairs: Record<string, boolean[]>; // atomId -> per-pair visibility (true or missing = shown)
  hideAllHydrogens?: boolean;
}

export type SemiStyle = "fully-condensed" | "semi" | "semi-expanded";

export interface RenderOptions {
  layout: "school" | "auto"; // 'school' = orthogonal layout like the printed exercises
  showHydrogens: "all" | "none" | "hetero-and-terminal";
  lonePairStyle: "dots" | "lines";
  cramLonePairs: boolean; // draw the lone pairs on a Cram drawing (the pyramidal NH3 with its pair)
  semiStyle: SemiStyle;
  bondLength: number; // px
  fontSize: number; // px
  monochrome: boolean; // default true (print)
  lang: "ar" | "fr" | "en";
  stubLength: number; // length of the stub a hidden atom leaves, in bond lengths (0..1)
  blankStyle: "stub" | "box" | "dashed-box"; // how a blank atom looks ("stub" = like a hidden one)
  showLonePairs?: boolean; // write the lone pairs on the structural and skeletal drawings too (Lewis always does)
}

export interface MoleculeSource {
  kind: "name" | "formula" | "smiles" | "molfile";
  input: string;
  lang?: string;
}

export interface MoleculeBlockData {
  schema: 1;
  source: MoleculeSource;
  smiles: string; // canonical SMILES of the base molecule (search / reload)
  graph: MolGraph; // includes coordinates, after structural edits
  representation: Representation;
  options: RenderOptions;
  edits: MoleculeEdits;
  exerciseMode: "answer" | "student";
  geometryCenters?: string[]; // atom ids used for VSEPR / Cram
  overlayBonds?: OverlayBond[]; // bonds of the drawing lab that are not covalent (see OverlayBond)
}

export interface RenderResult {
  svg: string; // self-contained SVG
  width: number;
  height: number;
  // Why the drawing is not the one asked for (e.g. the school layout could not place the molecule).
  warning?: string;
}

// "ghost": the editor view. What the student version hides or blanks is still drawn, faded, so it can be selected.
export interface RenderContext {
  ghost?: boolean;
}

export interface MoleculeRenderer {
  id: Representation;
  render(block: MoleculeBlockData, ctx?: RenderContext): RenderResult;
}

export const defaultRenderOptions = (lang: RenderOptions["lang"] = "en"): RenderOptions => ({
  layout: "school",
  showHydrogens: "all",
  lonePairStyle: "dots",
  cramLonePairs: false,
  semiStyle: "semi",
  bondLength: 46,
  fontSize: 20,
  monochrome: true,
  lang,
  stubLength: 0.45,
  blankStyle: "dashed-box",
});

export const emptyEdits = (): MoleculeEdits => ({ atoms: {}, bonds: {}, lonePairs: {} });
