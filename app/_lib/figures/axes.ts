import { arrowDefs, bool, clamp, dot, fmt, ink, line, num, parseNum, str, svg, text } from "./svg";
import type { FigureDef } from "./types";

// "A(2;3) B(-1,5;2)" or "A(2,3)" → named points.
export function parsePoints(s: string): { name: string; x: number; y: number }[] {
  const out: { name: string; x: number; y: number }[] = [];
  for (const m of s.matchAll(/([^\s();]*)\s*\(([^)]*)\)/g)) {
    const inside = m[2];
    const parts = inside.includes(";") ? inside.split(";") : inside.split(",");
    if (parts.length !== 2) continue;
    const x = parseNum(parts[0]);
    const y = parseNum(parts[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) out.push({ name: m[1], x, y });
  }
  return out;
}

export const axesFigure: FigureDef = {
  id: "axes",
  name: "Coordinate plane",
  hint: "Type points like A(2;3) B(-1;2) to place them.",
  params: [
    { key: "xMin", label: "x from", kind: "number", min: -20, max: 0, row: "x" },
    { key: "xMax", label: "x to", kind: "number", min: 1, max: 20, row: "x" },
    { key: "yMin", label: "y from", kind: "number", min: -20, max: 0, row: "y" },
    { key: "yMax", label: "y to", kind: "number", min: 1, max: 20, row: "y" },
    { key: "unit", label: "Square size", kind: "number", min: 10, max: 40, unit: "px" },
    { key: "grid", label: "Grid", kind: "bool" },
    { key: "numbers", label: "Numbers on the axes", kind: "bool" },
    { key: "points", label: "Points", kind: "text", placeholder: "A(2;3) B(-1;2)" },
    { key: "guides", label: "Dotted lines to the axes", kind: "bool", when: (p) => typeof p.points === "string" && p.points.trim() !== "" },
  ],
  defaults: () => ({ xMin: -6, xMax: 6, yMin: -5, yMax: 5, unit: 20, grid: true, numbers: false, points: "", guides: true }),
  build: (p) => {
    const color = ink(p);
    const xMin = Math.round(clamp(num(p, "xMin", -6), -20, 0));
    const xMax = Math.round(clamp(num(p, "xMax", 6), 1, 20));
    const yMin = Math.round(clamp(num(p, "yMin", -5), -20, 0));
    const yMax = Math.round(clamp(num(p, "yMax", 5), 1, 20));
    const u = clamp(num(p, "unit", 20), 10, 40);
    const pad = 22;
    const W = (xMax - xMin) * u + pad * 2;
    const H = (yMax - yMin) * u + pad * 2;
    const X = (x: number) => pad + (x - xMin) * u;
    const Y = (y: number) => pad + (yMax - y) * u;
    let body = arrowDefs(color);
    if (bool(p, "grid")) {
      let d = "";
      for (let x = xMin; x <= xMax; x++) d += `M${X(x)} ${Y(yMin)}V${Y(yMax)}`;
      for (let y = yMin; y <= yMax; y++) d += `M${X(xMin)} ${Y(y)}H${X(xMax)}`;
      body += `<path d="${d}" stroke="#c4c4cc" stroke-width="0.8"/>`;
    }
    body += line([X(xMin) - 8, Y(0)], [X(xMax) + 14, Y(0)], 'stroke-width="1.6" marker-end="url(#a)"');
    body += line([X(0), Y(yMin) + 8], [X(0), Y(yMax) - 14], 'stroke-width="1.6" marker-end="url(#a)"');
    body += text(X(xMax) + 6, Y(0) + 18, "x", { fill: color, italic: true }) + text(X(0) + 8, Y(yMax) - 4, "y", { fill: color, italic: true });
    body += text(X(0) - 13, Y(0) + 15, "O", { fill: color, size: 12 });
    // Ticks for 1 on each axis; every number when asked.
    for (let x = xMin; x <= xMax; x++) {
      if (x === 0 || (!bool(p, "numbers") && x !== 1)) continue;
      body += line([X(x), Y(0) - 3], [X(x), Y(0) + 3], 'stroke-width="1.4"') + text(X(x), Y(0) + 15, fmt(x), { fill: color, size: 11, anchor: "middle" });
    }
    for (let y = yMin; y <= yMax; y++) {
      if (y === 0 || (!bool(p, "numbers") && y !== 1)) continue;
      body += line([X(0) - 3, Y(y)], [X(0) + 3, Y(y)], 'stroke-width="1.4"') + text(X(0) - 6, Y(y) + 4, fmt(y), { fill: color, size: 11, anchor: "end" });
    }
    for (const pt of parsePoints(str(p, "points"))) {
      if (pt.x < xMin || pt.x > xMax || pt.y < yMin || pt.y > yMax) continue;
      if (bool(p, "guides")) body += `<path d="M${X(pt.x)} ${Y(pt.y)}V${Y(0)}M${X(pt.x)} ${Y(pt.y)}H${X(0)}" stroke-width="1" stroke-dasharray="3 3"/>`;
      body += dot([X(pt.x), Y(pt.y)], 3.2, color) + text(X(pt.x) + 6, Y(pt.y) - 6, pt.name, { fill: color, bold: true, size: 14 });
    }
    return svg(W, H, body, color);
  },
};
