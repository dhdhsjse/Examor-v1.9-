// The eraser of the floating tool bars (the page's and the Table Studio's): how far around the pointer it rubs, and how it looks.

/** Screen px around the pointer that the eraser rubs */
export const ERASER_RADIUS = 7;

/** The mouse pointer while the eraser is in hand: a small round eraser, rubbing at its centre */
export const ERASER_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="7" fill="rgba(255,255,255,0.7)" stroke="#111827" stroke-width="1.5"/></svg>',
)}") 10 10, crosshair`;

/**
 * The points the eraser rubs on its way from one position of the pointer to the next (a fast hand would jump over a thin stroke
 * otherwise): steps of `radius` along the way, and around each the centre and four points at `radius`.
 */
export function eraserPoints(from: { x: number; y: number }, to: { x: number; y: number }, radius: number): { x: number; y: number }[] {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / radius));
  const out: { x: number; y: number }[] = [];
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    out.push({ x, y }, { x: x + radius, y }, { x: x - radius, y }, { x, y: y + radius }, { x, y: y - radius });
  }
  return out;
}
