// How a bond is drawn: pure geometry (no React, no Konva), so the renderer stays thin and this is unit-tested.
import type { BondType } from "./types";

/** Usual bond length of a drawing, in studio units. */
export const BOND_LENGTH = 50;
/** A bond stops this far from an atom's centre, so it never runs behind the symbol. */
export const ATOM_RADIUS = 12;
/** An atom is grabbed, clicked and bonded to anywhere within this distance of its centre. */
export const ATOM_HIT_RADIUS = 16;
/** Perpendicular offset of each line of a double bond (±) and of the outer lines of a triple bond (±). */
export const DOUBLE_OFFSET = 2;
export const TRIPLE_OFFSET = 4;
/** Half-width of the wide end of a wedge, and of the longest stroke of a hashed bond. */
export const WEDGE_HALF_WIDTH = 4;
const DASH_STROKES = 6;
const QUADRUPLE_OFFSET = 2; // the four lines of a quadruple bond are 2×2 apart, centred
const AROMATIC_OFFSET = 4; // the dashed line of an aromatic bond
const BOLD_WIDTH = 3.6;
const WAVE_AMPLITUDE = 2.4;
const WAVE_LENGTH = 7;
const ARROW_LENGTH = 9;
const DOT_RADIUS = 2.4; // the dots at the ends of a "shared" bond
const ARROW_HALF_WIDTH = 3.6;

export type Point = { x: number; y: number };
export type Segment = { x1: number; y1: number; x2: number; y2: number };

/** A piece of a bond that is not a plain stroke: a styled line, an outline, a zigzag, a filled head. */
export type BondPart =
  | { kind: "line"; seg: Segment; width?: number; dash?: [number, number]; round?: boolean }
  | { kind: "outline"; points: number[] } // a closed polygon, not filled (the open wedge)
  | { kind: "polyline"; points: number[] } // an open zigzag (the wavy bond)
  | { kind: "head"; points: number[] }; // a filled triangle (the arrow of a dative bond)

export type BondDrawing = {
  /** Strokes: one for a single bond, two for a double, three for a triple, several for a hashed bond. */
  lines: Segment[];
  /** A filled triangle as [x, y, x, y, x, y] (wedge bonds), else null. */
  polygon: number[] | null;
  /** What the styled bonds are made of (absent for the plain ones). */
  parts?: BondPart[];
};

/** The bonds that have a direction: the first atom is the narrow end of a wedge, the donor of a dative bond. */
export const DIRECTED_BONDS: readonly BondType[] = ["wedge", "dash", "wedge-open", "dative"];
/** The bonds that are not covalent: they use no valence (and a hydrogen bond is not even part of the molecule). */
export const NON_COVALENT_BONDS: readonly BondType[] = ["dative", "ionic", "hydrogen"];

const EMPTY: BondDrawing = { lines: [], polygon: null };

// A segment moved sideways by `d` (positive = to the left of the direction a → b).
const shifted = (a: Point, b: Point, nx: number, ny: number, d: number): Segment => ({
  x1: a.x + nx * d,
  y1: a.y + ny * d,
  x2: b.x + nx * d,
  y2: b.y + ny * d,
});

/**
 * The lines to draw for a bond from atom `a` to atom `b`. Both ends are trimmed by ATOM_RADIUS (less on a
 * very short bond, so something always remains). A wedge is narrow at `a` (the stereocentre) and wide at `b`.
 */
