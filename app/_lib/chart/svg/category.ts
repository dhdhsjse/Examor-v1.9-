// The charts whose x axis is a list of categories: columns, bars, lines, areas, combinations of them, and waterfalls. Columns and bars are
// the same drawing turned (the frame says which way the categories run). Pure functions that write SVG text.
import { isPercentStacked, isStacked } from "../catalog";
import { present, waterfallSteps, type ModelSeries } from "../data";
import { shade } from "../palette";
import { axisText, niceScale, startsAtZero, valueText, type Scale } from "../scale";
import type { SeriesKind } from "../types";
import {
  catPx,
  drawCategoryAxis,
  drawDataTable,
  drawGrid,
  drawValueAxis,
  layoutAxes,
  pointAt,
  rectBetween,
  valueAt,
  type Frame,
  type TableRow,
} from "./axes";
import { errorEnds, labelText, labelsFor, trendOf } from "./extras";
import { MARKER_SHAPES, frame, inkOn, line, marker, num, outline, paintOf, path, rect, text, textWidth, type Ctx, type LegendItem, type Paint } from "./kit";

interface Resolved {
  s: ModelSeries;
  kind: SeriesKind;
  secondary: boolean;
  /** Its place among the series that are drawn */
  pos: number;
  paint: Paint;
}

/** How every visible series is drawn, and on which axis (the family decides, a combination lets each series choose) */
function resolve(ctx: Ctx): Resolved[] {
  const { c, m } = ctx;
  const vis = m.series.filter((s) => !s.style.hidden);
  return vis.map((s, pos) => {
    let kind: SeriesKind = c.family === "line" ? "line" : c.family === "area" ? "area" : "column";
    let secondary = false;
    if (c.family === "combo") {
      const last = pos === vis.length - 1 && vis.length > 1;
      if (c.variant === "columnLine") kind = last ? "line" : "column";
      else if (c.variant === "columnLineSecondary") {
        kind = last ? "line" : "column";
        secondary = last;
      } else if (c.variant === "areaColumn") kind = last ? "column" : "area";
      if (s.style.kind) kind = s.style.kind;
      if (s.style.secondary !== undefined) secondary = s.style.secondary;
    }
    return { s, kind, secondary, pos, paint: paintOf(ctx, s.index, undefined, false) };
  });
}

/** Whether the series of a kind are added up (stacked column, bar, line or area; the areas of a stacked-area-and-column combination) */
function stacks(ctx: Ctx, kind: SeriesKind): boolean {
  const { family, variant } = ctx.c;
  if (family === "combo") return variant === "areaColumn" && kind === "area";
  return isStacked(variant) && kind === (family === "line" ? "line" : family === "area" ? "area" : "column");
}

interface Stacked {
  from: (number | null)[];
  to: (number | null)[];
}

/** The two ends of every piece of a stack, by category: positives pile up, negatives pile down; 100 % turns them into shares */
function stack(group: Resolved[], n: number, percent: boolean): Stacked[] {
  const pos = new Array<number>(n).fill(0);
  const neg = new Array<number>(n).fill(0);
  const totals = Array.from({ length: n }, (_, k) => group.reduce((s, r) => s + Math.abs(r.s.values[k] ?? 0), 0));
  return group.map((r) => {
    const from: (number | null)[] = [];
    const to: (number | null)[] = [];
    for (let k = 0; k < n; k++) {
      const raw = r.s.values[k];
      if (raw === null) {
        from.push(null);
        to.push(null);
        continue;
      }
      const v = percent ? (totals[k] > 0 ? Math.max(0, raw) / totals[k] : 0) : raw;
      if (v >= 0) {
        from.push(pos[k]);
        pos[k] += v;
        to.push(pos[k]);
      } else {
        from.push(neg[k]);
        neg[k] += v;
        to.push(neg[k]);
      }
    }
    return { from, to };
  });
}

