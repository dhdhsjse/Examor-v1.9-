// Drawing kit of the Physics figures: vectors with their names, springs, hatched supports, lab glassware, the symbols of
// electric components, and graph frames. Everything is line art in the figure's ink (black by default), to print well.
import { r1, rad, type Pt } from "../svg";
import { chem, head, say, textWidth } from "../sciences/draw";

export { arcArrow, chem, head, polyline, say, textWidth } from "../sciences/draw";

// Light fills: a liquid, a solid body, the glass of an apparatus. Grey, so they stay light on a black-and-white print.
export const LIQUID = "#e6e6e6";
export const SOLID = "#f2f2f2";
export const GRID = "#bdbdbd";

// "M0 0L10 10" from points.
export const path = (pts: Pt[], close = false) => `M${pts.map((p) => `${r1(p[0])} ${r1(p[1])}`).join("L")}${close ? "Z" : ""}`;
export const seg = (a: Pt, b: Pt, extra = "") => `<path d="M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}" ${extra}/>`;
export const dashed = (a: Pt, b: Pt, w = 1) => seg(a, b, `stroke-width="${w}" stroke-dasharray="5 4"`);
export const disc = (p: Pt, r: number, fill: string, extra = "") => `<circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="${r}" fill="${fill}" ${extra}/>`;

// A vector: the arrow from a to b (with a filled head), heavier than the lines of the drawing.
export function vector(a: Pt, b: Pt, c: string, w = 2) {
  const deg = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (l < 1) return "";
  const end: Pt = [b[0] - Math.cos(rad(deg)) * Math.min(6, l), b[1] - Math.sin(rad(deg)) * Math.min(6, l)];
  return seg(a, end, `stroke-width="${w}"`) + head(b, deg, c, 9);
}

// The name of a vector, with its small arrow above ("F", "v0", "P", "F_A/B"): digits after a letter are written low, and
// what follows "_" too.
export function vecName(x: number, y: number, name: string, c: string, o: { size?: number; anchor?: "start" | "middle" | "end"; arrow?: boolean } = {}) {
  if (!name) return "";
  const size = o.size ?? 14;
  const [main, low = ""] = name.split("_");
  const w = Math.max(8, textWidth(main.replace(/\d/g, ""), size) * 0.9);
  const full = w + (low ? textWidth(low, size * 0.7) : 0);
  const anchor = o.anchor ?? "middle";
  const left = anchor === "middle" ? x - full / 2 : anchor === "end" ? x - full : x;
  let s = chem(left, y, main, { size, fill: c });
  if (low) s += `<text x="${r1(left + w + 1)}" y="${r1(y + size * 0.28)}" fill="${c}" stroke="none" font-size="${r1(size * 0.7)}">${low.replace(/[<>&"]/g, "")}</text>`;
  if (o.arrow !== false) {
    const ay = y - size * 0.95;
    s += `<path d="M${r1(left)} ${r1(ay)}H${r1(left + w)}" stroke-width="1.1"/>` + head([left + w + 2, ay], 0, c, 5);
  }
  return s;
}

// Hatching under a ground line from x1 to x2 at y (the support).
export function ground(x1: number, x2: number, y: number, extra = "") {
  const s = `<path d="M${r1(x1)} ${r1(y)}H${r1(x2)}" stroke-width="2" ${extra}/>`;
  let h = "";
  for (let x = x1 + 6; x <= x2; x += 10) h += `M${r1(x)} ${r1(y)}l-8 9`;
  return s + `<path d="${h}" stroke-width="1"/>`;
}
// A hatched wall (or ceiling): from a to b, hatched on its side (+1: right/below of the line from a to b, −1: the other).
export function hatched(a: Pt, b: Pt, side: 1 | -1 = 1) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const u: Pt = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  const n: Pt = [-u[1] * side, u[0] * side];
  let h = "";
  for (let t = 4; t <= l; t += 10) {
    const p: Pt = [a[0] + u[0] * t, a[1] + u[1] * t];
    h += `M${r1(p[0])} ${r1(p[1])}l${r1(n[0] * 8 - u[0] * 6)} ${r1(n[1] * 8 - u[1] * 6)}`;
  }
  return seg(a, b, `stroke-width="2"`) + `<path d="${h}" stroke-width="1"/>`;
}

