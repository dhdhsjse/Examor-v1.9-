import { clamp, fmt, ink, line, num, r1, str, svg, text } from "./svg";
import type { FigureDef } from "./types";

// A thermometer with a scale and a level to read (or empty, to color).
export const thermometerFigure: FigureDef = {
  id: "thermometer",
  name: "Thermometer",
  params: [
    { key: "min", label: "From", kind: "number", min: -50, max: 0, row: "range" },
    { key: "max", label: "To", kind: "number", min: 10, max: 150, row: "range" },
    { key: "step", label: "Number every", kind: "number", min: 1, max: 50, row: "range" },
    { key: "value", label: "Temperature shown", kind: "number", min: -50, max: 150 },
    { key: "empty", label: "Empty (the student colors it)", kind: "bool" },
    { key: "unit", label: "Unit", kind: "text", placeholder: "°C" },
  ],
  defaults: () => ({ min: -10, max: 50, step: 10, value: 22, empty: false, unit: "°C" }),
  build: (p) => {
    const color = ink(p);
    const min = clamp(num(p, "min", -10), -50, 0);
    const max = Math.max(min + 10, clamp(num(p, "max", 50), 10, 150));
    const step = clamp(num(p, "step", 10), 1, max - min);
    const value = clamp(num(p, "value", 22), min, max);
    const top = 24;
    const bottom = 214; // y of `min`
    const Y = (v: number) => bottom - ((v - min) / (max - min)) * (bottom - top);
    let body = `<rect x="40" y="${top - 12}" width="20" height="${bottom - top + 24}" rx="10" fill="#fff"/><circle cx="50" cy="${bottom + 22}" r="21" fill="#fff"/>`;
    if (p.empty !== true) body += `<rect x="45.5" y="${r1(Y(value))}" width="9" height="${r1(bottom + 14 - Y(value))}" fill="#ef4444" stroke="none"/>`;
    body += `<circle cx="50" cy="${bottom + 22}" r="15" fill="${p.empty === true ? "#fff" : "#ef4444"}" stroke="${p.empty === true ? color : "none"}" stroke-width="1"/>`;
    // Small ticks every step / 5 (or every unit), numbers every step.
    const small = step % 5 === 0 ? step / 5 : step % 2 === 0 ? step / 2 : step;
    for (let v = min, k = 0; v <= max + 1e-6 && k < 200; v += small, k++) {
      const big = Math.abs(((v - min) / step) % 1) < 1e-6 || Math.abs(((v - min) / step) % 1) > 1 - 1e-6;
      body += line([62, Y(v)], [big ? 74 : 68, Y(v)], 'stroke-width="1.3"');
      if (big) body += text(80, Y(v) + 4, fmt(v), { size: 12, fill: color });
    }
    body += text(50, top - 18 + 4, str(p, "unit", "°C"), { size: 12, anchor: "middle", fill: color, bold: true });
    return svg(120, bottom + 50, body, color);
  },
};
