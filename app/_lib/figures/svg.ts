// Small helpers to write the figures' svg. Figures are vector drawings, so they stay sharp in print.
import type { Params } from "./types";

export type Pt = [number, number];

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ESC[c]);

export const r1 = (v: number) => Math.round(v * 10) / 10;
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));
export const rad = (deg: number) => (deg * Math.PI) / 180;

// Read a setting with a fallback (files may hold anything).
export const num = (p: Params, key: string, fallback: number) => {
  const v = Number(p[key]);
  return Number.isFinite(v) ? v : fallback;
};
export const str = (p: Params, key: string, fallback = "") => (typeof p[key] === "string" ? (p[key] as string) : fallback);
export const bool = (p: Params, key: string) => p[key] === true;
export const ink = (p: Params, fallback = "#111111") => {
  const v = str(p, "ink");
  return /^#[0-9a-f]{3,8}$/i.test(v) ? v : fallback;
};

// "2.5" → "2,5" (decimal comma, as on French and Moroccan papers).
export const fmt = (v: number) => String(Math.round(v * 100) / 100).replace(".", ",");
// "2,5" or "2.5" → 2.5
export const parseNum = (s: string) => Number(s.trim().replace(",", "."));

// Names of the corners: "ABC", "A B C" or "A, B, C" → ["A", "B", "C"] (padded / cut to n).
export function cornerNames(s: string, n: number): string[] {
  const t = s.trim();
  const parts = /[\s,;،]/.test(t) ? t.split(/[\s,;،]+/).filter(Boolean) : Array.from(t);
  return Array.from({ length: n }, (_, i) => parts[i] ?? "");
}

export function svg(w: number, h: number, body: string, color: string): string {
  const W = Math.ceil(w);
  const H = Math.ceil(h);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" color="${color}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" font-family="Arial, Tahoma, 'Segoe UI', sans-serif" font-size="15">${body}</svg>`;
}

export function text(x: number, y: number, s: string, o: { size?: number; anchor?: "start" | "middle" | "end"; fill?: string; bold?: boolean; italic?: boolean } = {}) {
  if (!s) return "";
  const attrs = [
    `x="${r1(x)}"`,
    `y="${r1(y)}"`,
    `fill="${o.fill ?? "currentColor"}"`,
    `stroke="none"`,
    o.size ? `font-size="${o.size}"` : "",
    o.anchor && o.anchor !== "start" ? `text-anchor="${o.anchor}"` : "",
    o.bold ? `font-weight="bold"` : "",
    o.italic ? `font-style="italic"` : "",
  ];
  return `<text ${attrs.filter(Boolean).join(" ")}>${esc(s)}</text>`;
}

// A label centered on a point (the baseline is moved so the text sits in the middle).
export const label = (p: Pt, s: string, fill: string, size = 15, extra: { bold?: boolean; italic?: boolean } = {}) =>
  text(p[0], p[1] + size * 0.35, s, { size, anchor: "middle", fill, ...extra });

export const line = (a: Pt, b: Pt, extra = "") => `<path d="M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}" ${extra}/>`;
export const poly = (pts: Pt[], extra = "") => `<polygon points="${pts.map((p) => `${r1(p[0])},${r1(p[1])}`).join(" ")}" ${extra}/>`;
export const dot = (p: Pt, r: number, fill: string) => `<circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="${r}" fill="${fill}" stroke="none"/>`;

// Arrow heads: marker-end="url(#a)" (id unique per figure is enough: each figure is its own image).
export const arrowDefs = (color: string, id = "a") =>
  `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${color}" stroke="none"/></marker></defs>`;

// Vector helpers.
export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
export const len = (a: Pt) => Math.hypot(a[0], a[1]);
export const unit = (a: Pt): Pt => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
export const centroid = (pts: Pt[]): Pt => mul(pts.reduce((s, p) => add(s, p), [0, 0] as Pt), 1 / pts.length);

// Fit points (math coordinates, y up) in a box of at most maxW × maxH with `pad` around:
// returns the svg points and the svg size.
export function fit(pts: Pt[], maxW: number, maxH: number, pad: number) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const s = Math.min(maxW / Math.max(1e-6, maxX - minX), maxH / Math.max(1e-6, maxY - minY));
  const out = pts.map((p): Pt => [pad + (p[0] - minX) * s, pad + (maxY - p[1]) * s]);
  return { pts: out, w: (maxX - minX) * s + pad * 2, h: (maxY - minY) * s + pad * 2, scale: s };
}

// Arc mark of the angle at `v` between the rays toward a and b (svg coordinates), and the spot
// for its value. A right angle gets the small square instead.
export function angleMark(v: Pt, a: Pt, b: Pt, r: number, color: string) {
  const u = unit(sub(a, v));
  const w = unit(sub(b, v));
  const deg = (Math.acos(clamp(u[0] * w[0] + u[1] * w[1], -1, 1)) * 180) / Math.PI;
  const bis = unit(add(u, w));
  if (Math.abs(deg - 90) < 0.5) {
    const k = Math.min(12, r * 0.7);
    const p1 = add(v, mul(u, k));
    const p3 = add(v, mul(w, k));
    const p2 = add(p1, mul(w, k));
    return { path: `<path d="M${r1(p1[0])} ${r1(p1[1])}L${r1(p2[0])} ${r1(p2[1])}L${r1(p3[0])} ${r1(p3[1])}" stroke="${color}" stroke-width="1.4"/>`, deg, at: add(v, mul(bis, k + 16)) };
  }
  const s = add(v, mul(u, r));
  const e = add(v, mul(w, r));
  const sweep = u[0] * w[1] - u[1] * w[0] > 0 ? 1 : 0;
  const large = deg > 180 ? 1 : 0;
  return { path: `<path d="M${r1(s[0])} ${r1(s[1])}A${r} ${r} 0 ${large} ${sweep} ${r1(e[0])} ${r1(e[1])}" stroke="${color}" stroke-width="1.4"/>`, deg, at: add(v, mul(bis, r + 14)) };
}

// Labels outside a polygon: from its center through each corner.
export const outside = (p: Pt, center: Pt, d: number): Pt => add(p, mul(unit(sub(p, center)), d));
