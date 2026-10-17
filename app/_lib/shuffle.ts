// Mixed-up orders for questions (matching, ordering, word boxes).
// Printed orders must not change on every redraw, so they are either stored in the block
// or drawn from a seed (the block id).

// A small repeatable random generator (mulberry32) started from a text.
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The numbers 0..n-1 mixed up so that, when possible, none stays in its own place.
export function mixedOrder(n: number, random: () => number = Math.random): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  for (let tries = 0; tries < 40; tries++) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (n < 2 || out.every((v, i) => v !== i)) break;
  }
  return out;
}

// A stored order made valid for n items: unknown or repeated entries are dropped, missing ones
// are added at the end (so the teacher's mix stays as it was when an item is added or removed).
export function fixOrder(order: number[] | undefined, n: number): number[] {
  const seen = new Set<number>();
  const kept = (order ?? []).filter((v) => Number.isInteger(v) && v >= 0 && v < n && !seen.has(v) && seen.add(v));
  for (let i = 0; i < n; i++) if (!seen.has(i)) kept.push(i);
  return kept;
}

// The same list mixed up, always the same way for the same seed.
export function shuffled<T>(items: T[], seed: string): T[] {
  return mixedOrder(items.length, seededRandom(seed)).map((i) => items[i]);
}
