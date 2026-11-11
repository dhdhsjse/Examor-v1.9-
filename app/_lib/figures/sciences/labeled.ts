// Labeled diagrams of the Sciences pack: a line drawing, and lines pointing to its parts. The teacher chooses what is
// written at the end of each line: the names, numbers (to label), blank lines to fill, or nothing. In "Names" the teacher
// can also write their own names, in the order of the numbers.
import { cornerNames, ink, r1, str, svg, type Pt } from "../svg";
import { say, textWidth } from "./draw";
import type { FigureDef, FigureParam, Params } from "../types";
import type { Lang } from "../../types";

export interface Part {
  key: string;
  at: Pt; // the point of the drawing the line starts from
  fr: string;
  ar: string;
  side?: "l" | "r" | "t" | "b"; // where its label goes: a column left or right, a row above or below (default: the nearer column)
  when?: (p: Params) => boolean; // only when this part is drawn
}

export interface LabeledSpec {
  id: string;
  name: string; // English key (translated)
  hint?: string;
  w: number | ((p: Params) => number); // size of the drawing
  h: number | ((p: Params) => number);
  params?: FigureParam[]; // its own settings (parts to show…), before the labels
  defaults?: Params;
  draw: (p: Params, color: string, lang: Lang) => string;
  parts: Part[] | ((p: Params) => Part[]);
}

export const LABEL_MODES = [
  { value: "names", label: "Names" },
  { value: "numbers", label: "Numbers" },
  { value: "lines", label: "Lines to fill" },
  { value: "none", label: "No labels" },
];

export const labelsParam: FigureParam = { key: "labels", label: "Labels", kind: "select", options: LABEL_MODES };
export const ownNamesParam: FigureParam = {
  key: "own",
  label: "Own names (in the order of the numbers)",
  kind: "text",
  placeholder: "…, …, …",
  when: (p) => p.labels === "names",
};

// Spread labels along a line: each as near its wish as it can, at least its gap from the one before, inside min…max.
function spread(wish: number[], gaps: number[], min: number, max: number): number[] {
  const out = [...wish];
  for (let i = 0; i < out.length; i++) out[i] = Math.max(out[i], i ? out[i - 1] + gaps[i] : min);
  for (let i = out.length - 1; i >= 0; i--) out[i] = Math.min(out[i], i < out.length - 1 ? out[i + 1] - gaps[i + 1] : max);
  for (let i = 0; i < out.length; i++) out[i] = Math.max(out[i], i ? out[i - 1] + gaps[i] : min);
  return out;
}

const SIZE = 12;
const GAP = 19;
const LEAD = 14; // from the drawing to a label column
const ROW = 26; // height of a label row (above or below)

