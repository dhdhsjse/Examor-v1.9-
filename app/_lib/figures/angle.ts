import { add, angleMark, bool, clamp, cornerNames, dot, fit, ink, label, line, mul, num, outside, rad, str, svg, unit, sub, type Pt } from "./svg";
import type { FigureDef } from "./types";

// An angle xOy to measure or to draw: its size, its three names, its mark.
export const angleFigure: FigureDef = {
  id: "angle",
  name: "Angle",
  params: [
    { key: "deg", label: "Measure", kind: "number", min: 1, max: 180, unit: "°" },
    { key: "names", label: "Names (point, vertex, point)", kind: "text", placeholder: "AOB" },
    { key: "mark", label: "Mark the angle", kind: "bool" },
    { key: "value", label: "Write its size", kind: "bool" },
  ],
  defaults: () => ({ deg: 50, names: "AOB", mark: true, value: false }),
  build: (p) => {
    const color = ink(p);
    const deg = clamp(num(p, "deg", 50), 1, 180);
    const arm = 1;
    const math: Pt[] = [[arm, 0], [0, 0], [arm * Math.cos(rad(deg)), arm * Math.sin(rad(deg))]];
    // Keep the figure from collapsing to a line for small angles.
    const { pts, w, h } = fit([...math, [0, 0.35]], 240, 170, 30);
    const [a, o, b] = pts;
    const [na, no, nb] = cornerNames(str(p, "names", "AOB"), 3);
    const m = angleMark(o, a, b, 30, color);
    let body = line(o, a) + line(o, b) + dot(a, 2.5, color) + dot(b, 2.5, color);
    if (bool(p, "mark")) body += m.path;
    if (bool(p, "value")) body += label(m.at, `${Math.round(deg)}°`, color, 13);
    // The vertex name goes outside the angle (below it for a flat angle).
    const back = add(unit(sub(o, a)), unit(sub(o, b)));
    const away: Pt = Math.hypot(back[0], back[1]) < 0.01 ? [0, 1] : unit(back);
    body += label(add(o, mul(away, 16)), no, color, 15, { bold: true });
    body += label(outside(a, o, 14), na, color, 15, { bold: true }) + label(outside(b, o, 14), nb, color, 15, { bold: true });
    return svg(w, h, body, color);
  },
};
