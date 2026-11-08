// A magnet that helps make a table's rows (columns) the same size, without forcing it: a line dragged or drawn close to where it would give a
// row the size of another row (or cut a row in two equal halves) goes there, and the rows of the same size are marked. A little further
// away, or with Alt held, the line goes exactly where it is put. Pure functions on sizes in px.

/** A place a line can go, and the stretches (from, to) that are then the same size */
export interface MagnetSpot {
  at: number;
  marks: [number, number][];
}

/** The spot nearest to `pos` within `tol`, or `pos` itself with nothing marked */
export function magnet(pos: number, spots: MagnetSpot[], tol: number): MagnetSpot {
  let best: MagnetSpot | null = null;
  for (const s of spots) if (Math.abs(s.at - pos) <= tol && (!best || Math.abs(s.at - pos) < Math.abs(best.at - pos))) best = s;
  return best ?? { at: pos, marks: [] };
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.75;

/** Where each size starts and ends, one after the other from `start` */
function stretches(sizes: number[], start = 0): [number, number][] {
  let at = start;
  return sizes.map((s) => [at, (at += s)]);
}

/**
 * The spots of a line that cuts the stretch `i` of `sizes` in two: one of the two parts as big as another stretch, or two equal halves. Parts
 * smaller than `min` are left out.
 */
export function cutSpots(sizes: number[], i: number, min: number): MagnetSpot[] {
  const all = stretches(sizes);
  const [a, b] = all[i];
  const out: MagnetSpot[] = [];
  const same = (size: number) => all.filter(([x, y], j) => j !== i && near(y - x, size));
  const add = (at: number, size: number, part: [number, number]) => {
    if (at - a >= min && b - at >= min) out.push({ at, marks: [part, ...same(size)] });
  };
  for (const size of new Set(sizes.filter((_, j) => j !== i))) {
    add(a + size, size, [a, a + size]);
    add(b - size, size, [b - size, b]);
  }
  const mid = (a + b) / 2;
  if (mid - a >= min) out.push({ at: mid, marks: [[a, mid], [mid, b], ...same(mid - a)] });
  return out;
}

/**
 * The spots of the line between stretches `i` and `i + 1` dragged along: either one as big as another stretch, or both the same size. The
 * stretches start at `start` (the position of the first one).
 */
export function lineSpots(sizes: number[], i: number, min: number, start = 0): MagnetSpot[] {
  const all = stretches(sizes, start);
  const a = all[i][0];
  const b = all[i + 1][1];
  const others = all.filter((_, j) => j !== i && j !== i + 1);
  const same = (size: number) => others.filter(([x, y]) => near(y - x, size));
  const out: MagnetSpot[] = [];
  const add = (at: number) => {
    if (at - a < min || b - at < min) return;
    const first = at - a;
    const second = b - at;
    const marks: [number, number][] = [];
    if (same(first).length) marks.push([a, at], ...same(first));
    if (same(second).length) marks.push([at, b], ...same(second));
    if (near(first, second)) marks.push([a, at], [at, b]);
    const once = marks.filter(([x, y], k) => marks.findIndex(([x2, y2]) => near(x, x2) && near(y, y2)) === k);
    if (once.length) out.push({ at, marks: once });
  };
  for (const [x, y] of others) {
    add(a + (y - x));
    add(b - (y - x));
  }
  add((a + b) / 2);
  return out;
}

/** The spots of the far edge of stretch `i` dragged along (only that stretch changes size): as big as another one */
export function edgeSpots(sizes: number[], i: number, min: number, start = 0): MagnetSpot[] {
  const all = stretches(sizes, start);
  const a = all[i][0];
  const out: MagnetSpot[] = [];
  for (const size of new Set(sizes.filter((_, j) => j !== i))) {
    if (size < min) continue;
    out.push({ at: a + size, marks: [[a, a + size], ...all.filter(([x, y], j) => j !== i && near(y - x, size))] });
  }
  return out;
}
