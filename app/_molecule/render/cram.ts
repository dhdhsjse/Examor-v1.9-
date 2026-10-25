// Cram representation: the structural drawing in perspective around the chosen centres (see cramLayout.ts).
import type { MoleculeBlockData, MoleculeRenderer, RenderContext, RenderResult } from "../model";
import { cramLayout, defaultCramCenters } from "./cramLayout";
import { pairsSvg } from "./lewis";
import { atomsSvg, bondsSvg, buildScene, frame, type Bounds } from "./structural";
import { esc, num, svgDoc, textRuns } from "./svg";

// The centres being drawn: the teacher's choice, or the first tetrahedral / pyramidal atom.
export const cramCenters = (b: MoleculeBlockData): string[] => b.geometryCenters ?? defaultCramCenters(b.graph);

const MESSAGE: Record<"ring" | "pieces", string> = {
  ring: "Cram representation of rings: not supported yet",
  pieces: "Not a single molecule",
};

export const cram: MoleculeRenderer = {
  id: "cram",
  render(block: MoleculeBlockData, ctx?: RenderContext): RenderResult {
    const centers = cramCenters(block);
    const layout = cramLayout(block.graph, centers);
    if (typeof layout === "string") {
      // Chemistry correctness beats cosmetics: say so instead of drawing something wrong.
      return svgDoc(textRuns([{ text: MESSAGE[layout], mode: "normal" }], 8, 26, 14, { anchor: "start", fill: "#a00" }), 420, 40, layout);
    }
    const scene = buildScene(block, ctx, "sup", { positions: layout.pos, stereo: layout.stereo });
    const extra: Bounds[] = [];
    const parts = [...bondsSvg(scene), ...atomsSvg(scene)];
    if (block.options.cramLonePairs || block.options.showLonePairs) parts.push(...pairsSvg(scene, extra));
    if (scene.ghost) {
      // Editor only: a ring around each Cram centre.
      for (const id of centers) {
        const p = scene.placed.get(id);
        if (!p) continue;
        const r = Math.max(p.w, p.h) * 0.9;
        parts.push(`<circle data-cram-center="${esc(id)}" cx="${num(p.x)}" cy="${num(p.y)}" r="${num(r)}" fill="none" stroke="#4f46e5" stroke-width="1.2" stroke-dasharray="3 3" pointer-events="none"/>`);
        extra.push({ minX: p.x - r, maxX: p.x + r, minY: p.y - r, maxY: p.y + r });
      }
    }
    return frame(scene, parts, extra, 26);
  },
};
