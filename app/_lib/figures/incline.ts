import { add, arrowDefs, bool, clamp, ink, label, line, mul, num, poly, r1, rad, svg, type Pt } from "./svg";
import type { FigureDef } from "./types";

// A block on a slope with the forces acting on it.
export const inclineFigure: FigureDef = {
  id: "incline",
  name: "Inclined plane",
  params: [
    { key: "angle", label: "Slope angle", kind: "number", min: 5, max: 60, unit: "°" },
    { key: "weight", label: "Weight P", kind: "bool", row: "f1" },
    { key: "reaction", label: "Reaction R", kind: "bool", row: "f1" },
    { key: "friction", label: "Friction f", kind: "bool", row: "f2" },
    { key: "showAngle", label: "Angle α", kind: "bool", row: "f2" },
  ],
  defaults: () => ({ angle: 25, weight: true, reaction: true, friction: false, showAngle: true }),
  build: (p) => {
    const color = ink(p);
    const a = clamp(num(p, "angle", 25), 5, 60);
    const t = Math.tan(rad(a));
    let base = 280;
    if (base * t > 190) base = 190 / t;
    const H = base * t;
    const pad = 30;
    const top = pad + 50; // room for the reaction arrow
    const BL: Pt = [pad, top + H];
    const BR: Pt = [pad + base, top + H];
    const TR: Pt = [pad + base, top];
    const u: Pt = [Math.cos(rad(a)), -Math.sin(rad(a))]; // up the slope
    const n: Pt = [-Math.sin(rad(a)), -Math.cos(rad(a))]; // away from the slope
    const mid = add(BL, mul(u, (base / Math.cos(rad(a))) * 0.5));
    const c = add(mid, mul(n, 15));
    let body = arrowDefs("#dc2626", "p") + arrowDefs("#2563eb", "r") + arrowDefs("#16a34a", "f");
    body += poly([BL, BR, TR], 'fill="#f8fafc"');
    body += `<rect x="${r1(c[0] - 22)}" y="${r1(c[1] - 15)}" width="44" height="30" fill="#e0e7ff" transform="rotate(${r1(-a)} ${r1(c[0])} ${r1(c[1])})"/>`;
    body += `<circle cx="${r1(c[0])}" cy="${r1(c[1])}" r="2" fill="${color}" stroke="none"/>`;
    if (bool(p, "weight")) {
      const e = add(c, [0, 70]);
      body += line(c, e, 'stroke="#dc2626" stroke-width="2.2" marker-end="url(#p)"') + label(add(e, [12, -6]), "P", "#dc2626", 15, { bold: true });
    }
    if (bool(p, "reaction")) {
      const e = add(c, mul(n, 62));
      body += line(c, e, 'stroke="#2563eb" stroke-width="2.2" marker-end="url(#r)"') + label(add(e, [-12, -4]), "R", "#2563eb", 15, { bold: true });
    }
    if (bool(p, "friction")) {
      const e = add(c, mul(u, 52));
      body += line(c, e, 'stroke="#16a34a" stroke-width="2.2" marker-end="url(#f)"') + label(add(e, [6, -12]), "f", "#16a34a", 15, { bold: true, italic: true });
    }
    if (bool(p, "showAngle")) {
      const r = 42;
      const e = add(BL, mul(u, r));
      body += `<path d="M${r1(BL[0] + r)} ${r1(BL[1])}A${r} ${r} 0 0 0 ${r1(e[0])} ${r1(e[1])}" stroke-width="1.4"/>`;
      body += label(add(BL, [r + 12, -Math.max(7, r * Math.sin(rad(a / 2)))]), "α", color, 15, { italic: true });
    }
    return svg(pad * 2 + base, top + H + pad, body, color);
  },
};