/** A smooth path through points (Catmull-Rom turned into Bézier curves); null points break it */
function smoothPath(pts: ([number, number] | null)[]): string {
  let d = "";
  let run: [number, number][] = [];
  const flush = () => {
    if (run.length === 1) d += `M${num(run[0][0])} ${num(run[0][1])}`;
    else if (run.length > 1) {
      d += `M${num(run[0][0])} ${num(run[0][1])}`;
      for (let i = 0; i < run.length - 1; i++) {
        const p0 = run[i - 1] ?? run[i];
        const p1 = run[i];
        const p2 = run[i + 1];
        const p3 = run[i + 2] ?? p2;
        d += `C${num(p1[0] + (p2[0] - p0[0]) / 6)} ${num(p1[1] + (p2[1] - p0[1]) / 6)} ${num(p2[0] - (p3[0] - p1[0]) / 6)} ${num(p2[1] - (p3[1] - p1[1]) / 6)} ${num(p2[0])} ${num(p2[1])}`;
      }
    }
    run = [];
  };
  for (const p of pts) {
    if (p) run.push(p);
    else flush();
  }
  flush();
  return d;
}

/** A path through points, straight or smooth, broken where a value is missing */
export function linePath(pts: ([number, number] | null)[], smooth: boolean): string {
  if (smooth) return smoothPath(pts);
  let d = "";
  let pen = false;
  for (const p of pts) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${num(p[0])} ${num(p[1])}`;
    pen = true;
  }
  return d;
}

const baseline = (scale: Scale) => (scale.log ? scale.min : Math.max(scale.min, Math.min(0, scale.max)));

export function renderCategory(ctx: Ctx): void {
  const { c, m } = ctx;
  if (c.family === "waterfall") return renderWaterfall(ctx);
  const horizontal = c.family === "bar";
  const all = resolve(ctx);
  const n = m.categories.length;
  const percent = isPercentStacked(c.variant) && c.family !== "combo";
  const byAxis = (secondary: boolean) => all.filter((r) => r.secondary === secondary);
  const hasSecondary = all.some((r) => r.secondary);
  // the categories are in bands (columns, lines), or at points on the axis (an area starts at the axis)
  const band = layoutBand(ctx, all);

  // the numbers each axis has to hold
  const domain = (rs: Resolved[]): { lo: number; hi: number; zero: boolean } => {
    let lo = Infinity;
    let hi = -Infinity;
    let zero = false;
    const add = (v: number) => {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    };
    for (const kind of ["column", "line", "area"] as const) {
      const group = rs.filter((r) => r.kind === kind);
      if (!group.length) continue;
      if (kind !== "line") zero = true;
      if (stacks(ctx, kind)) {
        for (const st of stack(group, n, percent)) {
          st.from.forEach((v) => v !== null && add(v));
          st.to.forEach((v) => v !== null && add(v));
        }
      } else {
        for (const r of group) {
          const vals = present(r.s.values);
          for (const v of r.s.values) {
            if (v === null) continue;
            add(v);
            if (r.s.style.error) {
              const [a, b] = errorEnds(r.s.style.error, v, vals);
              add(a);
              add(b);
            }
          }
        }
      }
    }
    return { lo, hi, zero };
  };
  const scaleFor = (rs: Resolved[], axis: typeof c.axes.y) => {
    const d = domain(rs);
    if (percent) return niceScale({ lo: 0, hi: 1 }, { ...axis, min: axis.min ?? 0, max: axis.max ?? 1, unit: axis.unit ?? 0.2, log: false });
    return niceScale({ lo: Number.isFinite(d.lo) ? d.lo : 0, hi: Number.isFinite(d.hi) ? d.hi : 1, includeZero: (d.zero || startsAtZero(d.lo, d.hi)) && !axis.log }, axis);
  };
  const primary = byAxis(false);
  const scale1 = scaleFor(primary.length ? primary : all, c.axes.y);
  const scale2 = hasSecondary ? scaleFor(byAxis(true), c.axes.y2) : null;
  const fmt1 = percent ? { percent: true, decimals: 0, ...c.axes.y.format } : c.axes.y.format;
  const labels1 = scale1.ticks.map((v) => axisText(v, fmt1, scale1.unit, ctx.mark));
  const labels2 = scale2 ? scale2.ticks.map((v) => axisText(v, c.axes.y2.format, scale2.unit, ctx.mark)) : undefined;

  // the legend: every series (and the trendlines)
  const trends = new Map<number, ReturnType<typeof trendOf>>();
  const legend: LegendItem[] = [];
  for (const r of all) {
    const kind = r.kind;
    const markers = markerOf(ctx, r) !== "none";
    legend.push({ label: r.s.name, key: kind === "line" ? (markers ? "marker" : "line") : "box", paint: r.paint, dash: r.s.style.dash, shape: markerOf(ctx, r) === "none" ? undefined : (markerOf(ctx, r) as never) });
    const t = r.s.style.trendline;
    if (t) {
      const xs = Array.from({ length: n }, (_, k) => k + 1);
      const pts = xs.flatMap((x, k): [number, number][] => (r.s.values[k] === null ? [] : [[x, r.s.values[k] as number]]));
      const tr = trendOf(ctx, t, pts, [1, Math.max(1, n)], r.s.name);
      if (tr) {
        trends.set(r.s.index, tr);
        legend.push({ label: tr.legend, key: "line", paint: { fill: t.color ?? r.paint.color, color: t.color ?? shade(r.paint.color, -0.2) }, dash: t.dash });
      }
    }
  }
  const area = frame(ctx, ctx.blank ? [] : legend);

  const tableRows: TableRow[] | undefined =
    c.dataTable && !horizontal && !ctx.blank
      ? all.map((r) => ({ name: r.s.name, values: r.s.values.map((v) => (v === null ? "" : valueText(v, c.labels.format, ctx.mark))), color: r.paint.color, fill: r.paint.fill, stroke: r.paint.stroke }))
      : undefined;
  const layout = layoutAxes(ctx, area, { horizontal, catLabels: m.categories, band, catOpts: c.axes.x, valLabels: labels1, valOpts: c.axes.y, val2Labels: labels2, val2Opts: c.axes.y2, table: tableRows });
  const f: Frame = { box: layout.box, horizontal };
  const place = (k: number) => (band ? (k + 0.5) / Math.max(1, n) : n > 1 ? k / (n - 1) : 0.5);
  const tOf = (k: number) => (c.axes.x.reverse ? 1 - place(k) : place(k));
  const rev1 = c.axes.y.reverse;
  const valPx = (r: Resolved, v: number) => (r.secondary && scale2 ? valueAt(f, scale2, v, c.axes.y2.reverse) : valueAt(f, scale1, v, rev1));
  const scaleOf = (r: Resolved) => (r.secondary && scale2 ? scale2 : scale1);

  drawGrid(ctx, f, scale1, { major: c.grid.y, minor: c.grid.yMinor });
  if (c.grid.x && !horizontal) {
    for (let k = 0; k <= n; k++) {
      const x = catPx(f, c.axes.x.reverse ? 1 - k / n : k / n);
      line(ctx, x, layout.box.y, x, layout.box.y + layout.box.h, { stroke: "#d9dde3", sw: 0.8 });
    }
  }

  const late: (() => void)[] = []; // (labels go over everything)
  if (!ctx.blank) {
    drawAreas(ctx, f, all, n, percent, tOf, valPx, scaleOf, late);
    drawColumns(ctx, f, all, n, percent, tOf, valPx, scaleOf, late);
    drawLines(ctx, f, all, n, tOf, valPx, late);
    drawTrends(ctx, f, all, trends, tOf, valPx, n, late);
  }

  drawValueAxis(ctx, f, layout, scale1, labels1, c.axes.y, { reverse: rev1 });
  if (scale2 && labels2 && !ctx.blank) drawValueAxis(ctx, f, layout, scale2, labels2, c.axes.y2, { secondary: true, reverse: c.axes.y2.reverse });
  drawCategoryAxis(ctx, f, layout, m.categories, c.axes.x, band, place);
  if (tableRows) drawDataTable(ctx, f, layout, m.categories, tableRows, c.axes.x);
  for (const draw of late) draw();
}

/** Whether the categories are in bands (columns) or at points on the axis (an area starts at the axis) */
function layoutBand(ctx: Ctx, all: Resolved[]): boolean {
  const { c } = ctx;
  if (c.family === "area") return false;
  if (c.family === "combo") return !all.length || !all.every((r) => r.kind === "area");
  return true;
}

// ---- series ----

export function markerOf(ctx: Ctx, r: { s: ModelSeries; pos: number }): string {
  const mk = r.s.style.marker;
  if (mk) return mk;
  const { family, variant } = ctx.c;
  if (family === "line" && /arkers/.test(variant)) return MARKER_SHAPES[r.pos % MARKER_SHAPES.length];
  return "none";
}

type Px = (r: Resolved, v: number) => number;

function drawAreas(ctx: Ctx, f: Frame, all: Resolved[], n: number, percent: boolean, tOf: (k: number) => number, valPx: Px, scaleOf: (r: Resolved) => Scale, late: (() => void)[]) {
  for (const secondary of [false, true]) {
    const group = all.filter((r) => r.kind === "area" && r.secondary === secondary);
    if (!group.length) continue;
    const st = stacks(ctx, "area") ? stack(group, n, percent) : null;
    group.forEach((r, gi) => {
      const sc = scaleOf(r);
      const base = (k: number) => (st ? (st[gi].from[k] ?? 0) : baseline(sc));
      const top = (k: number) => (st ? st[gi].to[k] : r.s.values[k]);
      const upper: [number, number][] = [];
      const lower: [number, number][] = [];
      for (let k = 0; k < n; k++) {
        const v = top(k);
        if (v === null || v === undefined) continue;
        upper.push(pointAt(f, catPx(f, tOf(k)), valPx(r, v)));
        lower.push(pointAt(f, catPx(f, tOf(k)), valPx(r, base(k))));
      }
      if (upper.length < 2) return;
      const d = `M${upper.map((p) => `${num(p[0])} ${num(p[1])}`).join("L")}L${lower.reverse().map((p) => `${num(p[0])} ${num(p[1])}`).join("L")}Z`;
      path(ctx, d, { fill: r.paint.fill, opacity: r.s.style.opacity ?? (st ? 1 : 0.75), ...outline(r.paint), extra: `data-series="${r.s.index}"` });
      if (!st) path(ctx, linePath(upper, false), { stroke: r.paint.color, sw: 1.5 });
      labelPoints(ctx, f, r, n, tOf, valPx, late, (k) => top(k) ?? null, "center");
    });
  }
}

/** The columns (bars): clustered side by side, stacked, with the gap and the overlap of the chart */
function drawColumns(ctx: Ctx, f: Frame, all: Resolved[], n: number, percent: boolean, tOf: (k: number) => number, valPx: Px, scaleOf: (r: Resolved) => Scale, late: (() => void)[]) {
  const { c } = ctx;
  const bandPx = (f.horizontal ? f.box.h : f.box.w) / Math.max(1, n);
  const sign = (f.horizontal ? -1 : 1) * (c.axes.x.reverse ? -1 : 1);
  for (const secondary of [false, true]) {
    const group = all.filter((r) => r.kind === "column" && r.secondary === secondary);
    if (!group.length) continue;
    const stacked = stacks(ctx, "column");
    const st = stacked ? stack(group, n, percent) : null;
    const slots = stacked ? 1 : group.length;
    const overlap = Math.max(-100, Math.min(100, c.overlap)) / 100;
    const gap = Math.max(0, c.gap) / 100;
    const barW = bandPx / (1 + (slots - 1) * (1 - overlap) + gap);
    const groupW = barW * (1 + (slots - 1) * (1 - overlap));
    group.forEach((r, gi) => {
      const sc = scaleOf(r);
      const vals = present(r.s.values);
      for (let k = 0; k < n; k++) {
        const v = r.s.values[k];
        if (v === null) continue;
        const center = catPx(f, tOf(k));
        const slot = stacked ? 0 : gi;
        // (the series follow each other in the direction of the pixels; the first of a bar chart is the lowest)
        const c0 = center + sign * (-groupW / 2 + slot * barW * (1 - overlap) + barW / 2);
        const a = st ? (st[gi].from[k] ?? 0) : baseline(sc);
        const b = st ? (st[gi].to[k] ?? 0) : v;
        const p = paintOf(ctx, r.s.index, k, !!c.varyColors && group.length === 1);
        const box = rectBetween(f, c0 - barW / 2, c0 + barW / 2, valPx(r, a), valPx(r, b));
        rect(ctx, box.x, box.y, box.w, box.h, { fill: p.fill, ...outline(p), extra: `data-series="${r.s.index}"` });
        if (r.s.style.error && !stacked) {
          const [lo, hi] = errorEnds(r.s.style.error, v, vals);
          errorBar(ctx, f, c0, valPx(r, lo), valPx(r, hi), r.s.style.error.cap, Math.min(barW * 0.5, 10));
        }
        const o = labelsFor(ctx, r.s);
        if (o.show) {
          const p0 = valPx(r, a); // (where the bar starts and ends along the values)
          const p1 = valPx(r, b);
          late.push(() => {
            const text_ = labelText(ctx, o, { series: r.s.name, category: ctx.m.categories[k], value: v });
            if (!text_) return;
            const lead = f.horizontal ? textWidth(ctx, text_, o.size, o.bold) : o.size * 0.7; // (half of it is on each side of the point)
            const out = p1 >= p0 ? 1 : -1; // the way from the start of the bar to its free end
            const pos = stacked ? (o.position === "auto" || o.position === "outside" ? "center" : o.position) : o.position === "auto" ? "outside" : o.position;
            const inside = pos !== "outside" && pos !== "above" && pos !== "below" && pos !== "left" && pos !== "right";
            const at = pos === "center" ? (p0 + p1) / 2 : pos === "inside" ? p1 - out * (lead / 2 + 4) : pos === "base" ? p0 + out * (lead / 2 + 4) : p1 + out * (lead / 2 + 3);
            const [tx, ty] = pointAt(f, c0, at);
            text(ctx, tx, ty, text_, { size: o.size, bold: o.bold, anchor: "middle", fill: o.color ?? (inside ? inkOn(ctx, p) : "#1f2937"), halo: !inside });
          });
        }
      }
    });
  }
}

/** A bar of error: the line from `lo` to `hi` at c0 (pixels along the values), with caps */
function errorBar(ctx: Ctx, f: Frame, c0: number, lo: number, hi: number, cap: boolean, half: number) {
  const [x1, y1] = pointAt(f, c0, lo);
  const [x2, y2] = pointAt(f, c0, hi);
  line(ctx, x1, y1, x2, y2, { stroke: "#111827", sw: 1.2 });
  if (cap)
    for (const p of [lo, hi]) {
      const [ax, ay] = pointAt(f, c0 - half, p);
      const [bx, by] = pointAt(f, c0 + half, p);
      line(ctx, ax, ay, bx, by, { stroke: "#111827", sw: 1.2 });
    }
}

function drawLines(ctx: Ctx, f: Frame, all: Resolved[], n: number, tOf: (k: number) => number, valPx: Px, late: (() => void)[]) {
  const { c } = ctx;
  for (const secondary of [false, true]) {
    const group = all.filter((r) => r.kind === "line" && r.secondary === secondary);
    if (!group.length) continue;
    const st = stacks(ctx, "line") ? stack(group, n, isPercentStacked(c.variant)) : null;
    group.forEach((r, gi) => {
      const style = r.s.style;
      const vals = present(r.s.values);
      const at = (k: number) => (st ? st[gi].to[k] : r.s.values[k]);
      const pts = Array.from({ length: n }, (_, k): [number, number] | null => {
        const v = at(k);
        return v === null || v === undefined ? null : pointAt(f, catPx(f, tOf(k)), valPx(r, v));
      });
      const color = style.color ?? r.paint.color;
      path(ctx, linePath(pts, !!style.smooth), { stroke: color, sw: style.width ?? (ctx.mini ? 3 : 2.25), dash: style.dash, extra: `data-series="${r.s.index}"` });
      const mk = markerOf(ctx, r);
      pts.forEach((p, k) => {
        if (!p) return;
        if (mk !== "none") marker(ctx, mk as never, p[0], p[1], style.markerSize ?? 7, color, "#ffffff", `data-series="${r.s.index}"`);
        const v = r.s.values[k];
        if (style.error && v !== null) {
          const [lo, hi] = errorEnds(style.error, v, vals);
          errorBar(ctx, f, catPx(f, tOf(k)), valPx(r, lo), valPx(r, hi), style.error.cap, 4);
        }
      });
      labelPoints(ctx, f, r, n, tOf, valPx, late, (k) => at(k) ?? null, "above");
    });
  }
}

/** Labels on the points of a line or an area (above by default, or where the series says) */
function labelPoints(ctx: Ctx, f: Frame, r: Resolved, n: number, tOf: (k: number) => number, valPx: Px, late: (() => void)[], at: (k: number) => number | null, fallback: "above" | "center") {
  const o = labelsFor(ctx, r.s);
  if (!o.show) return;
  for (let k = 0; k < n; k++) {
    const v = at(k);
    const original = r.s.values[k];
    if (v === null || original === null) continue;
    late.push(() => {
      const s = labelText(ctx, o, { series: r.s.name, category: ctx.m.categories[k], value: original });
      const [x, y] = pointAt(f, catPx(f, tOf(k)), valPx(r, v));
      const pos = o.position === "auto" || o.position === "outside" ? fallback : o.position;
      const d = o.size * 0.9 + 4;
      const [tx, ty, anchor] = pos === "below" ? [x, y + d, "middle" as const] : pos === "left" ? [x - 6, y, "end" as const] : pos === "right" ? [x + 6, y, "start" as const] : pos === "center" || pos === "inside" || pos === "base" ? [x, y, "middle" as const] : [x, y - d, "middle" as const];
      text(ctx, tx, ty, s, { size: o.size, bold: o.bold, anchor, fill: o.color ?? (pos === "center" ? inkOn(ctx, r.paint) : "#1f2937"), halo: pos !== "center" });
    });
  }
}

function drawTrends(ctx: Ctx, f: Frame, all: Resolved[], trends: Map<number, ReturnType<typeof trendOf>>, tOf: (k: number) => number, valPx: Px, n: number, late: (() => void)[]) {
  for (const r of all) {
    const tr = trends.get(r.s.index);
    const t = r.s.style.trendline;
    if (!tr || !t) continue;
    // x = 1 is the first category: a trendline is drawn from its place, and goes on past the last one
    const px = (x: number) => {
      const k = x - 1;
      const near = Math.round(k);
      const here = tOf(Math.max(0, Math.min(n - 1, near)));
      const step = n > 1 ? Math.abs(tOf(1) - tOf(0)) * (tOf(1) >= tOf(0) ? 1 : -1) : 0;
      return catPx(f, here + (k - Math.max(0, Math.min(n - 1, near))) * step);
    };
    const pts = tr.points.map(([x, y]): [number, number] => pointAt(f, px(x), valPx(r, y)));
    path(ctx, linePath(pts, false), { stroke: t.color ?? shade(r.paint.color, -0.2), sw: 1.6, dash: t.dash === "solid" ? "dashed" : t.dash });
    if (tr.note) {
      const last = pts[pts.length - 1];
      late.push(() => text(ctx, Math.min(f.box.x + f.box.w - 4, last[0]), Math.max(f.box.y + 10, last[1] - 12), tr.note, { anchor: "end", size: ctx.fs, fill: t.color ?? shade(r.paint.color, -0.3), halo: true }));
    }
  }
}

// ---- waterfall ----

function renderWaterfall(ctx: Ctx): void {
  const { c, m } = ctx;
  const steps = waterfallSteps(c, m);
  const n = steps.length;
  const lo = Math.min(0, ...steps.map((s) => Math.min(s.from, s.to)));
  const hi = Math.max(0, ...steps.map((s) => Math.max(s.from, s.to)));
  const scale = niceScale({ lo, hi, includeZero: true }, c.axes.y);
  const labels = scale.ticks.map((v) => axisText(v, c.axes.y.format, scale.unit, ctx.mark));
  const w = c.waterfall;
  const colors = { up: w.up, down: w.down, total: w.total };
  const swatch = (color: string): Paint => (c.patterns ? paintOf(ctx, 0) : { fill: color, color });
  const legend: LegendItem[] = c.legend.show && !ctx.blank ? [{ label: ctx.words.up, key: "box", paint: swatch(colors.up) }, { label: ctx.words.down, key: "box", paint: swatch(colors.down) }, { label: ctx.words.total, key: "box", paint: swatch(colors.total) }] : [];
  const area = frame(ctx, legend);
  const cats = steps.map((s) => s.label);
  const layout = layoutAxes(ctx, area, { horizontal: false, catLabels: cats, band: true, catOpts: c.axes.x, valLabels: labels, valOpts: c.axes.y });
  const f: Frame = { box: layout.box, horizontal: false };
  drawGrid(ctx, f, scale, { major: c.grid.y, minor: c.grid.yMinor });
  const rev = c.axes.y.reverse;
  const band = f.box.w / Math.max(1, n);
  const barW = band / (1 + Math.max(0, c.gap) / 100);
  const late: (() => void)[] = [];
  if (!ctx.blank)
    steps.forEach((s, k) => {
      const cx = catPx(f, c.axes.x.reverse ? 1 - (k + 0.5) / n : (k + 0.5) / n);
      const color = s.total ? colors.total : s.value >= 0 ? colors.up : colors.down;
      const p = c.patterns ? paintOf(ctx, s.total ? 2 : s.value >= 0 ? 0 : 1) : { fill: color, color };
      const y1 = valueAt(f, scale, s.from, rev);
      const y2 = valueAt(f, scale, s.to, rev);
      rect(ctx, cx - barW / 2, Math.min(y1, y2), barW, Math.abs(y2 - y1), { fill: p.fill, ...outline(p), extra: 'data-series="0"' });
      const next = steps[k + 1];
      if (w.connectors && next) {
        const level = valueAt(f, scale, s.to, rev);
        const nx = catPx(f, c.axes.x.reverse ? 1 - (k + 1.5) / n : (k + 1.5) / n);
        line(ctx, cx + barW / 2, level, nx - barW / 2, level, { stroke: "#8b93a1", sw: 1, dash: "dashed" });
      }
      const o = c.labels;
      if (o.show) {
        late.push(() => {
          const sign = s.total || s.value < 0 ? "" : "+";
          const t = o.value ? `${sign}${valueText(s.value, o.format, ctx.mark)}` : "";
          const up = s.to >= s.from;
          text(ctx, cx, (up ? Math.min(y1, y2) - o.size * 0.9 - 2 : Math.max(y1, y2) + o.size * 0.9 + 2), t, { size: o.size, bold: o.bold, anchor: "middle", fill: o.color ?? "#1f2937", halo: true });
        });
      }
    });
  drawValueAxis(ctx, f, layout, scale, labels, c.axes.y, { reverse: rev });
  drawCategoryAxis(ctx, f, layout, cats, c.axes.x, true);
  for (const draw of late) draw();
}
