import { clamp, ink, num, r1, str, svg } from "./svg";
import type { FigureDef } from "./types";

// A whole cut into equal parts, some of them colored: to read or to color a fraction.
export const fractionFigure: FigureDef = {
  id: "fraction",
  name: "Fraction shape",
  params: [
    {
      key: "shape",
      label: "Shape",
      kind: "select",
      options: [
        { value: "circle", label: "Disc" },
        { value: "bar", label: "Bar" },
        { value: "grid", label: "Rectangle" },
      ],
    },
    { key: "parts", label: "Parts", kind: "number", min: 2, max: 24, row: "n" },
    { key: "shaded", label: "Colored", kind: "number", min: 0, max: 24, row: "n" },
    { key: "fill", label: "Color of the parts", kind: "color" },
  ],
  defaults: () => ({ shape: "circle", parts: 8, shaded: 3, fill: "#93c5fd" }),
  normalize: (p, changed) => {
    const parts = Math.round(clamp(num(p, "parts", 8), 2, 24));
    const shaded = Math.round(clamp(num(p, "shaded", 3), 0, parts));
    return { ...p, parts, shaded: changed === "parts" ? Math.min(shaded, parts) : shaded };
  },
  build: (p) => {
    const color = ink(p);
    const fill = /^#[0-9a-f]{3,8}$/i.test(str(p, "fill")) ? str(p, "fill") : "#93c5fd";
    const n = Math.round(clamp(num(p, "parts", 8), 2, 24));
    const k = Math.round(clamp(num(p, "shaded", 3), 0, n));
    const shape = str(p, "shape", "circle");
    let body = "";
    if (shape === "circle") {
      const c = 90;
      const R = 80;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
        const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        body += `<path d="M${c} ${c}L${r1(c + R * Math.cos(a0))} ${r1(c + R * Math.sin(a0))}A${R} ${R} 0 ${large} 1 ${r1(c + R * Math.cos(a1))} ${r1(c + R * Math.sin(a1))}Z" fill="${i < k ? fill : "#ffffff"}" stroke-width="1.6"/>`;
      }
      return svg(180, 180, body, color);
    }
    // Bar: one row; rectangle: rows × columns as square as possible.
    let rows = 1;
    if (shape === "grid") for (let r = Math.floor(Math.sqrt(n)); r >= 1; r--) if (n % r === 0) { rows = r; break; }
    const cols = n / rows;
    const cell = shape === "grid" ? Math.min(44, 260 / cols) : Math.min(60, 320 / cols);
    const ch = shape === "grid" ? cell : 50;
    for (let i = 0; i < n; i++) {
      const x = 2 + (i % cols) * cell;
      const y = 2 + Math.floor(i / cols) * ch;
      body += `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(cell)}" height="${r1(ch)}" fill="${i < k ? fill : "#ffffff"}" stroke-width="1.6"/>`;
    }
    return svg(cols * cell + 4, rows * ch + 4, body, color);
  },
};
