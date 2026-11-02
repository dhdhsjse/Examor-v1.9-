// The round charts: pie, doughnut (one ring for each series) and radar (spokes and rings). Pure functions that write SVG text.
import { present } from "../data";
import { axisText, niceScale } from "../scale";
import { labelText, labelsFor } from "./extras";
import { frame, inkOn, line, marker, MARKER_SHAPES, num, paintOf, path, text, textWidth, type Ctx, type LegendItem } from "./kit";

const RAD = Math.PI / 180;

/** A point at an angle (degrees clockwise from twelve o'clock) and a distance from the center */
const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => [cx + r * Math.sin(deg * RAD), cy - r * Math.cos(deg * RAD)];

/** A slice (or a piece of a ring) between two angles and two radii */
function slicePath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const sweep = a1 - a0;
  if (sweep >= 359.99) {
    // a whole circle (or ring): two half arcs
    const [x, y] = polar(cx, cy, r1, a0);
    const [x2, y2] = polar(cx, cy, r1, a0 + 180);
    const outer = `M${num(x)} ${num(y)}A${num(r1)} ${num(r1)} 0 1 1 ${num(x2)} ${num(y2)}A${num(r1)} ${num(r1)} 0 1 1 ${num(x)} ${num(y)}Z`;
    if (r0 <= 0) return outer;
    const [ix, iy] = polar(cx, cy, r0, a0);
    const [ix2, iy2] = polar(cx, cy, r0, a0 + 180);
    return `${outer}M${num(ix)} ${num(iy)}A${num(r0)} ${num(r0)} 0 1 0 ${num(ix2)} ${num(iy2)}A${num(r0)} ${num(r0)} 0 1 0 ${num(ix)} ${num(iy)}Z`;
  }
  const large = sweep > 180 ? 1 : 0;
  const [x1, y1] = polar(cx, cy, r1, a0);
  const [x2, y2] = polar(cx, cy, r1, a1);
  if (r0 <= 0) return `M${num(cx)} ${num(cy)}L${num(x1)} ${num(y1)}A${num(r1)} ${num(r1)} 0 ${large} 1 ${num(x2)} ${num(y2)}Z`;
  const [x3, y3] = polar(cx, cy, r0, a1);
  const [x4, y4] = polar(cx, cy, r0, a0);
  return `M${num(x1)} ${num(y1)}A${num(r1)} ${num(r1)} 0 ${large} 1 ${num(x2)} ${num(y2)}L${num(x3)} ${num(y3)}A${num(r0)} ${num(r0)} 0 ${large} 0 ${num(x4)} ${num(y4)}Z`;
}

