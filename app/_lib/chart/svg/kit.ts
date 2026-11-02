// What every chart is drawn with: the context (the chart, what it reads from its table, the font), the little drawing functions (text, shapes,
// markers), the fills (colors and hatchings), and the title and legend, which every kind has. Pure functions that write SVG text (no DOM).
import { fontStack } from "@/app/_lib/fonts";
import { measureText } from "@/app/_lib/measure";
import { PATTERN_COUNT, paletteColor, patternDef, readableOn, shade } from "../palette";
import type { ChartModel, Words } from "../data";
import type { ChartConfig, Dash, MarkerShape } from "../types";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Ctx {
  c: ChartConfig;
  m: ChartModel;
  W: number;
  H: number;
  /** The CSS font stack and the base size */
  font: string;
  fs: number;
  /** The decimal mark */
  mark: string;
  /** A thumbnail for the gallery: no text, thicker lines */
  mini: boolean;
  /** The picture for the students: the frame without the data */
  blank: boolean;
  words: Words;
  out: string[];
  defs: Map<string, string>;
}

export const INK = "#1f2937";
export const MUTED = "#6b7280";
export const GRID = "#d9dde3";
export const GRID_MINOR = "#eceff3";
export const AXIS = "#8b93a1";

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const num = (n: number) => String(Math.round(n * 100) / 100);

export const textWidth = (ctx: Ctx, s: string, size: number, bold = false) => measureText(s, { family: ctx.font, size, bold, italic: false });

export function makeCtx(c: ChartConfig, m: ChartModel, words: Words, opts: { mini?: boolean; blank?: boolean } = {}): Ctx {
  return { c, m, W: c.width, H: c.height, font: fontStack(c.fontFamily), fs: c.fontSize, mark: c.decimalMark, mini: !!opts.mini, blank: !!opts.blank, words, out: [], defs: new Map() };
}

// ---- drawing ----

export interface TextOptions {
  size?: number;
  anchor?: "start" | "middle" | "end";
  bold?: boolean;
  italic?: boolean;
  fill?: string;
  /** Turn the text round its position by this angle (degrees, clockwise) */
  rotate?: number;
  /** A white halo that keeps it readable over lines */
  halo?: boolean;
  extra?: string;
}

/** A text whose vertical middle is at y */
export function text(ctx: Ctx, x: number, y: number, s: string, o: TextOptions = {}): void {
  if (ctx.mini || s === "") return;
  const size = o.size ?? ctx.fs;
  const rotate = o.rotate ? ` transform="rotate(${num(o.rotate)} ${num(x)} ${num(y)})"` : "";
  const halo = o.halo ? ' stroke="#ffffff" stroke-width="3" stroke-linejoin="round" paint-order="stroke"' : "";
  ctx.out.push(
    `<text x="${num(x)}" y="${num(y)}" dy="0.35em" text-anchor="${o.anchor ?? "start"}" font-size="${num(size)}"${o.bold ? ' font-weight="bold"' : ""}${o.italic ? ' font-style="italic"' : ""} fill="${esc(o.fill ?? INK)}"${halo}${rotate}${o.extra ? ` ${o.extra}` : ""}>${esc(s)}</text>`,
  );
}

export interface ShapeOptions {
  fill?: string;
  stroke?: string;
  sw?: number;
  opacity?: number;
  dash?: Dash;
  extra?: string;
}

const dashAttr = (dash: Dash | undefined, sw: number) => (dash === "dashed" ? ` stroke-dasharray="${num(Math.max(sw * 4, 6))} ${num(Math.max(sw * 2.5, 4))}"` : dash === "dotted" ? ` stroke-dasharray="${num(Math.max(sw, 1.5))} ${num(Math.max(sw * 2, 3))}"` : "");
const paint = (o: ShapeOptions) => ` fill="${esc(o.fill ?? "none")}"${o.stroke ? ` stroke="${esc(o.stroke)}" stroke-width="${num(o.sw ?? 1)}"${dashAttr(o.dash, o.sw ?? 1)}` : ""}${o.opacity !== undefined && o.opacity < 1 ? ` opacity="${num(o.opacity)}"` : ""}${o.extra ? ` ${o.extra}` : ""}`;

export const rect = (ctx: Ctx, x: number, y: number, w: number, h: number, o: ShapeOptions = {}) => {
  if (w < 0 || h < 0 || !Number.isFinite(x + y + w + h)) return;
  ctx.out.push(`<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}"${paint(o)}/>`);
};

