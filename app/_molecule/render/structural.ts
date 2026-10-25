// Structural (developed) formula: every atom labelled, every hydrogen explicit, every bond a line.
// The scene (positions, labels, bonds) is also what the Lewis renderer draws lone pairs on.
import { neighbors, perceiveRings } from "../chem";
import type { BondStyle, MolAtom, MoleculeBlockData, MoleculeRenderer, RenderContext, RenderResult } from "../model";
import { atomLabel, atomVis, blankAsBox, bondOrder, bondVis } from "./blank";
import { pairsSvg } from "./lewis";
import { schoolLayout } from "./schoolLayout";
import { skeletalLabel } from "./skeletalLabels";
import { esc, num, runsFromFormula, runsWidth, svgDoc, textRuns, type Run } from "./svg";

const STROKE = 1.7;

const COLORS: Record<string, string> = { C: "#222", H: "#555", O: "#d11", N: "#22c", S: "#b80", Cl: "#0a7", F: "#0a7", Br: "#a20", I: "#74a", P: "#c60" };

const chargeText = (c: number) => (Math.abs(c) > 1 ? String(Math.abs(c)) : "") + (c > 0 ? "+" : "–");

function labelRuns(label: string, charge: number, style: "sup" | "circle"): Run[] {
  const runs = runsFromFormula(label);
  if (charge && style === "sup") runs.push({ text: chargeText(charge), mode: "sup" });
  return runs;
}

// Is this hydrogen left out of the drawing (showHydrogens option, not a student-version edit)?
function leftOut(block: MoleculeBlockData, atom: MolAtom): boolean {
  if (atom.element !== "H") return false;
  const mode = block.options.showHydrogens;
  if (mode === "all") return false;
  if (mode === "none") return true;
  const host = neighbors(block.graph, atom.id)[0]?.atom;
  if (!host || host.element !== "C") return false;
  return neighbors(block.graph, host.id).filter((n) => n.atom.element !== "H").length > 1;
}

export interface Placed {
  atom: MolAtom;
  x: number; // px
  y: number;
  w: number; // label size, px
  h: number;
  runs: Run[];
  vis: "shown" | "blank" | "hidden";
  faded?: "hidden" | "blank" | "label"; // editor view: drawn, but the student version would not show it as is
  // Skeletal formula only:
  implicit?: boolean; // a carbon vertex: nothing is written, the bonds meet at its centre (it is still a click target)
  textAt?: { dx: number; anchor: "start" | "middle" | "end" }; // a label with hydrogens (OH, H2N): where its text starts
  left?: number; // how far the drawn label reaches left / right of the centre (default w / 2)
  right?: number;
}

export interface Scene {
  block: MoleculeBlockData;
  view: MoleculeBlockData; // the block as the drawing sees it: in the editor view always the student version, so its changes show faded
  ghost: boolean;
  L: number;
  fs: number;
  fellBack: boolean;
  pos: Map<string, { x: number; y: number }>; // bond units
  placed: Map<string, Placed>;
  color: (element: string) => string;
  stereo: Map<string, Stereo>; // Cram: bonds drawn as a wedge (towards the viewer) or a hash (away)
  ownStereo: boolean; // no layout of its own (Cram) decided the stereo bonds: those of the graph are drawn
  ringCenter: Map<string, { x: number; y: number }>; // skeletal: the centre (px) of a ring, by the ids of its bonds: double bonds get an inner line
}

// A wedge or hash bond: narrow at the atom `from` (the Cram centre), wide at the other end.
export interface Stereo {
  type: "wedge" | "dash";
  from: string;
}

type Pos = Map<string, { x: number; y: number }>;

// What the drawing needs beyond the engine's layout: its own positions (Cram) and the stereo bonds.
export interface SceneInput {
  positions?: Pos; // bond units, final (the teacher's moves do not apply on top)
  stereo?: Map<string, Stereo>;
  skeletal?: boolean; // line-angle formula: bare carbon vertices, hydrogens only inside hetero labels
}

export function layoutPositions(block: MoleculeBlockData): { pos: Map<string, { x: number; y: number }>; fellBack: boolean } {
  const g = block.graph;
  const school = block.options.layout === "school" ? schoolLayout(g) : null;
  const pos = new Map<string, { x: number; y: number }>();
  for (const a of g.atoms) {
    const base = school?.get(a.id) ?? { x: a.x, y: a.y };
    const edit = block.edits.atoms[a.id];
    pos.set(a.id, { x: edit?.x ?? base.x, y: edit?.y ?? base.y });
  }
  return { pos, fellBack: block.options.layout === "school" && !school };
}

