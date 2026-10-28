// The data model of the drawing Studio: a molecule is a graph of atoms (nodes) and bonds (edges),
// with coordinates in studio units (1 unit = 1 px at zoom 100 %). Elements are keyed by symbol in
// PERIODIC_TABLE, so the model covers the whole table.
//
// This is separate from the model of the molecule-generating Studio (app/_molecule/model.ts).
import type { ShapeItem } from "@/app/_lib/shapes";

export type AtomNode = {
  id: string;
  /** The atomic symbol, e.g. "C", "O", "Fe" (a key of PERIODIC_TABLE). */
  element: string;
  x: number;
  y: number;
  /** Formal charge: +1, -1, +2… */
  charge: number;
  /** Masked: hidden in the student version (drawn faded, with a red dashed ring, in the teacher's view). */
  hidden: boolean;
  /** What the student version writes in place of a masked atom: absent = "?", "" = an empty dashed box. See masking.ts. */
  mask?: string;
  /**
   * A hydrogen made by the auto-valence engine (valence.ts). The engine removes and remakes these after
   * every edit; a hydrogen without the flag is the teacher's (or a sample's) and is never touched.
   * Moving an automatic hydrogen by hand turns the flag off: the teacher chose its place.
   */
  auto?: boolean;
  /** The lone pairs (non-bonding pairs) written on the atom: absent = worked out from its valence (lonePairs.ts). */
  pairs?: number;
  /** Where the teacher put some of those pairs by hand: directions (degrees, screen angles) from the atom, so they move with it. The other pairs are placed automatically. */
  pairDirs?: number[];
  /** Single electrons (one dot each) the teacher put beside the atom: directions in degrees, relative to the atom. Not lone pairs (electrons.ts). */
  dots?: number[];
  /** The student version does not draw the lone pairs of this atom (the students complete them). */
  pairsHidden?: boolean;
};

/**
 * The bonds of the library. Covalent: single, double, triple, quadruple, aromatic (delocalised: a line and a dashed one),
 * partial (a dashed line). Stereo: wedge (towards the viewer), dash (away), wedge-open (an outlined wedge), bold (a thick
 * line: the edge nearest the viewer), wavy (unknown). Not covalent: dative (an arrow from the donor to the acceptor),
 * ionic (dotted), hydrogen (dashed, thin). See bondGeometry.ts for how each is drawn and valence.ts for what it counts.
 */
export type BondType = "single" | "double" | "triple" | "quadruple" | "aromatic" | "partial" | "shared" | "wedge" | "dash" | "wedge-open" | "bold" | "wavy" | "dative" | "ionic" | "hydrogen";

export type BondEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  type: BondType;
  /** Masked: hidden in the student version (drawn faded, with a red dashed line, in the teacher's view). */
  hidden: boolean;
  /** What the student version draws in place of a masked bond: absent = a dashed grey line, "" = nothing. */
  mask?: string;
};

/**
 * Something drawn on the paper that is not part of a molecule: a piece of text, or a reaction arrow.
 * (x, y) is the top-left corner of a text and the tail of an arrow (the arrow points right, `width` long).
 */
export type CanvasAnnotation = {
  id: string;
  type: "text" | "arrow";
  x: number;
  y: number;
  /** The text itself, or the conditions written above an arrow ("H+", "Ac2O"). Typed plainly: see chemText.ts. */
  text?: string;
  /** Length of an arrow. */
  width?: number;
};

/**
 * What the Studio does about hydrogens:
 * - "auto": the engine adds the hydrogens each atom still needs, as atoms (valence.ts);
 * - "manual": nothing is added, every bond is drawn by hand (the default of a new drawing);
 * - "labels": nothing is added, and the missing hydrogens are written next to the atom (CH3, OH).
 */
export type HydrogenMode = "auto" | "manual" | "labels";

/** How the lone pairs (unshared pairs, non-bonding electrons) are drawn. */
export type LonePairMode = "off" | "dots" | "lines";

export type MoleculeGraph = {
  atoms: AtomNode[];
  bonds: BondEdge[];
  /** Required, so that an edit that rebuilds the graph cannot forget the texts and arrows (the compiler says so). */
  annotations: CanvasAnnotation[];
  /** Shapes drawn over the molecule (Shapes in the toolbar); absent in drawings made before they existed */
  shapes?: ShapeItem[];
  /** Absent in drawings made before the modes existed: see hydrogenModeOf (valence.ts). */
  hydrogens?: HydrogenMode;
  /** How the lone pairs are written: not at all (the default), as pairs of dots, or as bars. See lonePairs.ts. */
  lonePairs?: LonePairMode;
};

/** A ring to place: its number of sides and whether it is drawn with alternating double bonds (benzene). */
export type RingSpec = { sides: number; isAromatic: boolean };

/** The tools of the drawing Studio. */
export type StudioTool = "select" | "shape" | "atom" | "erase" | "bond" | "ring" | "template" | "text" | "arrow" | "pair" | "electron";
