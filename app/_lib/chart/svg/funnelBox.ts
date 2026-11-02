// The funnel (bars that narrow, one for each stage) and the box and whisker chart (the five numbers of each series). Pure functions that write
// SVG text.
import { boxSeries } from "../data";
import { shade } from "../palette";
import { axisText, niceScale, startsAtZero, valueText } from "../scale";
import { catPx, drawCategoryAxis, drawGrid, drawValueAxis, layoutAxes, pointAt, rectBetween, valueAt, type Frame } from "./axes";
import { labelText, labelsFor } from "./extras";
import { circle, frame, inkOn, line, marker, outline, paintOf, rect, text, textWidth, type Ctx, type LegendItem } from "./kit";

export function renderFunnel(ctx: Ctx): void {
  const { c, m } = ctx;
  const s = m.series.find((x) => !x.style.hidden);
  const area = frame(ctx, []);
  if (!s || ctx.blank) return;
  const rows = m.categories.map((label, k) => ({ label, value: Math.max(0, s.values[k] ?? 0), k }));
  const max = Math.max(...rows.map((r) => r.value), 1e-9);
  const first = rows[0]?.value || max;
  const names = c.axes.x.show ? Math.max(...rows.map((r) => textWidth(ctx, r.label, ctx.fs))) + 12 : 0;
  const left = area.x + names;
  const width = area.w - names;
  const n = rows.length;
  const band = area.h / Math.max(1, n);
  const barH = band / (1 + Math.max(0, c.gap) / 100);
  const o = labelsFor(ctx, s);
  rows.forEach((r, i) => {
    const w = Math.max(2, (r.value / max) * width);
    const cy = area.y + (i + 0.5) * band;
    const paint = paintOf(ctx, s.index, i, true);
    rect(ctx, left + (width - w) / 2, cy - barH / 2, w, barH, { fill: paint.fill, ...outline(paint), extra: `data-series="${s.index}"` });
    if (c.axes.x.show) text(ctx, left - 8, cy, r.label, { anchor: "end", extra: 'data-part="axis-x"' });
    if (o.show) {
      const label = labelText(ctx, o, { series: s.name, category: r.label, value: r.value, share: r.value / first });
      text(ctx, left + width / 2, cy, label, { size: o.size, bold: o.bold, anchor: "middle", fill: o.color ?? inkOn(ctx, paint) });
    }
  });
}

export function renderBox(ctx: Ctx): void {
  const { c, m } = ctx;
  const horizontal = c.variant === "horizontal";
  const boxes = boxSeries(c, m);
  const n = boxes.length;
  const lo = n ? Math.min(...boxes.map((b) => b.stats.min)) : 0;
  const hi = n ? Math.max(...boxes.map((b) => b.stats.max)) : 1;
  const scale = niceScale({ lo, hi, includeZero: startsAtZero(lo, hi) && !c.axes.y.log }, c.axes.y);
  const labels = scale.ticks.map((v) => axisText(v, c.axes.y.format, scale.unit, ctx.mark));
  const legend: LegendItem[] = c.legend.show && !ctx.blank ? boxes.map((b) => ({ label: b.name, key: "box", paint: paintOf(ctx, b.index) })) : [];
  const area = frame(ctx, legend);
  const names = boxes.map((b) => b.name);
  const layout = layoutAxes(ctx, area, { horizontal, catLabels: names, band: true, catOpts: c.axes.x, valLabels: labels, valOpts: c.axes.y });
  const f: Frame = { box: layout.box, horizontal };
  drawGrid(ctx, f, scale, { major: c.grid.y, minor: c.grid.yMinor });
  const vy = (v: number) => valueAt(f, scale, v, c.axes.y.reverse);
  const band = (horizontal ? f.box.h : f.box.w) / Math.max(1, n);
  const w = band / (1 + Math.max(0, c.gap) / 100);
  const late: (() => void)[] = [];
  if (!ctx.blank)
    boxes.forEach((b, k) => {
      const t = (k + 0.5) / n;
      const cx = catPx(f, c.axes.x.reverse ? 1 - t : t);
      const p = paintOf(ctx, b.index);
      const ink = shade(p.color, -0.35);
      const s = b.stats;
      const seg = (a: number, z: number, at = cx, half = 0) => {
        const [x1, y1] = pointAt(f, at - half, vy(a));
        const [x2, y2] = pointAt(f, at + half, vy(z));
        line(ctx, x1, y1, x2, y2, { stroke: ink, sw: 1.5 });
      };
      seg(s.low, s.q1);
      seg(s.q3, s.high);
      seg(s.low, s.low, cx, w * 0.25);
      seg(s.high, s.high, cx, w * 0.25);
      const r = rectBetween(f, cx - w / 2, cx + w / 2, vy(s.q1), vy(s.q3));
      rect(ctx, r.x, r.y, r.w, r.h, { fill: p.stroke ? p.fill : shade(p.color, 0.45), stroke: ink, sw: 1.5, extra: `data-series="${b.index}"` });
      seg(s.median, s.median, cx, w / 2);
      if (c.box.mean) {
        const [mx, my] = pointAt(f, cx, vy(s.mean));
        marker(ctx, "x", mx, my, 8, ink, ink);
      }
      for (const v of s.outliers) {
        const [ox, oy] = pointAt(f, cx, vy(v));
        circle(ctx, ox, oy, 3.2, { fill: "#ffffff", stroke: ink, sw: 1.4 });
      }
      if (c.box.points) {
        const raw = m.series.find((x) => x.index === b.index)?.values.filter((v): v is number => v !== null) ?? [];
        raw.forEach((v, i) => {
          const jitter = (((i * 37) % 11) / 10 - 0.5) * w * 0.5;
          const [ox, oy] = pointAt(f, cx + jitter, vy(v));
          circle(ctx, ox, oy, 2, { fill: ink });
        });
      }
      const o = labelsFor(ctx, m.series.find((x) => x.index === b.index) ?? { index: 0, name: "", values: [], style: {} });
      if (o.show)
        late.push(() => {
          const five: [number, number][] = [[s.min, s.min], [s.q1, s.q1], [s.median, s.median], [s.q3, s.q3], [s.max, s.max]];
          for (const [v] of five) {
            const [lx, ly] = pointAt(f, cx + w / 2 + 6, vy(v));
            text(ctx, horizontal ? lx - w / 2 - 6 : lx, horizontal ? ly - w / 2 - 8 : ly, valueText(v, o.format, ctx.mark), { size: o.size, bold: o.bold, anchor: horizontal ? "middle" : "start", fill: o.color ?? "#1f2937", halo: true });
          }
        });
    });
  drawValueAxis(ctx, f, layout, scale, labels, c.axes.y, { reverse: c.axes.y.reverse });
  drawCategoryAxis(ctx, f, layout, names, c.axes.x, true);
  for (const draw of late) draw();
}
