// The picture of a chart (the `src` of its image block): an SVG drawn from its configuration alone, the same in the Studio and on the
// page. Pure functions (no React, no DOM), unit-tested (__tests__/chart-render.test.ts).
import { niceStep } from "@/app/_lib/graphMath";
import { shapesSvg } from "@/app/_lib/shapes";
import { CHART_COLORS, type ChartConfig } from "./types";

const FONT = "Arial, Helvetica, sans-serif";
const INK = "#1f2937";
const MUTED = "#4b5563";
const GRID = "#e5e7eb";
const AXIS = "#374151";

export interface RenderOptions {
  /** The decimal mark of the numbers written ("," in French and Arabic) */
  decimal?: "," | ".";
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// (rough width of a text: SVG has no measuring outside a browser, and a chart only needs it to leave room)
const textWidth = (s: string, size: number) => s.length * size * 0.56;
const r1 = (v: number) => Math.round(v * 10) / 10;

/** A number as the chart writes it: at most 2 decimals, no trailing zeros, the decimal mark of the exam */
export function chartNumber(v: number, decimal: "," | "." = ","): string {
  const s = String(Math.round(v * 100) / 100);
  return decimal === "," ? s.replace(".", ",") : s;
}

// A text cut with "…" so that it fits in `room` px
function fit(s: string, size: number, room: number): string {
  if (textWidth(s, size) <= room) return s;
  let out = s;
  while (out.length > 1 && textWidth(`${out}…`, size) > room) out = out.slice(0, -1);
  return `${out}…`;
}

const text = (x: number, y: number, s: string, o: { size?: number; anchor?: "start" | "middle" | "end"; weight?: number; fill?: string; rotate?: boolean } = {}) =>
  `<text x="${r1(x)}" y="${r1(y)}" font-family="${FONT}" font-size="${o.size ?? 11}"${o.weight ? ` font-weight="${o.weight}"` : ""} fill="${o.fill ?? INK}" text-anchor="${o.anchor ?? "middle"}"${o.rotate ? ` transform="rotate(-90 ${r1(x)} ${r1(y)})"` : ""}>${esc(s)}</text>`;

/** The scale of the values: from a round number at or under the smallest (0 at most) to one at or over the largest (0 at least) */
export function valueScale(values: number[]): { min: number; max: number; step: number } {
  let lo = Math.min(0, ...values);
  let hi = Math.max(0, ...values);
  if (hi === lo) hi = lo + 1;
  const step = niceStep(hi - lo, 5);
  lo = Math.floor(lo / step + 1e-9) * step;
  hi = Math.ceil(hi / step - 1e-9) * step;
  return { min: lo, max: hi, step };
}

/** The SVG of the chart */
export function renderChartSvg(c: ChartConfig, options: RenderOptions = {}): string {
  const W = c.width;
  const H = c.height;
  const parts: string[] = [`<rect width="${W}" height="${H}" fill="#ffffff"/>`];
  const top = c.title.trim() ? 40 : 14;
  if (c.title.trim()) parts.push(text(W / 2, 24, fit(c.title.trim(), 15, W - 20), { size: 15, weight: 700 }));
  if (c.kind === "pie" || c.kind === "halfpie") pie(c, parts, top, options);
  else if (c.kind === "hbar") hbars(c, parts, top, options);
  else axes(c, parts, top, options);
  // what was drawn over the chart with the floating tool bar
  parts.push(shapesSvg(c.shapes));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
}

// The steps of a scale, from its smallest to its largest
function ticksOf(scale: { min: number; max: number; step: number }): number[] {
  const ticks: number[] = [];
  for (let v = scale.min; v <= scale.max + scale.step / 2; v += scale.step) ticks.push(Math.round(v / scale.step) * scale.step);
  return ticks;
}

// Bars, sticks, a histogram, a line or an area, over a scale of values (left) and the names of the values (under)
function axes(c: ChartConfig, parts: string[], top: number, o: RenderOptions) {
  const W = c.width;
  const H = c.height;
  const dec = o.decimal ?? ",";
  const rows = c.rows;
  const scale = valueScale(rows.flatMap((r) => (r.value === null ? [] : [r.value])));
  const ticks = ticksOf(scale);
  const tickW = Math.max(...ticks.map((v) => textWidth(chartNumber(v, dec), 11)));
  const x0 = 8 + (c.yTitle.trim() ? 18 : 0) + tickW + 8;
  const x1 = W - 14;
  const y0 = top;
  const y1 = H - 22 - (c.xTitle.trim() ? 18 : 0) - 4;
  const sy = (v: number) => y1 - ((v - scale.min) / (scale.max - scale.min)) * (y1 - y0);

  // the scale, and the grid at each of its steps
  for (const v of ticks) {
    if (c.grid && v !== 0) parts.push(`<line x1="${r1(x0)}" y1="${r1(sy(v))}" x2="${r1(x1)}" y2="${r1(sy(v))}" stroke="${GRID}" stroke-width="1"/>`);
    parts.push(`<line x1="${r1(x0 - 4)}" y1="${r1(sy(v))}" x2="${r1(x0)}" y2="${r1(sy(v))}" stroke="${AXIS}" stroke-width="1"/>`);
    parts.push(text(x0 - 7, sy(v) + 4, chartNumber(v, dec), { anchor: "end", fill: MUTED }));
  }
  parts.push(`<line x1="${r1(x0)}" y1="${r1(y0)}" x2="${r1(x0)}" y2="${r1(y1)}" stroke="${AXIS}" stroke-width="1.2"/>`);

  const n = Math.max(rows.length, 1);
  const slot = (x1 - x0) / n;
  const mid = (i: number) => x0 + slot * (i + 0.5);
  const zero = sy(0);

  if (c.kind === "bar" || c.kind === "histogram") {
    // (a histogram: the bars side by side, each outlined so that they stay apart in black and white)
    const histogram = c.kind === "histogram";
    const bw = histogram ? slot : slot * 0.6;
    rows.forEach((r, i) => {
      if (r.value === null) return;
      const y = Math.min(zero, sy(r.value));
      const h = Math.abs(sy(r.value) - zero);
      parts.push(`<rect x="${r1(mid(i) - bw / 2)}" y="${r1(y)}" width="${r1(bw)}" height="${r1(h)}" fill="${c.color}"${histogram ? ` stroke="${AXIS}" stroke-width="1"` : ""}/>`);
    });
  } else if (c.kind === "stick") {
    rows.forEach((r, i) => {
      if (r.value !== null) parts.push(`<line x1="${r1(mid(i))}" y1="${r1(zero)}" x2="${r1(mid(i))}" y2="${r1(sy(r.value))}" stroke="${c.color}" stroke-width="3"/>`);
    });
  } else {
    // the line (and for an area, the room between it and 0), cut where a value is missing; a dot at each value of a line
    const area = c.kind === "area";
    let run: { x: number; y: number }[] = [];
    const flush = () => {
      if (run.length > 1) {
        const pts = run.map((q) => `${r1(q.x)},${r1(q.y)}`).join(" ");
        if (area) parts.push(`<polygon points="${r1(run[0].x)},${r1(zero)} ${pts} ${r1(run[run.length - 1].x)},${r1(zero)}" fill="${c.color}" fill-opacity="0.25"/>`);
        parts.push(`<polyline points="${pts}" fill="none" stroke="${c.color}" stroke-width="2" stroke-linejoin="round"/>`);
      } else if (area && run.length === 1) parts.push(`<circle cx="${r1(run[0].x)}" cy="${r1(run[0].y)}" r="3.5" fill="${c.color}"/>`);
      run = [];
    };
    rows.forEach((r, i) => {
      if (r.value === null) return flush();
      run.push({ x: mid(i), y: sy(r.value) });
    });
    flush();
    if (!area)
      rows.forEach((r, i) => {
        if (r.value !== null) parts.push(`<circle cx="${r1(mid(i))}" cy="${r1(sy(r.value))}" r="3.5" fill="${c.color}"/>`);
      });
  }

  if (c.showValues)
    rows.forEach((r, i) => {
      if (r.value === null) return;
      const below = r.value < 0;
      parts.push(text(mid(i), sy(r.value) + (below ? 14 : -6), chartNumber(r.value, dec), { size: 10, weight: 600 }));
    });

  // the axis of the names (at 0), and the names under the chart
  parts.push(`<line x1="${r1(x0)}" y1="${r1(zero)}" x2="${r1(x1)}" y2="${r1(zero)}" stroke="${AXIS}" stroke-width="1.2"/>`);
  rows.forEach((r, i) => parts.push(text(mid(i), y1 + 16, fit(r.label, 11, slot - 4))));

  if (c.yTitle.trim()) parts.push(text(14, (y0 + y1) / 2, fit(c.yTitle.trim(), 11, y1 - y0), { rotate: true, weight: 600, fill: MUTED }));
  if (c.xTitle.trim()) parts.push(text((x0 + x1) / 2, H - 8, fit(c.xTitle.trim(), 11, x1 - x0), { weight: 600, fill: MUTED }));
}

// Horizontal bars: the names on the left, the scale of values under the chart
function hbars(c: ChartConfig, parts: string[], top: number, o: RenderOptions) {
  const W = c.width;
  const H = c.height;
  const dec = o.decimal ?? ",";
  const rows = c.rows;
  const scale = valueScale(rows.flatMap((r) => (r.value === null ? [] : [r.value])));
  const ticks = ticksOf(scale);
  const nameW = Math.min(W * 0.3, Math.max(20, ...rows.map((r) => textWidth(r.label, 11))));
  const x0 = 8 + (c.yTitle.trim() ? 18 : 0) + nameW + 8;
  const x1 = W - 14 - textWidth(chartNumber(scale.max, dec), 11) / 2;
  const y0 = top;
  const y1 = H - 22 - (c.xTitle.trim() ? 18 : 0) - 4;
  const sx = (v: number) => x0 + ((v - scale.min) / (scale.max - scale.min)) * (x1 - x0);

  // the scale under the chart, and the grid at each of its steps
  for (const v of ticks) {
    if (c.grid && v !== 0) parts.push(`<line x1="${r1(sx(v))}" y1="${r1(y0)}" x2="${r1(sx(v))}" y2="${r1(y1)}" stroke="${GRID}" stroke-width="1"/>`);
    parts.push(`<line x1="${r1(sx(v))}" y1="${r1(y1)}" x2="${r1(sx(v))}" y2="${r1(y1 + 4)}" stroke="${AXIS}" stroke-width="1"/>`);
    parts.push(text(sx(v), y1 + 16, chartNumber(v, dec), { fill: MUTED }));
  }
  parts.push(`<line x1="${r1(x0)}" y1="${r1(y1)}" x2="${r1(x1)}" y2="${r1(y1)}" stroke="${AXIS}" stroke-width="1.2"/>`);

  const n = Math.max(rows.length, 1);
  const slot = (y1 - y0) / n;
  const mid = (i: number) => y0 + slot * (i + 0.5);
  const zero = sx(0);
  const bh = slot * 0.6;
  rows.forEach((r, i) => {
    parts.push(text(x0 - 8, mid(i) + 4, fit(r.label, 11, nameW), { anchor: "end" }));
    if (r.value === null) return;
    const x = Math.min(zero, sx(r.value));
    parts.push(`<rect x="${r1(x)}" y="${r1(mid(i) - bh / 2)}" width="${r1(Math.abs(sx(r.value) - zero))}" height="${r1(bh)}" fill="${c.color}"/>`);
    if (c.showValues) parts.push(text(sx(r.value) + (r.value < 0 ? -5 : 5), mid(i) + 4, chartNumber(r.value, dec), { size: 10, weight: 600, anchor: r.value < 0 ? "end" : "start" }));
  });
  // the axis of the names, at 0
  parts.push(`<line x1="${r1(zero)}" y1="${r1(y0)}" x2="${r1(zero)}" y2="${r1(y1)}" stroke="${AXIS}" stroke-width="1.2"/>`);

  if (c.yTitle.trim()) parts.push(text(14, (y0 + y1) / 2, fit(c.yTitle.trim(), 11, y1 - y0), { rotate: true, weight: 600, fill: MUTED }));
  if (c.xTitle.trim()) parts.push(text((x0 + x1) / 2, H - 8, fit(c.xTitle.trim(), 11, x1 - x0), { weight: 600, fill: MUTED }));
}

// A pie (or a half pie): a slice per positive value, a legend beside it (the names, with their colors)
function pie(c: ChartConfig, parts: string[], top: number, o: RenderOptions) {
  const W = c.width;
  const H = c.height;
  const dec = o.decimal ?? ",";
  const half = c.kind === "halfpie";
  const slices = c.rows.map((r, i) => ({ label: r.label, value: r.value ?? 0, color: CHART_COLORS[i % CHART_COLORS.length] })).filter((s) => s.value > 0);
  const total = slices.reduce((s, x) => s + x.value, 0);

  const legendW = Math.min(W * 0.4, Math.max(60, ...slices.map((s) => textWidth(s.label, 11) + 26)));
  const room = H - top - 14;
  // (a half disc is as high as its radius: in the same height it can be twice as wide as a full one)
  const r = Math.max(10, Math.min((W - legendW - 40) / 2, half ? room - 4 : room / 2));
  const cx = 16 + r;
  const cy = half ? top + (room + r) / 2 : top + room / 2;
  const full = Math.PI * (half ? 1 : 2);
  const at = (angle: number, d: number) => `${r1(cx + d * Math.cos(angle))},${r1(cy + d * Math.sin(angle))}`;
  const halfDisc = (attrs: string) => `<path d="M${at(Math.PI, r)} A${r1(r)},${r1(r)} 0 0 1 ${at(0, r)} Z" ${attrs}/>`;

  if (!total) {
    const dashed = `fill="none" stroke="${GRID}" stroke-width="2" stroke-dasharray="6 4"`;
    parts.push(half ? halfDisc(dashed) : `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" ${dashed}/>`);
    return;
  }

  let a = half ? Math.PI : -Math.PI / 2; // (from the left for a half pie, from the top for a pie; clockwise)
  for (const s of slices) {
    const sweep = (s.value / total) * full;
    if (slices.length === 1) parts.push(half ? halfDisc(`fill="${s.color}"`) : `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="${s.color}"/>`);
    else parts.push(`<path d="M${r1(cx)},${r1(cy)} L${at(a, r)} A${r1(r)},${r1(r)} 0 ${sweep > Math.PI ? 1 : 0} 1 ${at(a + sweep, r)} Z" fill="${s.color}" stroke="#ffffff" stroke-width="1.5"/>`);
    const share = (s.value / total) * 100;
    if (c.showValues && share >= 4) {
      const m = a + sweep / 2;
      parts.push(text(cx + r * 0.62 * Math.cos(m), cy + r * 0.62 * Math.sin(m) + 4, `${chartNumber(share, dec)} %`, { size: 11, weight: 700, fill: "#ffffff" }));
    }
    a += sweep;
  }

  // the legend, in the middle of the height of the disc (of the half disc)
  const lx = cx + r + 24;
  const ly = (half ? cy - r / 2 : cy) - (slices.length * 18) / 2 + 9;
  slices.forEach((s, i) => {
    const y = ly + i * 18;
    parts.push(`<rect x="${r1(lx)}" y="${r1(y - 6)}" width="11" height="11" rx="2" fill="${s.color}"/>`);
    parts.push(text(lx + 17, y + 4, fit(s.label, 11, W - lx - 22), { anchor: "start" }));
  });
}
