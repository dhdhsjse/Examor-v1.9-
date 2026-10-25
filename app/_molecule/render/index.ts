// Renderer registry: one file per renderer, one line to register it. A renderer is a pure function
// from block data to SVG.
import type { MoleculeBlockData, MoleculeRenderer, Representation, RenderContext, RenderResult } from "../model";
import { cram } from "./cram";
import { lewis } from "./lewis";
import { molecular } from "./molecular";
import { semiStructural } from "./semiStructural";
import { skeletal } from "./skeletal";
import { structural } from "./structural";
import { svgDoc, textRuns } from "./svg";

export const renderers: MoleculeRenderer[] = [molecular, semiStructural, structural, skeletal, lewis, cram];

export const availableRepresentations = (): Representation[] => renderers.map((r) => r.id);

export function renderMolecule(block: MoleculeBlockData, ctx?: RenderContext): RenderResult {
  const r = renderers.find((x) => x.id === block.representation);
  if (!r) return svgDoc(textRuns([{ text: `"${block.representation}" is not available yet`, mode: "normal" }], 8, 24, 14, { anchor: "start", fill: "#a00" }), 360, 36, "not-available");
  try {
    return r.render(block, ctx);
  } catch (e) {
    // Never a wrong drawing: say what failed.
    return svgDoc(textRuns([{ text: (e as Error).message, mode: "normal" }], 8, 24, 14, { anchor: "start", fill: "#a00" }), 420, 36, "render-error");
  }
}
