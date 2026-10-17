import { clamp, ink, num, str, svg } from "./svg";
import type { FigureDef } from "./types";

// Squared paper, dot paper or plain lines, for drawing exercises.
export const gridFigure: FigureDef = {
  id: "grid",
  name: "Grid paper",
  params: [
    {
      key: "style",
      label: "Kind",
      kind: "select",
      options: [
        { value: "squares", label: "Squares" },
        { value: "dots", label: "Dots" },
        { value: "lines", label: "Lines" },
      ],
    },
    { key: "cols", label: "Columns", kind: "number", min: 2, max: 50, row: "size" },
    { key: "rows", label: "Rows", kind: "number", min: 1, max: 50, row: "size" },
    { key: "cell", label: "Square size", kind: "number", min: 8, max: 40, unit: "px" },
  ],
  defaults: () => ({ style: "squares", cols: 15, rows: 10, cell: 20, ink: "#a1a1aa" }),
  build: (p) => {
    const color = ink(p, "#a1a1aa");
    const cols = Math.round(clamp(num(p, "cols", 15), 2, 50));
    const rows = Math.round(clamp(num(p, "rows", 10), 1, 50));
    const c = clamp(num(p, "cell", 20), 8, 40);
    const W = cols * c;
    const H = rows * c;
    const o = 1; // keep the outer lines inside the picture
    let body = "";
    const style = str(p, "style", "squares");
    if (style === "dots") {
      for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) body += `<circle cx="${o + i * c}" cy="${o + j * c}" r="1.3" fill="${color}" stroke="none"/>`;
    } else {
      let d = "";
      for (let j = 0; j <= rows; j++) d += `M${o} ${o + j * c}H${o + W}`;
      if (style === "squares") for (let i = 0; i <= cols; i++) d += `M${o + i * c} ${o}V${o + H}`;
      body = `<path d="${d}" stroke-width="1"/>`;
    }
    return svg(W + o * 2, H + o * 2, body, color);
  },
};