export function buildScene(block: MoleculeBlockData, ctx: RenderContext = {}, charge: "sup" | "circle" = "sup", input: SceneInput = {}): Scene {
  const { graph: g, options: o } = block;
  const ghost = !!ctx.ghost;
  const view: MoleculeBlockData = ghost ? { ...block, exerciseMode: "student" } : block;
  let pos: Pos;
  let fellBack = false;
  if (input.positions) {
    // A drawing with its own layout (Cram) keeps it: moves made on the other drawings do not apply.
    pos = new Map(g.atoms.map((a) => [a.id, input.positions!.get(a.id) ?? { x: a.x, y: a.y }]));
  } else ({ pos, fellBack } = layoutPositions(block));
  const L = o.bondLength;
  const fs = o.fontSize;
  const placed = new Map<string, Placed>();
  for (const a of g.atoms) {
    const sk = input.skeletal ? skeletalLabel(g, a, pos) : null;
    if (input.skeletal ? sk === null : leftOut(block, a)) continue;
    let vis = atomVis(view, a);
    let label = atomLabel(view, a);
    let faded: Placed["faded"];
    if (ghost) {
      // The editor shows everything: what the student version changes is drawn faded.
      if (vis !== "shown") faded = vis;
      else if (label !== a.element) faded = "label";
      vis = "shown";
      label = a.element;
    }
    const p = pos.get(a.id)!;
    const box = vis === "blank";
    const hidden = vis === "blank" && !blankAsBox(block) ? "hidden" : vis;
    const base = { atom: a, x: p.x * L, y: p.y * L, vis: hidden, faded } as const;

    if (sk) {
      // A teacher's own text on an atom replaces the whole label; otherwise the label is the symbol plus its hydrogens.
      const own = label !== a.element;
      if (sk.implicit && !own && !box) {
        placed.set(a.id, { ...base, w: 0, h: 0, runs: [], implicit: true });
        continue;
      }
      const sym = own ? runsFromFormula(label) : runsFromFormula(sk.symbol);
      const hRuns: Run[] = !own && sk.hCount ? runsFromFormula("H" + (sk.hCount > 1 ? sk.hCount : "")) : [];
      const tail: Run[] = a.charge ? [{ text: chargeText(a.charge), mode: "sup" }] : [];
      const symW = Math.max(runsWidth(sym, fs), fs * 0.6);
      const hW = runsWidth(hRuns, fs);
      const tailW = runsWidth(tail, fs);
      const runs = sk.side > 0 ? [...sym, ...hRuns, ...tail] : [...hRuns, ...sym, ...tail];
      placed.set(a.id, {
        ...base,
        w: box ? fs * 1.3 : symW,
        h: box ? fs * 1.3 : fs * 1.05,
        runs: box ? [] : runs,
        // The symbol stays on the vertex; the hydrogens (and the charge) hang off one side of it.
        textAt: hRuns.length || tail.length ? (sk.side > 0 ? { dx: -symW / 2, anchor: "start" } : { dx: symW / 2 + tailW, anchor: "end" }) : undefined,
        left: box ? undefined : symW / 2 + (sk.side < 0 ? hW : 0),
        right: box ? undefined : symW / 2 + (sk.side > 0 ? hW : 0) + tailW,
      });
      continue;
    }

    const runs = labelRuns(label, a.charge, charge);
    placed.set(a.id, { ...base, w: box ? fs * 1.3 : Math.max(runsWidth(runs, fs), fs * 0.6), h: box ? fs * 1.3 : fs * 1.05, runs });
  }

  // Skeletal: where each ring is, so that a double bond in a ring can draw its second line on the inside.
  const ringCenter = new Map<string, { x: number; y: number }>();
  if (input.skeletal) {
    for (const ring of perceiveRings(g)) {
      const pts = ring.map((id) => placed.get(id)).filter((p): p is Placed => !!p);
      if (pts.length !== ring.length) continue;
      const c = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
      const inRing = new Set(ring);
      for (const b of g.bonds) if (inRing.has(b.a) && inRing.has(b.b) && !ringCenter.has(b.id)) ringCenter.set(b.id, c);
    }
  }
  return { block, view, ghost, L, fs, fellBack, pos, placed, color: (el) => (o.monochrome ? "#000" : (COLORS[el] ?? "#000")), stereo: input.stereo ?? new Map(), ownStereo: !input.stereo, ringCenter };
}

