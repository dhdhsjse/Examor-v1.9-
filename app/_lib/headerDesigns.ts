// The library of exam header designs (Page design → Header and footer). Each design is a pure function that lays out what the header
// draws as a flat list of shapes and texts (`HOp`), from one small kit (a text, a band, a rule, a row of cells, a score box…), so:
// - every design mirrors itself for right-to-left papers (the kit places everything from the "start" side);
// - every design follows a color: the header's own, else the paper's theme color, else the design's (`color`);
// - every design fits any page border: bands run between `x0` and `x1` and start at `y0`, the edges of the room inside the border
//   (pageBorder.ts `borderBox`), and the canvas cuts the header to that room, so a band follows a rounded or a cut corner too.
// The canvas draws the list (DesignHeaderView.tsx); the tests check every design in every border and direction.
import { fontStack } from "./fonts";
import type { words } from "./i18n";
import { measureText } from "./measure";
import type { HeaderFields } from "./types";

export type Words = ReturnType<typeof words>;
type Align = "left" | "right" | "center";
type Side = "start" | "end" | "center";

/** A linear gradient, its two points in the shape's own coordinates */
export interface Gradient {
  stops: [string, string];
  from: [number, number];
  to: [number, number];
}

/** One thing a header draws (x, y: inside the text area of the header, as the other header styles: 0..W, the bands from x0 to x1) */
export type HOp =
  | { k: "rect"; x: number; y: number; w: number; h: number; fill?: string | Gradient; stroke?: string; sw?: number; r?: number | [number, number, number, number]; dash?: number[] }
  | { k: "poly"; pts: number[]; fill?: string; stroke?: string; sw?: number; dash?: number[]; closed?: boolean }
  | { k: "circle"; x: number; y: number; r: number; fill?: string; stroke?: string; sw?: number; dash?: number[] }
  | { k: "text"; text: string; x: number; y: number; w: number; size: number; bold?: boolean; color: string; align: Align; ltr?: boolean; family?: string };

export interface DesignCtx {
  W: number; // width between the insets (the texts)
  rtl: boolean;
  t: Words;
  f: HeaderFields;
  title: string; // with "— Correction" on the correction sheet
  outOf: number;
  A: string; // the color
  x0: number; // left edge of the room (≤ 0)
  x1: number; // right edge of the room (≥ W)
  y0: number; // top edge of the room (≤ 0)
  family: string; // the header's font
  serif: string; // the font of the formal designs (the header's font when the teacher chose one)
}

export type DesignCategory = "classic" | "modern" | "colorful" | "exam";
export const DESIGN_CATEGORIES: { id: DesignCategory; name: string }[] = [
  { id: "classic", name: "Classic" },
  { id: "modern", name: "Modern" },
  { id: "colorful", name: "Colorful" },
  { id: "exam", name: "Exam headers" },
];

/** The extra texts a design shows (keys of HeaderFields), besides the usual ones */
type Extra = "authority" | "date" | "instructions" | "motto" | "directorate";

export interface HeaderDesign {
  id: string;
  name: string; // English (the key of the translations)
  category: DesignCategory;
  color: string; // its own color
  height: number;
  extra?: Extra[];
  defaults?: "motto"; // own default texts
  draw: (k: Kit, c: DesignCtx) => void;
}

export const INK = "#111827";
const MUTED = "#4b5563";
const SOFT = "#e5e7eb";
const LINE = "#9ca3af";
const DOTS = "....................................";
const DOTS_S = "............";
// Keep "/ 20" left-to-right inside Arabic text.
const ltrIso = (s: string) => `⁦${s}⁩`;

// ---- Colors ----

