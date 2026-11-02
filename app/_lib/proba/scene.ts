// Everything of the Probability Studio as simple things to draw (lines, circles, rectangles, paths, texts, shaded regions), in
// pixels of the sheet. The Konva canvas and the picture for the page both draw this scene, so they cannot differ. Pure (it only
// measures texts with a canvas when there is one), unit-tested.
import { formatRational, isFraction, numberStyle, pathProbability, treeTexts } from "./numbers";
import { paths } from "./tree";
import { colorOf, type Cards, type Coin, type Dice, type ProbItem, type ProbNode, type ProbTree, type Spinner, type Urn, type Venn } from "./types";

export const INK = "#111827";
export const FONT = "Arial, Helvetica, sans-serif";
export const SHADE = "#cbd5e1";

export type Circ = { cx: number; cy: number; r: number };
export type Box = { x: number; y: number; w: number; h: number };

export type Prim =
  | { k: "line"; pts: number[]; w: number; color?: string; dash?: number[]; closed?: boolean; fill?: string }
  | { k: "circle"; cx: number; cy: number; r: number; fill?: string; stroke?: string; w?: number }
  | { k: "rect"; x: number; y: number; w: number; h: number; radius?: number; fill?: string; stroke?: string; sw?: number }
  | { k: "path"; d: string; fill?: string; stroke?: string; w?: number }
  | { k: "text"; x: number; y: number; text: string; size: number; anchor: "start" | "middle" | "end"; bold?: boolean; italic?: boolean; color?: string }
  /** A region of a Venn diagram shaded: inside every circle of `inside`, outside every circle of `outside`, within `frame` */
  | { k: "region"; id: string; inside: Circ[]; outside: Circ[]; frame: Box; fill: string };

/** Something of a tree that can be clicked: a node (its event), or the probability on the branch leading to it. */
export type Hit = { node: string; part: "node" | "prob"; box: Box; depth: number };

export type DrawnItem = { id: string; prims: Prim[]; bounds: Box; hits: Hit[] };

// ---- texts ----

