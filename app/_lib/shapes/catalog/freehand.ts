// A stroke of the pencil (the Draw tool of the Studios). It is not in the gallery: its points are kept in `adj`, x and y pairs as
// fractions of the box, so it moves, stretches, turns and flips like any other shape, and the page draws it the same way.
import { polyline, type Pt } from "../path";
import type { ShapeDef } from "../types";

export const FREEHAND_ID = "freehand";

export const FREEHAND: ShapeDef = {
  id: FREEHAND_ID,
  label: "Freehand",
  category: "Lines",
  freehand: true,
  parts: (w, h, a) => {
    const pts: Pt[] = [];
    for (let i = 0; i + 1 < a.length; i += 2) pts.push([a[i] * w, a[i + 1] * h]);
    return pts.length > 1 ? [{ d: polyline(pts), paint: "line" }] : [];
  },
};
