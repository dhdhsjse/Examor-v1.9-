// A text box can be turned (written sideways or on a slant). `layout.rotation` is in degrees, clockwise, and the box turns about its top-left
// corner, which stays where `layout.x`, `layout.y` say (it is what the canvas does with a turned group). These work out where the box really is.

const rad = (deg: number) => (deg * Math.PI) / 180;

/** An angle as it is kept: from −180 (excluded) to 180, no more than two decimals; 0 and a missing angle are the same */
export function normalTurn(deg: number | undefined): number {
  if (!deg || !Number.isFinite(deg)) return 0;
  const r = ((Math.round(deg * 100) / 100) % 360 + 360) % 360;
  return Math.round((r > 180 ? r - 360 : r) * 100) / 100;
}

/** Where the middle of a `w` × `h` box is, whose corner is at (x, y) and that is turned by `rot` */
export function turnedCentre(x: number, y: number, w: number, h: number, rot: number): [number, number] {
  const c = Math.cos(rad(rot));
  const s = Math.sin(rad(rot));
  return [x + (w / 2) * c - (h / 2) * s, y + (w / 2) * s + (h / 2) * c];
}

/** The corner to give a `w` × `h` box so that, turned by `rot`, its middle is at (cx, cy) */
export function cornerForCentre(cx: number, cy: number, w: number, h: number, rot: number): [number, number] {
  const c = Math.cos(rad(rot));
  const s = Math.sin(rad(rot));
  return [cx - (w / 2) * c + (h / 2) * s, cy - (w / 2) * s - (h / 2) * c];
}

/** The smallest upright rectangle that holds the turned box */
export function turnedBounds(x: number, y: number, w: number, h: number, rot: number) {
  const c = Math.cos(rad(rot));
  const s = Math.sin(rad(rot));
  const xs = [0, w * c, w * c - h * s, -h * s].map((v) => x + v);
  const ys = [0, w * s, w * s + h * c, h * c].map((v) => y + v);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

/** The corner moved the least so that the turned box lies in a page of `pw` × `ph` (a box bigger than the page is centred on it) */
export function keepTurnedInside(x: number, y: number, w: number, h: number, rot: number, pw: number, ph: number): { x: number; y: number } {
  const b = turnedBounds(x, y, w, h, rot);
  const shift = (lo: number, hi: number, size: number) => (hi - lo >= size ? (size - (hi - lo)) / 2 - lo : lo < 0 ? -lo : hi > size ? size - hi : 0);
  return { x: x + shift(b.left, b.right, pw), y: y + shift(b.top, b.bottom, ph) };
}

/** The box turned to `rot` about its middle: the corner and the angle to save */
export function turnAboutCentre(layout: { x: number; y: number; rotation?: number }, w: number, h: number, rot: number): { x: number; y: number; rotation: number | undefined } {
  const [cx, cy] = turnedCentre(layout.x, layout.y, w, h, layout.rotation ?? 0);
  const next = normalTurn(rot);
  const [x, y] = cornerForCentre(cx, cy, w, h, next);
  return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, rotation: next || undefined };
}
