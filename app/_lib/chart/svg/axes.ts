// The axes of the charts with two axes (columns, bars, lines, areas, combinations, scatters, histograms, boxes, waterfalls): the room they
// take round the plot, the gridlines, the numbers and the names of the categories (tilted when they do not fit), the titles, and the table of
// the data under a chart. Pure functions that write SVG text.
import { fraction, type Scale } from "../scale";
import type { AxisOptions } from "../types";
import { AXIS, GRID, GRID_MINOR, INK, line, rect, text, textWidth, type Box, type Ctx } from "./kit";

/** The plot rectangle, and which way the categories run (up the left side for bars) */
export interface Frame {
  box: Box;
  horizontal: boolean;
}

/** Where a place on the value axis (0 = its start, 1 = its end) is, along the axis */
export const valuePx = (f: Frame, frac: number) => (f.horizontal ? f.box.x + frac * f.box.w : f.box.y + f.box.h - frac * f.box.h);
/** Where a place on the category axis (0 = its start, 1 = its end) is. The first category of a bar chart is at the bottom, as in Excel. */
export const catPx = (f: Frame, t: number) => (f.horizontal ? f.box.y + f.box.h - t * f.box.h : f.box.x + t * f.box.w);
/** A point from its place along the categories and along the values */
export const pointAt = (f: Frame, c: number, v: number): [number, number] => (f.horizontal ? [v, c] : [c, v]);

/** The rectangle between two places along the categories and two along the values */
export function rectBetween(f: Frame, c0: number, c1: number, v0: number, v1: number): Box {
  const [x0, y0] = pointAt(f, c0, v0);
  const [x1, y1] = pointAt(f, c1, v1);
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
}

/** The place of a value on the scale along the value axis (the axis can run the other way) */
export const valueAt = (f: Frame, scale: Scale, v: number, reverse = false) => valuePx(f, reverse ? 1 - fraction(scale, v) : fraction(scale, v));

export interface TableRow {
  name: string;
  values: string[];
  color: string;
  fill: string;
  stroke?: string;
}

export interface LayoutSpec {
  horizontal: boolean;
  /** The names of the categories (or the numbers on a numeric x axis) */
  catLabels: string[];
  /** The categories are in bands (columns) rather than at points; false for numbers on a scale */
  band: boolean;
  catOpts: AxisOptions;
  valLabels: string[];
  valOpts: AxisOptions;
  /** The second value axis, when a series is on it */
  val2Labels?: string[];
  val2Opts?: AxisOptions;
  table?: TableRow[];
}

export interface Layout {
  box: Box;
  /** The tilt of the category names and how many are written (one in `every`) */
  rotate: 0 | 45 | 90;
  every: number;
  /** Room taken by the numbers of the value axis, by the names of the categories, by the second axis */
  valueSize: number;
  catSize: number;
  value2Size: number;
  tableH: number;
}

const maxWidth = (ctx: Ctx, labels: string[], size = ctx.fs) => (labels.length ? Math.max(...labels.map((l) => textWidth(ctx, l, size))) : 0);
const TICK = 4;