export const line = (ctx: Ctx, x1: number, y1: number, x2: number, y2: number, o: ShapeOptions = {}) => {
  if (!Number.isFinite(x1 + y1 + x2 + y2)) return;
  ctx.out.push(`<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" stroke="${esc(o.stroke ?? INK)}" stroke-width="${num(o.sw ?? 1)}"${dashAttr(o.dash, o.sw ?? 1)}${o.opacity !== undefined && o.opacity < 1 ? ` opacity="${num(o.opacity)}"` : ""}${o.extra ? ` ${o.extra}` : ""}/>`);
};

export const path = (ctx: Ctx, d: string, o: ShapeOptions = {}) => {
  if (!d) return;
  ctx.out.push(`<path d="${d}"${paint(o)} stroke-linejoin="round" stroke-linecap="round"/>`);
};

export const circle = (ctx: Ctx, x: number, y: number, r: number, o: ShapeOptions = {}) => {
  if (!Number.isFinite(x + y + r)) return;
  ctx.out.push(`<circle cx="${num(x)}" cy="${num(y)}" r="${num(r)}"${paint(o)}/>`);
};

/** A marker of a shape centered at (x, y) */
export function marker(ctx: Ctx, shape: MarkerShape, x: number, y: number, size: number, fill: string, stroke: string, extra = ""): void {
  const r = size / 2;
  const o = { fill, stroke, sw: 1, extra };
  switch (shape) {
    case "circle":
      return circle(ctx, x, y, r, o);
    case "square":
      return rect(ctx, x - r, y - r, size, size, o);
    case "diamond":
      return path(ctx, `M${num(x)} ${num(y - r * 1.25)}L${num(x + r * 1.25)} ${num(y)}L${num(x)} ${num(y + r * 1.25)}L${num(x - r * 1.25)} ${num(y)}Z`, o);
    case "triangle":
      return path(ctx, `M${num(x)} ${num(y - r * 1.15)}L${num(x + r * 1.15)} ${num(y + r)}L${num(x - r * 1.15)} ${num(y + r)}Z`, o);
    case "cross":
      return path(ctx, `M${num(x - r)} ${num(y)}H${num(x + r)}M${num(x)} ${num(y - r)}V${num(y + r)}`, { stroke: fill, sw: 1.8, extra });
    case "x":
      return path(ctx, `M${num(x - r)} ${num(y - r)}L${num(x + r)} ${num(y + r)}M${num(x + r)} ${num(y - r)}L${num(x - r)} ${num(y + r)}`, { stroke: fill, sw: 1.8, extra });
  }
}

export const MARKER_SHAPES: MarkerShape[] = ["circle", "square", "diamond", "triangle", "x", "cross"];

// ---- colors ----

export interface Paint {
  /** What fills a bar or a slice: the color, or the hatching */
  fill: string;
  /** The color of a line, a marker, the outline */
  color: string;
  /** The line round a filled shape (hatchings need one) */
  stroke?: string;
}

/** The color of series `i` (and of its point `p`, which the table may give a color of its own, or which varies in a one-series chart) */
export function colorOf(ctx: Ctx, series: number, point?: number, vary = false): string {
  const s = ctx.c.series[series];
  if (point !== undefined && s?.points?.[point]?.color) return s.points[point].color as string;
  if (vary && point !== undefined) return paletteColor(ctx.c.palette, point);
  return s?.color ?? paletteColor(ctx.c.palette, series);
}

/** The fill of series `i` for a bar or a slice: the color, or with hatchings the hatching in turn (the series number, or the point's when it varies) */
export function paintOf(ctx: Ctx, series: number, point?: number, vary = false): Paint {
  const color = colorOf(ctx, series, point, vary);
  if (!ctx.c.patterns) return { fill: color, color };
  const k = vary && point !== undefined ? point : series;
  const ink = ctx.c.palette === "colorful" || ctx.c.palette === "pastel" ? shade(color, -0.45) : "#262626";
  const id = `p${k % PATTERN_COUNT}-${ink.replace("#", "")}`;
  if (!ctx.defs.has(id)) ctx.defs.set(id, patternDef(id, k, ink));
  return { fill: `url(#${id})`, color, stroke: ink };
}

/** The line a hatched shape has round it (none for a flat color) */
export const outline = (p: Paint): ShapeOptions => (p.stroke ? { stroke: p.stroke, sw: 1 } : {});

/** The ink that reads on a series' fill (labels inside bars) */
export const inkOn = (ctx: Ctx, p: Paint) => (ctx.c.patterns ? "#111827" : readableOn(p.color));

// ---- title and legend ----

