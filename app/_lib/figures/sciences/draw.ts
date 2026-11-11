// Drawing kit of the Sciences figures: formulas (CO2, H^+), arrow heads, graph axes, text boxes that can be left empty.
import { esc, r1, rad, type Pt } from "../svg";

// Rough width of a text (Arial): enough to keep it inside the picture.
export const textWidth = (s: string, size: number) => {
  let w = 0;
  for (const ch of s) w += /[؀-ۿ]/.test(ch) ? 0.5 : /[A-Z0-9mwMW]/.test(ch) ? 0.66 : 0.54;
  return w * size;
};

// "C6H12O6", "NADPH,H^+", "e^−": digits after a letter are written low, what follows ^ is written high (up to a space or comma).
export function chem(x: number, y: number, s: string, o: { size?: number; anchor?: "start" | "middle" | "end"; fill?: string; bold?: boolean } = {}) {
  if (!s) return "";
  const size = o.size ?? 13;
  const small = Math.round(size * 0.72);
  const low = Math.round(size * 0.28);
  const high = -Math.round(size * 0.38);
  let out = "";
  let shift = 0; // where the baseline is now
  let run = ""; // plain text not written yet
  const flush = () => {
    if (run) out += shift ? `<tspan dy="${-shift}">${esc(run)}</tspan>` : esc(run);
    if (run) shift = 0;
    run = "";
  };
  const chars = Array.from(s);
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === "^") {
      flush();
      let sup = "";
      while (i + 1 < chars.length && !/[\s,]/.test(chars[i + 1])) sup += chars[++i];
      out += `<tspan dy="${high - shift}" font-size="${small}">${esc(sup)}</tspan>`;
      shift = high;
      continue;
    }
    if (/\d/.test(c) && i > 0 && /[A-Za-z)\]]/.test(chars[i - 1])) {
      flush();
      let sub = c;
      while (i + 1 < chars.length && /\d/.test(chars[i + 1])) sub += chars[++i];
      out += `<tspan dy="${low - shift}" font-size="${small}">${sub}</tspan>`;
      shift = low;
      continue;
    }
    if (shift && !run) {
      // back on the baseline
      out += `<tspan dy="${-shift}">${esc(c)}</tspan>`;
      shift = 0;
      continue;
    }
    run += c;
  }
  flush();
  return `<text ${textAttrs(x, y, s, size, o)}>${out}</text>`;
}

// Arabic is written right to left: with Latin words in it (ADN, ATP…) the words stay in their order. A right-to-left text
// starts on its right, so the anchor is turned around to keep the text where it was meant to be.
export const isArabic = (s: string) => /[؀-ۿ]/.test(s);
function textAttrs(x: number, y: number, s: string, size: number, o: { anchor?: "start" | "middle" | "end"; fill?: string; bold?: boolean; italic?: boolean }) {
  const rtl = isArabic(s);
  const anchor = rtl ? ({ start: "end", end: "start", middle: "middle" } as const)[o.anchor ?? "start"] : (o.anchor ?? "start");
  const attrs = [`x="${r1(x)}"`, `y="${r1(y)}"`, `fill="${o.fill ?? "currentColor"}"`, `stroke="none"`, `font-size="${size}"`];
  if (anchor !== "start") attrs.push(`text-anchor="${anchor}"`);
  if (rtl) attrs.push(`direction="rtl"`);
  if (o.bold) attrs.push(`font-weight="bold"`);
  if (o.italic) attrs.push(`font-style="italic"`);
  return attrs.join(" ");
}

// Plain text (names: "gp120" stays as it is), right to left when Arabic.
export const say = (x: number, y: number, s: string, o: { size?: number; anchor?: "start" | "middle" | "end"; fill?: string; bold?: boolean; italic?: boolean } = {}) =>
  s ? `<text ${textAttrs(x, y, s, o.size ?? 13, o)}>${esc(s)}</text>` : "";

// Width of a formula as chem() writes it.
export const chemWidth = (s: string, size = 13) => textWidth(s.replace(/\^/g, ""), size) * 0.95;

// A filled arrow head with its tip at `tip`, pointing at `deg` (0 = right, 90 = down).
export function head(tip: Pt, deg: number, color: string, size = 8) {
  const a = rad(deg);
  const back: Pt = [tip[0] - Math.cos(a) * size, tip[1] - Math.sin(a) * size];
  const n: Pt = [-Math.sin(a) * size * 0.45, Math.cos(a) * size * 0.45];
  return `<polygon points="${r1(tip[0])},${r1(tip[1])} ${r1(back[0] + n[0])},${r1(back[1] + n[1])} ${r1(back[0] - n[0])},${r1(back[1] - n[1])}" fill="${color}" stroke="none"/>`;
}

