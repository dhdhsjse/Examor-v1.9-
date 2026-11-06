// The border of a text box, as a whole (Properties → Borders): the shape of the box with its corners, its fill, and the line around it in one
// of several kinds, on all four sides or only some. Drawn as SVG path data in the pixels of the box, so the canvas (Konva `Path`), the page
// editor and the small previews of the panel draw the same thing.

export type BorderKind = "solid" | "dashed" | "dotted" | "double" | "thick-thin" | "triple" | "shadow";
export const BORDER_KINDS: BorderKind[] = ["solid", "dashed", "dotted", "double", "thick-thin", "triple", "shadow"];

export type CornerStyle = "square" | "round" | "chamfer" | "scoop" | "leaf";
export const CORNER_STYLES: CornerStyle[] = ["square", "round", "chamfer", "scoop", "leaf"];
export const DEFAULT_CORNER_SIZE = 12;

export type SideKey = "t" | "r" | "b" | "l";
export const SIDES: SideKey[] = ["t", "r", "b", "l"];

/** What a text box keeps of its look (the fields of TextboxBlock) */
export interface BoxLook {
  background?: string;
  border?: string;
  borderWidth?: number;
  borderStyle?: BorderKind | string;
  corner?: CornerStyle;
  radius?: number;
  sides?: string;
}

/** One stroke (or, with `fill`, one fill in the colour of the line) of the line around a box. `w`: px; `o`: opacity */
export interface BoxLine {
  d: string;
  w: number;
  dash?: [number, number];
  round?: boolean;
  fill?: boolean;
  o?: number;
}

export const kindOf = (look: BoxLook): BorderKind => (BORDER_KINDS as string[]).includes(look.borderStyle ?? "") ? (look.borderStyle as BorderKind) : "solid";
/** The corners as kept: older boxes only had a radius (rounded) */
export const cornerOf = (look: BoxLook): CornerStyle => look.corner ?? (look.radius ? "round" : "square");
export const sidesOf = (look: BoxLook): SideKey[] => {
  const s = SIDES.filter((k) => (look.sides ?? "trbl").includes(k));
  return s.length ? s : SIDES;
};
export const lineWidth = (look: BoxLook) => Math.max(0.5, look.borderWidth ?? 1);

const f = (n: number) => String(Math.round(n * 100) / 100);

// The outline of the box, `o` px inside its edge, with the corners; `dx`, `dy` shift it (a shadow)
function shapePath(W: number, H: number, o: number, corner: CornerStyle, size: number, dx = 0, dy = 0): string {
  const x0 = o + dx;
  const y0 = o + dy;
  const x1 = W - o + dx;
  const y1 = H - o + dy;
  const r = Math.max(0, Math.min(size, (x1 - x0) / 2, (y1 - y0) / 2));
  // (the corners in the order top-left, top-right, bottom-right, bottom-left; a leaf is round at two opposite ones)
  const rs = corner === "square" ? [0, 0, 0, 0] : corner === "leaf" ? [r, 0, r, 0] : [r, r, r, r];
  const arc = (rr: number, x: number, y: number) => (corner === "chamfer" || rr === 0 ? `L${f(x)} ${f(y)}` : `A${f(rr)} ${f(rr)} 0 0 ${corner === "scoop" ? 0 : 1} ${f(x)} ${f(y)}`);
  const [tl, tr, br, bl] = rs;
  return [
    `M${f(x0 + tl)} ${f(y0)}`,
    `H${f(x1 - tr)}`,
    tr ? arc(tr, x1, y0 + tr) : "",
    `V${f(y1 - br)}`,
    br ? arc(br, x1 - br, y1) : "",
    `H${f(x0 + bl)}`,
    bl ? arc(bl, x0, y1 - bl) : "",
    `V${f(y0 + tl)}`,
    tl ? arc(tl, x0 + tl, y0) : "",
    "Z",
  ].join("");
}

// Only some sides, as straight lines `o` px inside the edge
function sidesPath(W: number, H: number, o: number, sides: SideKey[], dx = 0, dy = 0): string {
  const [x0, y0, x1, y1] = [o + dx, o + dy, W - o + dx, H - o + dy];
  const seg: Record<SideKey, string> = {
    t: `M${f(x0)} ${f(y0)}H${f(x1)}`,
    r: `M${f(x1)} ${f(y0)}V${f(y1)}`,
    b: `M${f(x0)} ${f(y1)}H${f(x1)}`,
    l: `M${f(x0)} ${f(y0)}V${f(y1)}`,
  };
  return sides.map((k) => seg[k]).join("");
}

/** The shape of the box (what its fill covers) */
export function boxFillPath(look: BoxLook, W: number, H: number): string {
  return shapePath(W, H, 0, cornerOf(look), look.radius ?? DEFAULT_CORNER_SIZE);
}

/** The line around the box: one or more strokes, the first ones lowest. Nothing when the box has no border */
export function boxLines(look: BoxLook, W: number, H: number): BoxLine[] {
  if (!look.border) return [];
  const w = lineWidth(look);
  const corner = cornerOf(look);
  const size = look.radius ?? DEFAULT_CORNER_SIZE;
  const sides = sidesOf(look);
  const all = sides.length === 4;
  // A line `o` px inside the edge (its corners follow the shape, a little tighter inside)
  const at = (o: number) => (all ? shapePath(W, H, o, corner, corner === "round" || corner === "leaf" ? Math.max(0, size - o) : size) : sidesPath(W, H, o, sides));
  switch (kindOf(look)) {
    case "dashed":
      return [{ d: at(w / 2), w, dash: [w * 4, w * 2.5] }];
    case "dotted":
      return [{ d: at(w / 2), w, dash: [0.01, w * 2], round: true }];
    case "double": {
      const l = Math.max(0.5, w / 3);
      return [{ d: at(l / 2), w: l }, { d: at(w - l / 2), w: l }];
    }
    case "thick-thin": {
      const thick = w * 0.6;
      const thin = Math.max(0.5, w * 0.2);
      return [{ d: at(thick / 2), w: thick }, { d: at(thick + thin * 1.2 + thin / 2), w: thin }];
    }
    case "triple": {
      const l = Math.max(0.5, w / 4);
      return [{ d: at(l / 2), w: l }, { d: at(w / 2), w: l }, { d: at(w - l / 2), w: l }];
    }
    case "shadow": {
      const d = Math.max(3, w * 1.6);
      return [{ d: all ? shapePath(W, H, 0, corner, size, d, d) : sidesPath(W, H, 0, sides, d, d), w: all ? 0 : w, fill: all, o: 0.28 }, { d: at(w / 2), w }];
    }
    default:
      return [{ d: at(w / 2), w }];
  }
}