export interface LegendItem {
  label: string;
  /** What the key shows: a square of the fill, a line, or a line with a marker */
  key: "box" | "line" | "marker" | "dot" | "none";
  paint: Paint;
  dash?: Dash;
  shape?: MarkerShape;
}

const KEY_W = 16;
const GAP = 14;

/** Draws the background, the border, the title and the legend; returns the room that is left for the chart itself. */
export function frame(ctx: Ctx, items: LegendItem[]): Box {
  const { c, W, H } = ctx;
  if (c.background) rect(ctx, 0, 0, W, H, { fill: c.background });
  if (c.border) rect(ctx, 0.5, 0.5, W - 1, H - 1, { fill: "none", stroke: "#9ca3af", sw: 1 });
  const pad = ctx.mini ? 4 : 10;
  let { x, y, w, h } = { x: pad, y: pad, w: W - 2 * pad, h: H - 2 * pad };

  // the title
  if (c.title.show && c.title.text.trim() && !ctx.mini) {
    const size = c.title.size;
    const th = size * 1.5 + 6;
    const ty = c.title.position === "top" ? y + th / 2 : y + h - th / 2;
    const tx = c.title.align === "center" ? x + w / 2 : x;
    text(ctx, tx, ty, c.title.text, { size, bold: c.title.bold, italic: c.title.italic, fill: c.title.color, anchor: c.title.align === "center" ? "middle" : "start", extra: 'data-part="title"' });
    if (c.title.position === "top") y += th;
    h -= th;
  }

  // the legend
  if (c.legend.show && items.length && !ctx.mini) {
    const size = ctx.fs;
    const keyW = (it: LegendItem) => (it.key === "none" ? 0 : KEY_W + 6);
    const widths = items.map((it) => keyW(it) + textWidth(ctx, it.label, size));
    const rowH = size * 1.5;
    const drawItem = (it: LegendItem, ix: number, iy: number) => {
      const cy = iy + rowH / 2;
      if (it.key === "none") {
        // (nothing to show the part by: its number is in the label)
      } else if (it.key === "box") rect(ctx, ix, cy - 5, 12, 10, { fill: it.paint.fill, ...outline(it.paint) });
      else if (it.key === "dot") marker(ctx, it.shape ?? "circle", ix + KEY_W / 2, cy, 7, it.paint.color, it.paint.color);
      else {
        line(ctx, ix, cy, ix + KEY_W, cy, { stroke: it.paint.color, sw: 2, dash: it.dash });
        if (it.key === "marker") marker(ctx, it.shape ?? "circle", ix + KEY_W / 2, cy, 6, it.paint.color, it.paint.color);
      }
      text(ctx, ix + keyW(it), cy, it.label, { size });
    };
    if (c.legend.position === "top" || c.legend.position === "bottom") {
      const rows: { items: number[]; width: number }[] = [];
      for (let i = 0; i < items.length; i++) {
        const last = rows[rows.length - 1];
        if (last && last.width + GAP + widths[i] <= w) {
          last.items.push(i);
          last.width += GAP + widths[i];
        } else rows.push({ items: [i], width: widths[i] });
      }
      const total = rows.length * rowH + 4;
      let ry = c.legend.position === "top" ? y : y + h - total + 4;
      for (const row of rows) {
        let rx = x + (w - row.width) / 2;
        for (const i of row.items) {
          drawItem(items[i], rx, ry);
          rx += widths[i] + GAP;
        }
        ry += rowH;
      }
      if (c.legend.position === "top") y += total;
      h -= total;
    } else {
      const lw = Math.max(...widths) + 8;
      const total = items.length * rowH;
      const ly = y + (h - total) / 2;
      const lx = c.legend.position === "left" ? x : x + w - lw;
      items.forEach((it, i) => drawItem(it, lx, ly + i * rowH));
      if (c.legend.position === "left") x += lw + 8;
      w -= lw + 8;
    }
  }
  return { x, y, w: Math.max(w, 10), h: Math.max(h, 10) };
}

/** The finished SVG: the defs (hatchings), then everything drawn. It reads left to right wherever it is put: the picture on the page always does, and the
 *  copy inside an Arabic screen (the dialog, the Studio) must not draw its text from the other side of each anchor. */
export function finish(ctx: Ctx): string {
  const defs = ctx.defs.size ? `<defs>${[...ctx.defs.values()].join("")}</defs>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ctx.W}" height="${ctx.H}" viewBox="0 0 ${ctx.W} ${ctx.H}" direction="ltr" font-family="${esc(ctx.font)}" font-size="${ctx.fs}">${defs}${ctx.out.join("")}</svg>`;
}
