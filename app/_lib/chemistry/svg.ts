// A drawing as a picture for the exam page: an SVG string, drawn like the Studio's canvas (same bonds, same
// trimming at the atom symbols). Black and white by default, because exams are printed that way.
// Pure functions (no React, no DOM), unit-tested.
import { chemSegments } from "./chemText";
import { bondDrawing, type BondPart } from "./bondGeometry";
import { electronPosition } from "./electrons";
import { lonePairMarks, pairShape, pairsShownToStudents } from "./lonePairs";
import { hydrogenLabels, labelParts, type HydrogenLabel } from "./hydrogenLabel";
import { atomInStudentView, bondInStudentView } from "./masking";
import { ARROW_DEFAULT_WIDTH, LABEL_GAP, LABEL_SIZE, TEXT_SIZE, drawingBounds } from "./geometry";
import { PERIODIC_TABLE, textColor } from "./periodicTable";
import type { AtomNode, CanvasAnnotation, MoleculeGraph } from "./types";

const FONT = "Arial, Helvetica, sans-serif";
const PRINT_INK = "#000000";
const BOND_WIDTH = 1.6;
const ARROW_STROKE = 2;
const ATOM_SIZE = 20;
const CHARGE_SIZE = 12;
/** Space left around the drawing: more than an atom symbol and a stroke need. */
const MARGIN = 18;
// Where the pieces of a line of text sit (the same fractions as chemText.ts).
const ASCENT = 0.905;
const SCALE = 0.7;
const SUB_DROP = 0.2;
const SUP_RAISE = 0.4;

export type DrawingImage = { svg: string; width: number; height: number };
export type SvgOptions = {
  /** Draw the symbols in their usual colours (default: everything black, for print). */
  colour?: boolean;
  /** The student version: masked atoms and bonds are replaced (see masking.ts). Default: the answer key, everything drawn. */
  student?: boolean;
};

const MISSING_BOND = "#9ca3af"; // the dashed line of a masked bond in the student version
const BLANK_BOX = 24;

const num = (v: number) => String(Math.round(v * 100) / 100);
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const chargeText = (n: number) => `${Math.abs(n) > 1 ? Math.abs(n) : ""}${n > 0 ? "+" : "−"}`;

// A line of chemistry text as <tspan>s: the browser measures and places them, so no widths are needed here.
function tspans(raw: string, fontSize: number): string {
  let offset = 0; // how far below the baseline the current piece is (dy is cumulative in SVG)
  return chemSegments(raw)
    .map((seg) => {
      const target = seg.kind === "sub" ? fontSize * SUB_DROP : seg.kind === "sup" ? -fontSize * SUP_RAISE : 0;
      const dy = target - offset;
      offset = target;
      const size = seg.kind === "normal" ? fontSize : fontSize * SCALE;
      return `<tspan font-size="${num(size)}"${dy ? ` dy="${num(dy)}"` : ""}>${escape(seg.text)}</tspan>`;
    })
    .join("");
}

// What replaces a masked atom in the student version: its replacement text, or an empty dashed box.
function maskSvg(atom: AtomNode, text: string): string {
  if (text === "") return `<rect x="${num(atom.x - BLANK_BOX / 2)}" y="${num(atom.y - BLANK_BOX / 2)}" width="${BLANK_BOX}" height="${BLANK_BOX}" fill="#ffffff" stroke="${PRINT_INK}" stroke-width="1.3" stroke-dasharray="4 3"/>`;
  return `<text x="${num(atom.x)}" y="${num(atom.y)}" dy="0.35em" text-anchor="middle" font-weight="bold" font-size="${ATOM_SIZE}" fill="${PRINT_INK}">${escape(text)}</text>`;
}

