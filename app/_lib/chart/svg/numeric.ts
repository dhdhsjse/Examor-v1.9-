// The charts whose x axis is a scale of numbers: scatters (points, with or without lines, with trendlines and error bars) and histograms
// (classes side by side, with the polygon of the frequencies and the cumulative curve). Pure functions that write SVG text.
import { classLabels, classTable, present } from "../data";
import { shade } from "../palette";
import { axisText, fraction, niceScale, startsAtZero, valueText, type Scale } from "../scale";
import {
  catPx,
  drawCategoryAxis,
  drawGrid,
  drawNumericXAxis,
  drawValueAxis,
  layoutAxes,
  pointAt,
  rectBetween,
  valueAt,
  type Frame,
} from "./axes";
import { linePath, markerOf } from "./category";
import { errorEnds, labelText, labelsFor, trendOf } from "./extras";
import { MARKER_SHAPES, circle, frame, line, marker, paintOf, path, rect, text, type Ctx, type LegendItem } from "./kit";

export function renderScatter(ctx: Ctx): void {
  const { c, m } = ctx;
  const vis = m.series.filter((s) => !s.style.hidden);
  const n = m.categories.length;
  const xs = m.xs ?? Array.from({ length: n }, (_, k) => k + 1);
  const connect = c.variant !== "markers";
  const smooth = c.variant === "smooth" || c.variant === "smoothMarkers";
  const showMarkers = c.variant === "markers" || c.variant === "smoothMarkers" || c.variant === "linesMarkers";

  // the numbers on each axis
  const xr = xs.filter(Number.isFinite);
  const ys: number[] = [];
  for (const s of vis) {
    const vals = present(s.values);
    s.values.forEach((v) => {
      if (v === null) return;
      ys.push(v);
      if (s.style.error) ys.push(...errorEnds(s.style.error, v, vals));
    });
  }
  const xlo = xr.length ? Math.min(...xr) : 0;
  const xhi = xr.length ? Math.max(...xr) : 1;
  const ylo = ys.length ? Math.min(...ys) : 0;
  const yhi = ys.length ? Math.max(...ys) : 1;
  const xScale = niceScale({ lo: xlo, hi: xhi, includeZero: startsAtZero(xlo, xhi) && !c.axes.x.log }, c.axes.x);
  const yScale = niceScale({ lo: ylo, hi: yhi, includeZero: startsAtZero(ylo, yhi) && !c.axes.y.log }, c.axes.y);
  const xLabels = xScale.ticks.map((v) => axisText(v, c.axes.x.format, xScale.unit, ctx.mark));
  const yLabels = yScale.ticks.map((v) => axisText(v, c.axes.y.format, yScale.unit, ctx.mark));

  // the trendlines, and the legend
  const legend: LegendItem[] = [];
  const trends = new Map<number, ReturnType<typeof trendOf>>();
  vis.forEach((s, pos) => {
    const p = paintOf(ctx, s.index);
    const mk = markerOf(ctx, { s, pos });
    const shape = s.style.marker && s.style.marker !== "none" ? s.style.marker : MARKER_SHAPES[pos % MARKER_SHAPES.length];
    legend.push({ label: s.name, key: connect ? (showMarkers || mk !== "none" ? "marker" : "line") : "dot", paint: p, dash: s.style.dash, shape });
    const t = s.style.trendline;
    if (t) {
      const pts = xs.flatMap((x, k): [number, number][] => (s.values[k] === null || !Number.isFinite(x) ? [] : [[x, s.values[k] as number]]));
      const tr = trendOf(ctx, t, pts, [xlo, xhi], s.name);
      if (tr) {
        trends.set(s.index, tr);
        legend.push({ label: tr.legend, key: "line", paint: { fill: t.color ?? p.color, color: t.color ?? shade(p.color, -0.2) }, dash: t.dash });
      }
    }
  });
  const area = frame(ctx, ctx.blank ? [] : legend);
  const layout = layoutAxes(ctx, area, { horizontal: false, catLabels: xLabels, band: false, catOpts: c.axes.x, valLabels: yLabels, valOpts: c.axes.y });
  const f: Frame = { box: layout.box, horizontal: false };
  const xPx = (x: number) => catPx(f, c.axes.x.reverse ? 1 - fraction(xScale, x) : fraction(xScale, x));
  const yPx = (y: number) => valueAt(f, yScale, y, c.axes.y.reverse);

  drawGrid(ctx, f, yScale, { major: c.grid.y, minor: c.grid.yMinor }, { scale: xScale, major: c.grid.x, minor: c.grid.xMinor });
  // the axes of the plane through zero, when it is on the paper
  if (xScale.min < 0 && xScale.max > 0) line(ctx, xPx(0), f.box.y, xPx(0), f.box.y + f.box.h, { stroke: "#9ca3af", sw: 1.2 });
  if (yScale.min < 0 && yScale.max > 0) line(ctx, f.box.x, yPx(0), f.box.x + f.box.w, yPx(0), { stroke: "#9ca3af", sw: 1.2 });

  const late: (() => void)[] = [];
  if (!ctx.blank)
    vis.forEach((s, pos) => {
      const p = paintOf(ctx, s.index);
      const color = s.style.color ?? p.color;
      const pts = xs.map((x, k): [number, number] | null => (s.values[k] === null || !Number.isFinite(x) ? null : [xPx(x), yPx(s.values[k] as number)]));
      if (connect) path(ctx, linePath(pts, smooth || !!s.style.smooth), { stroke: color, sw: s.style.width ?? 2, dash: s.style.dash, extra: `data-series="${s.index}"` });
      const mk = s.style.marker ?? (showMarkers ? MARKER_SHAPES[pos % MARKER_SHAPES.length] : "none");
      const vals = present(s.values);
      const o = labelsFor(ctx, s);
      pts.forEach((pt, k) => {
        if (!pt) return;
        const v = s.values[k] as number;
        if (s.style.error) {
          const [lo, hi] = errorEnds(s.style.error, v, vals);
          const [x1, y1] = [pt[0], yPx(lo)];
          const [x2, y2] = [pt[0], yPx(hi)];
          line(ctx, x1, y1, x2, y2, { stroke: "#111827", sw: 1.2 });
          if (s.style.error.cap)
            for (const y of [y1, y2]) line(ctx, pt[0] - 4, y, pt[0] + 4, y, { stroke: "#111827", sw: 1.2 });
        }
        if (mk !== "none") marker(ctx, mk, pt[0], pt[1], s.style.markerSize ?? 7, color, "#ffffff", `data-series="${s.index}"`);
        if (o.show) late.push(() => text(ctx, pt[0], pt[1] - o.size * 0.9 - 4, labelText(ctx, o, { series: s.name, category: String(xs[k]), value: v }), { size: o.size, bold: o.bold, anchor: "middle", fill: o.color ?? "#1f2937", halo: true }));
      });
      const tr = trends.get(s.index);
      const t = s.style.trendline;
      if (tr && t) {
        const tp = tr.points.map(([x, y]): [number, number] => [xPx(x), yPx(y)]);
        path(ctx, linePath(tp, false), { stroke: t.color ?? shade(color, -0.2), sw: 1.6, dash: t.dash === "solid" ? "dashed" : t.dash });
        if (tr.note) late.push(() => text(ctx, f.box.x + f.box.w - 6, f.box.y + 12 + pos * (ctx.fs + 4), tr.note, { anchor: "end", fill: t.color ?? shade(color, -0.3), halo: true }));
      }
    });

  drawValueAxis(ctx, f, layout, yScale, yLabels, c.axes.y, { reverse: c.axes.y.reverse });
  drawNumericXAxis(ctx, f, layout, xScale, xLabels, c.axes.x);
  for (const draw of late) draw();
}