// Distance from an atom's centre to the edge of its label box, along a direction (dx, dy unit).
export function edgeDistance(p: Pick<Placed, "w" | "h">, dx: number, dy: number): number {
  const hw = p.w / 2 + 3;
  const hh = p.h / 2 + 1;
  return Math.min(Math.abs(dx) > 1e-6 ? hw / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? hh / Math.abs(dy) : Infinity);
}

const gap = (p: Placed, dx: number, dy: number) => (p.vis === "hidden" || p.implicit ? 0 : edgeDistance(p, dx, dy));

const WEDGE_WIDTH = 8; // px, at the wide end

// A solid wedge (towards the viewer) or a hash (away) from distance s to e along the unit vector (ux, uy) that
// starts at `A`. Narrow end at the start when `narrowAtStart`, else at the end.
function wedge(A: { x: number; y: number }, ux: number, uy: number, s: number, e: number, type: "wedge" | "dash", narrowAtStart: boolean): string {
  const px = -uy;
  const py = ux;
  const at = (t: number, w: number, side: number) => `${num(A.x + ux * t + px * w * side)},${num(A.y + uy * t + py * w * side)}`;
  const half = (t: number) => {
    const f = (t - s) / (e - s); // 0 at the start, 1 at the end
    return (WEDGE_WIDTH / 2) * (narrowAtStart ? f : 1 - f) + 0.4;
  };
  if (type === "wedge") return `<polygon points="${at(s, half(s), 1)} ${at(e, half(e), 1)} ${at(e, half(e), -1)} ${at(s, half(s), -1)}" fill="#000" stroke="#000" stroke-width="0.6" stroke-linejoin="round" data-stereo="wedge"/>`;
  const n = Math.max(4, Math.round((e - s) / 5));
  let out = "";
  for (let i = 0; i <= n; i++) {
    const t = s + ((e - s) * i) / n;
    const w = half(t);
    out += `<line x1="${num(A.x + ux * t + px * w)}" y1="${num(A.y + uy * t + py * w)}" x2="${num(A.x + ux * t - px * w)}" y2="${num(A.y + uy * t - py * w)}" stroke-width="1.4"/>`;
  }
  return `<g data-stereo="dash">${out}</g>`;
}

export function bondsSvg(scene: Scene): string[] {
  const { block, L, placed, ghost } = scene;
  const o = block.options;
  const out: string[] = [];
  for (const b of block.graph.bonds) {
    const A = placed.get(b.a);
    const B = placed.get(b.b);
    if (!A || !B) continue;
    const bv = bondVis(scene.view, b);
    if (bv === "hidden" && !ghost) continue;
    const len = Math.hypot(B.x - A.x, B.y - A.y);
    if (len < 1e-6) continue;
    const ux = (B.x - A.x) / len;
    const uy = (B.y - A.y) / len;
    let s = gap(A, ux, uy);
    let e = len - gap(B, -ux, -uy);
    // A hidden atom leaves a stub: the bond stops short of where the atom was.
    const stub = Math.max(0.2, o.stubLength) * L;
    if (A.vis === "hidden" && B.vis === "hidden") continue;
    if (A.vis === "hidden") s = Math.max(0, e - stub);
    if (B.vis === "hidden") e = Math.min(s + stub, len);
    if (e - s < 2) continue;
    const order = bondOrder(scene.view, b);
    const offsets = order === 1 ? [0] : order === 2 ? [-3.2, 3.2] : [-4.6, 0, 4.6];
    const px = -uy;
    const py = ux;
    const dash = bv === "blank" && !ghost ? ' stroke-dasharray="5 4"' : bv !== "shown" && ghost ? ' stroke-dasharray="3 3" opacity="0.3" data-vis="' + bv + '"' : "";
    const own: Stereo | undefined = scene.ownStereo && (b.stereo === "wedge" || b.stereo === "dash") ? { type: b.stereo, from: b.a } : undefined;
    const st = scene.stereo.get(b.id) ?? own;
    const ring = scene.ringCenter.get(b.id);
    const line = (d: number, from = s, to = e) => `<line x1="${num(A.x + ux * from + px * d)}" y1="${num(A.y + uy * from + py * d)}" x2="${num(A.x + ux * to + px * d)}" y2="${num(A.y + uy * to + py * d)}"/>`;
    let lines: string;
    if (st) lines = wedge(A, ux, uy, s, e, st.type, st.from === b.a);
    else if (b.style) lines = styledBond(b.style, line, A, ux, uy, s, e);
    else if (ring && order === 2) {
      // A double bond in a ring: the bond itself, and a shorter line inside the ring.
      const mx = (A.x + B.x) / 2;
      const my = (A.y + B.y) / 2;
      const side = (ring.x - mx) * px + (ring.y - my) * py >= 0 ? 1 : -1;
      const trim = Math.min(8, (e - s) * 0.18);
      lines = line(0) + line(side * 5, s + trim, e - trim);
    } else lines = offsets.map((d) => line(d)).join("");
    const hit = `<line x1="${num(A.x + ux * s)}" y1="${num(A.y + uy * s)}" x2="${num(A.x + ux * e)}" y2="${num(A.y + uy * e)}" stroke="transparent" stroke-width="12" data-hit="1"/>`;
    out.push(`<g data-bond-id="${esc(b.id)}" stroke="#000" stroke-width="${STROKE}" stroke-linecap="butt"${dash}>${lines}${hit}</g>`);
  }
  return [...out, ...overlayBondsSvg(scene)];
}

