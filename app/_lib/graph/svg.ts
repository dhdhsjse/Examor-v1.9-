// The picture of a graph paper for the page (an image block's `src`): the same scene as the canvas, as an SVG with a margin
// around the paper for the numbers, the labels and the arrows. Pure function, unit-tested.
import { shapesBounds, shapesSvg } from "@/app/_lib/shapes";
import type { TextFrameGeometry } from "./annotations";
import { PAPER_MARGIN, buildScene, fatalIssue, type GraphScene, type SceneOptions } from "./grid";
import { SCRIPT_SIZE, SUB_SHIFT, SUP_SHIFT, type TextRun } from "./richLabel";
import type { GraphConfig } from "./types";

export const INK = "#111827";
const FONT = "Arial, Helvetica, sans-serif";
const num = (n: number) => String(Math.round(n * 100) / 100);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const MINOR_OPACITY = 0.2;
export const MINOR_WIDTH = 0.5;
export const MID_OPACITY = 0.5;
export const MID_WIDTH = 0.65;
export const MAJOR_WIDTH = 0.8;
export const AXIS_WIDTH = 1.8;
export const TICK_WIDTH = 1.2;
/** The line round a circled text (the ① of a curve's name) */
export const FRAME_STROKE = 1.2;

export type GraphImage = { svg: string; width: number; height: number };

const path = (segments: GraphScene["minor"]) => segments.map((s) => `M${num(s.x1)} ${num(s.y1)}L${num(s.x2)} ${num(s.y2)}`).join("");
const anchor = { start: "start", middle: "middle", end: "end" } as const;

// The runs of a text with sub- and superscripts: each script smaller, and moved down or up from the baseline (dy is relative to the
// text before it, so a script is followed by a move back, which is the dy of the plain text after it).
function tspans(runs: TextRun[], size: number): string {
  let shift = 0; // how far below the baseline the text is now
  return runs
    .map((r) => {
      const to = r.script === "sub" ? SUB_SHIFT * size : r.script === "sup" ? SUP_SHIFT * size : 0;
      const dy = to - shift;
      shift = to;
      const attrs = `${dy ? ` dy="${num(dy)}"` : ""}${r.script ? ` font-size="${num(size * SCRIPT_SIZE)}"` : ""}`;
      return attrs ? `<tspan${attrs}>${esc(r.text)}</tspan>` : esc(r.text);
    })
    .join("");
}

type DrawnText = { text: string; x: number; y: number; align: "start" | "middle" | "end"; size: number; bold?: boolean; italic?: boolean; runs?: TextRun[] };

// A text with a white halo to keep it readable over the grid (`extra`: more attributes, e.g. the annotation it belongs to).
const textElement = (t: DrawnText, fill: string, extra = "") =>
  `<text x="${num(t.x)}" y="${num(t.y)}" dy="0.35em" text-anchor="${anchor[t.align]}" font-size="${t.size}"${t.bold ? ' font-weight="bold"' : ""}${t.italic ? ' font-style="italic"' : ""} fill="${esc(fill)}" stroke="#ffffff" stroke-width="3" stroke-linejoin="round" paint-order="stroke"${extra}>${t.runs ? tspans(t.runs, t.size) : esc(t.text)}</text>`;

// What is behind a framed text: a white box, or a white disc with a line round it.
const frameElement = (f: TextFrameGeometry, color: string, extra: string) =>
  f.shape === "circle"
    ? `<circle cx="${num(f.x)}" cy="${num(f.y)}" r="${num(f.w / 2)}" fill="#ffffff" stroke="${esc(color)}" stroke-width="${FRAME_STROKE}"${extra}/>`
    : `<rect x="${num(f.x - f.w / 2)}" y="${num(f.y - f.h / 2)}" width="${num(f.w)}" height="${num(f.h)}" fill="#ffffff"${extra}/>`;

