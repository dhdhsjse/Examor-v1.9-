// Small helpers to write SVG path data (the `d` of a <path>, which Konva's Path reads too), for the shapes of the catalog.
// Coordinates are in pixels of the shape's own box (0,0 = its top-left corner). Pure functions.

export type Pt = readonly [number, number];

export const num = (v: number) => String(Math.round(v * 100) / 100);
export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

export const M = (x: number, y: number) => `M${num(x)} ${num(y)}`;
export const L = (x: number, y: number) => `L${num(x)} ${num(y)}`;
export const H = (x: number) => `H${num(x)}`;
export const V = (y: number) => `V${num(y)}`;
export const Q = (cx: number, cy: number, x: number, y: number) => `Q${num(cx)} ${num(cy)} ${num(x)} ${num(y)}`;
export const C = (x1: number, y1: number, x2: number, y2: number, x: number, y: number) => `C${num(x1)} ${num(y1)} ${num(x2)} ${num(y2)} ${num(x)} ${num(y)}`;
/** An elliptical arc to (x, y). `sweep` 1 = clockwise on the screen. */
export const A = (rx: number, ry: number, large: 0 | 1, sweep: 0 | 1, x: number, y: number) => `A${num(rx)} ${num(ry)} 0 ${large} ${sweep} ${num(x)} ${num(y)}`;
export const Z = "Z";

export const polyline = (pts: readonly Pt[]) => pts.map(([x, y], i) => (i ? L(x, y) : M(x, y))).join("");
export const polygon = (pts: readonly Pt[]) => polyline(pts) + Z;

export const rectPath = (x: number, y: number, w: number, h: number) =>
  polygon([
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]);

/** The same rectangle drawn the other way round: inside another path it makes a hole (non-zero fill). */
export const holePath = (x: number, y: number, w: number, h: number) =>
  polygon([
    [x, y],
    [x, y + h],
    [x + w, y + h],
    [x + w, y],
  ]);

export const ellipsePath = (cx: number, cy: number, rx: number, ry: number) => M(cx - rx, cy) + A(rx, ry, 1, 1, cx + rx, cy) + A(rx, ry, 1, 1, cx - rx, cy) + Z;

/** An ellipse drawn counter-clockwise: a hole inside another ellipse. */
export const ellipseHole = (cx: number, cy: number, rx: number, ry: number) => M(cx - rx, cy) + A(rx, ry, 1, 0, cx + rx, cy) + A(rx, ry, 1, 0, cx - rx, cy) + Z;

const RAD = Math.PI / 180;
export const rad = (deg: number) => deg * RAD;
export const deg = (r: number) => r / RAD;

/** The point of an ellipse at an angle in degrees (0 = right, 90 = down, as on the screen). */
export const onEllipse = (cx: number, cy: number, rx: number, ry: number, degrees: number): Pt => [cx + rx * Math.cos(rad(degrees)), cy + ry * Math.sin(rad(degrees))];

/** The angle (degrees, 0–360) at which the point (x, y) lies round the ellipse. */
export const angleOn = (cx: number, cy: number, rx: number, ry: number, x: number, y: number) => {
  const a = deg(Math.atan2((y - cy) / Math.max(ry, 1e-6), (x - cx) / Math.max(rx, 1e-6)));
  return (a + 360) % 360;
};

/** Points moved and scaled so that they fill the box exactly (a pentagon or a star has no point on its bottom row). */
export function fitPoints(pts: readonly Pt[], w: number, h: number): Pt[] {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const sx = w / Math.max(Math.max(...xs) - x0, 1e-6);
  const sy = h / Math.max(Math.max(...ys) - y0, 1e-6);
  return pts.map(([x, y]) => [(x - x0) * sx, (y - y0) * sy] as const);
}

/** A regular polygon with `n` corners, the first one at the top, filling the box. */
export function regularPolygon(n: number, w: number, h: number): Pt[] {
  const pts: Pt[] = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [Math.cos(a), Math.sin(a)] as const;
  });
  return fitPoints(pts, w, h);
}

/** A star with `n` points (the first one at the top): `inner` is the radius of the notches as a fraction of the outer one. */
export function starPoints(n: number, inner: number, w: number, h: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < 2 * n; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / n;
    const r = i % 2 ? inner : 1;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return fitPoints(pts, w, h);
}

/** The path of a rectangle with rounded corners of radius `r` (0 = square). */
export function roundedRect(w: number, h: number, r: number): string {
  const k = clamp(r, 0, Math.min(w, h) / 2);
  if (k <= 0.01) return rectPath(0, 0, w, h);
  return M(k, 0) + H(w - k) + A(k, k, 0, 1, w, k) + V(h - k) + A(k, k, 0, 1, w - k, h) + H(k) + A(k, k, 0, 1, 0, h - k) + V(k) + A(k, k, 0, 1, k, 0) + Z;
}
