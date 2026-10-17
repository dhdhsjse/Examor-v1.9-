import { bool, cornerNames, dot, ink, label, line, rad, str, svg, type Pt } from "./svg";
import type { FigureDef } from "./types";

export const circleFigure: FigureDef = {
  id: "circle",
  name: "Circle",
  params: [
    { key: "center", label: "Center name", kind: "text", placeholder: "O", row: "names" },
    { key: "radiusLabel", label: "Radius label", kind: "text", placeholder: "r", row: "names" },
    { key: "radius", label: "Draw a radius", kind: "bool" },
    { key: "diameter", label: "Draw a diameter", kind: "bool" },
    { key: "diameterNames", label: "Ends of the diameter", kind: "text", placeholder: "AB", when: (p) => p.diameter === true },
    { key: "point", label: "Point on the circle", kind: "text", placeholder: "M" },
    { key: "tangent", label: "Tangent at that point", kind: "bool", when: (p) => typeof p.point === "string" && p.point.trim() !== "" },
  ],
  defaults: () => ({ center: "O", radiusLabel: "r", radius: true, diameter: false, diameterNames: "AB", point: "", tangent: false }),
  build: (p) => {
    const color = ink(p);
    const R = 80;
    const c: Pt = [150, 120];
    let body = `<circle cx="${c[0]}" cy="${c[1]}" r="${R}"/>` + dot(c, 3, color) + label([c[0] - 12, c[1] + 14], str(p, "center"), color, 15, { bold: true });
    if (bool(p, "radius")) {
      const e: Pt = [c[0] + R * Math.cos(rad(-30)), c[1] + R * Math.sin(rad(-30))];
      body += line(c, e) + label([(c[0] + e[0]) / 2 + 4, (c[1] + e[1]) / 2 - 10], str(p, "radiusLabel"), color, 14, { italic: true });
    }
    if (bool(p, "diameter")) {
      const [a, b] = cornerNames(str(p, "diameterNames", "AB"), 2);
      const pa: Pt = [c[0] - R * Math.cos(rad(20)), c[1] + R * Math.sin(rad(20))];
      const pb: Pt = [c[0] + R * Math.cos(rad(20)), c[1] - R * Math.sin(rad(20))];
      body += line(pa, pb, 'stroke-width="1.6"') + dot(pa, 2.5, color) + dot(pb, 2.5, color);
      body += label([pa[0] - 14, pa[1] + 6], a, color, 15, { bold: true }) + label([pb[0] + 14, pb[1] - 6], b, color, 15, { bold: true });
    }
    const point = str(p, "point").trim();
    if (point) {
      const m: Pt = [c[0] + R * Math.cos(rad(-115)), c[1] + R * Math.sin(rad(-115))];
      body += dot(m, 3, color) + label([m[0] - 10, m[1] - 14], point, color, 15, { bold: true });
      if (bool(p, "tangent")) {
        const t: Pt = [Math.cos(rad(-25)), Math.sin(rad(-25))]; // perpendicular to the radius at M
        body += line([m[0] - t[0] * 90, m[1] - t[1] * 90], [m[0] + t[0] * 90, m[1] + t[1] * 90], 'stroke-width="1.6"');
      }
    }
    // Room for the tangent above the circle.
    return svg(300, 240, body, color);
  },
};
