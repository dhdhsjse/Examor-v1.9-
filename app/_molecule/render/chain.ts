// The skeleton of an acyclic molecule: its heavy-atom main chain, and the "decorations" (a terminal =O)
// that hang off it. Shared by the semi-structural text and the school layout so both read the molecule
// in the same order (CH3 first, carbonyl O as a branch).
import { hasRings, neighbors } from "../chem";
import type { MolGraph } from "../model";

export interface Skeleton {
  chain: string[]; // backbone atom ids, in reading order
  decor: Set<string>; // terminal =O / =S / =N atoms left out of the backbone
}

export const heavyNeighbors = (g: MolGraph, id: string) => neighbors(g, id).filter((n) => n.atom.element !== "H");
export const hydrogens = (g: MolGraph, id: string) => neighbors(g, id).filter((n) => n.atom.element === "H");

// A hetero atom doubly bonded to a single other heavy atom that has more neighbours (the O of C=O, not of O=O).
function isDecoration(g: MolGraph, id: string): boolean {
  const atom = g.atoms.find((a) => a.id === id);
  if (!atom || !["O", "S", "N"].includes(atom.element)) return false;
  const heavy = heavyNeighbors(g, id);
  if (heavy.length !== 1 || heavy[0].bond.order !== 2) return false;
  const host = heavy[0].atom;
  return host.element === "C" || heavyNeighbors(g, host.id).length >= 2;
}

// An ester oxygen: not terminal, two carbons around it.
const isEsterLink = (g: MolGraph, id: string, decor: Set<string>) => {
  const a = g.atoms.find((x) => x.id === id);
  const hn = heavyNeighbors(g, id).filter((n) => !decor.has(n.atom.id));
  return a?.element === "O" && hn.length === 2 && hn.every((n) => n.atom.element === "C");
};
const hasCarbonylO = (g: MolGraph, id: string, decor: Set<string>) =>
  heavyNeighbors(g, id).some((n) => decor.has(n.atom.id) && n.atom.element === "O");

// null when the molecule has rings or is in several pieces: those are not laid out as chains.
export function skeleton(g: MolGraph): Skeleton | null {
  const all = g.atoms.filter((a) => a.element !== "H");
  const heavy = all.length ? all : g.atoms; // H2
  if (!heavy.length || hasRings(g)) return null;
  const heavyIds = new Set(heavy.map((a) => a.id));
  const decor = new Set(heavy.filter((a) => isDecoration(g, a.id)).map((a) => a.id));
  const backbone = heavy.filter((a) => !decor.has(a.id));
  if (!backbone.length) return null;
  const inBackbone = new Set(backbone.map((a) => a.id));
  const adj = (id: string) => neighbors(g, id).filter((n) => inBackbone.has(n.atom.id) && heavyIds.has(n.atom.id));

  // Every path of the backbone tree: a BFS from each atom (the path between two atoms of a tree is unique).
  type P = { ids: string[]; orders: number };
  let best: P | null = null;
  const carbons = (p: P) => p.ids.filter((i) => g.atoms.find((a) => a.id === i)?.element === "C").length;
  const better = (p: P, q: P | null) =>
    !q || p.ids.length > q.ids.length || (p.ids.length === q.ids.length && (carbons(p) > carbons(q) || (carbons(p) === carbons(q) && p.orders < q.orders)));
  let reached = 0;
  for (const start of backbone) {
    const seen = new Map<string, P>([[start.id, { ids: [start.id], orders: 0 }]]);
    const queue = [start.id];
    for (let q = 0; q < queue.length; q++) {
      const cur = seen.get(queue[q])!;
      for (const n of adj(queue[q])) {
        if (seen.has(n.atom.id)) continue;
        seen.set(n.atom.id, { ids: [...cur.ids, n.atom.id], orders: cur.orders + n.bond.order });
        queue.push(n.atom.id);
      }
    }
    if (start === backbone[0]) reached = seen.size;
    for (const p of seen.values()) if (better(p, best)) best = p;
  }
  if (!best || reached !== backbone.length) return null; // several pieces

  let chain = best.ids;
  const hOf = (id: string) => hydrogens(g, id).length;
  const isC = (id: string) => g.atoms.find((a) => a.id === id)?.element === "C";
  // Read the chain from the end that carries more H (CH3 first); on a tie start from carbon.
  const first = chain[0];
  const last = chain[chain.length - 1];
  if (hOf(last) > hOf(first) || (hOf(last) === hOf(first) && isC(last) && !isC(first))) chain = [...chain].reverse();
  // An ester is written acid first: CH3–COO–CH2–CH3, HCOO–CH3.
  for (let i = 1; i < chain.length - 1; i++) {
    if (!isEsterLink(g, chain[i], decor)) continue;
    const before = hasCarbonylO(g, chain[i - 1], decor);
    const after = hasCarbonylO(g, chain[i + 1], decor);
    if (after && !before) chain = [...chain].reverse();
    break;
  }
  return { chain, decor };
}