// A straight arrow from a to b.
export function arrow(a: Pt, b: Pt, color: string, extra = "") {
  const deg = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  const end: Pt = [b[0] - Math.cos(rad(deg)) * 4, b[1] - Math.sin(rad(deg)) * 4];
  return `<path d="M${r1(a[0])} ${r1(a[1])}L${r1(end[0])} ${r1(end[1])}" ${extra}/>` + head(b, deg, color);
}

// Point on a circle (0° = up, clockwise).
export const polar = (c: Pt, r: number, deg: number): Pt => [c[0] + r * Math.sin(rad(deg)), c[1] - r * Math.cos(rad(deg))];

// An arc of a circle from `from`° to `to`° (clockwise, 0° = up), with an arrow head at its end.
export function arcArrow(c: Pt, r: number, from: number, to: number, color: string, extra = "") {
  const a = polar(c, r, from);
  const b = polar(c, r, to);
  const large = (to - from + 360) % 360 > 180 ? 1 : 0;
  return `<path d="M${r1(a[0])} ${r1(a[1])}A${r} ${r} 0 ${large} 1 ${r1(b[0])} ${r1(b[1])}" ${extra}/>` + head(b, to, color);
}

// Axes of a graph: the origin at (x0, y0), w long to the right and h high, with their names.
export function axes(x0: number, y0: number, w: number, h: number, xName: string, yName: string, color: string) {
  let s = `<path d="M${x0} ${y0 - h}V${y0}H${x0 + w}" stroke-width="1.6"/>`;
  s += head([x0 + w + 6, y0], 0, color) + head([x0, y0 - h - 6], -90, color);
  s += say(x0 + w + 4, y0 + 30, xName, { size: 12, anchor: "end", fill: color });
  s += say(x0 + 6, y0 - h - 6, yName, { size: 12, fill: color });
  return s;
}

// A tick of an axis with its value.
export const xTick = (x: number, y0: number, s: string, color: string) => `<path d="M${r1(x)} ${y0}v5" stroke-width="1.2"/>` + say(x, y0 + 17, s, { size: 11, anchor: "middle", fill: color });
export const yTick = (x0: number, y: number, s: string, color: string) => `<path d="M${x0} ${r1(y)}h-5" stroke-width="1.2"/>` + chem(x0 - 8, y + 4, s, { size: 11, anchor: "end", fill: color });

// A smooth line through points (a polyline: the points are close together).
export const polyline = (pts: Pt[], extra = "") => `<polyline points="${pts.map((p) => `${r1(p[0])},${r1(p[1])}`).join(" ")}" ${extra}/>`;

// A box with a formula or a name in it, or empty (dotted) when the student writes it.
export function box(c: Pt, s: string, empty: boolean, color: string, o: { size?: number; minW?: number; h?: number; round?: boolean; frame?: boolean } = {}) {
  const size = o.size ?? 12;
  const w = Math.max(o.minW ?? 44, chemWidth(s, size) + 14);
  const h = o.h ?? size + 10;
  const rx = o.round ? h / 2 : 4;
  let out = "";
  if (empty) out += `<rect x="${r1(c[0] - w / 2)}" y="${r1(c[1] - h / 2)}" width="${r1(w)}" height="${h}" rx="${rx}" fill="#ffffff" stroke-width="1.2" stroke-dasharray="3 3"/>`;
  else {
    if (o.frame !== false) out += `<rect x="${r1(c[0] - w / 2)}" y="${r1(c[1] - h / 2)}" width="${r1(w)}" height="${h}" rx="${rx}" fill="#ffffff" stroke-width="1.2"/>`;
    out += chem(c[0], c[1] + size * 0.36, s, { size, anchor: "middle", fill: color });
  }
  return { svg: out, w, h };
}

// Text in lines of at most `max` px (cut at spaces), centered on c.
export function wrapped(c: Pt, s: string, max: number, color: string, size = 12) {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && textWidth(`${last} ${w}`, size) <= max) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  const lh = size + 3;
  const y0 = c[1] - ((lines.length - 1) * lh) / 2 + size * 0.36;
  return { svg: lines.map((l, i) => chem(c[0], y0 + i * lh, l, { size, anchor: "middle", fill: color })).join(""), lines: lines.length, w: Math.max(0, ...lines.map((l) => textWidth(l, size))) };
}
