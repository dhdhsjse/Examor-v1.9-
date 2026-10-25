// The "school" layout of a developed formula: the main chain runs left to right, everything else hangs
// off it at 90°, as in the exercises:
//
//         H   O
//         |   ‖
//     H – C – C – O – H
//         |
//         H
//
// Positions are on an integer grid (one step = one bond). Returns null when the molecule cannot be placed
// without two atoms on one spot (rings, crowded branches): the caller then uses the engine's layout.
import type { MolGraph } from "../model";
import { heavyNeighbors, skeleton } from "./chain";
import { neighbors } from "../chem";

type Dir = { x: number; y: number };
const N: Dir = { x: 0, y: -1 };
const S: Dir = { x: 0, y: 1 };
const W: Dir = { x: -1, y: 0 };
const E: Dir = { x: 1, y: 0 };

class Crowded extends Error {}

export function schoolLayout(g: MolGraph): Map<string, { x: number; y: number }> | null {
  const sk = skeleton(g);
  if (!sk) return null;
  const { chain, decor } = sk;
  const pos = new Map<string, { x: number; y: number }>();
  const occupied = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;
  const put = (id: string, x: number, y: number) => {
    if (occupied.has(key(x, y))) throw new Crowded();
    occupied.add(key(x, y));
    pos.set(id, { x, y });
  };
  const free = (x: number, y: number) => !occupied.has(key(x, y));

  const onChain = new Set(chain);
  const sideHeavy = (id: string) => heavyNeighbors(g, id).filter((n) => !onChain.has(n.atom.id) && !decor.has(n.atom.id));
  const subtreeSize = (id: string, parent: string): number =>
    1 + neighbors(g, id).filter((n) => n.atom.id !== parent).reduce((s, n) => s + subtreeSize(n.atom.id, id), 0);

  try {
    // Chain atoms; the gap widens next to an atom with a side group so their hydrogens do not collide.
    let x = 0;
    chain.forEach((id, i) => {
      if (i > 0) x += sideHeavy(id).length || sideHeavy(chain[i - 1]).length ? 2 : 1;
      put(id, x, 0);
    });

    // Place `ids` around (px, py) taking the first free direction of `prefs` for each.
    const around = (px: number, py: number, ids: string[], prefs: Dir[]) => {
      const left = [...prefs];
      for (const id of ids) {
        const at = left.findIndex((d) => free(px + d.x, py + d.y));
        if (at < 0) throw new Crowded();
        const [d] = left.splice(at, 1);
        put(id, px + d.x, py + d.y);
      }
    };

    // A side group goes straight out; its own neighbours continue straight and sideways.
    const growSide = (id: string, d: Dir) => {
      const p = pos.get(id)!;
      const rest = neighbors(g, id).filter((n) => !pos.has(n.atom.id));
      const heavy = rest.filter((n) => n.atom.element !== "H").sort((a, b) => subtreeSize(b.atom.id, id) - subtreeSize(a.atom.id, id));
      const hs = rest.filter((n) => n.atom.element === "H");
      const side = [{ x: d.y, y: d.x }, { x: -d.y, y: -d.x }];
      around(p.x, p.y, heavy.map((n) => n.atom.id), [d, ...side]);
      const remaining = [d, ...side].filter((c) => free(p.x + c.x, p.y + c.y));
      const order = hs.length === 1 ? remaining : [...remaining.filter((c) => c !== d), ...remaining.filter((c) => c === d)];
      around(p.x, p.y, hs.map((n) => n.atom.id), order);
      for (const n of heavy) growSide(n.atom.id, dirOf(p, pos.get(n.atom.id)!));
    };
    const dirOf = (a: { x: number; y: number }, b: { x: number; y: number }): Dir => ({ x: b.x - a.x, y: b.y - a.y });

    chain.forEach((id, i) => {
      const p = pos.get(id)!;
      const single = chain.length === 1;
      const root = i === 0;
      const end = i === chain.length - 1;
      const rest = neighbors(g, id).filter((n) => !pos.has(n.atom.id));
      const decors = rest.filter((n) => decor.has(n.atom.id)).map((n) => n.atom.id);
      const sides = rest.filter((n) => n.atom.element !== "H" && !decor.has(n.atom.id)).map((n) => n.atom.id);
      const hs = rest.filter((n) => n.atom.element === "H").map((n) => n.atom.id);
      const lateral = single ? [W, E, N, S] : root ? [N, S, W] : end ? [N, S, E] : [N, S];
      // =O and side groups first, then the hydrogens in what is left.
      around(p.x, p.y, [...decors, ...sides], lateral);
      const left = lateral.filter((d) => free(p.x + d.x, p.y + d.y));
      const hOrder = single ? [W, E, S, N].filter((d) => left.includes(d)) : hs.length === 1 ? (end ? [E, N, S] : root ? [W, N, S] : left).filter((d) => left.includes(d)) : left;
      around(p.x, p.y, hs, hOrder);
      for (const sid of sides) growSide(sid, dirOf(p, pos.get(sid)!));
      for (const did of decors) if (neighbors(g, did).some((n) => !pos.has(n.atom.id))) growSide(did, dirOf(p, pos.get(did)!));
    });
  } catch (e) {
    if (e instanceof Crowded) return null;
    throw e;
  }
  return g.atoms.every((a) => pos.has(a.id)) ? pos : null;
}