function atomSvg(atom: AtomNode, colour: boolean, hydrogens?: HydrogenLabel, student = false): string {
  if (student) {
    const show = atomInStudentView(atom);
    if (show.kind === "omit") return "";
    if (show.kind === "mask") return maskSvg(atom, show.text);
  }
  const fill = colour ? textColor(PERIODIC_TABLE[atom.element]?.color ?? PRINT_INK) : PRINT_INK;
  const label = `<text x="${num(atom.x)}" y="${num(atom.y)}" dy="0.35em" text-anchor="middle" font-weight="bold" font-size="${ATOM_SIZE}" fill="${fill}">${escape(atom.element)}</text>`;
  const charge = atom.charge ? `<text x="${num(atom.x + 9)}" y="${num(atom.y - 13)}" font-weight="bold" font-size="${CHARGE_SIZE}" fill="${fill}">${chargeText(atom.charge)}</text>` : "";
  // the hydrogens of the "labels" mode: the symbol is followed by an H and a subscript
  const written = hydrogens
    ? labelParts(hydrogens)
        .map((p) => `<text x="${num(atom.x + p.x)}" y="${num(atom.y + p.y)}" dy="0.35em" text-anchor="middle" font-weight="bold" font-size="${p.size}" fill="${fill}">${p.text}</text>`)
        .join("")
    : "";
  return label + charge + written;
}

// The styled pieces of a bond (dashed lines, an outline, a zigzag, an arrow head).
function partSvg(p: BondPart): string {
  const pts = (points: number[]) => Array.from({ length: points.length / 2 }, (_, i) => num(points[2 * i]) + "," + num(points[2 * i + 1])).join(" ");
  switch (p.kind) {
    case "line": {
      const dash = p.dash ? ` stroke-dasharray="${p.dash.join(" ")}"` : "";
      return `<line x1="${num(p.seg.x1)}" y1="${num(p.seg.y1)}" x2="${num(p.seg.x2)}" y2="${num(p.seg.y2)}"${p.width ? ` stroke-width="${p.width}"` : ""}${dash}${p.round ? ' stroke-linecap="round"' : ' stroke-linecap="butt"'}/>`;
    }
    case "outline":
      return `<polygon points="${pts(p.points)}" fill="#ffffff" stroke-linejoin="round"/>`;
    case "polyline":
      return `<polyline points="${pts(p.points)}" fill="none" stroke-linejoin="round"/>`;
    case "head":
      return `<polygon points="${pts(p.points)}" fill="${PRINT_INK}" stroke-width="0.5"/>`;
  }
}

function noteSvg(note: CanvasAnnotation): string {
  const text = note.text ?? "";
  if (note.type === "text") {
    return text ? `<text x="${num(note.x)}" y="${num(note.y + TEXT_SIZE * ASCENT)}" font-size="${TEXT_SIZE}" fill="${PRINT_INK}">${tspans(text, TEXT_SIZE)}</text>` : "";
  }
  const width = note.width ?? ARROW_DEFAULT_WIDTH;
  const tip = note.x + width;
  const head = 12;
  const half = 5;
  const line = `<line x1="${num(note.x)}" y1="${num(note.y)}" x2="${num(tip - head + 1)}" y2="${num(note.y)}" stroke="${PRINT_INK}" stroke-width="${ARROW_STROKE}" stroke-linecap="round"/>`;
  const arrowHead = `<polygon points="${num(tip)},${num(note.y)} ${num(tip - head)},${num(note.y - half)} ${num(tip - head)},${num(note.y + half)}" fill="${PRINT_INK}"/>`;
  // the conditions, centred above the arrow
  const top = note.y - (LABEL_SIZE * 1.2 + LABEL_GAP);
  const label = text ? `<text x="${num(note.x + width / 2)}" y="${num(top + LABEL_SIZE * ASCENT)}" text-anchor="middle" font-size="${LABEL_SIZE}" fill="${PRINT_INK}">${tspans(text, LABEL_SIZE)}</text>` : "";
  return line + arrowHead + label;
}

