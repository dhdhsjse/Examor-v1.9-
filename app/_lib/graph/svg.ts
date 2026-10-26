// The picture of a graph paper for the page (an image block's `src`): the same scene as the canvas, as an SVG with a margin
// around the paper for the numbers, the labels and the arrows. Pure function, unit-tested.
import { PAPER_MARGIN, buildScene, fatalIssue, type GraphScene, type SceneOptions } from "./grid";
import type { GraphConfig } from "./types";

export const INK = "#111827";
const FONT = "Arial, Helvetica, sans-serif";
const num = (n: number) => String(Math.round(n * 100) / 100);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const MINOR_OPACITY = 0.2;
export const MINOR_WIDTH = 0.5;
export const MAJOR_WIDTH = 0.8;
export const AXIS_WIDTH = 1.8;
export const TICK_WIDTH = 1.2;

export type GraphImage = { svg: string; width: number; height: number };

const path = (segments: GraphScene["minor"]) => segments.map((s) => `M${num(s.x1)} ${num(s.y1)}L${num(s.x2)} ${num(s.y2)}`).join("");

/** The picture of the paper (null if the configuration cannot be drawn). Its size is the paper's plus the margin on each side. */
export function renderGraphSvg(c: GraphConfig, options: SceneOptions = {}): GraphImage | null {
  if (fatalIssue(c)) return null;
  // (the teacher's picture is the answer key: what is masked is drawn like the rest; the student's has it left out)
  const scene = buildScene(c, options);
  const width = c.width + 2 * PAPER_MARGIN;
  const height = c.height + 2 * PAPER_MARGIN;
  const anchor = { start: "start", middle: "middle", end: "end" } as const;
  const parts = [
    `<rect width="${c.width}" height="${c.height}" fill="#ffffff"/>`,
    scene.minor.length ? `<path d="${path(scene.minor)}" stroke="${esc(c.gridColor)}" stroke-width="${MINOR_WIDTH}" stroke-opacity="${MINOR_OPACITY}" fill="none"/>` : "",
    scene.major.length ? `<path d="${path(scene.major)}" stroke="${esc(c.gridColor)}" stroke-width="${MAJOR_WIDTH}" fill="none"/>` : "",
    // the curves go over the grid and under the axes and their texts
    ...scene.curves.flatMap((k) => k.segments.map((seg) => `<polyline points="${Array.from({ length: seg.length / 2 }, (_, i) => num(seg[2 * i]) + "," + num(seg[2 * i + 1])).join(" ")}" fill="none" stroke="${esc(k.color)}" stroke-width="${k.width}" stroke-linejoin="round" stroke-linecap="round" data-curve="${esc(k.id)}"/>`)),
    ...scene.curves.flatMap((k) => k.dots.map((d) => `<circle cx="${num(d.x)}" cy="${num(d.y)}" r="4" fill="#ffffff" stroke="${esc(k.color)}" stroke-width="2" data-curve="${esc(k.id)}"/>`)),
    `<path d="${path(scene.axes)}" stroke="${INK}" stroke-width="${AXIS_WIDTH}" fill="none"/>`,
    scene.ticks.length ? `<path d="${path(scene.ticks)}" stroke="${INK}" stroke-width="${TICK_WIDTH}" fill="none"/>` : "",
    ...scene.arrows.map((a) => `<polygon points="${a.map(num).join(" ")}" fill="${INK}"/>`),
    // the annotations: their lines and dots over the curves and the axes, their texts last
    ...scene.annotations.flatMap((a) => [
      ...a.lines.map((l) => `<polyline points="${Array.from({ length: l.points.length / 2 }, (_, i) => num(l.points[2 * i]) + "," + num(l.points[2 * i + 1])).join(" ")}" fill="none" stroke="${esc(a.color)}" stroke-width="${l.width}"${l.dash ? ` stroke-dasharray="${l.dash.join(" ")}"` : ""} stroke-linecap="round" stroke-linejoin="round" data-annotation="${esc(a.id)}"/>`),
      ...a.dots.map((d) => `<circle cx="${num(d.x)}" cy="${num(d.y)}" r="${d.r}" fill="${esc(a.color)}" data-annotation="${esc(a.id)}"/>`),
    ]),
    ...scene.annotations.flatMap((a) =>
      a.texts.map((t) => `<text x="${num(t.x)}" y="${num(t.y)}" dy="0.35em" text-anchor="${anchor[t.align]}" font-size="${t.size}"${t.bold ? ' font-weight="bold"' : ""} fill="${esc(a.color)}" stroke="#ffffff" stroke-width="3" stroke-linejoin="round" paint-order="stroke" data-annotation="${esc(a.id)}">${esc(t.text)}</text>`),
    ),
    ...scene.texts.map(
      (t) => `<text x="${num(t.x)}" y="${num(t.y)}" dy="0.35em" text-anchor="${anchor[t.align]}" font-size="${t.size}" fill="${INK}" stroke="#ffffff" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${esc(t.text)}</text>`,
    ),
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}"><g transform="translate(${PAPER_MARGIN} ${PAPER_MARGIN})">${parts.join("")}</g></svg>`;
  return { svg, width, height };
}
