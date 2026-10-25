// Skeletal (line-angle) formula: bare carbon vertices, only the other atoms written, their hydrogens in their labels.
// It uses the engine's own 2D coordinates (the zigzag of a depiction), so it also draws rings. Like Cram, it has
// its own layout: moves made on the other drawings do not apply to it.
import type { MoleculeBlockData, MoleculeRenderer, RenderContext, RenderResult } from "../model";
import { pairsSvg } from "./lewis";
import { atomsSvg, bondsSvg, buildScene, frame, type Bounds } from "./structural";

export const skeletal: MoleculeRenderer = {
  id: "skeletal",
  render(block: MoleculeBlockData, ctx?: RenderContext): RenderResult {
    // the depiction made without the hydrogens (a zigzag), else the first one (older documents)
    const positions = new Map(block.graph.atoms.map((a) => [a.id, a.sx !== undefined && a.sy !== undefined ? { x: a.sx, y: a.sy } : { x: a.x, y: a.y }]));
    const scene = buildScene(block, ctx, "sup", { positions, skeletal: true });
    const extra: Bounds[] = [];
    const parts = [...bondsSvg(scene), ...atomsSvg(scene)];
    if (block.options.showLonePairs) parts.push(...pairsSvg(scene, extra));
    return frame(scene, parts, extra, 22);
  },
};