// A spring from a to b: straight ends, then `coils` zigzags `width` wide.
export function spring(a: Pt, b: Pt, coils = 10, width = 12) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const u: Pt = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  const n: Pt = [-u[1], u[0]];
  const end = Math.min(10, l * 0.12);
  const pts: Pt[] = [a, [a[0] + u[0] * end, a[1] + u[1] * end]];
  const step = (l - 2 * end) / (coils * 2);
  for (let i = 1; i < coils * 2; i++) {
    const t = end + step * i;
    const k = i % 2 ? width / 2 : -width / 2;
    pts.push([a[0] + u[0] * t + n[0] * k, a[1] + u[1] * t + n[1] * k]);
  }
  pts.push([b[0] - u[0] * end, b[1] - u[1] * end], b);
  return `<path d="${path(pts)}" stroke-width="1.6"/>`;
}

// The wavy surface of a liquid from x1 to x2 at y.
export function surface(x1: number, x2: number, y: number) {
  const n = Math.max(2, Math.round((x2 - x1) / 16));
  const w = (x2 - x1) / n;
  let d = `M${r1(x1)} ${r1(y)}`;
  for (let i = 0; i < n; i++) d += `q${r1(w / 4)} -2.5 ${r1(w / 2)} 0t${r1(w / 2)} 0`;
  return `<path d="${d}" stroke-width="1.1"/>`;
}

// A beaker (x, y = its top left corner), with liquid up to `level` (0…1, 0 = empty).
export function beaker(x: number, y: number, w: number, h: number, level: number, liquid = LIQUID) {
  let s = "";
  if (level > 0) {
    const top = y + h * (1 - level);
    s += `<path d="M${x} ${r1(top)}V${y + h - 6}Q${x} ${y + h} ${x + 6} ${y + h}H${x + w - 6}Q${x + w} ${y + h} ${x + w} ${y + h - 6}V${r1(top)}Z" fill="${liquid}" stroke="none"/>`;
    s += surface(x, x + w, top);
  }
  s += `<path d="M${x - 5} ${y - 4}Q${x} ${y - 2} ${x} ${y + 6}V${y + h - 6}Q${x} ${y + h} ${x + 6} ${y + h}H${x + w - 6}Q${x + w} ${y + h} ${x + w} ${y + h - 6}V${y}" stroke-width="2"/>`;
  return s;
}

