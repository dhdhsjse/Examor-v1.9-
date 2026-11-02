// The colors a chart takes (by series, or by point), and the hatchings that stand for them when it is printed in black and white. Pure functions.
import type { PaletteId } from "./types";

export const PALETTE_COLORS: Record<PaletteId, readonly string[]> = {
  // (the colors of the Office theme: blue, orange, green…, what a chart of Excel looks like)
  colorful: ["#156082", "#e97132", "#196b24", "#0f9ed5", "#a02b93", "#4ea72e", "#c00000", "#7f7f7f"],
  blue: ["#0b3d62", "#1f6fa8", "#4a9bd4", "#86bfe8", "#b9dbf3", "#2c5f8a", "#6fa8d6", "#d3e8f8"],
  green: ["#14532d", "#2e8b57", "#4fb477", "#86d4a1", "#bfe9cc", "#1f6f43", "#6cc48f", "#dcf3e4"],
  orange: ["#7c2d12", "#c2561a", "#ee8434", "#f6ad6b", "#fbd0a5", "#a3410f", "#f19a52", "#fde6cd"],
  purple: ["#3b0f5c", "#6b2d9a", "#9558c4", "#bb8ddb", "#dcc1ee", "#53217f", "#a874d1", "#eee0f7"],
  red: ["#7f1d1d", "#b91c1c", "#dc4a4a", "#ee8888", "#f7c0c0", "#991b1b", "#e36868", "#fbdede"],
  gray: ["#262626", "#595959", "#8c8c8c", "#b3b3b3", "#d4d4d4", "#404040", "#737373", "#e5e5e5"],
  pastel: ["#8fb8de", "#f4b183", "#a9d18e", "#ffd966", "#c9a8e0", "#9dd5d0", "#f2a6b5", "#c5c5c5"],
};

/** The color of series (or point) `i` in a palette: the colors in turn, then lighter or darker ones when there are more than it has */
export function paletteColor(palette: PaletteId, i: number): string {
  const colors = PALETTE_COLORS[palette];
  const base = colors[i % colors.length];
  const round = Math.floor(i / colors.length);
  return round === 0 ? base : shade(base, round % 2 ? 0.35 : -0.3);
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export const rgb = (hex: string): [number, number, number] | null => {
  if (!HEX.test(hex)) return null;
  const h = hex.length === 4 ? [...hex.slice(1)].map((c) => c + c).join("") : hex.slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4), 16)];
};

/** A color mixed with white (amount > 0) or black (amount < 0), as #rrggbb; anything that is not a hex code stays as it is. */
export function shade(color: string, amount: number): string {
  const c = rgb(color);
  if (!c) return color;
  const target = amount >= 0 ? 255 : 0;
  const k = Math.min(Math.abs(amount), 1);
  return "#" + c.map((v) => Math.round(v + (target - v) * k).toString(16).padStart(2, "0")).join("");
}

/** The ink that reads on a background: dark on a light color, white on a dark one */
export function readableOn(background: string): string {
  const c = rgb(background);
  if (!c) return "#111827";
  const lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
  return lum > 0.6 ? "#111827" : "#ffffff";
}

/** The hatchings, one for each series in turn (8 kinds: slashes, backslashes, lines, columns, a grid, dots, a lattice, wide slashes) */
export const PATTERN_COUNT = 8;

/** The SVG of the hatching `i` in a color, as a pattern called `id` (a white ground, the lines in the color) */
export function patternDef(id: string, i: number, color: string): string {
  const S = 8;
  const ink = `stroke="${color}" stroke-width="1.4" fill="none" stroke-linecap="square"`;
  const shapes = [
    `<path d="M-2 ${S + 2}L${S + 2} -2M-2 2L2 -2M${S - 2} ${S + 2}L${S + 2} ${S - 2}" ${ink}/>`,
    `<path d="M-2 -2L${S + 2} ${S + 2}M${S - 2} -2L${S + 2} 2M-2 ${S - 2}L2 ${S + 2}" ${ink}/>`,
    `<path d="M0 ${S / 2}H${S}" ${ink}/>`,
    `<path d="M${S / 2} 0V${S}" ${ink}/>`,
    `<path d="M0 ${S / 2}H${S}M${S / 2} 0V${S}" ${ink}/>`,
    `<circle cx="${S / 2}" cy="${S / 2}" r="1.5" fill="${color}"/>`,
    `<path d="M-2 ${S + 2}L${S + 2} -2M-2 -2L${S + 2} ${S + 2}" ${ink}/>`,
    `<path d="M-2 ${S + 2}L${S + 2} -2" stroke="${color}" stroke-width="3" fill="none"/>`,
  ];
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${S}" height="${S}"><rect width="${S}" height="${S}" fill="#ffffff"/>${shapes[i % PATTERN_COUNT]}</pattern>`;
}