// The bonds of the drawing lab's library that are only a way of drawing: the engine's `order` is what they are made of.
function styledBond(style: BondStyle, line: (d: number, from?: number, to?: number) => string, A: { x: number; y: number }, ux: number, uy: number, s: number, e: number): string {
  switch (style) {
    case "quadruple":
      return [-7, -2.4, 2.4, 7].map((d) => line(d)).join("");
    case "aromatic":
      return line(0) + `<g stroke-dasharray="4 3">${line(5)}</g>`;
    case "partial":
      return `<g stroke-dasharray="5 4">${line(0)}</g>`;
    case "shared": // a line with a dot at each end
      return line(0, s + 2.4, e - 2.4) + [s + 2.4, e - 2.4].map((t) => `<circle cx="${num(A.x + ux * t)}" cy="${num(A.y + uy * t)}" r="2.4" fill="#000" stroke="none"/>`).join("");
    case "bold":
      return `<g stroke-width="3.6">${line(0)}</g>`;
    case "wavy": {
      const px = -uy;
      const py = ux;
      const steps = Math.max(4, Math.round((e - s) / 1.5));
      const points = Array.from({ length: steps + 1 }, (_, i) => {
        const t = s + ((e - s) * i) / steps;
        const w = 2.6 * Math.sin(((t - s) / 7) * 2 * Math.PI);
        return `${num(A.x + ux * t + px * w)},${num(A.y + uy * t + py * w)}`;
      });
      return `<polyline points="${points.join(" ")}" fill="none" stroke-linejoin="round"/>`;
    }
    case "wedge-open":
      return wedge(A, ux, uy, s, e, "wedge", true).replace('fill="#000"', 'fill="#fff"');
  }
}

// The bonds that are not covalent (dative, ionic, hydrogen), between the two atoms they join.
function overlayBondsSvg(scene: Scene): string[] {
  const out: string[] = [];
  for (const ob of scene.block.overlayBonds ?? []) {
    const A = scene.placed.get(ob.a);
    const B = scene.placed.get(ob.b);
    if (!A || !B || A.vis === "hidden" || B.vis === "hidden") continue;
    const len = Math.hypot(B.x - A.x, B.y - A.y);
    if (len < 1e-6) continue;
    const ux = (B.x - A.x) / len;
    const uy = (B.y - A.y) / len;
    const s = gap(A, ux, uy) + 2;
    const e = len - gap(B, -ux, -uy) - 2;
    if (e - s < 4) continue;
    const at = (t: number, w = 0) => `${num(A.x + ux * t - uy * w)},${num(A.y + uy * t + ux * w)}`;
    const stroke = (from: number, to: number) => `<line x1="${num(A.x + ux * from)}" y1="${num(A.y + uy * from)}" x2="${num(A.x + ux * to)}" y2="${num(A.y + uy * to)}"/>`;
    let body: string;
    if (ob.style === "dative") {
      const head = Math.min(9, (e - s) * 0.6);
      body = stroke(s, e - head) + `<polygon points="${at(e)} ${at(e - head, 3.6)} ${at(e - head, -3.6)}" fill="#000" stroke-width="0.5"/>`;
    } else if (ob.style === "ionic") body = `<g stroke-width="2" stroke-dasharray="0.1 4" stroke-linecap="round">${stroke(s, e)}</g>`;
    else body = `<g stroke-width="1.2" stroke-dasharray="3 3">${stroke(s, e)}</g>`;
    out.push(`<g data-overlay-bond="${esc(ob.id)}" stroke="#000" stroke-width="${STROKE}" stroke-linecap="butt">${body}</g>`);
  }
  return out;
}

