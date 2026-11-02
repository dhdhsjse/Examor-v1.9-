// Every shape of the catalog, by category (the order here is the order of the gallery).
import type { ShapeCategory, ShapeDef } from "../types";
import { ARROWS } from "./arrows";
import { BASIC } from "./basic";
import { CALLOUTS } from "./callouts";
import { EQUATION } from "./equation";
import { FLOWCHART } from "./flowchart";
import { FREEHAND } from "./freehand";
import { LINES } from "./lines";
import { RECTANGLES } from "./rectangles";
import { STARS } from "./stars";

export const SHAPES: readonly ShapeDef[] = [...LINES, ...RECTANGLES, ...BASIC, ...ARROWS, ...EQUATION, ...FLOWCHART, ...STARS, ...CALLOUTS];

// (the pencil's stroke is a shape too, but not one of the gallery)
const BY_ID = new Map([...SHAPES, FREEHAND].map((s) => [s.id, s]));
const FALLBACK = BY_ID.get("rect") as ShapeDef;

export const hasShape = (id: string) => BY_ID.has(id);
/** The shape of a key; an unknown key (a file from a later version) is a rectangle. */
export const shapeDef = (id: string): ShapeDef => BY_ID.get(id) ?? FALLBACK;
export const shapesIn = (category: ShapeCategory) => SHAPES.filter((s) => s.category === category);
