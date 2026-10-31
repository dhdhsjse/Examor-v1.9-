// The drawing tools of the page (the Draw button of the floating tool bar): a brush, a pencil and a highlighter. Nothing here is
// React or Konva: the stroke is steadied while it is drawn (InkCapture), smoothed when it is done (finishInk), and drawn as a filled
// outline whose width follows the pressure and thins at the ends (inkModel). The page, the PDF and the previews of the tool bar all
// draw what these give. Unit-tested.

export type InkTool = "brush" | "pencil" | "highlighter";
/** How much the hand is helped: 0 = the raw stroke, 3 = very steady */
export type Smoothing = 0 | 1 | 2 | 3;
export type InkSettings = { color: string; size: number; smoothing: Smoothing };
/** A point of a stroke and how hard it was pressed (0..1; with a mouse it comes from the speed) */
export type InkPoint = { x: number; y: number; p: number };
type Pt = [number, number];

export const INK_TOOLS: readonly InkTool[] = ["brush", "pencil", "highlighter"];

export const INK_DEFAULTS: Record<InkTool, InkSettings> = {
  brush: { color: "#111111", size: 14, smoothing: 2 },
  pencil: { color: "#262626", size: 3, smoothing: 2 },
  highlighter: { color: "#ffe14d", size: 18, smoothing: 2 },
};

/** The smallest and largest size of each tool (page pixels) */
export const INK_SIZES: Record<InkTool, readonly [number, number]> = {
  brush: [2, 60],
  pencil: [1, 12],
  highlighter: [6, 40],
};

export const INK_PALETTES: Record<InkTool, readonly string[]> = {
  brush: ["#111111", "#5b5b5b", "#c62828", "#ef6c00", "#2e7d32", "#1565c0", "#1d4ed8", "#6a1b9a", "#ad1457", "#795548", "#ffffff", "#f9a825"],
  pencil: ["#262626", "#6b6b6b", "#b91c1c", "#c2410c", "#15803d", "#1d4ed8", "#0e7490", "#7e22ce", "#be185d", "#78350f", "#a3a3a3", "#ca8a04"],
  highlighter: ["#ffe14d", "#b6f36b", "#7ee8fa", "#ff9ecf", "#ffb86b", "#c4a7ff", "#9ef0c6", "#ff8a80"],
};

export const SMOOTHING_LABELS: Record<Smoothing, string> = { 0: "Raw", 1: "Light", 2: "Smooth", 3: "Extra smooth" };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);

// ---- while drawing ----

// The steadying of the hand, by smoothing level: the "rope" (screen pixels the pointer moves before the ink follows: shakes
// smaller than it never reach the paper) and how much the ink lags behind (0 = none). Together they turn a shaky mouse into a
// smooth line, like the stabilizer of a painting app.
const ROPE = [0, 1.5, 3.5, 6.5];
const EASE = [0, 0.3, 0.5, 0.66];

/**
 * The points of a stroke being drawn, steadied. `scale` = screen pixels per page pixel (the zoom), so the help feels the same
 * at every zoom. `add` takes each move of the pointer (a pen's pressure, else none: the speed of the mouse gives it).
 */
export class InkCapture {
  readonly points: InkPoint[];
  private brush: { x: number; y: number };
  private out: { x: number; y: number };
  private pressure = 0.55;
  private lastT: number;

  constructor(
    x: number,
    y: number,
    private readonly level: Smoothing,
    private readonly scale = 1,
    t = 0,
    pressure?: number,
  ) {
    this.brush = { x, y };
    this.out = { x, y };
    this.lastT = t;
    if (pressure !== undefined && pressure > 0) this.pressure = pressure;
    this.points = [{ x, y, p: this.pressure }];
  }

  add(x: number, y: number, t: number, pressure?: number, rope = ROPE[this.level] / this.scale): boolean {
    const d = dist(this.brush.x, this.brush.y, x, y);
    if (d > rope) {
      const k = (d - rope) / d;
      this.brush.x += (x - this.brush.x) * k;
      this.brush.y += (y - this.brush.y) * k;
    }
    const e = EASE[this.level];
    this.out.x += (this.brush.x - this.out.x) * (1 - e);
    this.out.y += (this.brush.y - this.out.y) * (1 - e);
    const last = this.points[this.points.length - 1];
    const step = dist(last.x, last.y, this.out.x, this.out.y);
    if (step < 0.35 / this.scale) return false;
    // A pen says how hard it presses; a mouse: the faster the stroke, the lighter (screen pixels per millisecond).
    const speed = (step * this.scale) / Math.max(1, t - this.lastT);
    const target = pressure !== undefined && pressure > 0 ? pressure : clamp(1.05 - speed / 2.6, 0.2, 1);
    this.pressure += (target - this.pressure) * (pressure !== undefined && pressure > 0 ? 0.6 : 0.22);
    this.lastT = t;
    this.points.push({ x: this.out.x, y: this.out.y, p: this.pressure });
    return true;
  }

