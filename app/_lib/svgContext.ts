// A stand-in for a canvas's 2D context that writes SVG instead of pixels: what Konva draws on a page while it is in place (see
// stagePageSvgs) comes out as vector shapes, pictures, and text that stays text (it can be selected, searched, and printed sharp at any
// size, the letters shaped by the browser like on the canvas). Only what Konva uses is covered; what can't be said in SVG is left out.

type M = [number, number, number, number, number, number]; // a b c d e f, as canvas transforms
const ID: M = [1, 0, 0, 1, 0, 0];
const mul = (m: M, n: M): M => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const at = (m: M, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
function inv(m: M): M {
  const det = m[0] * m[3] - m[1] * m[2] || 1e-12;
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
}
const n = (v: number) => (Math.abs(v) < 1e-9 ? "0" : String(Math.round(v * 1000) / 1000));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const matrix = (m: M) => (m.every((v, i) => v === ID[i]) ? "" : ` transform="matrix(${m.map(n).join(" ")})"`);

type Seg = { op: "M" | "L" | "C" | "Z"; p: number[] }; // points on the page (device space)

class Gradient {
  stops: [number, string][] = [];
  constructor(
    readonly kind: "linear" | "radial",
    readonly coords: number[],
  ) {}
  addColorStop(offset: number, color: string) {
    this.stops.push([offset, color]);
  }
}

interface State {
  m: M;
  fillStyle: string | Gradient;
  strokeStyle: string | Gradient;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  miterLimit: number;
  dash: number[];
  lineDashOffset: number;
  globalAlpha: number;
  globalCompositeOperation: string;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  direction: CanvasDirection;
  letterSpacing: string;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  filter: string;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: ImageSmoothingQuality;
  groups: number; // <g> opened (by clip) since the save() that made this state
}

let measurer: CanvasRenderingContext2D | null = null;
const measure = () => (measurer ??= document.createElement("canvas").getContext("2d")!);

export interface SvgContextOptions {
  /** The page in the drawing's space: what lies wholly outside it is left out. */
  area: { x: number; y: number; width: number; height: number };
  /** Colours turned to greys (black-and-white printing). */
  gray?: boolean;
  /** Where Konva's own context state starts from (the real canvas's: e.g. its direction). */
  from?: CanvasRenderingContext2D;
  /** Before the ids of its gradients, clips and shadows: unique when several pages are in one document. */
  idPrefix?: string;
}

export class SvgContext {
  private s: State;
  private stack: State[] = [];
  private out: string[][] = [[]];
  private defs: string[] = [];
  private path: Seg[] = [];
  private start: [number, number] | null = null; // of the subpath (device)
  private cur: [number, number] | null = null;
  private ids = 0;
  private prefix: string;
  private gray: boolean;
  private area: SvgContextOptions["area"];
  readonly canvas: { width: number; height: number };

  constructor({ area, gray = false, from, idPrefix = "" }: SvgContextOptions) {
    this.area = area;
    this.prefix = idPrefix;
    this.gray = gray;
    this.canvas = { width: area.width, height: area.height };
    this.s = {
      m: [...ID],
      fillStyle: "#000000",
      strokeStyle: "#000000",
      lineWidth: 1,
      lineCap: "butt",
      lineJoin: "miter",
      miterLimit: 10,
      dash: [],
      lineDashOffset: 0,
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      font: from?.font ?? "10px sans-serif",
      textAlign: "start",
      textBaseline: "alphabetic",
      direction: from?.direction ?? "ltr",
      letterSpacing: "0px",
      shadowColor: "rgba(0, 0, 0, 0)",
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      filter: "none",
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "low",
      groups: 0,
    };
  }

  // ---- the page as SVG: its size in px, drawn from `area` ----
  toSvg(): string {
    while (this.out.length > 1) this.closeGroup();
    const { x, y, width, height } = this.area;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${n(x)} ${n(y)} ${n(width)} ${n(height)}" width="${n(width)}" height="${n(height)}" preserveAspectRatio="none">` +
      (this.defs.length ? `<defs>${this.defs.join("")}</defs>` : "") +
      this.out[0].join("") +
      "</svg>"
    );
  }

  // ---- state ----
  save() {
    this.stack.push(this.s);
    this.s = { ...this.s, m: [...this.s.m] as M, dash: [...this.s.dash], groups: 0 };
  }
  restore() {
    const prev = this.stack.pop();
    if (!prev) return;
    for (let i = 0; i < this.s.groups; i++) this.closeGroup();
    this.s = prev;
  }
  private closeGroup() {
    const inner = this.out.pop()!;
    const open = inner.shift()!;
    this.out[this.out.length - 1].push(inner.length ? `${open}${inner.join("")}</g>` : "");
  }

  get fillStyle() {
    return this.s.fillStyle as string;
  }
  set fillStyle(v: string | Gradient) {
    this.s.fillStyle = v;
  }
  get strokeStyle() {
    return this.s.strokeStyle as string;
  }
  set strokeStyle(v: string | Gradient) {
    this.s.strokeStyle = v;
  }
  get lineWidth() {
    return this.s.lineWidth;
  }
  set lineWidth(v: number) {
    if (Number.isFinite(v) && v > 0) this.s.lineWidth = v;
  }
  get lineCap() {
    return this.s.lineCap;
  }
  set lineCap(v: CanvasLineCap) {
    this.s.lineCap = v;
  }
  get lineJoin() {
    return this.s.lineJoin;
  }
  set lineJoin(v: CanvasLineJoin) {
    this.s.lineJoin = v;
  }
  get miterLimit() {
    return this.s.miterLimit;
  }
  set miterLimit(v: number) {
    this.s.miterLimit = v;
  }
  get lineDashOffset() {
    return this.s.lineDashOffset;
  }
  set lineDashOffset(v: number) {
    this.s.lineDashOffset = v;
  }
  get globalAlpha() {
    return this.s.globalAlpha;
  }
  set globalAlpha(v: number) {
    if (Number.isFinite(v)) this.s.globalAlpha = Math.max(0, Math.min(1, v));
  }
  get globalCompositeOperation() {
    return this.s.globalCompositeOperation;
  }
  set globalCompositeOperation(v: string) {
    this.s.globalCompositeOperation = v;
  }
  get font() {
    return this.s.font;
  }
  set font(v: string) {
    this.s.font = v;
  }
  get textAlign() {
    return this.s.textAlign;
  }
  set textAlign(v: CanvasTextAlign) {
    this.s.textAlign = v;
  }
  get textBaseline() {
    return this.s.textBaseline;
  }
  set textBaseline(v: CanvasTextBaseline) {
    this.s.textBaseline = v;
  }
  get direction() {
    return this.s.direction;
  }
  set direction(v: CanvasDirection) {
    this.s.direction = v;
  }
  get letterSpacing() {
    return this.s.letterSpacing;
  }
  set letterSpacing(v: string) {
    this.s.letterSpacing = v;
  }
  get shadowColor() {
    return this.s.shadowColor;
  }
  set shadowColor(v: string) {
    this.s.shadowColor = v;
  }
  get shadowBlur() {
    return this.s.shadowBlur;
  }
  set shadowBlur(v: number) {
    this.s.shadowBlur = v;
  }
  get shadowOffsetX() {
    return this.s.shadowOffsetX;
  }
  set shadowOffsetX(v: number) {
    this.s.shadowOffsetX = v;
  }
  get shadowOffsetY() {
    return this.s.shadowOffsetY;
  }
  set shadowOffsetY(v: number) {
    this.s.shadowOffsetY = v;
  }
  get filter() {
    return this.s.filter;
  }
  set filter(v: string) {
    this.s.filter = v;
  }
  get imageSmoothingEnabled() {
    return this.s.imageSmoothingEnabled;
  }
  set imageSmoothingEnabled(v: boolean) {
    this.s.imageSmoothingEnabled = v;
  }
  get imageSmoothingQuality() {
    return this.s.imageSmoothingQuality;
  }
  set imageSmoothingQuality(v: ImageSmoothingQuality) {
    this.s.imageSmoothingQuality = v;
  }
  setLineDash(d: number[]) {
    this.s.dash = d.every((v) => Number.isFinite(v) && v >= 0) ? (d.length % 2 ? [...d, ...d] : [...d]) : this.s.dash;
  }
  getLineDash() {
    return [...this.s.dash];
  }

  // ---- transforms ----
  transform(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.s.m = mul(this.s.m, [a, b, c, d, e, f]);
  }
  setTransform(a: number | DOMMatrix2DInit = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
    if (typeof a === "object") this.s.m = [a.a ?? 1, a.b ?? 0, a.c ?? 0, a.d ?? 1, a.e ?? 0, a.f ?? 0];
    else this.s.m = [a, b, c, d, e, f];
  }
  resetTransform() {
    this.s.m = [...ID];
  }
  getTransform() {
    return new DOMMatrix(this.s.m);
  }
  translate(x: number, y: number) {
    this.transform(1, 0, 0, 1, x, y);
  }
  scale(x: number, y: number) {
    this.transform(x, 0, 0, y, 0, 0);
  }
  rotate(a: number) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    this.transform(c, s, -s, c, 0, 0);
  }

  // ---- paths (kept on the page, as the canvas does) ----
  beginPath() {
    this.path = [];
    this.start = this.cur = null;
  }
  moveTo(x: number, y: number) {
    const p = at(this.s.m, x, y);
    this.path.push({ op: "M", p });
    this.start = this.cur = p;
  }
  lineTo(x: number, y: number) {
    if (!this.cur) return this.moveTo(x, y);
    const p = at(this.s.m, x, y);
    this.path.push({ op: "L", p });
    this.cur = p;
  }
  bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
    if (!this.cur) this.moveTo(x1, y1);
    const m = this.s.m;
    const p = [...at(m, x1, y1), ...at(m, x2, y2), ...at(m, x, y)];
    this.path.push({ op: "C", p });
    this.cur = [p[4], p[5]];
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    if (!this.cur) this.moveTo(cx, cy);
    const [x0, y0] = at(inv(this.s.m), ...this.cur!);
    this.bezierCurveTo(x0 + (2 / 3) * (cx - x0), y0 + (2 / 3) * (cy - y0), x + (2 / 3) * (cx - x), y + (2 / 3) * (cy - y), x, y);
  }
  closePath() {
    if (!this.path.length) return;
    this.path.push({ op: "Z", p: [] });
    this.cur = this.start;
  }
  rect(x: number, y: number, w: number, h: number) {
    this.moveTo(x, y);
    this.lineTo(x + w, y);
    this.lineTo(x + w, y + h);
    this.lineTo(x, y + h);
    this.closePath();
  }
  roundRect(x: number, y: number, w: number, h: number, radii: number | DOMPointInit | (number | DOMPointInit)[] = 0) {
    const list = (Array.isArray(radii) ? radii : [radii]).map((r) => (typeof r === "number" ? r : (r.x ?? 0)));
    const [tl, tr, br, bl] = list.length === 1 ? [list[0], list[0], list[0], list[0]] : list.length === 2 ? [list[0], list[1], list[0], list[1]] : list.length === 3 ? [list[0], list[1], list[2], list[1]] : list;
    const k = Math.min(1, Math.abs(w) / Math.max(tl + tr, bl + br, 1e-9), Math.abs(h) / Math.max(tl + bl, tr + br, 1e-9));
    this.moveTo(x + tl * k, y);
    this.arcTo(x + w, y, x + w, y + h, tr * k);
    this.arcTo(x + w, y + h, x, y + h, br * k);
    this.arcTo(x, y + h, x, y, bl * k);
    this.arcTo(x, y, x + w, y, tl * k);
    this.closePath();
  }
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw = false) {
    this.ellipse(x, y, r, r, 0, a0, a1, ccw);
  }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw = false) {
    // the sweep as canvas takes it, then pieces of at most a quarter turn as curves
    const TAU = Math.PI * 2;
    let sweep = a1 - a0;
    if (!ccw && sweep >= TAU) sweep = TAU;
    else if (ccw && sweep <= -TAU) sweep = -TAU;
    else {
      if (!ccw && sweep < 0) sweep = (sweep % TAU) + TAU;
      if (ccw && sweep > 0) sweep = (sweep % TAU) - TAU;
    }
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    const pt = (a: number): [number, number] => {
      const ex = rx * Math.cos(a);
      const ey = ry * Math.sin(a);
      return [x + ex * cr - ey * sr, y + ex * sr + ey * cr];
    };
    const d = (a: number): [number, number] => {
      const ex = -rx * Math.sin(a);
      const ey = ry * Math.cos(a);
      return [ex * cr - ey * sr, ex * sr + ey * cr];
    };
    const [sx, sy] = pt(a0);
    if (this.cur) this.lineTo(sx, sy);
    else this.moveTo(sx, sy);
    const parts = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9));
    const step = sweep / parts;
    const k = (4 / 3) * Math.tan(step / 4);
    for (let i = 0; i < parts; i++) {
      const s0 = a0 + i * step;
      const s1 = s0 + step;
      const [p0x, p0y] = pt(s0);
      const [p1x, p1y] = pt(s1);
      const [d0x, d0y] = d(s0);
      const [d1x, d1y] = d(s1);
      this.bezierCurveTo(p0x + k * d0x, p0y + k * d0y, p1x - k * d1x, p1y - k * d1y, p1x, p1y);
    }
  }
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number) {
    if (!this.cur) return this.moveTo(x1, y1);
    const [x0, y0] = at(inv(this.s.m), ...this.cur);
    const v1x = x0 - x1;
    const v1y = y0 - y1;
    const v2x = x2 - x1;
    const v2y = y2 - y1;
    const l1 = Math.hypot(v1x, v1y);
    const l2 = Math.hypot(v2x, v2y);
    const cross = v1x * v2y - v1y * v2x;
    if (r <= 0 || l1 < 1e-9 || l2 < 1e-9 || Math.abs(cross) < 1e-9) return this.lineTo(x1, y1);
    const u1x = v1x / l1;
    const u1y = v1y / l1;
    const u2x = v2x / l2;
    const u2y = v2y / l2;
    const angle = Math.acos(Math.max(-1, Math.min(1, u1x * u2x + u1y * u2y)));
    const t = r / Math.tan(angle / 2);
    // the circle touching both lines: its centre on the corner's bisector
    const bl = Math.hypot(u1x + u2x, u1y + u2y);
    const h = r / Math.sin(angle / 2);
    const cx = x1 + ((u1x + u2x) / bl) * h;
    const cy = y1 + ((u1y + u2y) / bl) * h;
    const a0 = Math.atan2(y1 + u1y * t - cy, x1 + u1x * t - cx);
    const a1 = Math.atan2(y1 + u2y * t - cy, x1 + u2x * t - cx);
    let sweep = a1 - a0;
    if (sweep > Math.PI) sweep -= Math.PI * 2;
    if (sweep < -Math.PI) sweep += Math.PI * 2;
    this.lineTo(x1 + u1x * t, y1 + u1y * t);
    this.ellipse(cx, cy, r, r, 0, a0, a0 + sweep, sweep < 0);
  }

  // the path as d, in the space of `m` (so a stroke's width and a gradient's points are those of the moment)
  private d(segs: Seg[], m: M | null): string {
    const back = m ? inv(m) : null;
    const pts = (p: number[]) => {
      const o: string[] = [];
      for (let i = 0; i < p.length; i += 2) {
        const [x, y] = back ? at(back, p[i], p[i + 1]) : [p[i], p[i + 1]];
        o.push(`${n(x)} ${n(y)}`);
      }
      return o.join(" ");
    };
    return segs.map((s) => (s.op === "Z" ? "Z" : `${s.op}${pts(s.p)}`)).join("");
  }
  private bounds(segs: Seg[], pad = 0) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const s of segs)
      for (let i = 0; i < s.p.length; i += 2) {
        x0 = Math.min(x0, s.p[i]);
        x1 = Math.max(x1, s.p[i]);
        y0 = Math.min(y0, s.p[i + 1]);
        y1 = Math.max(y1, s.p[i + 1]);
      }
    return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
  }
  private onPage(b: { x0: number; y0: number; x1: number; y1: number }) {
    const a = this.area;
    return b.x1 >= a.x && b.x0 <= a.x + a.width && b.y1 >= a.y && b.y0 <= a.y + a.height;
  }

  // ---- paint ----
  private color(c: string): string {
    if (!this.gray) return c;
    const m = measure();
    m.fillStyle = "#000";
    m.fillStyle = c;
    const v = String(m.fillStyle);
    const hex = /^#([0-9a-f]{6})$/i.exec(v);
    const rgba = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(v);
    const [r, g, b, a] = hex ? [parseInt(hex[1].slice(0, 2), 16), parseInt(hex[1].slice(2, 4), 16), parseInt(hex[1].slice(4), 16), 1] : rgba ? [+rgba[1], +rgba[2], +rgba[3], rgba[4] === undefined ? 1 : +rgba[4]] : [0, 0, 0, 1];
    const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    return a < 1 ? `rgba(${l}, ${l}, ${l}, ${a})` : `rgb(${l}, ${l}, ${l})`;
  }
  private paint(v: string | Gradient): string {
    if (typeof v === "string") return esc(this.color(v));
    if (!(v instanceof Gradient)) return "none"; // (a pattern: not drawn)
    const id = `${this.prefix}g${this.ids++}`;
    const stops = v.stops.map(([o, c]) => `<stop offset="${n(o)}" stop-color="${esc(this.color(c))}"/>`).join("");
    const c = v.coords.map(n);
    this.defs.push(
      v.kind === "linear"
        ? `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${c[0]}" y1="${c[1]}" x2="${c[2]}" y2="${c[3]}">${stops}</linearGradient>`
        : `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" fx="${c[0]}" fy="${c[1]}" fr="${c[2]}" cx="${c[3]}" cy="${c[4]}" r="${c[5]}">${stops}</radialGradient>`,
    );
    return `url(#${id})`;
  }
  private visible(v: string | Gradient) {
    if (v instanceof Gradient) return true;
    if (typeof v !== "string") return false;
    const m = measure();
    m.fillStyle = "#000";
    m.fillStyle = v;
    return !/^rgba\(.*,\s*0\)$/.test(String(m.fillStyle)) && v !== "transparent";
  }
  // what every drawn element carries: transparency, blending, shadow, CSS filter
  private effects(): string {
    const s = this.s;
    let a = "";
    if (s.globalAlpha < 1) a += ` opacity="${n(s.globalAlpha)}"`;
    const style: string[] = [];
    const blend = { multiply: "multiply", screen: "screen", overlay: "overlay", darken: "darken", lighten: "lighten" }[s.globalCompositeOperation];
    if (blend) style.push(`mix-blend-mode:${blend}`);
    if (s.filter && s.filter !== "none") style.push(`filter:${s.filter}`);
    if (style.length) a += ` style="${esc(style.join(";"))}"`;
    if ((s.shadowBlur || s.shadowOffsetX || s.shadowOffsetY) && this.visible(s.shadowColor)) {
      // (a canvas shadow is in page pixels, whatever the transform: brought into the element's space)
      const k = Math.sqrt(Math.abs(s.m[0] * s.m[3] - s.m[1] * s.m[2])) || 1;
      const id = `${this.prefix}f${this.ids++}`;
      this.defs.push(
        `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${n(s.shadowOffsetX / k)}" dy="${n(s.shadowOffsetY / k)}" stdDeviation="${n(s.shadowBlur / 2 / k)}" flood-color="${esc(this.color(s.shadowColor))}"/></filter>`,
      );
      a += ` filter="url(#${id})"`;
    }
    return a;
  }
  private emit(el: string) {
    this.out[this.out.length - 1].push(el);
  }
  private strokeAttrs(): string {
    const s = this.s;
    let a = ` fill="none" stroke="${this.paint(s.strokeStyle)}" stroke-width="${n(s.lineWidth)}"`;
    if (s.lineCap !== "butt") a += ` stroke-linecap="${s.lineCap}"`;
    if (s.lineJoin !== "miter") a += ` stroke-linejoin="${s.lineJoin}"`;
    else if (s.miterLimit !== 4) a += ` stroke-miterlimit="${n(s.miterLimit)}"`;
    if (s.dash.length) a += ` stroke-dasharray="${s.dash.map(n).join(" ")}"${s.lineDashOffset ? ` stroke-dashoffset="${n(s.lineDashOffset)}"` : ""}`;
    return a;
  }

  fill(rule?: CanvasFillRule | Path2D) {
    if (!this.path.length || !this.visible(this.s.fillStyle) || !this.onPage(this.bounds(this.path))) return;
    const r = typeof rule === "string" && rule === "evenodd" ? ` fill-rule="evenodd"` : "";
    this.emit(`<path d="${this.d(this.path, this.s.m)}"${matrix(this.s.m)} fill="${this.paint(this.s.fillStyle)}"${r}${this.effects()}/>`);
  }
  stroke() {
    if (!this.path.length || !this.visible(this.s.strokeStyle) || !this.onPage(this.bounds(this.path, this.s.lineWidth * 4))) return;
    this.emit(`<path d="${this.d(this.path, this.s.m)}"${matrix(this.s.m)}${this.strokeAttrs()}${this.effects()}/>`);
  }
  fillRect(x: number, y: number, w: number, h: number) {
    const keep = [this.path, this.start, this.cur] as const;
    this.beginPath();
    this.rect(x, y, w, h);
    this.fill();
    [this.path, this.start, this.cur] = [keep[0], keep[1], keep[2]];
  }
  strokeRect(x: number, y: number, w: number, h: number) {
    const keep = [this.path, this.start, this.cur] as const;
    this.beginPath();
    this.rect(x, y, w, h);
    this.stroke();
    [this.path, this.start, this.cur] = [keep[0], keep[1], keep[2]];
  }
  clearRect() {
    // (the page starts blank: nothing to clear)
  }
  clip(rule?: CanvasFillRule | Path2D) {
    const id = `${this.prefix}c${this.ids++}`;
    const r = typeof rule === "string" && rule === "evenodd" ? ` clip-rule="evenodd"` : "";
    this.defs.push(`<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path d="${this.d(this.path, null)}"${r}/></clipPath>`);
    this.out.push([`<g clip-path="url(#${id})">`]);
    this.s.groups++;
  }

  // ---- text ----
  private textEl(text: string, x: number, y: number, how: "fill" | "stroke") {
    const s = this.s;
    if (!text || !this.visible(how === "fill" ? s.fillStyle : s.strokeStyle)) return;
    const m = measure();
    m.font = s.font;
    m.direction = s.direction;
    m.letterSpacing = s.letterSpacing;
    m.textAlign = s.textAlign;
    m.textBaseline = s.textBaseline;
    const tm = m.measureText(text);
    // the canvas's baseline, as the alphabetic one SVG text sits on
    const dy = s.textBaseline === "alphabetic" ? 0 : -tm.alphabeticBaseline;
    // where it is: from the measured box, culled when off the page
    const box = [at(s.m, x - tm.actualBoundingBoxLeft, y - tm.actualBoundingBoxAscent), at(s.m, x + tm.actualBoundingBoxRight, y + tm.actualBoundingBoxDescent)];
    if (!this.onPage({ x0: Math.min(box[0][0], box[1][0]), y0: Math.min(box[0][1], box[1][1]), x1: Math.max(box[0][0], box[1][0]), y1: Math.max(box[0][1], box[1][1]) })) return;
    const rtl = s.direction === "rtl";
    const anchor = { left: rtl ? "end" : "start", right: rtl ? "start" : "end", center: "middle", start: "start", end: "end" }[s.textAlign] ?? "start";
    const style = [`font:${s.font}`, "white-space:pre"];
    if (s.letterSpacing && s.letterSpacing !== "0px") style.push(`letter-spacing:${s.letterSpacing}`);
    const paint = how === "fill" ? ` fill="${this.paint(s.fillStyle)}"` : this.strokeAttrs();
    this.emit(
      `<text x="${n(x)}" y="${n(y + dy)}"${matrix(s.m)}${paint} direction="${rtl ? "rtl" : "ltr"}"${anchor === "start" ? "" : ` text-anchor="${anchor}"`} style="${esc(style.join(";"))}"${this.effects()}>${esc(text)}</text>`,
    );
  }
  fillText(text: string, x: number, y: number) {
    this.textEl(String(text), x, y, "fill");
  }
  strokeText(text: string, x: number, y: number) {
    this.textEl(String(text), x, y, "stroke");
  }
  measureText(text: string) {
    const m = measure();
    m.font = this.s.font;
    m.direction = this.s.direction;
    m.letterSpacing = this.s.letterSpacing;
    m.textAlign = this.s.textAlign;
    m.textBaseline = this.s.textBaseline;
    return m.measureText(text);
  }

  // ---- pictures ----
  drawImage(img: CanvasImageSource, ...a: number[]) {
    const w0 = "naturalWidth" in img ? img.naturalWidth : "videoWidth" in img ? img.videoWidth : (img as { width: number }).width;
    const h0 = "naturalHeight" in img ? img.naturalHeight : "videoHeight" in img ? img.videoHeight : (img as { height: number }).height;
    if (!w0 || !h0) return;
    const [sx, sy, sw, sh, dx, dy, dw, dh] = a.length >= 8 ? a : a.length >= 4 ? [0, 0, w0, h0, a[0], a[1], a[2], a[3]] : [0, 0, w0, h0, a[0], a[1], w0, h0];
    const corners = [at(this.s.m, dx, dy), at(this.s.m, dx + dw, dy + dh), at(this.s.m, dx + dw, dy), at(this.s.m, dx, dy + dh)];
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    if (!this.onPage({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) })) return;
    const href = esc(this.href(img, w0, h0));
    if (!href) return;
    const smooth = this.s.imageSmoothingEnabled ? "" : ` style="image-rendering:pixelated"`;
    const whole = sx === 0 && sy === 0 && sw === w0 && sh === h0;
    this.emit(
      whole
        ? `<image href="${href}" x="${n(dx)}" y="${n(dy)}" width="${n(dw)}" height="${n(dh)}" preserveAspectRatio="none"${matrix(this.s.m)}${smooth}${this.effects()}/>`
        : `<g${matrix(this.s.m)}${this.effects()}><svg x="${n(dx)}" y="${n(dy)}" width="${n(dw)}" height="${n(dh)}" viewBox="${n(sx)} ${n(sy)} ${n(sw)} ${n(sh)}" preserveAspectRatio="none"><image href="${href}" width="${n(w0)}" height="${n(h0)}"${smooth}/></svg></g>`,
    );
  }
  private href(img: CanvasImageSource, w: number, h: number): string {
    if (typeof HTMLImageElement !== "undefined" && img instanceof HTMLImageElement) {
      const src = img.currentSrc || img.src;
      if (!this.gray) return src;
      if (src.startsWith("data:image/svg+xml")) return this.graySvg(src);
    }
    // a canvas (a drawing Konva keeps ready), or a picture to turn grey: as a PNG
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    if (!x) return "";
    if (this.gray) x.filter = "grayscale(1)";
    x.drawImage(img, 0, 0);
    try {
      return c.toDataURL("image/png");
    } catch {
      return "";
    }
  }
  // an SVG picture (a formula) in greys: its colours changed in its text, so it stays sharp
  private graySvg(src: string): string {
    const comma = src.indexOf(",");
    const head = src.slice(0, comma);
    const body = head.includes(";base64") ? atob(src.slice(comma + 1)) : decodeURIComponent(src.slice(comma + 1));
    const out = body.replace(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\([^)]*\)/gi, (c) => this.color(c));
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(out)}`;
  }

  // ---- gradients ----
  createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
    return new Gradient("linear", [x0, y0, x1, y1]);
  }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
    return new Gradient("radial", [x0, y0, r0, x1, y1, r1]);
  }
  createPattern() {
    return null;
  }

  // ---- what only pixels have: not on a page ----
  getImageData(_x: number, _y: number, w: number, h: number) {
    return measure().createImageData(Math.max(1, w), Math.max(1, h));
  }
  createImageData(w: number, h: number) {
    return measure().createImageData(Math.max(1, w), Math.max(1, h));
  }
  putImageData() {}
  isPointInPath() {
    return false;
  }
  isPointInStroke() {
    return false;
  }
}