/** The picture of the paper (null if the configuration cannot be drawn). Its size is the paper's plus the margin on each side. */
export function renderGraphSvg(c: GraphConfig, options: SceneOptions = {}): GraphImage | null {
  if (fatalIssue(c)) return null;
  // (the teacher's picture is the answer key: what is masked is drawn like the rest; the student's has it left out)
  const scene = buildScene(c, options);
  // the picture is the paper and its margin, and more where a shape goes past them
  const sb = shapesBounds(c.shapes);
  const x0 = sb ? Math.min(-PAPER_MARGIN, Math.floor(sb.minX)) : -PAPER_MARGIN;
  const y0 = sb ? Math.min(-PAPER_MARGIN, Math.floor(sb.minY)) : -PAPER_MARGIN;
  const width = (sb ? Math.max(c.width + PAPER_MARGIN, Math.ceil(sb.maxX)) : c.width + PAPER_MARGIN) - x0;
  const height = (sb ? Math.max(c.height + PAPER_MARGIN, Math.ceil(sb.maxY)) : c.height + PAPER_MARGIN) - y0;
  const parts = [
    `<rect width="${c.width}" height="${c.height}" fill="#ffffff"/>`,
    scene.minor.length ? `<path d="${path(scene.minor)}" stroke="${esc(c.gridColor)}" stroke-width="${MINOR_WIDTH}" stroke-opacity="${MINOR_OPACITY}" fill="none"/>` : "",
    scene.mid.length ? `<path d="${path(scene.mid)}" stroke="${esc(c.gridColor)}" stroke-width="${MID_WIDTH}" stroke-opacity="${MID_OPACITY}" fill="none"/>` : "",
    scene.major.length ? `<path d="${path(scene.major)}" stroke="${esc(c.gridColor)}" stroke-width="${MAJOR_WIDTH}" fill="none"/>` : "",
    // the curves go over the grid and under the axes and their texts
    ...scene.curves.flatMap((k) => k.segments.map((seg) => `<polyline points="${Array.from({ length: seg.length / 2 }, (_, i) => num(seg[2 * i]) + "," + num(seg[2 * i + 1])).join(" ")}" fill="none" stroke="${esc(k.color)}" stroke-width="${k.width}"${k.dash ? ` stroke-dasharray="${k.dash.map(num).join(" ")}"` : ""} stroke-linejoin="round" stroke-linecap="round" data-curve="${esc(k.id)}"/>`)),
    ...scene.curves.flatMap((k) => k.dots.map((d) => `<circle cx="${num(d.x)}" cy="${num(d.y)}" r="4" fill="#ffffff" stroke="${esc(k.color)}" stroke-width="2" data-curve="${esc(k.id)}"/>`)),
    `<path d="${path(scene.axes)}" stroke="${INK}" stroke-width="${AXIS_WIDTH}" fill="none"/>`,
    scene.ticks.length ? `<path d="${path(scene.ticks)}" stroke="${INK}" stroke-width="${TICK_WIDTH}" fill="none"/>` : "",
    ...scene.arrows.map((a) => `<polygon points="${a.map(num).join(" ")}" fill="${INK}"/>`),
    // the annotations: their lines and dots over the curves and the axes, then what is behind their texts, then the texts
    ...scene.annotations.flatMap((a) => [
      ...a.lines.map((l) => `<polyline points="${Array.from({ length: l.points.length / 2 }, (_, i) => num(l.points[2 * i]) + "," + num(l.points[2 * i + 1])).join(" ")}" fill="none" stroke="${esc(a.color)}" stroke-width="${l.width}"${l.dash ? ` stroke-dasharray="${l.dash.join(" ")}"` : ""} stroke-linecap="round" stroke-linejoin="round" data-annotation="${esc(a.id)}"/>`),
      ...a.dots.map((d) => `<circle cx="${num(d.x)}" cy="${num(d.y)}" r="${d.r}" fill="${esc(a.color)}" data-annotation="${esc(a.id)}"/>`),
    ]),
    ...scene.annotations.flatMap((a) => a.texts.flatMap((t) => (t.frame ? [frameElement(t.frame, a.color, ` data-annotation="${esc(a.id)}"`)] : []))),
    ...scene.annotations.flatMap((a) => a.texts.map((t) => textElement(t, a.color, ` data-annotation="${esc(a.id)}"`))),
    ...scene.texts.map((t) => textElement(t, INK)),
    shapesSvg(c.shapes),
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}"><g transform="translate(${-x0} ${-y0})">${parts.join("")}</g></svg>`;
  return { svg, width, height };
}