// A magnetic stirrer (x, y = top left), with its bar in the beaker above when `bar` is the bar's center.
export function stirrer(x: number, y: number, w: number, bar?: Pt) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="26" rx="4" fill="#ffffff" stroke-width="1.8"/>`;
  s += `<circle cx="${x + w - 16}" cy="${y + 13}" r="6" stroke-width="1.3"/><path d="M${x + w - 16} ${y + 8}v5" stroke-width="1.3"/>`;
  if (bar) s += `<rect x="${r1(bar[0] - 12)}" y="${r1(bar[1] - 3)}" width="24" height="6" rx="3" fill="currentColor" stroke="none"/>`;
  return s;
}

// A lab stand: base, rod, and a clamp at `clampY` reaching to `clampX`.
export function stand(x: number, base: number, top: number, clampY: number, clampX: number) {
  let s = `<rect x="${x - 30}" y="${base}" width="70" height="10" rx="2" fill="#ffffff" stroke-width="1.8"/>`;
  s += `<path d="M${x} ${base}V${top}" stroke-width="3"/>`;
  s += `<path d="M${x} ${clampY}H${clampX}" stroke-width="2.4"/><rect x="${x - 5}" y="${clampY - 5}" width="10" height="10" fill="#ffffff" stroke-width="1.4"/>`;
  return s;
}

// ---- Electric components ----
// A component's symbol along a horizontal axis, its middle at (0, 0) and its leads to ±H. Turned and moved by `place`.
export type Component = "generator" | "battery" | "resistor" | "lamp" | "switch-open" | "switch-closed" | "ammeter" | "voltmeter" | "ohmmeter" | "motor" | "capacitor" | "coil" | "diode" | "led" | "fuse" | "wire" | "ground" | "lowfreq" | "rheostat" | "zener";

// A letter of a symbol (A, V, +): its center in the symbol's own coordinates. `place` writes it upright.
type SymbolText = { at: Pt; t: string; size: number };

export function symbol(type: Component, H: number, c: string, texts?: SymbolText[]): string {
  const lead = (r: number) => `<path d="M${-H} 0H${-r}M${r} 0H${H}" stroke-width="2"/>`;
  const letter = (at: Pt, t: string, size: number) => {
    if (texts) texts.push({ at, t, size });
    return texts ? "" : say(at[0], at[1] + size * 0.36, t, { size, anchor: "middle", fill: c, bold: true });
  };
  const meter = (t: string) => lead(14) + `<circle cx="0" cy="0" r="14" fill="#ffffff" stroke-width="2"/>` + letter([0, 0], t, 15);
  switch (type) {
    case "wire":
      return `<path d="M${-H} 0H${H}" stroke-width="2"/>`;
    case "battery":
      // the long thin plate is the + terminal
      return lead(5) + `<path d="M-5 -15V15" stroke-width="2"/><path d="M5 -8V8" stroke-width="5"/>` + letter([-14, -17], "+", 13);
    case "generator":
      // a DC generator: a circle crossed by its line, + on its side
      return lead(14) + `<circle cx="0" cy="0" r="14" fill="#ffffff" stroke-width="2"/><path d="M-14 0H14" stroke-width="2"/>` + letter([-22, -15], "+", 13);
    case "lowfreq":
      return lead(14) + `<circle cx="0" cy="0" r="14" fill="#ffffff" stroke-width="2"/><path d="M-8 0q4 -8 8 0t8 0" stroke-width="1.6"/>`;
    case "resistor":
      return lead(18) + `<rect x="-18" y="-7" width="36" height="14" fill="#ffffff" stroke-width="2"/>`;
    case "rheostat":
      return lead(18) + `<rect x="-18" y="-7" width="36" height="14" fill="#ffffff" stroke-width="2"/>` + `<path d="M-14 12L14 -12" stroke-width="1.6"/>` + head([16, -14], -40, c, 7);
    case "lamp":
      return lead(13) + `<circle cx="0" cy="0" r="13" fill="#ffffff" stroke-width="2"/><path d="M-9.2 -9.2L9.2 9.2M9.2 -9.2L-9.2 9.2" stroke-width="1.8"/>`;
    case "switch-open":
      return lead(16) + `<circle cx="-16" cy="0" r="2.6" fill="${c}" stroke="none"/><circle cx="16" cy="0" r="2.6" fill="${c}" stroke="none"/><path d="M-16 0L12 -15" stroke-width="2"/>`;
    case "switch-closed":
      return lead(16) + `<circle cx="-16" cy="0" r="2.6" fill="${c}" stroke="none"/><circle cx="16" cy="0" r="2.6" fill="${c}" stroke="none"/><path d="M-16 0L16 0" stroke-width="2"/>`;
    case "ammeter":
      return meter("A");
    case "voltmeter":
      return meter("V");
    case "ohmmeter":
      return meter("Ω");
    case "motor":
      return meter("M");
    case "capacitor":
      return lead(5) + `<path d="M-5 -14V14M5 -14V14" stroke-width="2.4"/>`;
    case "coil": {
      let d = "M-20 0";
      for (let k = 0; k < 4; k++) d += `a5 5 0 0 1 10 0`;
      return lead(20) + `<path d="${d}" stroke-width="2"/>`;
    }
    case "diode":
    case "led":
    case "zener": {
      let s = lead(9) + `<path d="M-9 -10L9 0L-9 10Z" fill="#ffffff" stroke-width="2"/>`;
      s += type === "zener" ? `<path d="M5 -12L9 -10V10L13 12" stroke-width="2"/>` : `<path d="M9 -11V11" stroke-width="2"/>`;
      if (type === "led") s += `<path d="M0 -14L8 -24M7 -12L15 -22" stroke-width="1.3"/>` + head([9, -26], -51, c, 5) + head([16, -24], -51, c, 5);
      return s;
    }
    case "fuse":
      return lead(18) + `<rect x="-18" y="-7" width="36" height="14" fill="#ffffff" stroke-width="2"/><path d="M-24 0H24" stroke-width="1.4"/>`;
    case "ground":
      return `<path d="M0 0V12M-12 12H12M-8 17H8M-4 22H4" stroke-width="2"/>`;
  }
}

// A symbol between a and b (a straight horizontal or vertical stretch): the leads reach both points.
// The letters (A, V, +) are written upright, whatever the turn.
export function place(type: Component, a: Pt, b: Pt, c: string) {
  const H = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2;
  const deg = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const texts: SymbolText[] = [];
  let s = `<g transform="translate(${r1(m[0])} ${r1(m[1])}) rotate(${r1(deg)})">${symbol(type, H, c, texts)}</g>`;
  const cos = Math.cos(rad(deg));
  const sin = Math.sin(rad(deg));
  for (const { at, t, size } of texts) {
    const x = m[0] + at[0] * cos - at[1] * sin;
    const y = m[1] + at[0] * sin + at[1] * cos;
    s += say(x, y + size * 0.36, t, { size, anchor: "middle", fill: c, bold: true });
  }
  return s;
}

// A junction dot.
export const node = (p: Pt, c: string) => `<circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="3" fill="${c}" stroke="none"/>`;

// A voltage arrow beside a component from a to b (the arrow points to the first letter of U_AB, i.e. toward a), at `off` px.
export function voltage(a: Pt, b: Pt, name: string, c: string, off = 24) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const u: Pt = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  const n: Pt = [u[1], -u[0]]; // left of the direction a → b (above a horizontal one)
  const k = Math.min(18, l * 0.25);
  const from: Pt = [b[0] - u[0] * k + n[0] * off, b[1] - u[1] * k + n[1] * off];
  const to: Pt = [a[0] + u[0] * k + n[0] * off, a[1] + u[1] * k + n[1] * off];
  // the name on the outer side of the arrow
  const side = off >= 0 ? 1 : -1;
  const mid: Pt = [(from[0] + to[0]) / 2 + n[0] * 16 * side, (from[1] + to[1]) / 2 + n[1] * 16 * side + 5];
  const vertical = Math.abs(u[1]) > 0.9;
  return vector(from, to, c, 1.5) + low(mid[0] + (vertical ? 4 * side : 0), mid[1], name, c, { anchor: vertical ? (side * u[1] > 0 ? "start" : "end") : "middle" });
}

// A name with what follows "_" written low ("u_C", "U_AB"); digits after a letter are written low too.
export function low(x: number, y: number, name: string, c: string, o: { size?: number; anchor?: "start" | "middle" | "end"; bold?: boolean } = {}) {
  if (!name.includes("_")) return chem(x, y, name, { size: o.size ?? 13, anchor: o.anchor, fill: c, bold: o.bold });
  const size = o.size ?? 13;
  const [main, sub] = name.split("_");
  const w = textWidth(main, size) * 0.95 + textWidth(sub, size * 0.72);
  const left = o.anchor === "middle" ? x - w / 2 : o.anchor === "end" ? x - w : x;
  return `<text x="${r1(left)}" y="${r1(y)}" fill="${c}" stroke="none" font-size="${size}"${o.bold ? ' font-weight="bold"' : ""}>${main.replace(/[<>&"]/g, "")}<tspan dy="${r1(size * 0.28)}" font-size="${r1(size * 0.72)}">${sub.replace(/[<>&"]/g, "")}</tspan></text>`;
}

// A current arrow on a wire at p, pointing at `deg` (0 = right, 90 = down), with its name beside it.
export function current(p: Pt, deg: number, name: string, c: string) {
  const a = rad(deg);
  const tip: Pt = [p[0] + Math.cos(a) * 6, p[1] + Math.sin(a) * 6];
  const n: Pt = [Math.sin(a), -Math.cos(a)];
  const at: Pt = [p[0] + n[0] * 14, p[1] + n[1] * 14 + 4];
  return head(tip, deg, c, 11) + (name ? chem(at[0], at[1], name, { size: 13, anchor: "middle", fill: c }) : "");
}

// ---- Graphs ----
export interface Frame {
  s: string;
  X: (v: number) => number;
  Y: (v: number) => number;
  x0: number;
  y0: number;
  w: number;
  h: number;
  xt: boolean; // numbers on the x axis
  yt: boolean; // numbers on the y axis
}

// Axes from the origin (x0, y0) w wide and h high, for values xMin…xMax and yMin…yMax, with their names, a grid
// (squares of `grid` units) and ticks every `xStep` and `yStep` (0: none). The origin is named O.
export function frame(o: {
  x0: number;
  y0: number;
  w: number;
  h: number;
  xMax: number;
  yMax: number;
  yMin?: number;
  xName: string;
  yName: string;
  c: string;
  xStep?: number;
  yStep?: number;
  grid?: boolean;
  gridX?: number;
  gridY?: number;
  ticks?: boolean;
  fmt?: (v: number) => string;
}): Frame {
  const { x0, y0, w, h, xMax, yMax, c } = o;
  const yMin = o.yMin ?? 0;
  const X = (v: number) => x0 + (v / xMax) * w;
  const Y = (v: number) => y0 - ((v - yMin) / (yMax - yMin)) * h;
  const fmt = o.fmt ?? ((v: number) => String(Math.round(v * 1000) / 1000).replace(".", ","));
  let s = "";
  if (o.grid) {
    const gx = o.gridX ?? o.xStep ?? xMax / 10;
    const gy = o.gridY ?? o.yStep ?? (yMax - yMin) / 8;
    let d = "";
    for (let v = gx; v <= xMax + 1e-9; v += gx) d += `M${r1(X(v))} ${r1(Y(yMax))}V${r1(Y(yMin))}`;
    for (let v = yMin; v <= yMax + 1e-9; v += gy) if (Math.abs(v) > 1e-9) d += `M${x0} ${r1(Y(v))}H${r1(X(xMax))}`;
    s += `<path d="${d}" stroke="${GRID}" stroke-width="0.7"/>`;
  }
  const axisY = yMin < 0 ? Y(0) : y0;
  s += `<path d="M${x0} ${r1(y0 - h - 10)}V${y0}M${x0} ${r1(axisY)}H${r1(x0 + w + 12)}" stroke-width="1.6"/>`;
  s += head([x0 + w + 18, axisY], 0, c) + head([x0, y0 - h - 16], -90, c);
  s += chem(x0 + w + 14, axisY + 28, o.xName, { size: 12, anchor: "end", fill: c });
  s += chem(x0 + 8, y0 - h - 14, o.yName, { size: 12, fill: c });
  s += say(x0 - 6, axisY + 16, "O", { size: 12, anchor: "end", fill: c });
  if (o.ticks !== false) {
    if (o.xStep) for (let v = o.xStep; v <= xMax + 1e-9; v += o.xStep) s += `<path d="M${r1(X(v))} ${r1(axisY)}v5" stroke-width="1.1"/>` + say(X(v), axisY + 17, fmt(v), { size: 10.5, anchor: "middle", fill: c });
    if (o.yStep)
      for (let v = Math.ceil(yMin / o.yStep) * o.yStep; v <= yMax + 1e-9; v += o.yStep)
        if (Math.abs(v) > 1e-9) s += `<path d="M${x0} ${r1(Y(v))}h-5" stroke-width="1.1"/>` + say(x0 - 8, Y(v) + 4, fmt(v), { size: 10.5, anchor: "end", fill: c });
  }
  const ticks = o.ticks !== false;
  return { s, X, Y, x0, y0, w, h, xt: ticks && !!o.xStep, yt: ticks && !!o.yStep };
}

// The points of a curve y = f(x) for x in a…b, in the frame.
export function curve(f: Frame, fn: (x: number) => number, a: number, b: number, n = 160): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    pts.push([f.X(x), f.Y(fn(x))]);
  }
  return pts;
}

// A dashed guide from a point of the curve to both axes, with its values written on the axes (beyond the axes' numbers).
export function guide(f: Frame, x: number, y: number, xText: string, yText: string, c: string) {
  let s = `<path d="M${r1(f.X(x))} ${f.y0}V${r1(f.Y(y))}H${f.x0}" stroke-width="1" stroke-dasharray="4 3"/>`;
  if (xText) s += chem(f.X(x), f.y0 + (f.xt ? 32 : 17), xText, { size: 12, anchor: "middle", fill: c, bold: true });
  if (yText) s += chem(f.x0 - (f.yt ? 26 : 8), f.Y(y) + 4, yText, { size: 12, anchor: "end", fill: c, bold: true });
  return s;
}

// A point of a measure (a small cross).
export const cross = (p: Pt) => `<path d="M${r1(p[0] - 4)} ${r1(p[1] - 4)}l8 8m0 -8l-8 8" stroke-width="1.5"/>`;

// The words of a figure in French and Arabic.
export type Two = { fr: string; ar: string };
export const tr = (lang: "fr" | "ar", w: Two) => (lang === "ar" ? w.ar : w.fr);