export function renderPie(ctx: Ctx): void {
  const { c, m } = ctx;
  const doughnut = c.variant === "doughnut";
  const vis = m.series.filter((s) => !s.style.hidden);
  const rings = doughnut ? vis : vis.slice(0, 1);
  const first = rings[0];
  const n = m.categories.length;
  const vary = true; // (a slice has a color of its own)
  // How the parts are told apart: by color (the legend), by a number written in each part (the legend lists them), or by the name written in it
  const identify = c.legend.identify ?? "color";
  const legend: LegendItem[] = !first || identify === "name" || identify === "text" ? [] : m.categories.map((label, k) => (identify === "number" ? { label: `${k + 1}. ${label}`, key: "none" as const, paint: paintOf(ctx, first.index, k, vary) } : { label, key: "box" as const, paint: paintOf(ctx, first.index, k, vary) }));
  const area = frame(ctx, ctx.blank ? [] : legend);
  if (!first || ctx.blank) {
    // (nothing for the students to draw on a pie but the outline)
    const r = Math.min(area.w, area.h) / 2 - 6;
    path(ctx, slicePath(area.x + area.w / 2, area.y + area.h / 2, 0, Math.max(4, r), 0, 360), { fill: "none", stroke: "#9ca3af", sw: 1.2 });
    return;
  }
  const size = c.labels.size;
  const o0 = labelsFor(ctx, first);
  const named = identify === "name" || identify === "text";
  const outsideLabels = (o0.show || named) && !doughnut && o0.position !== "inside" && o0.position !== "center";
  const widest = outsideLabels ? Math.max(...m.categories.map((name, k) => textWidth(ctx, (identify === "name" ? `${name}${o0.separator}` : identify === "text" ? `${first.style.points?.[k]?.text ?? ""}${o0.separator}` : "") + (o0.show ? labelText(ctx, o0, { series: first.name, category: name, value: first.values[k] ?? 0, share: 0.5 }) : ""), size))) : 0;
  const explode = Math.max(0, c.pie.explode) / 100;
  const maxExplode = Math.max(explode, ...Object.values(first.style.points ?? {}).map((p) => (p.explode ?? 0) / 100));
  const margin = (outsideLabels ? Math.max(26, widest * 0.6 + 14) : 8) + 0;
  const R = Math.max(10, Math.min(area.w, area.h) / 2 - margin) / (1 + maxExplode);
  const cx = area.x + area.w / 2;
  const cy = area.y + area.h / 2;
  const hole = doughnut ? Math.max(10, Math.min(85, c.pie.hole)) / 100 : 0;
  const ringW = (R * (1 - hole)) / Math.max(1, rings.length);
  const late: (() => void)[] = [];

  rings.forEach((s, ri) => {
    const vals = Array.from({ length: n }, (_, k) => Math.max(0, s.values[k] ?? 0));
    const total = vals.reduce((a, b) => a + b, 0);
    if (total <= 0) return;
    const r0 = R * hole + ri * ringW;
    const r1 = r0 + ringW;
    let angle = c.pie.firstAngle;
    const o = labelsFor(ctx, s);
    vals.forEach((v, k) => {
      if (v <= 0) return;
      const sweep = (v / total) * 360;
      const mid = angle + sweep / 2;
      const pull = ((s.style.points?.[k]?.explode ?? 0) / 100 || explode) * R;
      const [dx, dy] = pull ? [Math.sin(mid * RAD) * pull, -Math.cos(mid * RAD) * pull] : [0, 0];
      const colored = paintOf(ctx, s.index, k, vary);
      const paint = c.pie.plain && identify !== "color" ? { ...colored, fill: "#ffffff", color: "#ffffff", stroke: "#374151" } : colored;
      path(ctx, slicePath(cx + dx, cy + dy, r0, r1, angle, angle + sweep), { fill: paint.fill, stroke: paint.stroke ?? "#ffffff", sw: paint.stroke ? 1 : 1.5, extra: `data-series="${s.index}"` });
      const tag = identify === "number" ? String(k + 1) : identify === "text" ? (s.style.points?.[k]?.text ?? "") : identify === "name" && !(o.show && o.category) ? m.categories[k] : "";
      if (o.show || tag) {
        const share = v / total;
        const data = o.show ? labelText(ctx, o, { series: s.name, category: m.categories[k], value: s.values[k] ?? 0, share }) : "";
        const label = [tag, data].filter(Boolean).join(o.separator);
        // (a name inside a slice only where it fits across it; a number or a value fits a slice of 8 %)
        const fits = named ? share >= 0.3 || share * 2 * Math.PI * r1 * 0.68 >= textWidth(ctx, label, o.size) * 1.2 : share >= 0.08;
        const inside = doughnut || o.position === "inside" || o.position === "center" || (o.position === "auto" && fits);
        late.push(() => {
          if (!label) return;
          if (inside) {
            const [tx, ty] = polar(cx + dx, cy + dy, doughnut ? (r0 + r1) / 2 : o.position === "center" ? r1 * 0.5 : r1 * 0.68, mid);
            text(ctx, tx, ty, label, { size: o.size, bold: o.bold, anchor: "middle", fill: o.color ?? inkOn(ctx, paint) });
          } else {
            const [tx, ty] = polar(cx + dx, cy + dy, r1 + 12, mid);
            const right = Math.sin(mid * RAD) >= 0;
            text(ctx, tx, ty, label, { size: o.size, bold: o.bold, anchor: right ? "start" : "end", fill: o.color ?? "#1f2937", halo: true });
          }
        });
      }
      angle += sweep;
    });
  });
  for (const draw of late) draw();
}

