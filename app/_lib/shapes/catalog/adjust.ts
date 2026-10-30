// Builders for the yellow handles of the shapes: most of them move along one line and set one value.
import { clamp, type Pt } from "../path";
import type { Adjust } from "../types";

/** One handle that sets one value: `at` says where it is for a value, `from` the value for a point. */
export function single(def: number, at: (w: number, h: number, v: number) => Pt, from: (x: number, y: number, w: number, h: number) => number, lo = 0, hi = 1): Adjust {
  return {
    defaults: [def],
    handles: (w, h, a) => [at(w, h, a[0] ?? def)],
    drag: (_i, x, y, w, h) => [clamp(from(x, y, w, h), lo, hi)],
  };
}

/** Handles that each set some of the values (the arrows: the thickness of the shaft, the length of the head…). */
export function multi(defaults: readonly number[], handles: Adjust["handles"], drag: Adjust["drag"]): Adjust {
  return { defaults, handles, drag };
}

/** The value `a[i]`, or its default, kept inside [lo, hi]. */
export const val = (a: readonly number[], i: number, def: number, lo: number, hi: number) => clamp(a[i] ?? def, lo, hi);

/** A handle on the top edge that sets a corner size as a fraction of the shorter side (rounded and cut corners). */
export const cornerAdjust = (def: number, max = 0.5): Adjust =>
  single(
    def,
    (w, h, v) => [v * Math.min(w, h), 0],
    (x, _y, w, h) => x / Math.max(Math.min(w, h), 1),
    0,
    max,
  );