// The lone pairs: two dots or a bar each, in the free space around their atom. The student version leaves out the ones the
// teacher hid, and those of a masked atom.
function pairsSvg(graph: MoleculeGraph, student: boolean): string {
  const mode = graph.lonePairs ?? "off";
  if (mode === "off") return "";
  const byId = new Map(graph.atoms.map((a) => [a.id, a]));
  return lonePairMarks(graph, mode)
    .map((m) => {
      const atom = byId.get(m.atomId)!;
      if (student && !pairsShownToStudents(atom)) return "";
      const shape = pairShape(m.angle, mode);
      if ("bar" in shape) return `<line x1="${num(atom.x + shape.bar.x1)}" y1="${num(atom.y + shape.bar.y1)}" x2="${num(atom.x + shape.bar.x2)}" y2="${num(atom.y + shape.bar.y2)}" stroke="${PRINT_INK}" stroke-width="1.8" stroke-linecap="round"/>`;
      return shape.dots.map((d) => `<circle cx="${num(atom.x + d.x)}" cy="${num(atom.y + d.y)}" r="${d.r}" fill="${PRINT_INK}"/>`).join("");
    })
    .join("");
}

// The single electrons put by hand: one dot each (not for a masked atom, nor one whose pairs the teacher hid, in the student version).
function electronsSvg(graph: MoleculeGraph, student: boolean): string {
  return graph.atoms
    .filter((a) => a.dots?.length && (!student || pairsShownToStudents(a)))
    .flatMap((a) => a.dots!.map((angle) => electronPosition(angle)).map((d) => `<circle cx="${num(a.x + d.x)}" cy="${num(a.y + d.y)}" r="${d.r}" fill="${PRINT_INK}"/>`))
    .join("");
}

/**
 * The picture of a drawing, or null if there is nothing drawn. The size is that of the drawing at 100 %
 * plus a margin; the caller scales it to the page. Hidden atoms and bonds are drawn like the others
 * (this is the answer key; a student version is a later step).
 */
export function renderDrawingSvg(graph: MoleculeGraph, options: SvgOptions = {}): DrawingImage | null {
  const bounds = drawingBounds(graph);
  if (!bounds) return null;
  const colour = options.colour ?? false;
  const width = Math.ceil(bounds.maxX - bounds.minX + 2 * MARGIN);
  const height = Math.ceil(bounds.maxY - bounds.minY + 2 * MARGIN);
  const byId = new Map(graph.atoms.map((a) => [a.id, a]));
  const labels = hydrogenLabels(graph);

  const bonds = graph.bonds
    .map((bond) => {
      const a = byId.get(bond.sourceId);
      const b = byId.get(bond.targetId);
      if (!a || !b) return "";
      const show = options.student ? bondInStudentView(bond, a, b) : { kind: "normal" as const };
      if (show.kind === "omit") return "";
      if (show.kind === "missing") {
        const dashed = bondDrawing(a, b, "single").lines.map((l) => `<line x1="${num(l.x1)}" y1="${num(l.y1)}" x2="${num(l.x2)}" y2="${num(l.y2)}"/>`).join("");
        return `<g stroke="${MISSING_BOND}" stroke-dasharray="5 4">${dashed}</g>`;
      }
      const { lines, polygon, parts } = bondDrawing(a, b, bond.type);
      const strokes = lines.map((l) => `<line x1="${num(l.x1)}" y1="${num(l.y1)}" x2="${num(l.x2)}" y2="${num(l.y2)}"/>`).join("");
      const wedge = polygon ? `<polygon points="${[0, 2, 4].map((i) => `${num(polygon[i])},${num(polygon[i + 1])}`).join(" ")}" fill="${PRINT_INK}"/>` : "";
      return strokes + wedge + (parts ?? []).map(partSvg).join("");
    })
    .join("");

  const body = [
    `<g stroke="${PRINT_INK}" stroke-width="${BOND_WIDTH}" stroke-linecap="round">${bonds}</g>`,
    graph.atoms.map((a) => atomSvg(a, colour, labels.get(a.id), options.student)).join(""),
    pairsSvg(graph, !!options.student),
    electronsSvg(graph, !!options.student),
    graph.annotations.map(noteSvg).join(""),
  ].join("");

  // The first width="…" of the string is the picture's size (library.svgSize reads it that way).
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">` +
    `<g transform="translate(${num(MARGIN - bounds.minX)} ${num(MARGIN - bounds.minY)})">${body}</g></svg>`;
  return { svg, width, height };
}