let measureCtx: CanvasRenderingContext2D | null | undefined;
/** How wide a text is drawn: measured with a canvas in the browser, guessed elsewhere (the tests). */
export function textWidth(text: string, size: number, bold = false): number {
  if (measureCtx === undefined) measureCtx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  if (measureCtx) {
    measureCtx.font = `${bold ? "bold " : ""}${size}px ${FONT}`;
    return measureCtx.measureText(text).width;
  }
  return [...text].reduce((w, ch) => w + (/[ il.,;:!'|]/.test(ch) ? 0.3 : /[mwMW]/.test(ch) ? 0.85 : /[A-Z0-9]/.test(ch) ? 0.66 : 0.55), 0) * size;
}

/** A piece of writing placed on the sheet: its prims, and its box. */
type Piece = { prims: Prim[]; w: number; h: number };

const empty: Piece = { prims: [], w: 0, h: 0 };

/** An event (A, or Ā with its bar), its middle at (0, 0). */
function eventPiece(label: string, bar: boolean, size: number, bold = false): Piece {
  if (!label) return empty;
  const w = textWidth(label, size, bold);
  const prims: Prim[] = [{ k: "text", x: 0, y: 0, text: label, size, anchor: "middle", bold }];
  if (bar) prims.push({ k: "line", pts: [-w / 2, -size * 0.55, w / 2, -size * 0.55], w: Math.max(1, size / 14) });
  return { prims, w, h: size * 1.2 };
}

/** A probability: "1/4" one over the other, the rest as typed, dots when it is hidden; its middle at (0, 0). */
function probPiece(text: string, size: number, hidden = false): Piece {
  if (hidden) {
    const dots = "……";
    return { prims: [{ k: "text", x: 0, y: 0, text: dots, size, anchor: "middle" }], w: textWidth(dots, size), h: size };
  }
  const s = text.trim();
  if (!s) return empty;
  if (isFraction(s)) {
    const [a, b] = s.split("/").map((p) => p.trim());
    const fs = size * 0.85;
    const w = Math.max(textWidth(a, fs), textWidth(b, fs)) + 4;
    return {
      prims: [
        { k: "text", x: 0, y: -fs * 0.62, text: a, size: fs, anchor: "middle" },
        { k: "line", pts: [-w / 2, 0, w / 2, 0], w: Math.max(1, size / 16) },
        { k: "text", x: 0, y: fs * 0.66, text: b, size: fs, anchor: "middle" },
      ],
      w,
      h: fs * 2.5,
    };
  }
  return { prims: [{ k: "text", x: 0, y: 0, text: s, size, anchor: "middle" }], w: textWidth(s, size), h: size * 1.2 };
}

/** The outcome of a path, "A ∩ B̄", its middle at (0, 0). */
function outcomePiece(nodes: ProbNode[], size: number): Piece {
  const parts = nodes.filter((n) => n.label);
  if (!parts.length) return empty;
  const sep = " ∩ ";
  const sepW = textWidth(sep, size);
  const widths = parts.map((n) => textWidth(n.label, size));
  const total = widths.reduce((a, b) => a + b, 0) + sepW * (parts.length - 1);
  const prims: Prim[] = [];
  let x = -total / 2;
  parts.forEach((n, i) => {
    if (i) {
      // (the sign alone, in the middle of its room: the spaces around it would be dropped by an svg image)
      prims.push({ k: "text", x: x + sepW / 2, y: 0, text: "∩", size, anchor: "middle" });
      x += sepW;
    }
    for (const p of eventPiece(n.label, !!n.bar, size).prims) prims.push(shift(p, x + widths[i] / 2, 0));
    x += widths[i];
  });
  return { prims, w: total, h: size * 1.2 };
}

/** A prim moved by (dx, dy). */
export function shift(p: Prim, dx: number, dy: number): Prim {
  switch (p.k) {
    case "line":
      return { ...p, pts: p.pts.map((v, i) => v + (i % 2 ? dy : dx)) };
    case "circle":
      return { ...p, cx: p.cx + dx, cy: p.cy + dy };
    case "rect":
      return { ...p, x: p.x + dx, y: p.y + dy };
    case "text":
      return { ...p, x: p.x + dx, y: p.y + dy };
    case "path":
      return { ...p, d: shiftPath(p.d, dx, dy) };
    case "region": {
      const c = (q: Circ) => ({ ...q, cx: q.cx + dx, cy: q.cy + dy });
      return { ...p, inside: p.inside.map(c), outside: p.outside.map(c), frame: { ...p.frame, x: p.frame.x + dx, y: p.frame.y + dy } };
    }
  }
}

// (the paths of the scene only use absolute M, L, A and Z, so moving one moves its points; an arc's radii and flags stay)
function shiftPath(d: string, dx: number, dy: number): string {
  return d.replace(/([MLA])([^MLAZ]*)/g, (_, cmd: string, args: string) => {
    const n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (cmd === "A") return `A${n[0]} ${n[1]} ${n[2]} ${n[3]} ${n[4]} ${r2(n[5] + dx)} ${r2(n[6] + dy)}`;
    const out: number[] = [];
    for (let i = 0; i < n.length; i += 2) out.push(r2(n[i] + dx), r2(n[i + 1] + dy));
    return `${cmd}${out.join(" ")}`;
  });
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** The box around a list of prims (texts measured). */
export function primsBounds(prims: Prim[]): Box | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (x: number, y: number) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  for (const p of prims) {
    if (p.k === "line") for (let i = 0; i < p.pts.length; i += 2) take(p.pts[i], p.pts[i + 1]);
    else if (p.k === "circle") {
      take(p.cx - p.r, p.cy - p.r);
      take(p.cx + p.r, p.cy + p.r);
    } else if (p.k === "rect") {
      take(p.x, p.y);
      take(p.x + p.w, p.y + p.h);
    } else if (p.k === "region") {
      take(p.frame.x, p.frame.y);
      take(p.frame.x + p.frame.w, p.frame.y + p.frame.h);
    } else if (p.k === "path") {
      // (an arc's own numbers are radii and flags: only the points are read, which is enough for the boxes the scene makes)
      for (const m of p.d.matchAll(/([MLA])([^MLAZ]*)/g)) {
        const a = m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
        if (m[1] === "A") take(a[5], a[6]);
        else for (let i = 0; i < a.length; i += 2) take(a[i], a[i + 1]);
      }
    } else {
      const w = textWidth(p.text, p.size, p.bold);
      const left = p.anchor === "start" ? p.x : p.anchor === "middle" ? p.x - w / 2 : p.x - w;
      take(left, p.y - p.size * 0.6);
      take(left + w, p.y + p.size * 0.6);
    }
  }
  return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// ---- trees ----

const NODE_PAD = 5; // between an event and the end of its branch

type Placed = { node: ProbNode; depth: number; x: number; y: number; piece: Piece; hw: number; hh: number };

/** Where every node of a tree goes (before the tree is moved to its place): the leaves one after the other, each node in the middle of its own. */
function placeNodes(t: ProbTree): Placed[] {
  const out: Placed[] = [];
  let leaf = 0;
  const walk = (n: ProbNode, depth: number): number => {
    let cross: number;
    if (!n.children.length) cross = leaf++ * t.leafGap;
    else {
      const crosses = n.children.map((c) => walk(c, depth + 1));
      cross = (crosses[0] + crosses[crosses.length - 1]) / 2;
    }
    const piece = eventPiece(n.label, !!n.bar, t.fontSize);
    const isRootDot = depth === 0 && !n.label;
    const hw = isRootDot ? 3 : piece.w / 2;
    const hh = isRootDot ? 3 : piece.h / 2;
    const along = depth * t.levelGap;
    out.push({ node: n, depth, x: t.direction === "right" ? along : cross, y: t.direction === "right" ? cross : along, piece, hw, hh });
    return cross;
  };
  walk(t.root, 0);
  return out;
}

export function drawTree(t: ProbTree): DrawnItem {
  const prims: Prim[] = [];
  const hits: Hit[] = [];
  const placed = placeNodes(t);
  const at = new Map(placed.map((p) => [p.node.id, p]));
  const right = t.direction === "right";
  const size = t.fontSize;
  const sw = Math.max(1.2, size / 11);

  for (const p of placed) {
    // the event (or a dot for a root with no name)
    if (p.depth === 0 && !p.node.label) prims.push({ k: "circle", cx: p.x, cy: p.y, r: 3, fill: INK });
    else for (const q of p.piece.prims) prims.push(shift(q, p.x, p.y));
    const hw = Math.max(p.hw, 10);
    const hh = Math.max(p.hh, 10);
    hits.push({ node: p.node.id, part: "node", depth: p.depth, box: { x: p.x - hw - 2, y: p.y - hh - 2, w: 2 * hw + 4, h: 2 * hh + 4 } });

    // the branches from it, with their probabilities
    for (const c of p.node.children) {
      const q = at.get(c.id)!;
      const a = right ? { x: p.x + p.hw + NODE_PAD, y: p.y } : { x: p.x, y: p.y + p.hh + NODE_PAD };
      const b = right ? { x: q.x - q.hw - NODE_PAD, y: q.y } : { x: q.x, y: q.y - q.hh - NODE_PAD };
      prims.push({ k: "line", pts: [a.x, a.y, b.x, b.y], w: sw });
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      // the probability beside the middle of the branch, on the outer side (above a branch that goes up…)
      const flip = right ? dy > 0 : dx < 0;
      const nx = (flip ? -dy : dy) / len;
      const ny = (flip ? dx : -dx) / len;
      const piece = probPiece(c.prob, size * 0.92, c.hideProb);
      const pw = Math.max(piece.w, 14);
      const ph = Math.max(piece.h, size);
      const off = 4 + Math.abs(nx) * (pw / 2) + Math.abs(ny) * (ph / 2);
      const mx = (a.x + b.x) / 2 + nx * off;
      const my = (a.y + b.y) / 2 + ny * off;
      for (const r of piece.prims) prims.push(shift(r, mx, my));
      hits.push({ node: c.id, part: "prob", depth: q.depth, box: { x: mx - pw / 2 - 3, y: my - ph / 2 - 3, w: pw + 6, h: ph + 6 } });
    }
  }

  // the columns at the end of the paths: the outcome and its probability
  const leaves = paths(t.root);
  if (leaves.length && (t.showOutcomes || t.showResults)) {
    const style = numberStyle(treeTexts(t.root));
    const ends = leaves.map((path) => at.get(path[path.length - 1].id)!);
    const outcomes = leaves.map((path) => (t.showOutcomes ? outcomePiece(path, size) : empty));
    const results = leaves.map((path) => {
      if (!t.showResults) return empty;
      const r = pathProbability(path.map((n) => n.prob));
      return probPiece(r ? formatRational(r, style) : "", size * 0.92);
    });
    if (right) {
      const x0 = Math.max(...ends.map((e) => e.x + e.hw)) + 28;
      const ow = Math.max(0, ...outcomes.map((o) => o.w));
      const x1 = x0 + (ow ? ow + 26 : 0);
      ends.forEach((e, i) => {
        for (const q of outcomes[i].prims) prims.push(shift(q, x0 + outcomes[i].w / 2, e.y));
        for (const q of results[i].prims) prims.push(shift(q, x1 + results[i].w / 2, e.y));
      });
    } else {
      const y0 = Math.max(...ends.map((e) => e.y + e.hh)) + 24;
      const oh = Math.max(0, ...outcomes.map((o) => o.h));
      const y1 = y0 + (oh ? oh / 2 + 10 : 0) + Math.max(0, ...results.map((r) => r.h)) / 2;
      ends.forEach((e, i) => {
        for (const q of outcomes[i].prims) prims.push(shift(q, e.x, y0));
        for (const q of results[i].prims) prims.push(shift(q, e.x, y1));
      });
    }
  }

  // the tree is put with the top-left corner of what it draws at (x, y)
  const b = primsBounds(prims) ?? { x: 0, y: 0, w: 0, h: 0 };
  const dx = t.x - b.x;
  const dy = t.y - b.y;
  return {
    id: t.id,
    prims: prims.map((p) => shift(p, dx, dy)),
    bounds: { x: t.x, y: t.y, w: b.w, h: b.h },
    hits: hits.map((h) => ({ ...h, box: { ...h.box, x: h.box.x + dx, y: h.box.y + dy } })),
  };
}

// ---- Venn diagrams ----

const VENN_R = 70;

/** The circles of a Venn diagram, around (0, 0). */
export function vennCircles(sets: 2 | 3): Circ[] {
  const d = VENN_R * 1.1;
  if (sets === 2) return [{ cx: -d / 2, cy: 0, r: VENN_R }, { cx: d / 2, cy: 0, r: VENN_R }];
  const h = (d * Math.sqrt(3)) / 2;
  return [{ cx: -d / 2, cy: -h / 3, r: VENN_R }, { cx: d / 2, cy: -h / 3, r: VENN_R }, { cx: 0, cy: (2 * h) / 3, r: VENN_R }];
}

/** Every region of a Venn diagram, the inside of all of them first: "11", "10", "01", "00". */
export function vennRegions(sets: 2 | 3): string[] {
  const out: string[] = [];
  for (let m = (1 << sets) - 1; m >= 0; m--) out.push(m.toString(2).padStart(sets, "0"));
  return out;
}

const VENN_PAD = 28;
const vennFrame = (sets: 2 | 3): Box => {
  const cs = vennCircles(sets);
  const x0 = Math.min(...cs.map((c) => c.cx - c.r)) - VENN_PAD;
  const y0 = Math.min(...cs.map((c) => c.cy - c.r)) - VENN_PAD;
  const x1 = Math.max(...cs.map((c) => c.cx + c.r)) + VENN_PAD;
  const y1 = Math.max(...cs.map((c) => c.cy + c.r)) + VENN_PAD;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

const inside = (c: Circ, x: number, y: number) => (x - c.cx) ** 2 + (y - c.cy) ** 2 <= c.r * c.r;

const spotCache = new Map<number, Record<string, { x: number; y: number }>>();
/** Where the value of each region is written: the point of the region farthest from its edges (found on a fine grid, once). */
export function regionSpots(sets: 2 | 3): Record<string, { x: number; y: number }> {
  const cached = spotCache.get(sets);
  if (cached) return cached;
  const cs = vennCircles(sets);
  const f = vennFrame(sets);
  const best: Record<string, { x: number; y: number; d: number }> = {};
  for (let x = f.x + 6; x < f.x + f.w - 6; x += 3)
    for (let y = f.y + 6; y < f.y + f.h - 6; y += 3) {
      const key = cs.map((c) => (inside(c, x, y) ? "1" : "0")).join("");
      // the distance to the nearest edge (a circle, or the frame for the outside)
      let d = Math.min(...cs.map((c) => Math.abs(Math.hypot(x - c.cx, y - c.cy) - c.r)));
      if (key === "0".repeat(sets)) d = Math.min(d, x - f.x, f.x + f.w - x, y - f.y, f.y + f.h - y) * (y > f.y + f.h / 2 ? 1.2 : 1); // (lower down, away from Ω)
      if (!best[key] || d > best[key].d) best[key] = { x, y, d };
    }
  const spots = Object.fromEntries(Object.entries(best).map(([k, v]) => [k, { x: v.x, y: v.y }]));
  spotCache.set(sets, spots);
  return spots;
}

export function drawVenn(v: Venn): DrawnItem {
  const cs = vennCircles(v.sets);
  const f = vennFrame(v.sets);
  const prims: Prim[] = [];
  const size = 16;
  for (const key of v.shaded) {
    if (key.length !== v.sets) continue;
    prims.push({ k: "region", id: `${v.id}-${key}`, inside: cs.filter((_, i) => key[i] === "1"), outside: cs.filter((_, i) => key[i] === "0"), frame: f, fill: SHADE });
  }
  if (v.showUniverse) {
    prims.push({ k: "rect", x: f.x, y: f.y, w: f.w, h: f.h, stroke: INK, sw: 1.6 });
    if (v.universe) prims.push({ k: "text", x: f.x + 8, y: f.y + 13, text: v.universe, size, anchor: "start" });
  }
  for (const c of cs) prims.push({ k: "circle", cx: c.cx, cy: c.cy, r: c.r, stroke: INK, w: 1.8 });
  // the names of the sets, outside their circles
  const dirs = v.sets === 2 ? [[-0.72, -0.72], [0.72, -0.72]] : [[-0.8, -0.6], [0.8, -0.6], [0.62, 0.78]];
  cs.forEach((c, i) => {
    const label = v.labels[i] ?? "";
    if (!label) return;
    const [ux, uy] = dirs[i];
    const x = c.cx + ux * (c.r + 10);
    const y = c.cy + uy * (c.r + 8);
    prims.push({ k: "text", x, y, text: label, size: size + 1, anchor: ux < -0.1 ? "end" : ux > 0.1 ? "start" : "middle", bold: true });
  });
  const spots = regionSpots(v.sets);
  for (const [key, text] of Object.entries(v.values)) {
    if (!text?.trim() || key.length !== v.sets || !spots[key]) continue;
    for (const p of probPiece(text, size).prims) prims.push(shift(p, spots[key].x, spots[key].y));
  }
  return placeAt(v.id, prims, v.x, v.y, f);
}

/** An item drawn around (0, 0) put with the top-left corner of its frame at (x, y). */
function placeAt(id: string, prims: Prim[], x: number, y: number, frame?: Box): DrawnItem {
  const b = frame ?? primsBounds(prims) ?? { x: 0, y: 0, w: 0, h: 0 };
  const all = primsBounds(prims) ?? b;
  const dx = x - b.x;
  const dy = y - b.y;
  const x0 = Math.min(b.x, all.x), y0 = Math.min(b.y, all.y);
  const x1 = Math.max(b.x + b.w, all.x + all.w), y1 = Math.max(b.y + b.h, all.y + all.h);
  return { id, prims: prims.map((p) => shift(p, dx, dy)), bounds: { x: x0 + dx, y: y0 + dy, w: x1 - x0, h: y1 - y0 }, hits: [] };
}

// ---- urns ----

const BALL_R = 13;

export function drawUrn(u: Urn): DrawnItem {
  const balls = u.balls.flatMap((b) => Array.from({ length: Math.max(0, Math.min(40, Math.round(b.count))) }, () => b));
  const n = balls.slice(0, 40).length;
  const cols = Math.max(3, Math.ceil(Math.sqrt(n * 1.6)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const step = BALL_R * 2 + 3;
  const w = cols * step + 16;
  const h = rows * step + 26;
  const prims: Prim[] = [];
  // the jar: open at the top, a rim on each side
  const r = 14;
  prims.push({ k: "path", d: `M0 0L0 ${h - r}A${r} ${r} 0 0 0 ${r} ${h}L${w - r} ${h}A${r} ${r} 0 0 0 ${w} ${h - r}L${w} 0`, stroke: INK, w: 2 });
  prims.push({ k: "line", pts: [-7, 0, 6, 0], w: 2 }, { k: "line", pts: [w - 6, 0, w + 7, 0], w: 2 });
  // the balls, from the bottom up
  balls.slice(0, 40).forEach((b, i) => {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    const col = i % cols;
    const x = w / 2 + (col - (inRow - 1) / 2) * step;
    const y = h - 8 - BALL_R - row * step;
    const c = colorOf(b.color);
    prims.push({ k: "circle", cx: x, cy: y, r: BALL_R, fill: c.fill, stroke: INK, w: 1.3 });
    if (b.text) prims.push({ k: "text", x, y, text: b.text, size: b.text.length > 2 ? 9 : 12, anchor: "middle", bold: true, color: c.ink });
  });
  if (u.label) prims.push({ k: "text", x: w / 2, y: h + 16, text: u.label, size: 15, anchor: "middle" });
  return placeAt(u.id, prims, u.x, u.y);
}

// ---- dice, coins, cards ----

const DIE = 46;
const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

export function drawDice(d: Dice): DrawnItem {
  const prims: Prim[] = [];
  d.faces.forEach((face, i) => {
    const x0 = i * (DIE + 14);
    prims.push({ k: "rect", x: x0, y: 0, w: DIE, h: DIE, radius: 8, fill: "#ffffff", stroke: INK, sw: 2 });
    for (const [px, py] of PIPS[Math.min(6, Math.max(1, Math.round(face)))] ?? []) prims.push({ k: "circle", cx: x0 + DIE / 2 + px * 12.5, cy: DIE / 2 + py * 12.5, r: 4.2, fill: INK });
  });
  return placeAt(d.id, prims, d.x, d.y);
}

const COIN_R = 25;

export function drawCoin(c: Coin): DrawnItem {
  const prims: Prim[] = [];
  c.sides.forEach((text, i) => {
    const cx = COIN_R + i * (2 * COIN_R + 14);
    prims.push({ k: "circle", cx, cy: COIN_R, r: COIN_R, fill: "#fde68a", stroke: INK, w: 2 });
    prims.push({ k: "circle", cx, cy: COIN_R, r: COIN_R - 5, stroke: INK, w: 0.8 });
    if (text) prims.push({ k: "text", x: cx, y: COIN_R, text, size: text.length > 2 ? 12 : 17, anchor: "middle", bold: true });
  });
  return placeAt(c.id, prims, c.x, c.y);
}

const CARD_W = 42;
const CARD_H = 58;

export function drawCards(c: Cards): DrawnItem {
  const prims: Prim[] = [];
  c.texts.forEach((text, i) => {
    const x0 = i * (CARD_W + 10);
    prims.push({ k: "rect", x: x0, y: 0, w: CARD_W, h: CARD_H, radius: 6, fill: "#ffffff", stroke: INK, sw: 1.8 });
    const red = /[♥♦]/.test(text);
    if (text) prims.push({ k: "text", x: x0 + CARD_W / 2, y: CARD_H / 2, text, size: text.length > 3 ? 12 : 17, anchor: "middle", bold: true, color: red ? "#dc2626" : INK });
  });
  return placeAt(c.id, prims, c.x, c.y);
}

// ---- spinners ----

export function drawSpinner(s: Spinner): DrawnItem {
  const R = s.radius;
  const prims: Prim[] = [];
  const total = s.sectors.reduce((a, b) => a + Math.max(0, b.weight), 0) || 1;
  let a0 = -Math.PI / 2;
  const pt = (a: number, r: number) => `${r2(Math.cos(a) * r)} ${r2(Math.sin(a) * r)}`;
  const live = s.sectors.filter((x) => x.weight > 0);
  for (const sec of live) {
    const a1 = a0 + (Math.max(0, sec.weight) / total) * 2 * Math.PI;
    const c = colorOf(sec.color);
    if (live.length === 1) prims.push({ k: "circle", cx: 0, cy: 0, r: R, fill: c.fill, stroke: INK, w: 1.6 });
    else prims.push({ k: "path", d: `M0 0L${pt(a0, R)}A${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(a1, R)}Z`, fill: c.fill, stroke: INK, w: 1.6 });
    if (sec.label) {
      const mid = (a0 + a1) / 2;
      prims.push({ k: "text", x: Math.cos(mid) * R * 0.62, y: Math.sin(mid) * R * 0.62, text: sec.label, size: 15, anchor: "middle", bold: true, color: c.ink });
    }
    a0 = a1;
  }
  if (!live.length) prims.push({ k: "circle", cx: 0, cy: 0, r: R, stroke: INK, w: 1.6 });
  // the pointer: from the middle, a little arrow
  const tip = { x: Math.cos(-1.05) * R * 0.78, y: Math.sin(-1.05) * R * 0.78 };
  const ang = Math.atan2(tip.y, tip.x);
  const head = (da: number) => [tip.x - Math.cos(ang + da) * 11, tip.y - Math.sin(ang + da) * 11];
  prims.push({ k: "line", pts: [0, 0, tip.x, tip.y], w: 3, color: INK });
  prims.push({ k: "line", pts: [tip.x, tip.y, ...head(0.45), ...head(-0.45)], w: 1, closed: true, fill: INK });
  prims.push({ k: "circle", cx: 0, cy: 0, r: 5, fill: INK });
  return placeAt(s.id, prims, s.x, s.y, { x: -R, y: -R, w: 2 * R, h: 2 * R });
}

// ---- everything ----

export function drawItem(item: ProbItem): DrawnItem {
  switch (item.kind) {
    case "tree":
      return drawTree(item);
    case "venn":
      return drawVenn(item);
    case "urn":
      return drawUrn(item);
    case "dice":
      return drawDice(item);
    case "coin":
      return drawCoin(item);
    case "spinner":
      return drawSpinner(item);
    case "cards":
      return drawCards(item);
  }
}
