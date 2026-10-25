// Molecular formula: C₂H₄O₂, with real subscripts.
import { displayFormula } from "../chem";
import type { MoleculeBlockData, MoleculeRenderer, RenderResult } from "../model";
import { runsFromFormula, runsWidth, svgDoc, textRuns } from "./svg";

export const molecular: MoleculeRenderer = {
  id: "molecular",
  render(block: MoleculeBlockData): RenderResult {
    const fs = block.options.fontSize * 1.5;
    const runs = runsFromFormula(displayFormula(block.graph));
    const w = runsWidth(runs, fs) + 24;
    return svgDoc(textRuns(runs, w / 2, fs + 10, fs), w, fs * 1.9);
  },
};
