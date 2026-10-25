import { CONTENT_WIDTH } from "@/app/_lib/a4";
import type { BlockPreset } from "@/app/_lib/blocks";
import { svgUrl } from "@/app/_lib/library";
import { renderMolecule } from "@/app/_molecule/render";
import type { MoleculeBlockData } from "@/app/_molecule/model";

// The picture of a molecule block (its `src`), with the shape the page needs.
export function moleculeImage(molecule: MoleculeBlockData) {
  const r = renderMolecule(molecule);
  const width = Math.min(CONTENT_WIDTH, Math.max(60, r.width));
  return { src: svgUrl(r.svg), ratio: r.width / r.height, width, height: (width * r.height) / r.width, warning: r.warning };
}

// A new image block that carries its molecule, so the Studio can reopen it without a name lookup.
export function moleculePreset(molecule: MoleculeBlockData): BlockPreset {
  const { src, ratio, width, height } = moleculeImage(molecule);
  return { src, ratio, width, height, molecule };
}