export function renderRadar(ctx: Ctx): void {
  const { c, m } = ctx;
  const vis = m.series.filter((s) => !s.style.hidden);
  const n = m.categories.length;
  const filled = c.variant === "filled";
  const marked = c.variant === "markers";
  const legend: LegendItem[] = vis.map((s, pos) => ({ label: s.name, key: filled ? "box" : marked ? "marker" : "line", paint: paintOf(ctx, s.index), shape: MARKER_SHAPES[pos % MARKER_SHAPES.length] }));
  const area = frame(ctx, ctx.blank ? [] : legend);
  const all = vis.flatMap((s) => present(s.values));
  const scale = niceScale({ lo: Math.min(0, ...all), hi: all.length ? Math.max(...all) : 1, includeZero: true }, c.axes.y);
  const labels = scale.ticks.map((v) => axisText(v, c.axes.y.format, scale.unit, ctx.mark));
  const widest = Math.max(0, ...m.categories.map((l) => textWidth(ctx, l, ctx.fs)));
  const cx = area.x + area.w / 2;
  const cy = area.y + area.h / 2;
  const R = Math.max(10, Math.min(area.w / 2 - widest - 12, area.h / 2 - ctx.fs * 1.6 - 6));
  if (n < 3) return;
  const angleOf = (k: number) => (360 * k) / n;
  const radius = (v: number) => (R * (v - scale.min)) / (scale.max - scale.min);
  // the rings and the spokes
  if (c.grid.y)
    for (const v of scale.ticks) {
      if (v <= scale.min) continue;
      const pts = Array.from({ length: n }, (_, k) => polar(cx, cy, radius(v), angleOf(k)));
      path(ctx, `M${pts.map((p) => `${num(p[0])} ${num(p[1])}`).join("L")}Z`, { stroke: "#d9dde3", sw: 0.9 });
    }
  for (let k = 0; k < n; k++) {
    const [x, y] = polar(cx, cy, R, angleOf(k));
    line(ctx, cx, cy, x, y, { stroke: "#d9dde3", sw: 0.9 });
    const [tx, ty] = polar(cx, cy, R + 14, angleOf(k));
    const s = Math.sin(angleOf(k) * RAD);
    text(ctx, tx + (s > 0.2 ? 2 : s < -0.2 ? -2 : 0), ty + (Math.cos(angleOf(k) * RAD) > 0.5 ? -4 : Math.cos(angleOf(k) * RAD) < -0.5 ? 6 : 0), m.categories[k], { anchor: s > 0.2 ? "start" : s < -0.2 ? "end" : "middle", extra: 'data-part="axis-x"' });
  }
  if (c.axes.y.show)
    scale.ticks.forEach((v, i) => {
      const [x, y] = polar(cx, cy, radius(v), 0);
      text(ctx, x + 4, y + 1, labels[i] ?? "", { size: ctx.fs - 1, fill: "#6b7280", anchor: "start", halo: true, extra: 'data-part="axis-y"' });
    });
  if (ctx.blank) return;
  vis.forEach((s, pos) => {
    const p = paintOf(ctx, s.index);
    const pts = Array.from({ length: n }, (_, k): [number, number] | null => (s.values[k] === null ? null : polar(cx, cy, radius(s.values[k] as number), angleOf(k))));
    const ring = pts.map((q) => q ?? [cx, cy]);
    const d = `M${ring.map((q) => `${num(q[0])} ${num(q[1])}`).join("L")}Z`;
    path(ctx, d, { fill: filled ? p.color : "none", opacity: filled ? (s.style.opacity ?? 0.35) : undefined, stroke: p.color, sw: s.style.width ?? 2, dash: s.style.dash, extra: `data-series="${s.index}"` });
    const mk = s.style.marker ?? (marked ? MARKER_SHAPES[pos % MARKER_SHAPES.length] : "none");
    const o = labelsFor(ctx, s);
    pts.forEach((q, k) => {
      if (!q) return;
      if (mk !== "none") marker(ctx, mk, q[0], q[1], s.style.markerSize ?? 7, p.color, "#ffffff", `data-series="${s.index}"`);
      if (o.show) text(ctx, q[0], q[1] - o.size * 0.9 - 2, labelText(ctx, o, { series: s.name, category: m.categories[k], value: s.values[k] as number }), { size: o.size, bold: o.bold, anchor: "middle", fill: o.color ?? "#1f2937", halo: true });
    });
  });
}