/** The room the axes need round the area, and so what is left for the plot */
export function layoutAxes(ctx: Ctx, area: Box, s: LayoutSpec): Layout {
  const fs = ctx.fs;
  const lh = fs * 1.35;
  const mini = ctx.mini;
  const catTitle = !mini && s.catOpts.show && s.catOpts.title.trim() ? lh + 6 : 0;
  const valTitle = !mini && s.valOpts.show && s.valOpts.title.trim() ? lh + 6 : 0;
  const val2Title = !mini && s.val2Opts?.show && s.val2Opts.title.trim() ? lh + 6 : 0;
  const tableH = !mini && s.table?.length ? (s.table.length + 1) * lh * 1.1 : 0;
  const tableName = tableH ? Math.max(...(s.table ?? []).map((r) => textWidth(ctx, r.name, fs) + 22)) : 0;
  let left = 6;
  let right = 6;
  const top = mini ? 2 : 8;
  let bottom = mini ? 2 : 6;
  let valueSize = 0;
  let catSize = 0;
  let value2Size = 0;
  let rotate: Layout["rotate"] = 0;
  let every = 1;

  if (s.horizontal) {
    // categories up the left, values along the bottom
    if (s.catOpts.show && !mini) {
      catSize = maxWidth(ctx, s.catLabels) + 8 + TICK;
      left += catSize + catTitle;
    } else left += catTitle;
    if (s.valOpts.show && !mini) {
      valueSize = lh + 4 + TICK;
      bottom += valueSize + valTitle;
      right += maxWidth(ctx, s.valLabels.slice(-1)) / 2;
    } else bottom += valTitle;
  } else {
    if (s.valOpts.show && !mini) {
      valueSize = maxWidth(ctx, s.valLabels) + 8 + TICK;
      left += valueSize + valTitle;
    } else left += valTitle;
    if (s.val2Labels && s.val2Opts?.show && !mini) {
      value2Size = maxWidth(ctx, s.val2Labels) + 8 + TICK;
      right += value2Size + val2Title;
    }
    if (tableH) left = Math.max(left, tableName + 6);
    // (an axis that starts with a category on it: half of its name is on this side of the axis)
    if (!s.band && s.catOpts.show && !mini && s.catLabels.length) left = Math.max(left, maxWidth(ctx, s.catLabels.slice(0, 1)) / 2 + 4);
    if (s.catOpts.show && !mini) {
      const n = Math.max(1, s.catLabels.length);
      const plotW = Math.max(40, area.w - left - right - (s.band ? 0 : maxWidth(ctx, s.catLabels.slice(-1)) / 2));
      const band = plotW / (s.band ? n : Math.max(1, n - 1));
      const widest = maxWidth(ctx, s.catLabels);
      const wanted = s.catOpts.labelAngle;
      if (tableH) {
        rotate = 0; // (the names are in the table)
        catSize = 0;
      } else {
        if (wanted === "auto") {
          if (widest + 6 <= band || !s.band) rotate = 0;
          else if (band >= fs * 1.5) rotate = 45;
          else rotate = 90;
        } else rotate = wanted;
        const spacing = rotate === 0 ? widest + 6 : rotate === 45 ? fs * 1.5 : fs * 1.25;
        every = s.catOpts.every && s.catOpts.every > 0 ? Math.round(s.catOpts.every) : spacing <= band + 0.5 ? 1 : Math.max(1, Math.ceil(spacing / band));
        catSize = (rotate === 0 ? lh : rotate === 45 ? widest * 0.71 + fs * 0.8 : widest + 4) + 4 + TICK;
        right += !s.band && rotate === 0 ? maxWidth(ctx, s.catLabels.slice(-1)) / 2 : 0;
      }
      bottom += catSize + catTitle;
    } else bottom += catTitle;
    bottom += tableH;
  }
  const box = { x: area.x + left, y: area.y + top, w: Math.max(20, area.w - left - right), h: Math.max(20, area.h - top - bottom) };
  return { box, rotate, every, valueSize, catSize, value2Size, tableH };
}

// ---- gridlines ----

/** The gridlines (behind the series): along the values (major, minor), and along the categories for the charts that have a number scale there */
export function drawGrid(ctx: Ctx, f: Frame, valScale: Scale, grid: { major: boolean; minor: boolean }, cross?: { scale: Scale; major: boolean; minor: boolean }) {
  const { box, horizontal } = f;
  const lineAt = (frac: number, along: "val" | "cat", color: string, sw: number) => {
    if (along === "val") {
      const p = valuePx(f, frac);
      if (horizontal) line(ctx, p, box.y, p, box.y + box.h, { stroke: color, sw });
      else line(ctx, box.x, p, box.x + box.w, p, { stroke: color, sw });
    } else {
      const p = catPx(f, frac);
      if (horizontal) line(ctx, box.x, p, box.x + box.w, p, { stroke: color, sw });
      else line(ctx, p, box.y, p, box.y + box.h, { stroke: color, sw });
    }
  };
  if (grid.minor) for (const v of valScale.minor) lineAt(fraction(valScale, v), "val", GRID_MINOR, 0.6);
  if (grid.major) for (const v of valScale.ticks) lineAt(fraction(valScale, v), "val", GRID, 0.8);
  if (cross?.minor) for (const v of cross.scale.minor) lineAt(fraction(cross.scale, v), "cat", GRID_MINOR, 0.6);
  if (cross?.major) for (const v of cross.scale.ticks) lineAt(fraction(cross.scale, v), "cat", GRID, 0.8);
}

// ---- value axis ----