// The labels of a drawing (w × h). Returns the labels and where the drawing goes: (L, T) in a picture of W × H.
// `own` replaces the names in the order of the numbers.
export function callouts(parts: Part[], mode: string, lang: Lang, color: string, w: number, h: number, own = "") {
  const sides = { l: [] as Part[], t: [] as Part[], r: [] as Part[], b: [] as Part[] };
  for (const part of parts) sides[part.side ?? (part.at[0] < w / 2 ? "l" : "r")].push(part);
  sides.l.sort((a, b) => a.at[1] - b.at[1]);
  sides.r.sort((a, b) => a.at[1] - b.at[1]);
  sides.t.sort((a, b) => a.at[0] - b.at[0]);
  sides.b.sort((a, b) => a.at[0] - b.at[0]);
  // numbered: left column, top row, right column, bottom row (as they are read)
  const ordered = [...sides.l, ...sides.t, ...sides.r, ...sides.b];
  const custom = own.trim() ? cornerNames(own.replace(/\n/g, ","), ordered.length) : [];
  const nameOf = (part: Part) => {
    const i = ordered.indexOf(part);
    return custom[i]?.trim() || (lang === "ar" ? part.ar : part.fr);
  };
  const wordOf = (part: Part, left: boolean) => {
    const n = String(ordered.indexOf(part) + 1);
    if (mode === "names") return nameOf(part);
    if (mode === "lines") return left ? `……………… ${n}` : `${n} ………………`;
    return n;
  };
  const size = mode === "numbers" ? 13 : SIZE;
  const widthOf = (part: Part, left = false) => textWidth(wordOf(part, left), size);
  const none = mode === "none";
  const widest = (list: Part[], left: boolean) => (list.length && !none ? Math.max(...list.map((p) => widthOf(p, left))) + LEAD + 6 : 0);
  // the row labels may stick out of the drawing on the sides
  const rowSpan = (list: Part[]) => {
    if (!list.length || none) return { xs: [] as number[], lo: 0, hi: w };
    const gaps = list.map((p, i) => (i ? (widthOf(list[i - 1]) + widthOf(p)) / 2 + 10 : 0));
    const xs = spread(
      list.map((p) => p.at[0]),
      gaps,
      -Infinity,
      Infinity,
    );
    return { xs, lo: Math.min(0, ...xs.map((x, i) => x - widthOf(list[i]) / 2)), hi: Math.max(w, ...xs.map((x, i) => x + widthOf(list[i]) / 2)) };
  };
  const top = rowSpan(sides.t);
  const bottom = rowSpan(sides.b);
  const L = Math.max(widest(sides.l, true), -top.lo, -bottom.lo);
  const R = Math.max(widest(sides.r, false), top.hi - w, bottom.hi - w);
  const T = sides.t.length && !none ? ROW : 0;
  const B = sides.b.length && !none ? ROW : 0;
  // The columns may need more height than the drawing: then the drawing goes down to the middle.
  const inner = Math.max(h, ...[sides.l, sides.r].map((s) => (none ? 0 : s.length * GAP + 12)));
  const dy = T + (inner - h) / 2;
  const H = T + inner + B;
  let body = "";
  const at = (part: Part): Pt => [part.at[0], part.at[1] + dy];
  const dotAndLine = (from: Pt, to: Pt) => `<circle cx="${r1(from[0])}" cy="${r1(from[1])}" r="1.8" fill="${color}" stroke="none"/><path d="M${r1(from[0])} ${r1(from[1])}L${r1(to[0])} ${r1(to[1])}" stroke-width="1"/>`;
  if (none) return { body, L, R, H, T: dy };
  for (const [list, left] of [
    [sides.l, true],
    [sides.r, false],
  ] as const) {
    const ys = spread(
      list.map((p) => at(p)[1]),
      list.map(() => GAP),
      T + 10,
      T + inner - 6,
    );
    list.forEach((part, i) => {
      const end = left ? -LEAD + 4 : w + LEAD - 4;
      body += dotAndLine(at(part), [end, ys[i]]);
      body += say(left ? end - 4 : end + 4, ys[i] + 4, wordOf(part, left), { size, fill: color, bold: mode === "numbers", anchor: left ? "end" : "start" });
    });
  }
  for (const [list, xs, y, ly] of [
    [sides.t, top.xs, T - 6, T - 10],
    [sides.b, bottom.xs, T + inner + 6, T + inner + 20],
  ] as const) {
    list.forEach((part, i) => {
      body += dotAndLine(at(part), [xs[i], y]);
      body += say(xs[i], ly, wordOf(part, false), { size, fill: color, bold: mode === "numbers", anchor: "middle" });
    });
  }
  return { body, L, R, H, T: dy };
}

// A figure made of a drawing and its labels.
export function labeledFigure(spec: LabeledSpec): FigureDef {
  return {
    id: spec.id,
    name: spec.name,
    hint: spec.hint,
    params: [...(spec.params ?? []), labelsParam, ownNamesParam],
    defaults: () => ({ labels: "numbers", own: "", ...(spec.defaults ?? {}) }),
    build: (p, lang) => {
      const color = ink(p);
      const mode = str(p, "labels", "numbers");
      const all = typeof spec.parts === "function" ? spec.parts(p) : spec.parts;
      const parts = all.filter((part) => !part.when || part.when(p));
      const w = typeof spec.w === "function" ? spec.w(p) : spec.w;
      const h = typeof spec.h === "function" ? spec.h(p) : spec.h;
      const { body, L, R, H, T } = callouts(parts, mode, lang, color, w, h, str(p, "own"));
      const drawing = `<g transform="translate(${r1(L)} ${r1(T)})">${spec.draw(p, color, lang)}</g>`;
      return svg(L + w + R, H, `${drawing}<g transform="translate(${r1(L)} 0)">${body}</g>`, color);
    },
  };
}
