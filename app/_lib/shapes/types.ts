// The data of the shapes (Insert → Shapes): the same in the page editor and in every Studio. A shape is its kind (a key of the
// catalog), a box, and how it is drawn; the lines of the catalog (a line, an arrow, a connector) are drawn from one corner of
// the box to the opposite one. Nothing here is React or Konva: the canvases and the SVG pictures both draw what these give.
import type { Pt } from "./path";

export const SHAPE_CATEGORIES = ["Lines", "Rectangles", "Basic shapes", "Block arrows", "Equation shapes", "Flowchart", "Stars and banners", "Callouts"] as const;
export type ShapeCategory = (typeof SHAPE_CATEGORIES)[number];

export type DashKind = "solid" | "dashed" | "dotted";
export type ShapeTextAlign = "left" | "center" | "right";
export type ShapeVAlign = "top" | "middle" | "bottom";

/**
 * How a shape looks, without where it is. A page block carries this; a shape in a Studio is this plus a place (ShapeItem).
 * Missing fields mean the defaults (DEFAULT_SHAPE_STYLE), so older documents and short literals stay valid.
 */
export type ShapeStyle = {
  /** A key of the catalog; an unknown one is drawn as a rectangle */
  shape: string;
  /** The color inside (null = nothing) */
  fill?: string | null;
  /** The color of the outline (null = no outline) */
  stroke?: string | null;
  strokeWidth?: number;
  dash?: DashKind;
  /** The yellow handles of the shape (how round, how thick…): only the ones changed from the defaults need to be there */
  adj?: number[];
  flipX?: boolean;
  flipY?: boolean;
  /** The text written in the shape */
  text?: string;
  textColor?: string;
  /** A font of the app's list (missing = Arial, as before) */
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  textAlign?: ShapeTextAlign;
  textVAlign?: ShapeVAlign;
  /** A stroke of the page's drawing tools (a freehand shape): which tool drew it. `stroke` is its color, `strokeWidth` its size. */
  ink?: "brush" | "pencil" | "highlighter";
  /** How hard each point of an ink stroke was pressed (0..1), one per point of `adj` */
  pressure?: number[];
};

/** A shape in a Studio: where it is (the top-left corner of its box, before it is turned) and how it is turned. */
export type ShapeItem = ShapeStyle & {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees, clockwise, round the centre of the box */
  rotation?: number;
};

/** Which way a painted part is filled */
export type Paint =
  /** with the shape's fill, and outlined */
  | "fill"
  /** a lighter / darker shade of the shape's fill (the faces of a cube) */
  | "light"
  | "dark"
  /** only the outline, nothing inside (an inner edge, a line) */
  | "line"
  /** with the outline's color (an arrow head, the eyes of a face) */
  | "solid";

export type ShapePart = { d: string; paint: Paint };

/** A yellow handle: where it is, and what the values become when it is dragged to a point (both in the box's pixels). */
export type Adjust = {
  defaults: readonly number[];
  handles: (w: number, h: number, a: readonly number[]) => Pt[];
  drag: (i: number, x: number, y: number, w: number, h: number, a: readonly number[]) => number[];
};

export type ShapeDef = {
  id: string;
  /** English name (translated where it is shown) */
  label: string;
  category: ShapeCategory;
  /** The drawing, for a box of w×h and the values of the handles; `sw` is the outline's width (arrow heads follow it) */
  parts: (w: number, h: number, a: readonly number[], sw: number) => ShapePart[];
  adjust?: Adjust;
  /** A line: no inside, drawn from one corner to the opposite one, with two end handles instead of eight */
  line?: boolean;
  /** A stroke of the pencil: `adj` holds its points (x, y pairs, as fractions of the box) instead of the values of handles */
  freehand?: boolean;
  /** The room for the text inside the shape, as fractions of the box: left, top, right, bottom (default: all of it) */
  textInset?: readonly [number, number, number, number];
  /** The size of a shape put with a click instead of a drag (default 120×90) */
  size?: readonly [number, number];
};