  /** The pointer is let go at (x, y): the ink catches up with it along a curve, not a jump. */
  end(x: number, y: number) {
    for (let i = 0; i < 40 && dist(this.out.x, this.out.y, x, y) > 0.3; i++) this.add(x, y, this.lastT + 16, undefined, 0);
    const last = this.points[this.points.length - 1];
    if (dist(last.x, last.y, x, y) > 0.05) this.points.push({ x, y, p: last.p });
  }
}

// ---- when done ----

/** The stroke at even steps of `step` pixels (the pressure in between follows). */
export function resample(points: readonly InkPoint[], step: number): InkPoint[] {
  if (points.length < 2) return points.map((p) => ({ ...p }));
  const out: InkPoint[] = [{ ...points[0] }];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = dist(a.x, a.y, b.x, b.y);
    if (!len) continue;
    let s = step - carry;
    while (s <= len) {
      const t = s / len;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, p: a.p + (b.p - a.p) * t });
      s += step;
    }
    carry = len - (s - step);
  }
  const last = points[points.length - 1];
  const tail = out[out.length - 1];
  if (dist(tail.x, tail.y, last.x, last.y) > step * 0.25) out.push({ ...last });
  else out[out.length - 1] = { ...last };
  return out;
}

/** A gentle blur of the points (a window of `radius` points each side, weighted to the middle); the two ends stay where they are. */
function blur(points: readonly InkPoint[], radius: number, pressureRadius = radius): InkPoint[] {
  const n = points.length;
  if (n < 3 || (radius < 1 && pressureRadius < 1)) return points.map((p) => ({ ...p }));
  return points.map((pt, i) => {
    if (i === 0 || i === n - 1) return { ...pt, p: avg(points, i, pressureRadius, (q) => q.p) };
    // (near the ends the window shrinks, so the stroke still starts and ends where it was drawn)
    const r = Math.min(radius, i, n - 1 - i);
    return { x: avg(points, i, r, (q) => q.x), y: avg(points, i, r, (q) => q.y), p: avg(points, i, pressureRadius, (q) => q.p) };
  });
}

function avg(points: readonly InkPoint[], i: number, r: number, get: (p: InkPoint) => number) {
  let sum = 0;
  let wsum = 0;
  const k = Math.round(r);
  for (let j = Math.max(0, i - k); j <= Math.min(points.length - 1, i + k); j++) {
    const w = k + 1 - Math.abs(j - i);
    sum += get(points[j]) * w;
    wsum += w;
  }
  return sum / wsum;
}

