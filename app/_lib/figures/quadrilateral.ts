import { angleMark, bool, centroid, clamp, cornerNames, fit, ink, label, line, num, outside, poly, rad, str, svg, type Pt } from "./svg";
import type { FigureDef, Params } from "./types";

type Kind = "square" | "rectangle" | "parallelogram" | "rhombus" | "trapezoid" | "right-trapezoid";

const slanted = (p: Params) => !["square", "rectangle"].includes(String(p.kind));
const hasHeight = (p: Params) => !["square", "rhombus"].includes(String(p.kind));

// Corners A B C D counter-clockwise from the bottom left (math coordinates, y up).
function corners(kind: Kind, w: number, h: number, angle: number): Pt[] {
  const t = Math.tan(rad(angle));
  switch (kind) {
    case "square":
      return [[0, 0], [w, 0], [w, w], [0, w]];
    case "rectangle":
      return [[0, 0], [w, 0], [w, h], [0, h]];
    case "parallelogram": {
      const dx = h / t;
      return [[0, 0], [w, 0], [w + dx, h], [dx, h]];
    }
    case "rhombus": {
      const d: Pt = [w * Math.cos(rad(angle)), w * Math.sin(rad(angle))];
      return [[0, 0], [w, 0], [w + d[0], d[1]], d];
    }
    case "trapezoid": {
      const dx = Math.min(h / t, w * 0.4);
      return [[0, 0], [w, 0], [w - dx, h], [dx, h]];
    }
    case "right-trapezoid": {
      const dx = Math.min(h / t, w * 0.7);
      return [[0, 0], [w, 0], [w - dx, h], [0, h]];
    }
  }
}

export const quadrilateralFigure: FigureDef = {
  id: "quadrilateral",
  name: "Quadrilateral",
  params: [
    {
      key: "kind",
      label: "Shape",
      kind: "select",
      options: [
        { value: "square", label: "Square" },
        { value: "rectangle", label: "Rectangle" },
        { value: "parallelogram", label: "Parallelogram" },
        { value: "rhombus", label: "Rhombus" },
        { value: "trapezoid", label: "Trapezoid" },
        { value: "right-trapezoid", label: "Right trapezoid" },
      ],
    },
    { key: "w", label: "Width", kind: "number", min: 20, max: 100, row: "size" },
    { key: "h", label: "Height", kind: "number", min: 10, max: 100, row: "size", when: hasHeight },
    { key: "angle", label: "Angle", kind: "number", min: 20, max: 90, unit: "°", row: "size", when: slanted },
    { key: "names", label: "Corner names", kind: "text", placeholder: "ABCD" },
    { key: "diagonals", label: "Draw the diagonals", kind: "bool" },
    { key: "marks", label: "Mark the right angles", kind: "bool" },
  ],
  defaults: (lang) => ({ kind: "rectangle", w: 70, h: 40, angle: 60, names: lang === "ar" ? "أ ب ج د" : "ABCD", diagonals: false, marks: true }),
  build: (p) => {
    const color = ink(p);
    const kind = (String(p.kind) as Kind) in { square: 1, rectangle: 1, parallelogram: 1, rhombus: 1, trapezoid: 1, "right-trapezoid": 1 } ? (String(p.kind) as Kind) : "rectangle";
    const math = corners(kind, clamp(num(p, "w", 70), 10, 100), clamp(num(p, "h", 40), 5, 100), clamp(num(p, "angle", 60), 10, 90));
    const { pts, w, h } = fit(math, 260, 190, 30);
    const g = centroid(pts);
    const names = cornerNames(str(p, "names", "ABCD"), 4);
    let body = poly(pts);
    if (bool(p, "diagonals")) body += line(pts[0], pts[2], 'stroke-dasharray="6 4" stroke-width="1.4"') + line(pts[1], pts[3], 'stroke-dasharray="6 4" stroke-width="1.4"');
    pts.forEach((v, i) => {
      const m = angleMark(v, pts[(i + 3) % 4], pts[(i + 1) % 4], 16, color);
      if (bool(p, "marks") && Math.abs(m.deg - 90) < 0.5) body += m.path;
      body += label(outside(v, g, 15), names[i], color, 15, { bold: true });
    });
    return svg(w, h, body, color);
  },
};