export function bondDrawing(a: Point, b: Point, type: BondType): BondDrawing {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return EMPTY;
  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy;
  const ny = ux;
  const trim = Math.min(ATOM_RADIUS, length * 0.3);
  const from: Point = { x: a.x + ux * trim, y: a.y + uy * trim };
  const to: Point = { x: b.x - ux * trim, y: b.y - uy * trim };

  switch (type) {
    case "single":
      return { lines: [shifted(from, to, nx, ny, 0)], polygon: null };
    case "double":
      return { lines: [shifted(from, to, nx, ny, -DOUBLE_OFFSET), shifted(from, to, nx, ny, DOUBLE_OFFSET)], polygon: null };
    case "triple":
      return { lines: [shifted(from, to, nx, ny, -TRIPLE_OFFSET), shifted(from, to, nx, ny, 0), shifted(from, to, nx, ny, TRIPLE_OFFSET)], polygon: null };
    case "wedge":
      return {
        lines: [],
        polygon: [from.x, from.y, to.x + nx * WEDGE_HALF_WIDTH, to.y + ny * WEDGE_HALF_WIDTH, to.x - nx * WEDGE_HALF_WIDTH, to.y - ny * WEDGE_HALF_WIDTH],
      };
    case "quadruple":
      return { lines: [-3, -1, 1, 3].map((k) => shifted(from, to, nx, ny, k * QUADRUPLE_OFFSET)), polygon: null };
    case "aromatic":
      return { lines: [shifted(from, to, nx, ny, 0)], polygon: null, parts: [{ kind: "line", seg: shifted(from, to, nx, ny, AROMATIC_OFFSET), dash: [4, 3] }] };
    case "partial":
      return { lines: [], polygon: null, parts: [{ kind: "line", seg: shifted(from, to, nx, ny, 0), dash: [5, 4] }] };
    case "shared": {
      // A line with a dot at each end (a shared pair: A•—•B); the dots are filled 12-gons, drawn like the arrow head.
      const dot = (c: Point) => Array.from({ length: 12 }, (_, i) => [c.x + DOT_RADIUS * Math.cos((i * Math.PI) / 6), c.y + DOT_RADIUS * Math.sin((i * Math.PI) / 6)]).flat();
      const start: Point = { x: from.x + ux * DOT_RADIUS, y: from.y + uy * DOT_RADIUS };
      const end: Point = { x: to.x - ux * DOT_RADIUS, y: to.y - uy * DOT_RADIUS };
      return { lines: [shifted(start, end, nx, ny, 0)], polygon: null, parts: [{ kind: "head", points: dot(start) }, { kind: "head", points: dot(end) }] };
    }
    case "wedge-open":
      return {
        lines: [],
        polygon: null,
        parts: [{ kind: "outline", points: [from.x, from.y, to.x + nx * WEDGE_HALF_WIDTH, to.y + ny * WEDGE_HALF_WIDTH, to.x - nx * WEDGE_HALF_WIDTH, to.y - ny * WEDGE_HALF_WIDTH] }],
      };
    case "bold":
      return { lines: [], polygon: null, parts: [{ kind: "line", seg: shifted(from, to, nx, ny, 0), width: BOLD_WIDTH }] };
    case "wavy": {
      const run = Math.hypot(to.x - from.x, to.y - from.y);
      const steps = Math.max(2, Math.round(run / 1.5));
      const points: number[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const side = WAVE_AMPLITUDE * Math.sin(((run * t) / WAVE_LENGTH) * 2 * Math.PI);
        points.push(from.x + (to.x - from.x) * t + nx * side, from.y + (to.y - from.y) * t + ny * side);
      }
      return { lines: [], polygon: null, parts: [{ kind: "polyline", points }] };
    }
    case "dative": {
      // A line ending in an arrow head at the acceptor (b).
      const head = Math.min(ARROW_LENGTH, Math.hypot(to.x - from.x, to.y - from.y) * 0.6);
      const base: Point = { x: to.x - ux * head, y: to.y - uy * head };
      return {
        lines: [shifted(from, base, nx, ny, 0)],
        polygon: null,
        parts: [{ kind: "head", points: [to.x, to.y, base.x + nx * ARROW_HALF_WIDTH, base.y + ny * ARROW_HALF_WIDTH, base.x - nx * ARROW_HALF_WIDTH, base.y - ny * ARROW_HALF_WIDTH] }],
      };
    }
    case "ionic":
      return { lines: [], polygon: null, parts: [{ kind: "line", seg: shifted(from, to, nx, ny, 0), width: 2, dash: [0.1, 4], round: true }] };
    case "hydrogen":
      return { lines: [], polygon: null, parts: [{ kind: "line", seg: shifted(from, to, nx, ny, 0), width: 1.2, dash: [3, 3] }] };
    case "dash": {
      // Short strokes across the bond, longer towards `b`.
      const lines: Segment[] = [];
      for (let i = 0; i < DASH_STROKES; i++) {
        const t = (i + 0.5) / DASH_STROKES;
        const cx = from.x + (to.x - from.x) * t;
        const cy = from.y + (to.y - from.y) * t;
        const half = Math.max(0.6, WEDGE_HALF_WIDTH * t);
        lines.push({ x1: cx - nx * half, y1: cy - ny * half, x2: cx + nx * half, y2: cy + ny * half });
      }
      return { lines, polygon: null };
    }
  }
}

/** The box around a drawing's atoms (null if there are none). */
export function graphBounds(atoms: readonly Point[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (!atoms.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of atoms) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}