/** The length of a stroke (pixels). */
export function strokeLength(points: readonly { x: number; y: number }[]) {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += dist(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
  return len;
}

/**
 * A highlighter stroke that is nearly straight becomes straight (and level when it is nearly level), as the marker of a ruler
 * would: a line of a text is highlighted with a clean band. Others stay as drawn.
 */
export function straighten(points: readonly InkPoint[]): InkPoint[] | null {
  if (points.length < 2) return null;
  const a = points[0];
  const b = points[points.length - 1];
  const chord = dist(a.x, a.y, b.x, b.y);
  if (chord < 24) return null;
  let far = 0;
  for (const q of points) far = Math.max(far, Math.abs((b.x - a.x) * (a.y - q.y) - (a.x - q.x) * (b.y - a.y)) / chord);
  if (far > Math.max(5, chord * 0.07) || strokeLength(points) > chord * 1.15) return null;
  const [x0, x1] = [a.x, b.x];
  let [y0, y1] = [a.y, b.y];
  const angle = Math.abs(Math.atan2(y1 - y0, x1 - x0) * (180 / Math.PI));
  if (angle < 7 || angle > 173) {
    const y = points.reduce((s, q) => s + q.y, 0) / points.length;
    y0 = y;
    y1 = y;
  }
  return [
    { x: x0, y: y0, p: 1 },
    { x: x1, y: y1, p: 1 },
  ];
}

const BLUR = [0, 2, 4, 7]; // points each side (the points are 1.5 px apart)

/** The finished stroke: even steps, smoothed by the level, a highlighter straightened when it is meant to be straight. */
export function finishInk(points: readonly InkPoint[], tool: InkTool, level: Smoothing): InkPoint[] {
  if (!points.length) return [];
  if (strokeLength(points) < 1) {
    // a click: a dot
    const { x, y, p } = points[0];
    return [
      { x, y, p: Math.max(p, 0.6) },
      { x: x + 0.5, y, p: Math.max(p, 0.6) },
    ];
  }
  const even = resample(points, 1.5);
  const smooth = blur(even, BLUR[level], tool === "pencil" ? 3 : 8);
  if (tool === "highlighter" && level > 0) {
    const line = straighten(smooth);
    if (line) return resample(line, 2);
  }
  return resample(smooth, 2);
}

// ---- drawing a stroke ----

/** How wide the stroke is at each point (the radius): the pressure, and the ends drawn thinner like a real tool. */
export function inkRadii(tool: InkTool, points: readonly InkPoint[], size: number): number[] {
  const base = Math.max(0.25, size / 2);
  if (tool === "highlighter") return points.map(() => base);
  const n = points.length;
  const at: number[] = [0];
  for (let i = 1; i < n; i++) at.push(at[i - 1] + dist(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y));
  const len = at[n - 1] || 1;
  const ease = (t: number) => 1 - (1 - clamp(t, 0, 1)) ** 2;
  return points.map((q, i) => {
    if (tool === "brush") {
      // a brush swells as it touches the paper and runs dry at the end, thinner where it went fast
      const inLen = Math.min(len * 0.28, size * 4);
      const outLen = Math.min(len * 0.4, size * 5);
      const taper = Math.max(0.08, ease(at[i] / inLen)) * Math.max(0.06, ease((len - at[i]) / outLen));
      return Math.max(0.3, base * (0.28 + 0.72 * q.p) * taper);
    }
    // a pencil: nearly even, a little lighter at the very ends
    const tip = Math.min(len * 0.12, size * 3);
    const taper = Math.max(0.45, ease(at[i] / tip)) * Math.max(0.45, ease((len - at[i]) / tip));
    return Math.max(0.3, base * (0.72 + 0.28 * q.p) * taper);
  });
}

const num = (v: number) => String(Math.round(v * 100) / 100);

/**
 * The outline of a stroke, as path data (SVG and Konva both draw it): both sides of the points at their radius, joined by round
 * ends (`flat`: square ends, the chisel of a highlighter). The corners are rounded, so the edge is as smooth as the stroke.
 */
export function outlinePath(points: readonly Pt[], radii: readonly number[], flat = false): string {
  const n = points.length;
  if (!n) return "";
  if (n === 1 || points.every((p) => p[0] === points[0][0] && p[1] === points[0][1])) {
    const [x, y] = points[0];
    const r = radii[0] ?? 1;
    return `M${num(x - r)} ${num(y)}a${num(r)} ${num(r)} 0 1 0 ${num(2 * r)} 0a${num(r)} ${num(r)} 0 1 0 ${num(-2 * r)} 0Z`;
  }
  const left: Pt[] = [];
  const right: Pt[] = [];
  const normals: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const nx = -ty;
    const ny = tx;
    normals.push([nx, ny]);
    const r = radii[i];
    left.push([points[i][0] + nx * r, points[i][1] + ny * r]);
    right.push([points[i][0] - nx * r, points[i][1] - ny * r]);
  }
  const cap = (i: number, from: number) => {
    // half a circle round the end point, from one side to the other (12 steps)
    const out: Pt[] = [];
    const [nx, ny] = normals[i];
    const a = Math.atan2(ny, nx);
    const r = radii[i];
    for (let k = 1; k < 12; k++) {
      const th = a + from - (k * Math.PI) / 12;
      out.push([points[i][0] + Math.cos(th) * r, points[i][1] + Math.sin(th) * r]);
    }
    return out;
  };
  const ring: Pt[] = [...left, ...(flat ? [] : cap(n - 1, 0)), ...right.reverse(), ...(flat ? [] : cap(0, Math.PI))];
  // a curve through the middles of the sides, the points as its controls
  const mid = (p: Pt, q: Pt): Pt => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const m = ring.length;
  const start = mid(ring[m - 1], ring[0]);
  let d = `M${num(start[0])} ${num(start[1])}`;
  for (let i = 0; i < m; i++) {
    const c = ring[i];
    const e = mid(c, ring[(i + 1) % m]);
    d += `Q${num(c[0])} ${num(c[1])} ${num(e[0])} ${num(e[1])}`;
  }
  return `${d}Z`;
}