// ---- histogram ----

export function renderHistogram(ctx: Ctx): void {
  const { c, m } = ctx;
  const h = c.histogram;
  const table = classTable(c, m);
  const bins = table.bins;
  const n = bins.length;
  const empty = n === 0;
  const widths = bins.map((b) => b.hi - b.lo);
  const minW = empty ? 1 : Math.min(...widths);
  // what the bars show: the numbers (each class, or the total up to it), their share of the whole, or per unit of width when the classes are not all as wide
  let acc = 0;
  const heights = bins.map((b, k) => {
    acc += b.count;
    const base = h.cumulative ? acc : table.unequal ? (b.count * minW) / widths[k] : b.count;
    return h.relative && table.total > 0 ? base / table.total : base;
  });
  const fmt = h.relative ? { percent: true, ...c.axes.y.format } : c.axes.y.format;
  const yScale = niceScale({ lo: 0, hi: Math.max(0, ...heights), includeZero: true }, c.axes.y);
  const yLabels = yScale.ticks.map((v) => axisText(v, fmt, yScale.unit, ctx.mark));
  const classMode = h.axisLabels === "classes" && !table.unequal;
  const names = classLabels(table, c);
  const lo = empty ? 0 : bins[0].lo;
  const hi = empty ? 1 : bins[n - 1].hi;
  // the numbers under the bars: the classes themselves, or the limits of the classes
  const limits = empty ? [] : [...bins.map((b) => b.lo), hi];
  const stride = Math.max(1, Math.ceil(limits.length / 14));
  const xScale: Scale = { min: lo, max: hi > lo ? hi : lo + 1, unit: minW, ticks: limits.filter((_, i) => i % stride === 0 || i === limits.length - 1), minor: [], log: false };
  const limitLabels = xScale.ticks.map((v) => valueText(v, c.axes.x.format, ctx.mark));
  const p = paintOf(ctx, 0);
  const area = frame(ctx, c.legend.show && !ctx.blank ? [{ label: m.series[0]?.name ?? "", key: "box", paint: p }] : []);
  const layout = layoutAxes(ctx, area, { horizontal: false, catLabels: classMode ? names : limitLabels, band: classMode, catOpts: c.axes.x, valLabels: yLabels, valOpts: c.axes.y });
  const f: Frame = { box: layout.box, horizontal: false };
  drawGrid(ctx, f, yScale, { major: c.grid.y, minor: c.grid.yMinor });

  const edge = (k: number, side: 0 | 1) => {
    const t = classMode ? (k + side) / n : (bins[k][side ? "hi" : "lo"] - xScale.min) / (xScale.max - xScale.min);
    return catPx(f, c.axes.x.reverse ? 1 - t : t);
  };
  const late: (() => void)[] = [];
  if (!ctx.blank && !empty) {
    const o = labelsFor(ctx, m.series[0] ?? { index: 0, name: "", values: [], style: {} });
    const gap = Math.max(0, c.gap) / 100;
    bins.forEach((b, k) => {
      const a = edge(k, 0);
      const z = edge(k, 1);
      const mid = (a + z) / 2;
      const half = Math.abs(z - a) / (2 * (1 + gap));
      const box = rectBetween(f, mid - half, mid + half, valueAt(f, yScale, 0), valueAt(f, yScale, heights[k]));
      const color = paintOf(ctx, 0, k, false);
      rect(ctx, box.x, box.y, box.w, box.h, { fill: color.fill, stroke: color.stroke ?? "#ffffff", sw: color.stroke ? 1 : gap > 0 ? 0 : 1, extra: 'data-series="0"' });
      if (o.show)
        late.push(() => {
          const value = h.cumulative || h.relative ? heights[k] : b.count;
          text(ctx, mid, valueAt(f, yScale, heights[k]) - o.size * 0.9 - 2, valueText(value, h.relative ? { percent: true, ...o.format } : o.format, ctx.mark), { size: o.size, bold: o.bold, anchor: "middle", fill: o.color ?? "#1f2937", halo: true });
        });
    });
    if (h.polygon) {
      const color = shade(p.color, -0.35);
      const pts: [number, number][] = h.cumulative
        ? [[edge(0, 0), valueAt(f, yScale, 0)], ...bins.map((_, k): [number, number] => [edge(k, 1), valueAt(f, yScale, heights[k])])]
        : [
            [edge(0, 0) - (edge(0, 1) - edge(0, 0)) / 2, valueAt(f, yScale, 0)],
            ...bins.map((_, k): [number, number] => [(edge(k, 0) + edge(k, 1)) / 2, valueAt(f, yScale, heights[k])]),
            [edge(n - 1, 1) + (edge(n - 1, 1) - edge(n - 1, 0)) / 2, valueAt(f, yScale, 0)],
          ];
      path(ctx, linePath(pts.map((q) => pointAt(f, q[0], q[1])), false), { stroke: color, sw: 2 });
      pts.forEach((q) => circle(ctx, ...(pointAt(f, q[0], q[1]) as [number, number]), 3, { fill: "#ffffff", stroke: color, sw: 1.5 }));
    }
  }
  drawValueAxis(ctx, f, layout, yScale, yLabels, c.axes.y, { reverse: c.axes.y.reverse });
  if (classMode) drawCategoryAxis(ctx, f, layout, names, c.axes.x, true);
  else drawNumericXAxis(ctx, f, layout, xScale, limitLabels, c.axes.x);
  for (const draw of late) draw();
}