/** The numbers of a value axis, its line, its ticks and its title. `secondary` puts it on the other side. */
export function drawValueAxis(ctx: Ctx, f: Frame, layout: Layout, scale: Scale, labels: string[], opts: AxisOptions, o: { secondary?: boolean; reverse?: boolean } = {}) {
  if (!opts.show) return;
  const { box, horizontal } = f;
  const rev = !!o.reverse;
  const tick = opts.ticks === "none" ? 0 : opts.ticks === "in" ? -TICK : TICK;
  const attrs = `data-part="${o.secondary ? "axis-y2" : "axis-y"}"`;
  if (!horizontal) {
    const x = o.secondary ? box.x + box.w : box.x;
    const dir = o.secondary ? 1 : -1;
    if (opts.line) line(ctx, x, box.y, x, box.y + box.h, { stroke: AXIS, sw: 1 });
    scale.ticks.forEach((v, i) => {
      const y = valueAt(f, scale, v, rev);
      if (tick) line(ctx, x, y, x + dir * tick, y, { stroke: AXIS, sw: 1 });
      text(ctx, x + dir * (Math.max(tick, 0) + 4), y, labels[i] ?? "", { anchor: o.secondary ? "start" : "end", fill: INK, extra: attrs });
    });
    if (opts.title.trim()) {
      const size = ctx.fs;
      const cx = o.secondary ? x + layout.value2Size + size * 0.9 + 2 : x - layout.valueSize - size * 0.9 - 2;
      text(ctx, cx, box.y + box.h / 2, opts.title, { anchor: "middle", rotate: o.secondary ? 90 : -90, size, bold: true, extra: attrs });
    }
  } else {
    const y = box.y + box.h;
    if (opts.line) line(ctx, box.x, y, box.x + box.w, y, { stroke: AXIS, sw: 1 });
    scale.ticks.forEach((v, i) => {
      const x = valueAt(f, scale, v, rev);
      if (tick) line(ctx, x, y, x, y + tick, { stroke: AXIS, sw: 1 });
      text(ctx, x, y + Math.max(tick, 0) + ctx.fs * 0.85, labels[i] ?? "", { anchor: "middle", extra: attrs });
    });
    if (opts.title.trim()) text(ctx, box.x + box.w / 2, y + layout.valueSize + ctx.fs * 0.9 + 4, opts.title, { anchor: "middle", size: ctx.fs, bold: true, extra: attrs });
  }
}

// ---- category axis ----

/** The names of the categories (in bands, or at points), the line, the ticks and the title. */
export function drawCategoryAxis(ctx: Ctx, f: Frame, layout: Layout, labels: string[], opts: AxisOptions, band: boolean, placeAt?: (i: number) => number) {
  if (!opts.show) return;
  const { box, horizontal } = f;
  const n = labels.length;
  const at = placeAt ?? ((i: number) => (band ? (i + 0.5) / n : n > 1 ? i / (n - 1) : 0.5));
  const tick = opts.ticks === "none" ? 0 : opts.ticks === "in" ? -TICK : TICK;
  const attrs = 'data-part="axis-x"';
  const pos = (i: number) => {
    const t = opts.reverse ? 1 - at(i) : at(i);
    return catPx(f, t);
  };
  if (!horizontal) {
    const y = box.y + box.h;
    if (opts.line) line(ctx, box.x, y, box.x + box.w, y, { stroke: AXIS, sw: 1 });
    if (tick) {
      const edges = band ? Array.from({ length: n + 1 }, (_, i) => i / n) : Array.from({ length: n }, (_, i) => at(i));
      for (const e of edges) {
        const x = catPx(f, opts.reverse ? 1 - e : e);
        line(ctx, x, y, x, y + tick, { stroke: AXIS, sw: 1 });
      }
    }
    if (!layout.tableH) {
      labels.forEach((label, i) => {
        if (i % layout.every !== 0) return;
        const x = pos(i);
        const ty = y + Math.max(tick, 0) + 4;
        if (layout.rotate === 0) text(ctx, x, ty + ctx.fs * 0.65, label, { anchor: "middle", extra: attrs });
        else text(ctx, x + ctx.fs * 0.3, ty + 2, label, { anchor: "end", rotate: -layout.rotate, extra: attrs });
      });
    }
    if (opts.title.trim() && !layout.tableH) text(ctx, box.x + box.w / 2, y + layout.catSize + ctx.fs * 0.8 + 2, opts.title, { anchor: "middle", size: ctx.fs, bold: true, extra: attrs });
    else if (opts.title.trim()) text(ctx, box.x + box.w / 2, y + layout.tableH + ctx.fs * 0.8 + 2, opts.title, { anchor: "middle", size: ctx.fs, bold: true, extra: attrs });
  } else {
    const x = box.x;
    if (opts.line) line(ctx, x, box.y, x, box.y + box.h, { stroke: AXIS, sw: 1 });
    if (tick) {
      const edges = band ? Array.from({ length: n + 1 }, (_, i) => i / n) : Array.from({ length: n }, (_, i) => at(i));
      for (const e of edges) {
        const y = catPx(f, opts.reverse ? 1 - e : e);
        line(ctx, x, y, x - tick, y, { stroke: AXIS, sw: 1 });
      }
    }
    labels.forEach((label, i) => {
      if (i % layout.every !== 0) return;
      text(ctx, x - Math.max(tick, 0) - 4, pos(i), label, { anchor: "end", extra: attrs });
    });
    if (opts.title.trim()) text(ctx, x - layout.catSize - ctx.fs * 0.9 - 2, box.y + box.h / 2, opts.title, { anchor: "middle", rotate: -90, size: ctx.fs, bold: true, extra: attrs });
  }
}