/** A small random generator that gives the same numbers for the same seed (the texture of a stroke never changes). */
export function seeded(seed: number) {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One hair of the brush: a line along the stroke, lighter (a gap in the paint) or darker (paint piled up). */
export type Bristle = { points: number[]; light: boolean; width: number; alpha: number };

/**
 * The hairs of a brush stroke: lines along it, each at its own place across the stroke. The light ones start later and later
 * toward the end, so the paint looks dry where the brush lifts.
 */
export function bristles(points: readonly Pt[], radii: readonly number[], size: number, seed: number): Bristle[] {
  const n = points.length;
  if (n < 3) return [];
  const rand = seeded(seed);
  const count = clamp(Math.round(size / 1.4), 5, 18);
  const out: Bristle[] = [];
  for (let k = 0; k < count; k++) {
    const across = -0.88 + (1.76 * (k + 0.2 + rand() * 0.6)) / count;
    const light = rand() < 0.62;
    const from = light ? Math.floor(n * (0.15 + rand() * 0.6)) : Math.floor(n * rand() * 0.25);
    const to = light ? n : Math.ceil(n * (0.55 + rand() * 0.45));
    const wobble = (rand() - 0.5) * 0.08;
    const pts: number[] = [];
    for (let i = Math.max(1, from); i < Math.min(n - 1, to); i++) {
      const a = points[i - 1];
      const b = points[i + 1];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / l;
      const ny = (b[0] - a[0]) / l;
      const o = (across + wobble * Math.sin(i / 9)) * radii[i];
      pts.push(Math.round((points[i][0] + nx * o) * 100) / 100, Math.round((points[i][1] + ny * o) * 100) / 100);
    }
    if (pts.length < 4) continue;
    out.push({ points: pts, light, width: clamp(size * (0.03 + rand() * 0.05), 0.4, 2.2), alpha: light ? 0.16 + rand() * 0.22 : 0.1 + rand() * 0.16 });
  }
  return out;
}

/** A number for a stroke (from its points), the seed of its texture. */
export function strokeSeed(adj: readonly number[] | undefined) {
  let h = 2166136261;
  for (const v of (adj ?? []).slice(0, 24)) h = Math.imul(h ^ Math.round(v * 10000), 16777619);
  return h >>> 0;
}

export type InkModel = { body: string; bristles: Bristle[] };

/** All that is drawn for a stroke: its outline, and for a brush its hairs. */
export function inkModel(tool: InkTool, points: readonly InkPoint[], size: number, seed = 1): InkModel {
  const pts = points.map((q) => [q.x, q.y] as Pt);
  const radii = inkRadii(tool, points, size);
  return {
    body: outlinePath(pts, radii, tool === "highlighter"),
    bristles: tool === "brush" ? bristles(pts, radii, size, seed) : [],
  };
}

// ---- kept in a shape ----

/** A finished stroke as the box of a shape (with room for the ink's width) and its points and pressures as fractions of that box. */
export function inkToShape(points: readonly InkPoint[], size: number): { x: number; y: number; w: number; h: number; adj: number[]; pressure: number[] } | null {
  if (!points.length) return null;
  const pad = size / 2;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  const w = Math.max(Math.max(...xs) + pad - x, 1);
  const h = Math.max(Math.max(...ys) + pad - y, 1);
  const frac = (v: number) => Math.round(v * 10000) / 10000;
  return {
    x,
    y,
    w,
    h,
    adj: points.flatMap((p) => [frac((p.x - x) / w), frac((p.y - y) / h)]),
    pressure: points.map((p) => Math.round(p.p * 100) / 100),
  };
}

/** The points of a stroke kept in a shape of w×h (the inverse of inkToShape). */
export function shapeToInk(adj: readonly number[] | undefined, pressure: readonly number[] | undefined, w: number, h: number): InkPoint[] {
  const a = adj ?? [];
  const out: InkPoint[] = [];
  for (let i = 0; i + 1 < a.length; i += 2) out.push({ x: a[i] * w, y: a[i + 1] * h, p: pressure?.[i / 2] ?? 0.7 });
  return out;
}
