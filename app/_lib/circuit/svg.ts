// The picture of a circuit for the page (an image block's `src`): the same scene as the canvas, cropped to what is drawn, with a
// margin. Pure function, unit-tested.
import { JUNCTION_RADIUS, WIRE_STROKE, buildCircuitScene, contentBounds } from "./scene";
import { SYMBOL_STROKE, type SymbolShape } from "./symbols";
import type { CircuitConfig } from "./types";

export const INK = "#111827";
const FONT = "Arial, Helvetica, sans-serif";
export const PICTURE_MARGIN = 16;
const num = (n: number) => String(Math.round(n * 100) / 100);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pts = (points: number[]) => Array.from({ length: points.length / 2 }, (_, i) => num(points[2 * i]) + "," + num(points[2 * i + 1])).join(" ");

export type CircuitImage = { svg: string; width: number; height: number };

const shapeSvg = (s: SymbolShape): string => {
  if (s.kind === "circle") return `<circle cx="${num(s.cx)}" cy="${num(s.cy)}" r="${s.r}" fill="${s.fill ? INK : "none"}"/>`;
  if (s.kind === "line") return `<polyline points="${pts(s.points)}" fill="none"/>`;
  return `<polygon points="${pts(s.points)}" fill="${s.kind === "poly" ? INK : "none"}"/>`;
};

/** The picture of the circuit (null for an empty one). Its size is that of what is drawn plus a margin. */
export function renderCircuitSvg(config: CircuitConfig): CircuitImage | null {
  const scene = buildCircuitScene(config);
  const box = contentBounds(scene);
  if (!box) return null;
  const x0 = Math.floor(box.minX - PICTURE_MARGIN);
  const y0 = Math.floor(box.minY - PICTURE_MARGIN);
  const width = Math.ceil(box.maxX + PICTURE_MARGIN) - x0;
  const height = Math.ceil(box.maxY + PICTURE_MARGIN) - y0;
  const body = [
    `<g fill="none" stroke="${INK}" stroke-width="${WIRE_STROKE}" stroke-linecap="round" stroke-linejoin="round">${scene.wires.map((w) => `<polyline points="${pts(w.points)}" data-wire="${esc(w.id)}"/>`).join("")}</g>`,
    `<g fill="${INK}">${scene.junctions.map((j) => `<circle cx="${num(j.x)}" cy="${num(j.y)}" r="${JUNCTION_RADIUS}"/>`).join("")}</g>`,
    ...scene.components.map(
      (c) =>
        `<g stroke="${INK}" stroke-width="${SYMBOL_STROKE}" stroke-linecap="round" stroke-linejoin="round" data-component="${esc(c.id)}" data-type="${c.type}">${c.shapes.map(shapeSvg).join("")}</g>` +
        c.texts.map((t) => `<text x="${num(t.x)}" y="${num(t.y)}" dy="0.35em" text-anchor="${t.align}" font-size="${t.size}"${t.bold ? ' font-weight="bold"' : ""} fill="${INK}">${esc(t.text)}</text>`).join(""),
    ),
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}"><g transform="translate(${-x0} ${-y0})">${body.join("")}</g></svg>`;
  return { svg, width, height };
}