/** The tick marks and numbers of a numeric axis along the categories' side (scatter, histogram): `scale` is the x scale. */
export function drawNumericXAxis(ctx: Ctx, f: Frame, layout: Layout, scale: Scale, labels: string[], opts: AxisOptions) {
  if (!opts.show) return;
  const { box } = f;
  const y = box.y + box.h;
  const tick = opts.ticks === "none" ? 0 : opts.ticks === "in" ? -TICK : TICK;
  const attrs = 'data-part="axis-x"';
  if (opts.line) line(ctx, box.x, y, box.x + box.w, y, { stroke: AXIS, sw: 1 });
  scale.ticks.forEach((v, i) => {
    const t = fraction(scale, v);
    const x = catPx(f, opts.reverse ? 1 - t : t);
    if (tick) line(ctx, x, y, x, y + tick, { stroke: AXIS, sw: 1 });
    text(ctx, x, y + Math.max(tick, 0) + 4 + ctx.fs * 0.65, labels[i] ?? "", { anchor: "middle", extra: attrs });
  });
  if (opts.title.trim()) text(ctx, box.x + box.w / 2, y + layout.catSize + ctx.fs * 0.8 + 2, opts.title, { anchor: "middle", size: ctx.fs, bold: true, extra: attrs });
}

// ---- the table of the data ----

/** The numbers of the chart in a table under it, a column under each category, with the key of each series */
export function drawDataTable(ctx: Ctx, f: Frame, layout: Layout, categories: string[], rows: TableRow[], opts: AxisOptions) {
  if (!layout.tableH || !rows.length) return;
  const { box } = f;
  const n = categories.length;
  const rowH = layout.tableH / (rows.length + 1);
  const top = box.y + box.h;
  const band = box.w / Math.max(1, n);
  const left = box.x;
  const right = box.x + box.w;
  const names = Math.max(...rows.map((r) => textWidth(ctx, r.name, ctx.fs) + 22));
  // lines: the frame of the table (with the column of the names), a line under every row, a line between the categories
  for (let r = 0; r <= rows.length + 1; r++) line(ctx, left - names - 2, top + r * rowH, right, top + r * rowH, { stroke: AXIS, sw: 0.8 });
  line(ctx, left - names - 2, top, left - names - 2, top + layout.tableH, { stroke: AXIS, sw: 0.8 });
  for (let k = 0; k <= n; k++) {
    const x = box.x + k * band;
    line(ctx, x, top, x, top + layout.tableH, { stroke: AXIS, sw: 0.8 });
  }
  categories.forEach((c, k) => text(ctx, box.x + (k + 0.5) * band, top + rowH / 2, c, { anchor: "middle", extra: 'data-part="axis-x"' }));
  rows.forEach((r, i) => {
    const cy = top + (i + 1.5) * rowH;
    rect(ctx, left - names + 2, cy - 4, 10, 8, { fill: r.fill, ...(r.stroke ? { stroke: r.stroke, sw: 1 } : {}) });
    text(ctx, left - names + 16, cy, r.name, { anchor: "start" });
    r.values.forEach((v, k) => text(ctx, box.x + (k + 0.5) * band, cy, v, { anchor: "middle" }));
  });
  if (opts.title.trim()) text(ctx, box.x + box.w / 2, top + layout.tableH + ctx.fs * 0.8 + 2, opts.title, { anchor: "middle", size: ctx.fs, bold: true });
}
