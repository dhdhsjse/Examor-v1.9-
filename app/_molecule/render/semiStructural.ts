// Semi-structural (condensed) formula: CH3–COOH. Pure text first (semiText, easy to test), then SVG.
import { displayFormula, hasRings } from "../chem";
import type { MolAtom, MolGraph, MoleculeBlockData, MoleculeRenderer, RenderResult, SemiStyle } from "../model";
import { heavyNeighbors, hydrogens, skeleton } from "./chain";
import { runsFromFormula, runsWidth, svgDoc, textRuns } from "./svg";

const SEP: Record<number, string> = { 1: "–", 2: "=", 3: "≡" };

export type SemiResult = { text: string } | { warning: "ring" | "pieces" };

export function semiText(g: MolGraph, style: SemiStyle): SemiResult {
  const sk = skeleton(g);
  if (!sk) return { warning: hasRings(g) ? "ring" : "pieces" };
  const atom = (id: string) => g.atoms.find((a) => a.id === id) as MolAtom;
  const grouped = style !== "semi-expanded";
  const sep = (order: number) => (style === "fully-condensed" && order === 1 ? "" : SEP[order]);
  const hCount = (id: string) => hydrogens(g, id).length;

  // Nothing but one heavy atom (CH4, H2O, NH3, HCl) or H2: the molecular formula is the condensed one.
  const decorOf = (id: string) => heavyNeighbors(g, id).filter((n) => sk.decor.has(n.atom.id));
  if (sk.chain.length === 1 && !decorOf(sk.chain[0]).length) return { text: displayFormula(g) };
  // O=C=O, O=S=O
  if (sk.chain.length === 1 && decorOf(sk.chain[0]).length === 2 && !hCount(sk.chain[0])) {
    const [d1, d2] = decorOf(sk.chain[0]);
    return { text: `${d1.atom.element}=${atom(sk.chain[0]).element}=${d2.atom.element}` };
  }

  const depth = (id: string, parent: string | null): number =>
    1 + Math.max(0, ...heavyNeighbors(g, id).filter((n) => n.atom.id !== parent).map((n) => depth(n.atom.id, id)));

  const token = (id: string, isRoot: boolean) => {
    const a = atom(id);
    const h = hCount(id);
    const hs = h ? "H" + (h > 1 ? h : "") : "";
    // A chain that starts on O or N is written H first: HO–CH2…, H2N–CH3
    return isRoot && a.element !== "C" && h ? hs + a.element : a.element + hs;
  };

  // The carbonyl groups the school writes in one piece: COOH, COO, CHO, CO, CONH2.
  type Group = { text: string; skip: Set<string>; cont?: { id: string; parent: string } };
  const group = (id: string, parent: string | null): Group | null => {
    if (!grouped || atom(id).element !== "C") return null;
    const kids = heavyNeighbors(g, id).filter((n) => n.atom.id !== parent);
    const carbonyl = kids.find((n) => sk.decor.has(n.atom.id) && n.atom.element === "O");
    if (!carbonyl) return null;
    const rest = kids.filter((n) => n !== carbonyl);
    const hs = hCount(id);
    const skip = new Set([carbonyl.atom.id]);
    if (rest.length === 0) return parent && hs === 1 ? { text: "CHO", skip } : null;
    if (rest.length !== 1 || rest[0].bond.order !== 1) return null;
    const k = rest[0].atom;
    const kHeavy = heavyNeighbors(g, k.id).filter((n) => n.atom.id !== id);
    if (k.element === "O" && !kHeavy.length && hydrogens(g, k.id).length === 1 && hs <= 1 && !(parent && hs))
      return { text: (hs ? "H" : "") + "COOH", skip: new Set([...skip, k.id]) };
    if (k.element === "O" && kHeavy.length === 1 && hs <= 1 && !(parent && hs))
      return { text: (hs ? "H" : "") + "COO", skip: new Set([...skip, k.id]), cont: { id: kHeavy[0].atom.id, parent: k.id } };
    if (k.element === "N" && !kHeavy.length && hydrogens(g, k.id).length === 2 && !hs)
      return { text: "CONH2", skip: new Set([...skip, k.id]) };
    if (!hs && parent && k.element === "C") return { text: "CO", skip, cont: { id: k.id, parent: id } };
    return null;
  };

  const frag = (id: string, parent: string | null): string => {
    const isRoot = parent === null;
    const grp = group(id, parent);
    if (grp) return grp.cont ? grp.text + sep(1) + frag(grp.cont.id, grp.cont.parent) : grp.text;

    const kids = heavyNeighbors(g, id).filter((n) => n.atom.id !== parent);
    const chainIdx = sk.chain.indexOf(id);
    let next = chainIdx >= 0 && chainIdx < sk.chain.length - 1 ? kids.find((n) => n.atom.id === sk.chain[chainIdx + 1]) : undefined;
    if (!next && chainIdx < 0 && kids.length) {
      // a side group: continue along its deepest part, a double bond last (so (=O) stays in brackets)
      next = [...kids].sort((a, b) => depth(a.atom.id, id) - depth(b.atom.id, id) || b.bond.order - a.bond.order)[kids.length - 1];
    }
    const branches = kids.filter((n) => n !== next).sort((a, b) => depth(a.atom.id, id) - depth(b.atom.id, id) || b.bond.order - a.bond.order);
    let out = token(id, isRoot);
    for (const b of branches) out += `(${b.bond.order === 1 ? "" : SEP[b.bond.order]}${frag(b.atom.id, id)})`;
    if (next) out += sep(next.bond.order) + frag(next.atom.id, id);
    return out;
  };

  return { text: frag(sk.chain[0], null) };
}

export const semiStructural: MoleculeRenderer = {
  id: "semi-structural",
  render(block: MoleculeBlockData): RenderResult {
    const fs = block.options.fontSize * 1.2;
    const res = semiText(block.graph, block.options.semiStyle);
    if ("warning" in res) {
      const msg = res.warning === "ring" ? "Semi-structural formula of rings: not supported yet" : "Not a single molecule";
      return svgDoc(textRuns([{ text: msg, mode: "normal" }], 8, fs + 8, fs * 0.7, { anchor: "start", fill: "#a00" }), 460, fs + 22, res.warning);
    }
    const runs = runsFromFormula(res.text);
    const w = runsWidth(runs, fs) + 24;
    return svgDoc(textRuns(runs, w / 2, fs + 10, fs), w, fs * 1.9);
  },
};
