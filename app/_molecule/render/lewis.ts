// Lewis structure: the structural drawing plus the lone pairs (dots or lines), and formal charges in circles.
// Each lone pair is its own element (data-lp-id="atomId:index") so it can be selected and hidden alone.
import { neighbors } from "../chem";
import type { MoleculeBlockData, MoleculeRenderer, RenderContext, RenderResult } from "../model";
import { lonePairAngles } from "./lonePairs";
import { atomsSvg, bondsSvg, buildScene, edgeDistance, frame, type Bounds, type Placed, type Scene } from "./structural";
import { esc, FONT, num } from "./svg";

const PAD = 24;

export const lonePairId = (atomId: string, index: number) => `${atomId}:${index}`;

// Is pair `index` of the atom drawn? (Student version only: the answer key shows every pair.)
export function lonePairShown(block: MoleculeBlockData, atomId: string, index: number): boolean {
  if (block.exerciseMode === "answer") return true;
  return block.edits.lonePairs[atomId]?.[index] !== false;
}

export function pairsSvg(scene: Scene, extra: Bounds[]): string[] {
  const { block, pos, L, placed } = scene;
  const dots = block.options.lonePairStyle === "dots";
  const color = block.options.monochrome ? "#000" : "#333";
  const out: string[] = [];
  for (const p of placed.values()) {
    if (p.vis !== "shown" || !p.atom.lonePairs) continue; // a hidden or blank atom takes its lone pairs with it
    const bondAngles = neighbors(block.graph, p.atom.id).map((n) => {
      const q = pos.get(n.atom.id)!;
      return (Math.atan2(q.y * L - p.y, q.x * L - p.x) * 180) / Math.PI;
    });
    lonePairAngles(bondAngles, p.atom.lonePairs).forEach((deg, i) => {
      const shown = lonePairShown(scene.view, p.atom.id, i);
      if (!shown && !scene.ghost) return;
      out.push(onePair(p, deg, i, dots, color, !shown));
      const r = edgeDistance(p, Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)) + 6;
      const cx = p.x + Math.cos((deg * Math.PI) / 180) * r;
      const cy = p.y + Math.sin((deg * Math.PI) / 180) * r;
      extra.push({ minX: cx - 6, maxX: cx + 6, minY: cy - 6, maxY: cy + 6 });
    });
  }
  return out;
}

function onePair(p: Placed, deg: number, index: number, dots: boolean, color: string, faded: boolean): string {
  const rad = (deg * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const r = edgeDistance(p, ux, uy) + 6;
  const cx = p.x + ux * r;
  const cy = p.y + uy * r;
  const tx = -uy; // along the pair (perpendicular to the direction away from the atom)
  const ty = ux;
  const mark = dots
    ? `<circle class="lp" cx="${num(cx + tx * 2.7)}" cy="${num(cy + ty * 2.7)}" r="1.9" fill="${color}"/><circle class="lp" cx="${num(cx - tx * 2.7)}" cy="${num(cy - ty * 2.7)}" r="1.9" fill="${color}"/>`
    : `<line class="lp" x1="${num(cx + tx * 4.5)}" y1="${num(cy + ty * 4.5)}" x2="${num(cx - tx * 4.5)}" y2="${num(cy - ty * 4.5)}" stroke="${color}" stroke-width="1.7" stroke-linecap="round"/>`;
  const hit = `<circle cx="${num(cx)}" cy="${num(cy)}" r="7" fill="transparent"/>`;
  const fade = faded ? ' opacity="0.3" data-vis="hidden"' : "";
  return `<g data-lp-id="${esc(lonePairId(p.atom.id, index))}"${fade}>${hit}${mark}</g>`;
}

// Formal charge in a circle at the upper right of the atom.
function chargesSvg(scene: Scene, extra: Bounds[]): string[] {
  const out: string[] = [];
  for (const p of scene.placed.values()) {
    if (p.vis !== "shown" || !p.atom.charge) continue;
    const c = p.atom.charge;
    const sign = c > 0 ? "+" : "−";
    const text = (Math.abs(c) > 1 ? String(Math.abs(c)) : "") + sign;
    const r = text.length > 1 ? 7 : 5.6;
    const cx = p.x + p.w / 2 + 5;
    const cy = p.y - p.h / 2 - 1;
    extra.push({ minX: cx - r, maxX: cx + r, minY: cy - r, maxY: cy + r });
    out.push(
      `<g data-charge-of="${esc(p.atom.id)}"><circle cx="${num(cx)}" cy="${num(cy)}" r="${r}" fill="#fff" stroke="#000" stroke-width="1"/>` +
        `<text x="${num(cx)}" y="${num(cy + 3.2)}" font-family="${FONT}" font-size="9" text-anchor="middle" fill="#000">${text}</text></g>`,
    );
  }
  return out;
}

export const lewis: MoleculeRenderer = {
  id: "lewis",
  render(block: MoleculeBlockData, ctx?: RenderContext): RenderResult {
    const scene = buildScene(block, ctx, "circle");
    const extra: Bounds[] = [];
    const parts = [...bondsSvg(scene), ...atomsSvg(scene), ...pairsSvg(scene, extra), ...chargesSvg(scene, extra)];
    return frame(scene, parts, extra, PAD);
  },
};