export function atomsSvg(scene: Scene): string[] {
  const { block, placed, fs, color } = scene;
  const o = block.options;
  const out: string[] = [];
  for (const p of placed.values()) {
    if (p.vis === "hidden") continue;
    const id = esc(p.atom.id);
    const fade = p.faded ? ` opacity="0.3" data-vis="${p.faded}"` : "";
    if (p.vis === "blank") {
      const dashed = o.blankStyle === "dashed-box" ? ' stroke-dasharray="4 3"' : "";
      out.push(`<g data-atom-id="${id}"><rect x="${num(p.x - p.w / 2)}" y="${num(p.y - p.h / 2)}" width="${num(p.w)}" height="${num(p.h)}" fill="#fff" stroke="#000" stroke-width="1.3"${dashed}/></g>`);
      continue;
    }
    if (p.implicit) {
      // A bare carbon vertex: nothing to see, but it can be clicked.
      out.push(`<g data-atom-id="${id}"${fade}><circle cx="${num(p.x)}" cy="${num(p.y)}" r="7" fill="transparent"/></g>`);
      continue;
    }
    const left = p.left ?? p.w / 2;
    const right = p.right ?? p.w / 2;
    const hit = `<rect x="${num(p.x - left - 2)}" y="${num(p.y - p.h / 2)}" width="${num(left + right + 4)}" height="${num(p.h)}" fill="transparent"/>`;
    const at = p.textAt;
    const text = p.runs.length ? textRuns(p.runs, p.x + (at?.dx ?? 0), p.y + fs * 0.35, fs, { fill: color(p.atom.element), anchor: at?.anchor ?? "middle" }) : "";
    out.push(`<g data-atom-id="${id}"${fade}>${hit}${text}</g>`);
  }
  return out;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Wraps drawn parts into a document sized to what is drawn (plus `pad`), and adds `extra` bounds (lone pairs…).
export function frame(scene: Scene, parts: string[], extra: Bounds[] = [], pad = 18): RenderResult {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of scene.placed.values()) {
    minX = Math.min(minX, p.x - (p.left ?? p.w / 2));
    maxX = Math.max(maxX, p.x + (p.right ?? p.w / 2));
    minY = Math.min(minY, p.y - p.h / 2);
    maxY = Math.max(maxY, p.y + p.h / 2);
  }
  for (const b of extra) {
    minX = Math.min(minX, b.minX);
    maxX = Math.max(maxX, b.maxX);
    minY = Math.min(minY, b.minY);
    maxY = Math.max(maxY, b.maxY);
  }
  if (!Number.isFinite(minX)) return svgDoc("", 40, 40);
  const body = `<g transform="translate(${num(pad - minX)} ${num(pad - minY)})">${parts.join("")}</g>`;
  return svgDoc(body, maxX - minX + pad * 2, maxY - minY + pad * 2, scene.fellBack ? "school-layout-unavailable" : undefined);
}

export const structural: MoleculeRenderer = {
  id: "structural",
  render(block: MoleculeBlockData, ctx?: RenderContext): RenderResult {
    const scene = buildScene(block, ctx, "sup");
    const extra: Bounds[] = [];
    const parts = [...bondsSvg(scene), ...atomsSvg(scene)];
    if (block.options.showLonePairs) parts.push(...pairsSvg(scene, extra)); // (lewis.ts imports this file too: both only use each other when drawing)
    return frame(scene, parts, extra);
  },
};