const hex = (c: string) => (/^#[0-9a-f]{6}/i.test(c) ? c.slice(0, 7) : "#4f46e5");
/** `c` with an opacity ("14" = 8 %) */
export const alpha = (c: string, a: string) => `${hex(c)}${a}`;
/** Between two colors (`k` = 0: `a`, 1: `b`) */
export function mix(a: string, b: string, k: number) {
  const p = (c: string) => [1, 3, 5].map((i) => parseInt(hex(c).slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, "0")).join("")}`;
}
const luminance = (c: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex(c).slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** The color of a text on `c`: white, or ink on a light color (a yellow theme) */
export const onColor = (c: string) => (luminance(c) > 0.45 ? INK : "#ffffff");
/** The color as a text on the white paper: darker when too light to read */
const asText = (c: string) => (luminance(c) > 0.35 ? mix(c, "#000000", 0.45) : hex(c));

// ---- The kit ----

export class Kit {
  ops: HOp[] = [];
  constructor(readonly c: DesignCtx) {}

  get W() {
    return this.c.W;
  }
  get A() {
    return this.c.A;
  }
  /** The color as a text on the paper */
  get At() {
    return asText(this.c.A);
  }
  get on() {
    return onColor(this.c.A);
  }
  /** The left x of a box `w` wide placed `x` from the start side */
  at(x: number, w: number) {
    return this.c.rtl ? this.W - x - w : x;
  }
  /** A point `x` from the start side */
  mx(x: number) {
    return this.c.rtl ? this.W - x : x;
  }
  private align(a: Side): Align {
    return a === "center" ? "center" : (a === "start") !== this.c.rtl ? "left" : "right";
  }
  width(text: string, size: number, bold = false, family = this.c.family) {
    return measureText(text, { family, size, bold, italic: false });
  }

  /** A line of text in a box `w` wide, `x` from the start side */
  text(text: string, x: number, y: number, w: number, size: number, o: { bold?: boolean; color?: string; align?: Side; ltr?: boolean; serif?: boolean } = {}) {
    if (w <= 4) return;
    this.ops.push({ k: "text", text, x: this.at(x, w), y, w, size, bold: o.bold, color: o.color ?? INK, align: this.align(o.align ?? "start"), ...(o.ltr ? { ltr: true } : {}), ...(o.serif ? { family: this.c.serif } : {}) });
  }
  /** A box `x` from the start side. `r`: one radius, or [start-top, end-top, end-bottom, start-bottom] */
  rect(x: number, y: number, w: number, h: number, o: { fill?: string | Gradient; stroke?: string; sw?: number; r?: number | [number, number, number, number]; dash?: number[] } = {}) {
    const r = Array.isArray(o.r) ? ((this.c.rtl ? [o.r[1], o.r[0], o.r[3], o.r[2]] : o.r) as [number, number, number, number]) : o.r;
    this.ops.push({ k: "rect", x: this.at(x, w), y, w, h, ...o, ...(r !== undefined ? { r } : {}) });
  }
  /** A box between two x of the paper (no mirroring): bands */
  rectAbs(xa: number, y: number, xb: number, h: number, o: { fill?: string | Gradient; stroke?: string; sw?: number; r?: number | [number, number, number, number] } = {}) {
    this.ops.push({ k: "rect", x: xa, y, w: xb - xa, h, ...o });
  }
  /** A band across the whole room, from its top (`y0`) down to `bottom` */
  band(bottom: number, fill: string | Gradient) {
    const { x0, x1, y0 } = this.c;
    this.rectAbs(x0, y0, x1, bottom - y0, { fill });
  }
  /** A rule across the room (`edge`) or between the margins */
  rule(y: number, o: { sw?: number; color?: string; dash?: number[]; edge?: boolean } = {}) {
    const [a, b] = o.edge === false ? [0, this.W] : [this.c.x0, this.c.x1];
    this.ops.push({ k: "poly", pts: [a, y, b, y], stroke: o.color ?? INK, sw: o.sw ?? 1, ...(o.dash ? { dash: o.dash } : {}) });
  }
  /** A line through points given from the start side */
  line(pts: number[], o: { color?: string; sw?: number; dash?: number[]; fill?: string; closed?: boolean } = {}) {
    this.ops.push({ k: "poly", pts: pts.map((v, i) => (i % 2 ? v : this.mx(v))), stroke: o.fill && !o.color ? undefined : (o.color ?? INK), sw: o.sw ?? 1, ...(o.dash ? { dash: o.dash } : {}), ...(o.fill ? { fill: o.fill, closed: true } : {}), ...(o.closed ? { closed: true } : {}) });
  }
  /** Points of the paper (no mirroring) */
  polyAbs(pts: number[], fill: string) {
    this.ops.push({ k: "poly", pts, fill, closed: true });
  }
  circle(cx: number, cy: number, r: number, o: { fill?: string; stroke?: string; sw?: number; dash?: number[] } = {}) {
    this.ops.push({ k: "circle", x: this.mx(cx), y: cy, r, ...o });
  }
  diamond(cx: number, cy: number, r: number, fill: string) {
    this.line([cx - r, cy, cx, cy - r, cx + r, cy, cx, cy + r], { fill });
  }
  star(cx: number, cy: number, r: number, fill: string) {
    const pts: number[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * i) / 5 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      pts.push(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
    }
    this.line(pts, { fill });
  }

  // ---- What headers are made of ----

  get sub() {
    const f = this.c.f;
    return [f.subject, f.level, f.duration].filter(Boolean).join("  ·  ");
  }
  get yearText() {
    return `${this.c.t.year} : ${this.c.f.year}`;
  }
  get dateValue() {
    return this.c.f.date?.trim() || "..... / ..... / ..........";
  }
  get scoreValue() {
    return `...... / ${this.c.outOf}`;
  }
  get scoreText() {
    return `${this.c.t.score} : ${ltrIso(this.scoreValue)}`;
  }
  /** The school's first letter (the emblem) */
  get initial() {
    const f = this.c.f;
    return ((f.school || f.subject || f.title).replace(/[^\p{L}]/gu, "").charAt(0) || "★").toUpperCase();
  }
  /** The subject's first letter */
  get subjectInitial() {
    const f = this.c.f;
    return ((f.subject || f.title).replace(/[^\p{L}]/gu, "").charAt(0) || "★").toUpperCase();
  }

  /** School at the start, school year at the end */
  schoolYear(y: number, o: { size?: number; color?: string; bold?: boolean; serif?: boolean } = {}) {
    const size = o.size ?? 11;
    this.text(this.c.f.school, 0, y, this.W * 0.6, size, { color: o.color ?? MUTED, bold: o.bold, serif: o.serif });
    this.text(this.yearText, this.W * 0.6, y, this.W * 0.4, size, { color: o.color ?? MUTED, align: "end", serif: o.serif });
  }
  /** Name and class, dotted */
  nameLine(y: number, o: { w?: number; size?: number; serif?: boolean } = {}) {
    const t = this.c.t;
    this.text(`${t.name} : ${DOTS}${DOTS}      ${t.class} : ${DOTS_S}`, 0, y, o.w ?? this.W, o.size ?? 13, { serif: o.serif });
  }
  /** Name at the start, score at the end */
  nameScore(y: number, o: { serif?: boolean; color?: string } = {}) {
    const t = this.c.t;
    this.text(`${t.name} : ${DOTS}${DOTS}`, 0, y, this.W * 0.62, 13, { serif: o.serif });
    this.text(this.scoreText, this.W * 0.62, y, this.W * 0.38, 13, { bold: true, align: "end", serif: o.serif, color: o.color });
  }
  /** A score box: the label on top, "...... / 20" under it */
  scoreBox(x: number, y: number, w: number, h: number, o: { label?: string; value?: string; fill?: string; stroke?: string; r?: number; sw?: number } = {}) {
    if (o.fill || o.stroke) this.rect(x, y, w, h, { fill: o.fill, stroke: o.stroke, sw: o.sw ?? 1.4, r: o.r ?? 8 });
    this.text(this.c.t.score, x, y + Math.min(10, h * 0.16), w, 10, { bold: true, color: o.label ?? MUTED, align: "center" });
    this.text(this.scoreValue, x, y + h / 2 + 1, w, h < 50 ? 14 : 16, { bold: true, color: o.value ?? INK, align: "center", ltr: true });
  }
  /** A round score badge: the label, a dotted place for the grade, "/20" */
  scoreCircle(cx: number, cy: number, r: number, o: { color?: string; fill?: string; stroke?: string; sw?: number; ink?: string } = {}) {
    const color = o.color ?? this.At;
    if (o.fill || o.stroke) this.circle(cx, cy, r, { fill: o.fill, stroke: o.stroke, sw: o.sw ?? 1.5 });
    const outOf = this.c.outOf;
    this.text(this.c.t.score, cx - r, cy - r * 0.62, r * 2, 9, { bold: true, color, align: "center" });
    // (the dotted place and "/20" side by side, in the middle, left to right in any language)
    const x = this.c.rtl ? this.W - cx : cx;
    this.ops.push({ k: "poly", pts: [x - r * 0.72, cy + r * 0.38, x - 2, cy + r * 0.38], stroke: alpha(color, "88"), sw: 1, dash: [2, 2] });
    this.ops.push({ k: "text", text: `/${outOf}`, x: x - 1, y: cy - 4, w: r, size: outOf >= 100 ? 13 : 16, bold: true, color: o.ink ?? INK, align: "left", ltr: true });
  }
  /** An emblem: a round badge with the school's first letter (the place of a logo) */
  emblem(cx: number, cy: number, r: number, o: { fill?: string; color?: string; ring?: string } = {}) {
    const fill = o.fill ?? this.A;
    this.circle(cx, cy, r, { fill });
    this.circle(cx, cy, r - Math.max(3, r * 0.14), { stroke: o.ring ?? alpha(onColor(fill), "88"), sw: 1 });
    this.text(this.initial, cx - r, cy - r * 0.48, r * 2, r * 0.95, { bold: true, color: o.color ?? onColor(fill), align: "center" });
  }
  /**
   * A row of cells from the start side, `weights` sharing the width. A cell shows `label` above `value` (stack), or "label : value" (inline).
   * `box`: drawn in a frame; `tint`: the inside of each `hl` cell in the color.
   */
  cells(
    y: number,
    h: number,
    list: { label: string; value: string; weight?: number; hl?: boolean; ltr?: boolean }[],
    o: { kind?: "stack" | "inline"; box?: boolean; open?: boolean; stroke?: string; labelColor?: string; r?: number; size?: number; x?: number; w?: number } = {},
  ) {
    const x = o.x ?? 0;
    const w = o.w ?? this.W;
    const total = list.reduce((s, c) => s + (c.weight ?? 1), 0);
    const stroke = o.stroke ?? LINE;
    let acc = x;
    const placed = list.map((c) => {
      const cw = (w * (c.weight ?? 1)) / total;
      const cell = { ...c, x: acc, w: cw };
      acc += cw;
      return cell;
    });
    for (const [i, c] of placed.entries()) {
      if (c.hl) this.rect(c.x, y, c.w, h, { fill: alpha(this.A, "14"), r: o.r ? (i === 0 ? [o.r, 0, 0, o.r] : i === placed.length - 1 ? [0, o.r, o.r, 0] : 0) : 0 });
    }
    if (o.box) this.rect(x, y, w, h, { stroke, sw: 1, r: o.r ?? 0 });
    if (o.open) {
      this.line([x, y, x + w, y], { color: stroke, sw: 1 });
      this.line([x, y + h, x + w, y + h], { color: stroke, sw: 1 });
    }
    for (const c of placed.slice(1)) this.line([c.x, y + (o.box || o.open ? 0 : 6), c.x, y + h - (o.box || o.open ? 0 : 6)], { color: o.box || o.open ? stroke : SOFT, sw: 1 });
    const size = o.size ?? 13;
    for (const c of placed) {
      if (o.kind === "inline") {
        this.text(c.label ? `${c.label} : ${c.value}` : c.value, c.x + 8, y + (h - size) / 2 - 1, c.w - 16, size - 1, { align: "center", bold: c.hl });
      } else {
        this.text(c.label.toUpperCase(), c.x + 10, y + h / 2 - 15, c.w - 20, 9, { bold: true, color: o.labelColor ?? this.At });
        this.text(c.value, c.x + 10, y + h / 2 + 1, c.w - 20, size, { bold: true, ltr: c.ltr, align: c.ltr ? "center" : "start" });
      }
    }
  }
  /** Boxes to fill in (name, ID, score…): a small label in a corner, the room under it */
  fields(y: number, h: number, list: { label: string; weight: number; score?: boolean }[], o: { gap?: number; r?: number; stroke?: string; fill?: string } = {}) {
    const gap = o.gap ?? 8;
    const room = this.W - gap * (list.length - 1);
    const total = list.reduce((s, c) => s + c.weight, 0);
    let acc = 0;
    for (const c of list) {
      const w = (room * c.weight) / total;
      const stroke = c.score ? this.A : (o.stroke ?? LINE);
      this.rect(acc, y, w, h, { stroke, sw: c.score ? 1.6 : 1, r: o.r ?? 6, fill: c.score ? alpha(this.A, "10") : o.fill });
      this.text(c.label, acc + 8, y + 6, w - 16, 9, { bold: true, color: c.score ? this.At : MUTED });
      if (c.score) this.text(`/ ${this.c.outOf}`, acc + 8, y + h - 22, w - 16, 15, { bold: true, align: "end", ltr: true });
      acc += w + gap;
    }
  }
  /** The instructions box: "Instructions :" then the text */
  instructions(y: number, h: number, o: { fill?: string; stroke?: string; r?: number } = {}) {
    const label = `${this.c.t.instructions} :`;
    this.rect(0, y, this.W, h, { fill: o.fill ?? alpha(this.A, "0f"), stroke: o.stroke ?? alpha(this.A, "66"), sw: 1, r: o.r ?? 6 });
    const lw = this.width(label, 11, true) + 8;
    this.text(label, 10, y + (h - 11) / 2 - 1, lw, 11, { bold: true, color: this.At });
    this.text(this.c.f.instructions ?? "", 10 + lw, y + (h - 11) / 2 - 1, this.W - 20 - lw, 11, { color: INK });
  }
  /** A centered title with a line on each side, out to `reach` from the middle */
  titleWithSides(y: number, size: number, o: { color?: string; lineColor?: string; serif?: boolean; dots?: boolean } = {}) {
    const W = this.W;
    const tw = Math.min(this.width(this.c.title, size, true, o.serif ? this.c.serif : this.c.family), W - 120);
    this.text(this.c.title, (W - tw) / 2 - 4, y, tw + 8, size, { bold: true, align: "center", color: o.color, serif: o.serif });
    const mid = y + size * 0.62;
    const a = (W - tw) / 2 - 14;
    const b = (W + tw) / 2 + 14;
    const color = o.lineColor ?? this.A;
    this.line([0, mid, a, mid], { color, sw: 1.2 });
    this.line([b, mid, W, mid], { color, sw: 1.2 });
    if (o.dots !== false) {
      this.diamond(a, mid, 3.5, color);
      this.diamond(b, mid, 3.5, color);
    }
  }
  /** A wavy line through the room at `y` (from the end edge back to the start edge), to close a band */
  waveEdge(y: number, amp: number, period: number, phase = 0) {
    const { x0, x1 } = this.c;
    const pts: number[] = [];
    const n = Math.max(12, Math.round((x1 - x0) / 6));
    for (let i = 0; i <= n; i++) {
      const x = x1 - ((x1 - x0) * i) / n;
      pts.push(x, y + amp * Math.sin(((x - x0) / period) * Math.PI * 2 + phase));
    }
    return pts;
  }
}

// ---- The designs ----

const d = (id: string, name: string, category: DesignCategory, color: string, height: number, draw: HeaderDesign["draw"], more: Partial<HeaderDesign> = {}): HeaderDesign => ({
  id,
  name,
  category,
  color,
  height,
  draw,
  ...more,
});

const sideEdge = (c: DesignCtx, end = false) => ((c.rtl !== end) ? c.x1 : c.x0);

export const HEADER_DESIGNS: HeaderDesign[] = [
  // ---------- Classic ----------
  d("classic-plain", "Plain title", "classic", "#1f2937", 108, (k, c) => {
    k.schoolYear(0);
    k.text(c.title, 0, 20, k.W, 22, { bold: true, align: "center" });
    k.text(k.sub, 0, 52, k.W, 12, { color: MUTED, align: "center" });
    k.nameScore(84);
  }),
  d("classic-double-rule", "Double rule", "classic", "#1f2937", 120, (k, c) => {
    k.text(c.title, 0, 0, k.W, 22, { bold: true, align: "center" });
    k.text(k.sub, 0, 31, k.W, 12, { color: MUTED, align: "center" });
    k.rule(56, { sw: 2.2, color: k.A });
    k.rule(60.5, { sw: 0.7, color: k.A });
    k.schoolYear(70);
    k.nameScore(96);
  }),
  d("classic-underlined", "Underlined", "classic", "#1e3a8a", 114, (k, c) => {
    const W = k.W;
    k.text(c.f.school.toUpperCase(), 0, 0, W * 0.6, 10, { bold: true, color: k.At });
    k.text(k.yearText, W * 0.6, 0, W * 0.4, 10, { color: MUTED, align: "end" });
    k.text(c.title, 0, 15, W, 24, { bold: true });
    k.rect(0, 47, Math.min(k.width(c.title, 24, true) + 4, W * 0.7), 3, { fill: k.A });
    k.text(k.sub, 0, 58, W, 12, { color: MUTED });
    k.rule(82, { sw: 0.8, color: SOFT });
    k.nameScore(92);
  }),
  d("classic-side-lines", "Centered with side lines", "classic", "#1f2937", 114, (k, c) => {
    k.text(c.f.school, 0, 0, k.W, 11, { color: MUTED, align: "center" });
    k.titleWithSides(18, 21);
    k.text([k.sub, c.f.year].filter(Boolean).join("  ·  "), 0, 50, k.W, 12, { color: MUTED, align: "center" });
    k.rule(74, { sw: 0.8, color: SOFT });
    k.nameScore(86);
  }),
  d("classic-boxed", "Boxed", "classic", "#1f2937", 138, (k, c) => {
    const W = k.W;
    const t = c.t;
    k.rect(0, 0, W, 84, { stroke: INK, sw: 1.2 });
    k.text(c.title, 10, 11, W - 20, 20, { bold: true, align: "center" });
    k.line([0, 44, W, 44], { color: INK, sw: 0.8 });
    k.cells(44, 40, [
      { label: "", value: c.f.school, weight: 1.3 },
      { label: t.subject, value: c.f.subject },
      { label: t.level, value: c.f.level },
      { label: t.duration, value: c.f.duration },
    ], { kind: "inline", stroke: INK, size: 12, open: false });
    k.nameScore(96);
    k.text(`${t.class} : ${DOTS_S}`, 0, 118, W * 0.5, 13);
    k.text(k.yearText, W * 0.5, 118, W * 0.5, 12, { color: MUTED, align: "end" });
  }),
  d("classic-serif", "Serif formal", "classic", "#7c2d12", 128, (k, c) => {
    const W = k.W;
    k.text(c.f.school.toUpperCase(), 0, 0, W, 11, { bold: true, color: k.At, align: "center", serif: true });
    k.line([W * 0.22, 21, W * 0.46, 21], { color: k.A, sw: 0.8 });
    k.line([W * 0.54, 21, W * 0.78, 21], { color: k.A, sw: 0.8 });
    k.diamond(W / 2, 21, 4, k.A);
    k.text(c.title, 0, 29, W, 25, { bold: true, align: "center", serif: true });
    k.text([k.sub, c.f.year].filter(Boolean).join("  ·  "), 0, 63, W, 12, { color: MUTED, align: "center", serif: true });
    k.rule(86, { sw: 0.6 });
    k.rule(89.5, { sw: 0.6 });
    k.nameScore(100, { serif: true });
  }),
  d("classic-letterhead", "School letterhead", "classic", "#1e3a8a", 150, (k, c) => {
    const W = k.W;
    const t = c.t;
    k.emblem(30, 32, 30);
    k.text(c.f.school, 74, 6, W - 74 - 170, 17, { bold: true, color: k.At });
    k.text(c.f.authority ?? "", 74, 31, W - 74 - 170, 11, { color: MUTED });
    k.text(k.yearText, W - 170, 8, 170, 11, { color: MUTED, align: "end" });
    k.text(`${t.level} : ${c.f.level}`, W - 170, 26, 170, 11, { color: MUTED, align: "end" });
    k.text(`${t.duration} : ${c.f.duration}`, W - 170, 44, 170, 11, { color: MUTED, align: "end" });
    k.rule(70, { sw: 2.4, color: k.A });
    k.rule(74.5, { sw: 0.8, color: k.A });
    k.text(c.title, 0, 84, W, 19, { bold: true, align: "center" });
    k.text(c.f.subject, 0, 108, W, 12, { color: MUTED, align: "center" });
    k.nameScore(130);
  }, { extra: ["authority"] }),
  d("classic-framed", "Double frame", "classic", "#1f2937", 132, (k, c) => {
    const W = k.W;
    k.rect(0, 0, W, 130, { stroke: k.A, sw: 1.6 });
    k.rect(4, 4, W - 8, 122, { stroke: k.A, sw: 0.6 });
    k.schoolYear(14, { size: 11 });
    k.text(c.title, 16, 34, W - 32, 21, { bold: true, align: "center" });
    k.text(k.sub, 16, 64, W - 32, 12, { color: MUTED, align: "center" });
    k.line([16, 88, W - 16, 88], { color: alpha(k.A, "66"), sw: 0.8 });
    k.text(`${c.t.name} : ${DOTS}${DOTS}`, 16, 100, (W - 32) * 0.62, 13);
    k.text(k.scoreText, 16 + (W - 32) * 0.62, 100, (W - 32) * 0.38, 13, { bold: true, align: "end" });
  }),
  d("classic-ruled-band", "Ruled band", "classic", "#1f2937", 124, (k, c) => {
    k.rule(0, { sw: 1.6 });
    k.schoolYear(9);
    k.rule(31, { sw: 0.6 });
    k.text(c.title, 0, 41, k.W, 21, { bold: true, align: "center" });
    k.text(k.sub, 0, 70, k.W, 12, { color: MUTED, align: "center" });
    k.rule(93, { sw: 1.6 });
    k.nameScore(104);
  }),
  d("classic-official", "Official centered", "classic", "#1f2937", 150, (k, c) => {
    const W = k.W;
    const t = c.t;
    k.text(c.f.authority ?? "", 0, 0, W, 12, { bold: true, align: "center" });
    k.text(c.f.school, 0, 20, W, 12, { align: "center" });
    k.line([W * 0.38, 42, W * 0.62, 42], { color: k.A, sw: 1.2 });
    k.text(c.title, 0, 52, W, 21, { bold: true, align: "center" });
    k.cells(86, 30, [
      { label: t.subject, value: c.f.subject },
      { label: t.level, value: c.f.level },
      { label: t.duration, value: c.f.duration },
      { label: t.year, value: c.f.year },
    ], { kind: "inline", open: true, stroke: INK, size: 12 });
    k.nameScore(128);
  }, { extra: ["authority"] }),

  // ---------- Modern ----------
  d("modern-minimal", "Minimal", "modern", "#4f46e5", 102, (k, c) => {
    const W = k.W;
    k.text(c.f.school.toUpperCase(), 0, 0, W - 140, 10, { bold: true, color: k.At });
    k.text(c.title, 0, 16, W - 140, 24, { bold: true });
    k.text([k.sub, c.f.year].filter(Boolean).join("  ·  "), 0, 48, W - 140, 12, { color: MUTED });
    k.text(c.t.score, W - 120, 6, 120, 10, { bold: true, color: MUTED, align: "end" });
    k.text(k.scoreValue, W - 140, 24, 140, 20, { bold: true, align: "end", ltr: true });
    k.rule(72, { sw: 0.8, color: SOFT });
    k.nameLine(82);
  }),
  d("modern-accent-bar", "Left accent bar", "modern", "#0d9488", 114, (k, c) => {
    const W = k.W;
    // (the bar sits on the edge of the room, on the start side)
    const e = sideEdge(c);
    k.rectAbs(c.rtl ? e - 6 : e, 0, c.rtl ? e : e + 6, 80, { fill: k.A });
    k.text(c.f.school, 0, 0, W - 150, 11, { bold: true, color: k.At });
    k.text(c.title, 0, 17, W - 150, 23, { bold: true });
    k.text(k.sub, 0, 49, W - 150, 12, { color: MUTED });
    k.text(k.yearText, 0, 66, W - 150, 11, { color: MUTED });
    k.scoreBox(W - 124, 4, 124, 70, { fill: alpha(k.A, "0f"), stroke: k.A, label: k.At, r: 10 });
    k.rule(90, { sw: 1, color: SOFT });
    k.nameLine(98);
  }),
  d("modern-pill", "Pill badge", "modern", "#7c3aed", 116, (k, c) => {
    const W = k.W;
    const pw = Math.min(k.width(c.f.school, 11, true) + 30, W * 0.55);
    k.rect(0, 0, pw, 22, { fill: k.A, r: 11 });
    k.text(c.f.school, 12, 5, pw - 24, 11, { bold: true, color: k.on, align: "center" });
    k.text(k.yearText, pw + 12, 5, W - pw - 12 - 140, 11, { color: MUTED });
    k.text(c.title, 0, 32, W - 140, 23, { bold: true });
    k.text(k.sub, 0, 64, W - 140, 12, { color: MUTED });
    k.rect(W - 124, 26, 124, 50, { stroke: k.A, sw: 1.4, r: 25 });
    k.text(c.t.score, W - 124, 32, 124, 9, { bold: true, color: k.At, align: "center" });
    k.text(k.scoreValue, W - 124, 47, 124, 15, { bold: true, align: "center", ltr: true });
    k.rule(90, { color: SOFT });
    k.nameLine(100);
  }),
  d("modern-split", "Split: logo | title", "modern", "#2563eb", 128, (k, c) => {
    const W = k.W;
    const col = 150;
    k.emblem(col / 2, 30, 28);
    k.text(c.f.school, 0, 64, col, 10, { bold: true, align: "center" });
    k.text(c.f.year, 0, 80, col, 10, { color: MUTED, align: "center" });
    k.line([col + 12, 2, col + 12, 96], { color: k.A, sw: 1.4 });
    const x = col + 28;
    k.text(c.title, x, 6, W - x - 132, 22, { bold: true });
    k.text(k.sub, x, 38, W - x - 132, 12, { color: k.At, bold: true });
    k.text(`${c.t.date} : ${k.dateValue}`, x, 60, W - x - 132, 11, { color: MUTED });
    k.scoreBox(W - 118, 6, 118, 66, { stroke: INK, sw: 1.1, r: 6 });
    k.rule(106, { color: SOFT });
    k.nameLine(112);
  }, { extra: ["date"] }),
  d("modern-gradient-strip", "Gradient strip", "modern", "#db2777", 120, (k, c) => {
    const W = k.W;
    const { x0, x1, rtl } = c;
    k.rectAbs(x0, c.y0, x1, 8 - c.y0, { fill: { stops: rtl ? [mix(k.A, "#ffffff", 0.5), k.A] : [k.A, mix(k.A, "#ffffff", 0.5)], from: [0, 0], to: [x1 - x0, 0] } });
    k.text(c.f.school, 0, 20, W * 0.6, 11, { bold: true, color: k.At });
    k.text(k.yearText, W * 0.6, 20, W * 0.4, 11, { color: MUTED, align: "end" });
    k.text(c.title, 0, 38, W - 110, 23, { bold: true });
    k.text(k.sub, 0, 70, W - 110, 12, { color: MUTED });
    k.scoreCircle(W - 40, 64, 32, { stroke: k.A });
    k.nameLine(102);
  }),
  d("modern-smallcaps", "Thin line + small caps", "modern", "#0f766e", 130, (k, c) => {
    const W = k.W;
    const t = c.t;
    k.rule(0, { sw: 0.8 });
    k.text(c.f.school.toUpperCase(), 0, 10, W * 0.6, 10, { bold: true, color: k.At });
    k.text(k.yearText.toUpperCase(), W * 0.6, 10, W * 0.4, 10, { color: MUTED, align: "end" });
    k.text(c.title, 0, 30, W, 24, { bold: true });
    k.cells(62, 40, [
      { label: t.subject, value: c.f.subject },
      { label: t.level, value: c.f.level },
      { label: t.duration, value: c.f.duration },
      { label: t.score, value: k.scoreValue, ltr: true },
    ], { labelColor: MUTED, size: 13 });
    k.rule(106, { sw: 0.8 });
    k.nameLine(114);
  }),
  d("modern-columns", "Info columns", "modern", "#2563eb", 126, (k, c) => {
    const W = k.W;
    const t = c.t;
    k.text(c.title, 0, 0, W * 0.62, 22, { bold: true });
    k.text(c.f.school, W * 0.62, 2, W * 0.38, 11, { bold: true, align: "end" });
    k.text(k.yearText, W * 0.62, 19, W * 0.38, 11, { color: MUTED, align: "end" });
    k.cells(42, 48, [
      { label: t.subject, value: c.f.subject, weight: 1.2 },
      { label: t.level, value: c.f.level },
      { label: t.date, value: k.dateValue, weight: 1.1 },
      { label: t.duration, value: c.f.duration },
      { label: t.score, value: k.scoreValue, hl: true, ltr: true },
    ], { open: true, stroke: SOFT, size: 12 });
    k.nameLine(104);
  }, { extra: ["date"] }),
  d("modern-score-tile", "Score tile", "modern", "#4338ca", 118, (k, c) => {
    const W = k.W;
    // (the tile runs to the edge of the room on the end side, and to its top)
    const tile = 130;
    if (c.rtl) k.rectAbs(c.x0, c.y0, tile, 84 - c.y0, { fill: k.A });
    else k.rectAbs(W - tile, c.y0, c.x1, 84 - c.y0, { fill: k.A });
    k.text(c.t.score, W - tile, 10, tile, 10, { bold: true, color: k.on, align: "center" });
    k.rect(W - tile + 14, 30, tile - 28, 40, { fill: "#ffffff", r: 6 });
    k.text(k.scoreValue, W - tile + 14, 43, tile - 28, 15, { bold: true, color: k.At, align: "center", ltr: true });
    k.text(c.f.school, 0, 4, W - tile - 24, 11, { bold: true, color: k.At });
    k.text(c.title, 0, 22, W - tile - 24, 23, { bold: true });
    k.text([k.sub, c.f.year].filter(Boolean).join("  ·  "), 0, 54, W - tile - 24, 12, { color: MUTED });
    k.rule(84, { sw: 2, color: k.A });
    k.nameLine(98);
  }),
  d("modern-tabs", "Tabs", "modern", "#0284c7", 118, (k, c) => {
    const W = k.W;
    const f = c.f;
    k.text(c.title, 0, 0, W * 0.66, 23, { bold: true });
    k.text(f.school, W * 0.66, 6, W * 0.34, 11, { color: MUTED, align: "end" });
    let x = 0;
    const tabs = [f.subject, f.level, f.duration].filter(Boolean);
    tabs.forEach((tab, i) => {
      const w = Math.min(k.width(tab, 12, i === 0) + 24, W - 150 - x);
      if (w < 30) return;
      k.text(tab, x, 42, w, 12, { bold: i === 0, color: i === 0 ? k.At : MUTED, align: "center" });
      if (i === 0) k.rect(x, 62, w, 3, { fill: k.A, r: 1.5 });
      x += w + 4;
    });
    k.text(k.scoreText, W - 150, 42, 150, 13, { bold: true, align: "end" });
    k.rule(64.5, { sw: 1, color: SOFT });
    k.text(k.yearText, 0, 74, W, 11, { color: MUTED });
    k.nameLine(98);
  }),
  d("modern-corner-tag", "Corner tag", "modern", "#e11d48", 112, (k, c) => {
    const W = k.W;
    const tag = 150;
    // (the tag hangs from the top corner of the room on the end side)
    if (c.rtl) k.rectAbs(c.x0, c.y0, tag, 30 - c.y0, { fill: k.A, r: [0, 0, 12, 0] });
    else k.rectAbs(W - tag, c.y0, c.x1, 30 - c.y0, { fill: k.A, r: [0, 0, 0, 12] });
    k.text(c.f.subject, W - tag + 8, 8, tag - 16, 12, { bold: true, color: k.on, align: "center" });
    k.text(k.scoreText, W - tag, 46, tag, 13, { bold: true, align: "end" });
    k.text(c.f.school, 0, 0, W - tag - 20, 11, { color: MUTED });
    k.text(c.title, 0, 18, W - tag - 20, 23, { bold: true });
    k.text([c.f.level, c.f.duration].filter(Boolean).join("  ·  "), 0, 50, W - tag - 20, 12, { color: k.At, bold: true });
    k.text(k.yearText, 0, 67, W - tag - 20, 11, { color: MUTED });
    k.rule(86, { color: SOFT });
    k.nameLine(94);
  }),
  d("modern-initial", "Initial square", "modern", "#be123c", 108, (k, c) => {
    const W = k.W;
    k.rect(0, 0, 64, 64, { fill: k.A, r: 14 });
    k.text(k.subjectInitial, 0, 15, 64, 32, { bold: true, color: k.on, align: "center" });
    k.text(c.title, 80, 2, W - 80 - 134, 22, { bold: true });
    k.text(k.sub, 80, 33, W - 80 - 134, 12, { bold: true, color: k.At });
    k.text([c.f.school, c.f.year].filter(Boolean).join("  —  "), 80, 51, W - 80 - 134, 11, { color: MUTED });
    k.scoreBox(W - 120, 0, 120, 64, { fill: alpha(k.A, "14"), label: k.At, r: 14 });
    k.rule(80, { color: alpha(k.A, "55") });
    k.nameLine(90);
  }),

  // ---------- Colorful ----------
  d("color-band", "Solid color band", "colorful", "#1d4ed8", 132, (k, c) => {
    const W = k.W;
    k.band(86, k.A);
    k.text(c.f.school, 4, 10, W - 160, 11, { bold: true, color: alpha(k.on, "cc") });
    k.text(c.title, 4, 26, W - 160, 23, { bold: true, color: k.on });
    k.text(k.sub, 4, 58, W - 160, 12, { color: alpha(k.on, "e6") });
    k.scoreBox(W - 124, 11, 120, 62, { fill: "#ffffff", r: 8, value: k.At });
    k.text(k.yearText, 0, 96, W, 11, { color: MUTED, align: "end" });
    k.nameLine(112);
  }),
  d("color-two-tone", "Two-tone", "colorful", "#0f766e", 128, (k, c) => {
    const W = k.W;
    const { x0, x1, y0, rtl } = c;
    const cut = 168;
    // a light panel, then a solid one with a slanted edge (each to the edge of the room on its side)
    k.band(88, alpha(k.A, "1c"));
    const a = rtl ? cut : W - cut;
    const b = rtl ? cut - 26 : W - cut + 26;
    k.polyAbs(rtl ? [x0, y0, a, y0, b, 88, x0, 88] : [a, y0, x1, y0, x1, 88, b, 88], k.A);
    k.text([c.f.school, c.f.year].filter(Boolean).join("   ·   "), 4, 12, W - cut - 24, 11, { bold: true, color: k.At });
    k.text(c.title, 4, 30, W - cut - 24, 22, { bold: true });
    k.text(k.sub, 4, 62, W - cut - 24, 12, { color: MUTED });
    k.text(c.t.score, W - 130, 12, 130, 11, { bold: true, color: k.on, align: "center" });
    k.rect(W - 120, 32, 110, 42, { fill: "#ffffff", r: 8 });
    k.text(k.scoreValue, W - 120, 45, 110, 15, { bold: true, color: k.At, align: "center", ltr: true });
    k.nameLine(106);
  }),
  d("color-gradient", "Gradient band", "colorful", "#7c3aed", 128, (k, c) => {
    const W = k.W;
    const { x0, x1, y0, rtl } = c;
    const deep = mix(k.A, "#000000", 0.35);
    k.band(90, { stops: rtl ? [deep, k.A] : [k.A, deep], from: [0, 0], to: [x1 - x0, 90 - y0] });
    // soft circles in the end corner
    const e = sideEdge(c, true);
    k.ops.push({ k: "circle", x: e, y: y0 + 4, r: 70, fill: "#ffffff14" }, { k: "circle", x: e + (rtl ? 60 : -60), y: 90, r: 34, fill: "#ffffff10" });
    const on = onColor(mix(k.A, deep, 0.5));
    k.text(c.title, 6, 14, W - 130, 22, { bold: true, color: on });
    k.text(k.sub, 6, 46, W - 130, 13, { color: alpha(on, "e6") });
    k.text([c.f.school, c.f.year].filter(Boolean).join("  —  "), 6, 66, W - 130, 11, { color: alpha(on, "bf") });
    k.circle(W - 46, 45, 34, { fill: "#ffffff" });
    k.scoreCircle(W - 46, 45, 30, { stroke: alpha(k.A, "55"), sw: 1 });
    k.nameLine(106);
  }),
  d("color-ribbon", "Ribbon", "colorful", "#dc2626", 124, (k, c) => {
    const W = k.W;
    const L = W * 0.14;
    const R = W * 0.86;
    const dark = mix(k.A, "#000000", 0.3);
    const darker = mix(k.A, "#000000", 0.5);
    k.text([c.f.school, c.f.year].filter(Boolean).join("  ·  "), 0, 0, W, 11, { color: MUTED, align: "center" });
    // tails behind, then the folds, then the ribbon
    k.line([L - 40, 30, L + 10, 30, L + 10, 70, L - 40, 70, L - 26, 50], { fill: dark });
    k.line([R + 40, 30, R - 10, 30, R - 10, 70, R + 40, 70, R + 26, 50], { fill: dark });
    k.line([L, 62, L + 10, 70, L + 10, 62], { fill: darker });
    k.line([R, 62, R - 10, 70, R - 10, 62], { fill: darker });
    k.rect(L, 20, R - L, 42, { fill: k.A });
    k.text(c.title, L + 12, 31, R - L - 24, 19, { bold: true, color: k.on, align: "center" });
    k.text(k.sub, 0, 78, W, 12, { bold: true, color: k.At, align: "center" });
    k.nameScore(102);
  }),
  d("color-corners", "Corner shapes", "colorful", "#ea580c", 120, (k, c) => {
    const W = k.W;
    const { y0 } = c;
    const s = sideEdge(c);
    const e = sideEdge(c, true);
    const dir = c.rtl ? -1 : 1;
    k.polyAbs([s, y0, s + dir * 170, y0, s, 112], alpha(k.A, "2e"));
    k.polyAbs([s, y0, s + dir * 118, y0, s, 74], k.A);
    k.polyAbs([e, y0, e - dir * 96, y0, e, 58], alpha(k.A, "2e"));
    k.polyAbs([e, y0, e - dir * 54, y0, e, 32], k.A);
    k.text(c.f.school, 120, 0, W - 240, 11, { bold: true, color: k.At, align: "center" });
    k.text(c.title, 110, 18, W - 220, 22, { bold: true, align: "center" });
    k.text(k.sub, 110, 50, W - 220, 12, { color: MUTED, align: "center" });
    k.text(k.yearText, 110, 68, W - 220, 11, { color: MUTED, align: "center" });
    k.nameScore(98);
  }),
  d("color-blocks", "Rounded color blocks", "colorful", "#0891b2", 108, (k, c) => {
    const W = k.W;
    const g = 8;
    const w1 = W * 0.5;
    const w2 = W * 0.26;
    const w3 = W - w1 - w2 - 2 * g;
    k.rect(0, 0, w1, 74, { fill: k.A, r: 14 });
    k.text(c.title, 14, 13, w1 - 28, 19, { bold: true, color: k.on });
    k.text([c.f.school, c.f.year].filter(Boolean).join("  —  "), 14, 44, w1 - 28, 11, { color: alpha(k.on, "d9") });
    k.rect(w1 + g, 0, w2, 74, { fill: alpha(k.A, "26"), r: 14 });
    k.text(c.f.subject, w1 + g + 8, 12, w2 - 16, 13, { bold: true, color: k.At, align: "center" });
    k.text(c.f.level, w1 + g + 8, 34, w2 - 16, 11, { align: "center" });
    k.text(c.f.duration, w1 + g + 8, 51, w2 - 16, 11, { color: MUTED, align: "center" });
    k.scoreBox(w1 + w2 + 2 * g, 0, w3, 74, { fill: alpha(k.A, "10"), stroke: k.A, label: k.At, r: 14 });
    k.nameLine(90);
  }),
  d("color-wave", "Wave band", "colorful", "#2563eb", 132, (k, c) => {
    const W = k.W;
    const { x0, x1, y0 } = c;
    k.polyAbs([x0, y0, x1, y0, ...k.waveEdge(80, 7, 170, 1.2)], alpha(k.A, "40"));
    k.polyAbs([x0, y0, x1, y0, ...k.waveEdge(70, 7, 170)], k.A);
    k.text(c.title, 4, 12, W - 130, 23, { bold: true, color: k.on });
    k.text(k.sub, 4, 44, W - 130, 12, { color: alpha(k.on, "e6") });
    k.circle(W - 44, 40, 32, { fill: "#ffffff" });
    k.scoreCircle(W - 44, 40, 29, {});
    k.schoolYear(92);
    k.nameLine(112);
  }),
  d("color-stripes", "Striped strip", "colorful", "#f59e0b", 120, (k, c) => {
    const W = k.W;
    const { x0, x1, y0 } = c;
    k.band(12, k.A);
    for (let x = x0 - 20; x < x1; x += 14) k.polyAbs([x, 12, x + 7, 12, x + 19, y0, x + 12, y0], "#ffffff40");
    k.text(c.f.school, 0, 24, W * 0.6, 11, { bold: true, color: k.At });
    k.text(k.yearText, W * 0.6, 24, W * 0.4, 11, { color: MUTED, align: "end" });
    k.text(c.title, 0, 42, W - 140, 23, { bold: true });
    k.text(k.sub, 0, 74, W - 140, 12, { color: MUTED });
    k.scoreBox(W - 122, 42, 122, 46, { fill: alpha(k.A, "1a"), stroke: k.A, label: k.At, r: 6 });
    k.nameLine(102);
  }),
  d("color-bubbles", "Bubbles", "colorful", "#9333ea", 116, (k, c) => {
    const W = k.W;
    k.circle(W + 10, 4, 54, { fill: alpha(k.A, "1f") });
    k.circle(W - 112, 70, 18, { fill: alpha(k.A, "2e") });
    k.circle(W - 150, 10, 9, { fill: alpha(k.A, "55") });
    k.circle(W - 46, 44, 32, { fill: "#ffffff", stroke: k.A, sw: 1.5 });
    k.scoreCircle(W - 46, 44, 30, {});
    k.text(c.f.school.toUpperCase(), 0, 0, W - 180, 10, { bold: true, color: k.At });
    k.text(c.title, 0, 16, W - 180, 23, { bold: true });
    k.text(k.sub, 0, 48, W - 180, 12, { color: MUTED });
    k.text(k.yearText, 0, 66, W - 180, 11, { color: MUTED });
    k.nameLine(98);
  }),
  d("color-score-tab", "Band with score tab", "colorful", "#15803d", 124, (k, c) => {
    const W = k.W;
    k.band(56, k.A);
    const deep = mix(k.A, "#000000", 0.2);
    k.rectAbs(k.at(W - 128, 112), c.y0, k.at(W - 128, 112) + 112, 92 - c.y0, { fill: deep, r: [0, 0, 14, 14] });
    k.text(c.t.score, W - 128, 14, 112, 10, { bold: true, color: onColor(deep), align: "center" });
    k.rect(W - 120, 34, 96, 46, { fill: "#ffffff", r: 8 });
    k.text(k.scoreValue, W - 120, 49, 96, 15, { bold: true, color: k.At, align: "center", ltr: true });
    k.text(c.title, 4, 9, W - 160, 21, { bold: true, color: k.on });
    k.text(k.sub, 4, 35, W - 160, 11, { color: alpha(k.on, "e6") });
    k.text([c.f.school, c.f.year].filter(Boolean).join("  ·  "), 0, 66, W - 150, 11, { color: MUTED });
    k.nameLine(104);
  }),
  d("color-pastel", "Primary school", "colorful", "#0ea5e9", 136, (k, c) => {
    const W = k.W;
    k.band(96, alpha(k.A, "22"));
    k.rule(95, { sw: 2, color: k.A, dash: [6, 5] });
    k.star(26, 24, 13, k.A);
    k.star(56, 62, 8, alpha(k.A, "99"));
    k.star(84, 22, 6, alpha(k.A, "77"));
    k.text(c.title, 110, 14, W - 230, 24, { bold: true, color: k.At, align: "center" });
    k.text(k.sub, 110, 48, W - 230, 13, { align: "center" });
    k.text([c.f.school, c.f.year].filter(Boolean).join("  —  "), 110, 70, W - 230, 11, { color: MUTED, align: "center" });
    k.circle(W - 48, 48, 36, { fill: "#ffffff", stroke: k.A, sw: 2 });
    k.scoreCircle(W - 48, 48, 32, {});
    k.text(`${c.t.firstName} : ${DOTS}${DOTS}`, 0, 112, W * 0.62, 15);
    k.text(`${c.t.date} : ${DOTS_S}${DOTS_S}`, W * 0.62, 112, W * 0.38, 15, { align: "end" });
  }),

  // ---------- Exam headers ----------
  d("exam-standard", "Standard exam", "exam", "#1e40af", 172, (k, c) => {
    const W = k.W;
    const t = c.t;
    k.emblem(28, 28, 28);
    k.text(c.f.school, 66, 6, W * 0.6 - 66, 15, { bold: true });
    k.text(k.yearText, 66, 30, W * 0.6 - 66, 11, { color: MUTED });
    k.text(c.f.authority ?? "", W * 0.6, 8, W * 0.4, 10, { color: MUTED, align: "end" });
    k.text(c.title, 0, 64, W, 21, { bold: true, align: "center", color: k.At });
    k.cells(96, 30, [
      { label: t.subject, value: c.f.subject, weight: 1.3 },
      { label: t.class, value: c.f.level, weight: 1.2 },
      { label: t.date, value: k.dateValue, weight: 1.3 },
      { label: t.duration, value: c.f.duration },
      { label: t.score, value: `/ ${c.outOf}`, weight: 0.8, hl: true },
    ], { kind: "inline", box: true, stroke: INK, size: 12 });
    k.fields(134, 36, [
      { label: t.name, weight: 0.52 },
      { label: t.studentId, weight: 0.26 },
      { label: t.score, weight: 0.22, score: true },
    ]);
  }, { extra: ["authority", "date"] }),
  d("exam-instructions", "With instructions", "exam", "#1e40af", 158, (k, c) => {
    const W = k.W;
    const t = c.t;
    k.text(c.f.school, 0, 0, W * 0.6, 13, { bold: true });
    k.text(k.yearText, W * 0.6, 1, W * 0.4, 11, { color: MUTED, align: "end" });
    k.text(c.title, 0, 22, W, 21, { bold: true, align: "center" });
    k.cells(54, 30, [
      { label: t.subject, value: c.f.subject, weight: 1.3 },
      { label: t.class, value: c.f.level, weight: 1.2 },
      { label: t.date, value: k.dateValue, weight: 1.3 },
      { label: t.duration, value: c.f.duration },
    ], { kind: "inline", open: true, stroke: INK, size: 12 });
    k.nameScore(96);
    k.instructions(122, 32);
  }, { extra: ["date", "instructions"] }),
  d("exam-student-boxes", "Student boxes", "exam", "#4f46e5", 140, (k, c) => {
    const W = k.W;
    const t = c.t;
    k.text(c.title, 0, 0, W * 0.6, 22, { bold: true });
    k.text(c.f.school, W * 0.6, 2, W * 0.4, 11, { bold: true, align: "end" });
    k.text(k.yearText, W * 0.6, 19, W * 0.4, 11, { color: MUTED, align: "end" });
    k.text(k.sub, 0, 32, W * 0.6, 12, { color: k.At, bold: true });
    k.fields(58, 52, [
      { label: t.name, weight: 0.42 },
      { label: t.studentId, weight: 0.2 },
      { label: t.class, weight: 0.16 },
      { label: t.score, weight: 0.22, score: true },
    ]);
    k.text(`${t.date} : ${k.dateValue}`, 0, 122, W * 0.5, 11, { color: MUTED });
    k.text(`${t.duration} : ${c.f.duration}`, W * 0.5, 122, W * 0.5, 11, { color: MUTED, align: "end" });
  }, { extra: ["date"] }),
  d("exam-panels", "Exam and student panels", "exam", "#4f46e5", 146, (k, c) => {
    const W = k.W;
    const t = c.t;
    const lw = W * 0.58 - 6;
    const rw = W * 0.42 - 6;
    const rx = W - rw;
    k.rect(0, 0, lw, 142, { fill: alpha(k.A, "12"), stroke: k.A, sw: 1.2, r: 10 });
    k.text(c.title, 14, 12, lw - 28, 19, { bold: true, color: k.At });
    k.text([c.f.subject, c.f.level].filter(Boolean).join("  ·  "), 14, 42, lw - 28, 13);
    k.text(`${t.duration} : ${c.f.duration}`, 14, 64, lw - 28, 12, { color: MUTED });
    k.text(`${t.date} : ${k.dateValue}`, 14, 83, lw - 28, 12, { color: MUTED });
    k.text(k.yearText, 14, 102, lw - 28, 12, { color: MUTED });
    k.text(c.f.school, 14, 121, lw - 28, 12, { color: MUTED });
    k.rect(rx, 0, rw, 142, { stroke: INK, sw: 1, r: 10 });
    k.text(`${t.lastName} : ${DOTS}`, rx + 12, 12, rw - 24, 13);
    k.text(`${t.firstName} : ${DOTS}`, rx + 12, 36, rw - 24, 13);
    k.text(`${t.studentId} : ${DOTS}`, rx + 12, 60, rw - 24, 13);
    k.text(`${t.class} : ${DOTS_S}`, rx + 12, 84, rw - 24, 13);
    k.line([rx + 12, 108, rx + rw - 12, 108], { color: LINE });
    k.text(k.scoreText, rx + 12, 117, rw - 24, 15, { bold: true });
  }, { extra: ["date"] }),
  d("exam-ministry", "Ministry exam", "exam", "#1f2937", 174, (k, c) => {
    const W = k.W;
    const t = c.t;
    k.text(c.f.authority ?? "", 0, 0, W, 12, { bold: true, align: "center" });
    k.text(c.f.school, 0, 24, W * 0.55, 12, { bold: true });
    k.text(k.yearText, W * 0.55, 24, W * 0.45, 12, { align: "end" });
    k.text(`${t.level} : ${c.f.level}`, 0, 42, W * 0.55, 11);
    k.text(`${t.duration} : ${c.f.duration}`, W * 0.55, 42, W * 0.45, 11, { align: "end" });
    k.rect(W * 0.12, 64, W * 0.76, 40, { stroke: k.A, sw: 1.6, r: 4 });
    k.rect(W * 0.12 + 3, 67, W * 0.76 - 6, 34, { stroke: k.A, sw: 0.6, r: 2 });
    k.text(c.title, W * 0.12 + 8, 75, W * 0.76 - 16, 18, { bold: true, align: "center" });
    k.cells(114, 28, [
      { label: t.subject, value: c.f.subject },
      { label: t.date, value: k.dateValue },
      { label: t.score, value: `/ ${c.outOf}`, hl: true },
    ], { kind: "inline", open: true, stroke: INK, size: 12 });
    k.text(`${t.name} : ${DOTS}${DOTS}`, 0, 156, W * 0.56, 13);
    k.text(`${t.studentId} : ${DOTS_S}`, W * 0.56, 156, W * 0.44, 13, { align: "end" });
  }, { extra: ["authority", "date"] }),
  d("exam-arabic-official", "Arabic official", "exam", "#065f46", 162, (k, c) => {
    const W = k.W;
    const t = c.t;
    k.text(c.f.authority ?? "", 0, 0, W, 13, { bold: true, align: "center" });
    k.text(c.f.school, 0, 26, W * 0.55, 12, { bold: true });
    k.text(`${t.level} : ${c.f.level}`, 0, 44, W * 0.55, 11);
    k.text(k.yearText, W * 0.55, 26, W * 0.45, 12, { align: "end" });
    k.text(`${t.duration} : ${c.f.duration}`, W * 0.55, 44, W * 0.45, 11, { align: "end" });
    k.rect(W * 0.16, 68, W * 0.68, 38, { fill: alpha(k.A, "1a"), stroke: k.A, sw: 1.4, r: 19 });
    k.text(c.title, W * 0.16 + 14, 78, W * 0.68 - 28, 18, { bold: true, color: k.At, align: "center" });
    k.text(`${t.subject} : ${c.f.subject}`, 0, 118, W * 0.6, 12, { bold: true });
    k.text(k.scoreText, W * 0.6, 118, W * 0.4, 12, { bold: true, align: "end" });
    k.nameLine(142);
  }, { extra: ["authority"] }),
  d("exam-basmala", "With Basmala", "exam", "#065f46", 166, (k, c) => {
    const W = k.W;
    const t = c.t;
    k.text(c.f.motto ?? "", 0, 0, W, 14, { bold: true, color: k.At, align: "center" });
    k.text(c.f.school, 0, 26, W * 0.55, 12, { bold: true });
    k.text(`${t.level} : ${c.f.level}`, 0, 44, W * 0.55, 11);
    k.text(k.yearText, W * 0.55, 26, W * 0.45, 12, { align: "end" });
    k.text(`${t.duration} : ${c.f.duration}`, W * 0.55, 44, W * 0.45, 11, { align: "end" });
    k.titleWithSides(70, 20, { lineColor: k.A });
    k.text(`${t.subject} : ${c.f.subject}`, 0, 102, W, 12, { bold: true, color: k.At, align: "center" });
    k.nameScore(126);
    k.text(`${t.class} : ${DOTS_S}      ${t.number} : ${DOTS_S}`, 0, 148, W, 13);
  }, { extra: ["motto"], defaults: "motto" }),
  d("exam-arabic-table", "Arabic table", "exam", "#1f2937", 144, (k, c) => {
    const W = k.W;
    const t = c.t;
    const a = W * 0.34;
    const b = W * 0.66;
    k.rect(0, 0, W, 80, { fill: alpha(k.A, "0d") });
    k.rect(0, 0, W, 142, { stroke: INK, sw: 1.2 });
    k.line([a, 0, a, 80], { color: INK });
    k.line([b, 0, b, 80], { color: INK });
    k.line([0, 80, W, 80], { color: INK });
    k.line([W * 0.74, 80, W * 0.74, 142], { color: INK });
    k.text(c.f.authority ?? "", 8, 9, a - 16, 10, { color: MUTED });
    k.text(c.f.school, 8, 30, a - 16, 13, { bold: true });
    k.text(k.yearText, 8, 54, a - 16, 11, { color: MUTED });
    k.text(c.title, a + 8, 18, b - a - 16, 17, { bold: true, align: "center" });
    k.text(c.f.subject, a + 8, 48, b - a - 16, 13, { color: k.At, bold: true, align: "center" });
    k.text(`${t.level} : ${c.f.level}`, b + 8, 18, W - b - 16, 12);
    k.text(`${t.duration} : ${c.f.duration}`, b + 8, 46, W - b - 16, 12);
    k.text(`${t.name} : ${DOTS}${DOTS}`, 10, 92, W * 0.74 - 20, 13);
    k.text(`${t.class} : ${DOTS_S}      ${t.number} : ${DOTS_S}`, 10, 116, W * 0.74 - 20, 13);
    k.text(t.score, W * 0.74, 90, W * 0.26, 12, { bold: true, align: "center" });
    k.text(k.scoreValue, W * 0.74, 114, W * 0.26, 15, { bold: true, align: "center", ltr: true });
  }, { extra: ["authority"] }),
  d("exam-compact", "Compact exam", "exam", "#1f2937", 82, (k, c) => {
    const W = k.W;
    const t = c.t;
    k.text(c.title, 0, 2, W - 150, 17, { bold: true });
    k.rect(W - 136, 0, 136, 30, { stroke: k.A, sw: 1.2, r: 4 });
    k.text(k.scoreText, W - 136, 8, 136, 13, { bold: true, align: "center" });
    k.text([c.f.school, k.sub, c.f.year].filter(Boolean).join("  ·  "), 0, 30, W - 150, 11, { color: MUTED });
    k.text(`${t.name} : ${DOTS}${DOTS}      ${t.class} : ${DOTS_S}      ${t.date} : ${DOTS_S}`, 0, 54, W, 12);
    k.rule(80, { sw: 1.6, color: k.A });
  }),
  d("exam-quiz", "Quiz", "exam", "#c2410c", 98, (k, c) => {
    const W = k.W;
    const t = c.t;
    k.text(c.title, 0, 0, W * 0.6, 22, { bold: true, color: k.At });
    k.text(c.f.school, W * 0.6, 2, W * 0.4, 11, { color: MUTED, align: "end" });
    k.text([c.f.subject, c.f.level].filter(Boolean).join("  ·  "), W * 0.6, 19, W * 0.4, 11, { color: MUTED, align: "end" });
    k.fields(44, 52, [
      { label: t.name, weight: 0.5 },
      { label: t.date, weight: 0.25 },
      { label: t.score, weight: 0.25, score: true },
    ], { r: 10, stroke: alpha(k.A, "80"), fill: alpha(k.A, "08") });
  }),
  d("exam-marks-table", "Marks table", "exam", "#1e40af", 160, (k, c) => {
    const W = k.W;
    const t = c.t;
    k.schoolYear(0, { color: MUTED });
    k.text(c.title, 0, 20, W, 20, { bold: true, align: "center" });
    k.text(k.sub, 0, 48, W, 12, { color: MUTED, align: "center" });
    k.nameLine(72);
    // the marks of each exercise, and the total
    const top = 100;
    const head = 22;
    const rowH = 34;
    const first = W * 0.16;
    const last = W * 0.18;
    const n = 4;
    const cw = (W - first - last) / n;
    k.rect(0, top, W, head, { fill: alpha(k.A, "14") });
    k.rect(W - last, top, last, head + rowH, { fill: alpha(k.A, "1f") });
    k.rect(0, top, W, head + rowH, { stroke: INK, sw: 1.1 });
    k.line([0, top + head, W, top + head], { color: INK, sw: 0.8 });
    for (let i = 0; i <= n; i++) k.line([first + i * cw, top, first + i * cw, top + head + rowH], { color: INK, sw: 0.8 });
    k.text(t.exercise, 4, top + 5, first - 8, 11, { bold: true, align: "center" });
    k.text(t.score, 4, top + head + 11, first - 8, 11, { bold: true, align: "center" });
    for (let i = 0; i < n; i++) k.text(`${t.exercise} ${i + 1}`, first + i * cw + 4, top + 5, cw - 8, 11, { bold: true, color: k.At, align: "center" });
    k.text(t.total, W - last + 4, top + 5, last - 8, 11, { bold: true, align: "center" });
    k.text(`/ ${c.outOf}`, W - last + 4, top + head + 10, last - 12, 14, { bold: true, align: "end", ltr: true });
  }),
  d("exam-signature", "Comments and signature", "exam", "#0f766e", 172, (k, c) => {
    const W = k.W;
    const t = c.t;
    k.text(c.title, 0, 0, W * 0.6, 20, { bold: true, color: k.At });
    k.text(c.f.school, W * 0.6, 2, W * 0.4, 11, { bold: true, align: "end" });
    k.text(k.yearText, W * 0.6, 19, W * 0.4, 11, { color: MUTED, align: "end" });
    k.text(k.sub, 0, 30, W * 0.6, 12, { color: MUTED });
    k.nameLine(56);
    const top = 84;
    const head = 22;
    const cols = [
      { w: 0.2, label: t.score },
      { w: 0.4, label: t.appreciation },
      { w: 0.2, label: t.teacher },
      { w: 0.2, label: t.signature },
    ];
    k.rect(0, top, W, head, { fill: alpha(k.A, "1a") });
    k.rect(0, top, W, 170 - top, { stroke: INK, sw: 1.2 });
    k.line([0, top + head, W, top + head], { color: INK });
    let x = 0;
    for (const [i, col] of cols.entries()) {
      const w = W * col.w;
      if (i) k.line([x, top, x, 170], { color: INK });
      k.text(col.label, x + 4, top + 5, w - 8, 11, { bold: true, align: "center" });
      x += w;
    }
    k.text(k.scoreValue, 0, top + head + 24, W * 0.2, 15, { bold: true, align: "center", ltr: true });
  }),
];

const BY_ID = new Map(HEADER_DESIGNS.map((x) => [x.id, x]));
export const headerDesign = (id: string) => BY_ID.get(id);
export const isDesignStyle = (style: string) => BY_ID.has(style);

/** The default texts a design adds (the Basmala of "With Basmala") */
export function designDefaults(id: string): Partial<HeaderFields> {
  return headerDesign(id)?.defaults === "motto" ? { motto: "بسم الله الرحمن الرحيم" } : {};
}

/** What a design draws, for a header of `ctx` */
export function drawDesign(id: string, ctx: Omit<DesignCtx, "A" | "serif"> & { color?: string; chosenFont?: boolean }): HOp[] {
  const design = headerDesign(id);
  if (!design) return [];
  const k = new Kit({ ...ctx, A: hex(ctx.color || design.color), serif: ctx.chosenFont ? ctx.family : fontStack("Georgia") });
  design.draw(k, k.c);
  return k.ops;
}
