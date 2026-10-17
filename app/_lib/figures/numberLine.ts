import { arrowDefs, bool, clamp, dot, fmt, ink, line, num, parseNum, str, svg, text } from "./svg";
import type { FigureDef } from "./types";

// "A=2 ; B=-1,5" → named points.
function parseMarks(s: string) {
  return [...s.matchAll(/([^\s=;]+)\s*=\s*(-?\d+(?:[.,]\d+)?)/g)].map((m) => ({ name: m[1], v: parseNum(m[2]) }));
}

export const numberLineFigure: FigureDef = {
  id: "number-line",
  name: "Number line",
  hint: "Type points like A=2 ; B=-1,5 to place them.",
  params: [
    { key: "min", label: "From", kind: "number", min: -100, max: 99, row: "range" },
    { key: "max", label: "To", kind: "number", min: -99, max: 100, row: "range" },
    { key: "step", label: "Step", kind: "number", min: 0.1, max: 50, step: 0.1, row: "range" },
    { key: "minor", label: "Small ticks between", kind: "number", min: 0, max: 9 },
    { key: "numbers", label: "Write the numbers", kind: "bool" },
    { key: "every", label: "Number every", kind: "number", min: 1, max: 10, when: (p) => p.numbers === true },
    { key: "points", label: "Points", kind: "text", placeholder: "A=2 ; B=-1,5" },
  ],
  defaults: () => ({ min: -5, max: 5, step: 1, minor: 0, numbers: true, every: 1, points: "" }),
  normalize: (p, changed) => {
    const next = { ...p };
    const min = num(p, "min", -5);
    const max = num(p, "max", 5);
    if (min >= max) {
      if (changed === "min") next.max = min + 1;
      else next.min = max - 1;
    }
    return next;
  },
  build: (p) => {
    const color = ink(p);
    const min = num(p, "min", -5);
    const max = Math.max(min + 0.1, num(p, "max", 5));
    const step = clamp(num(p, "step", 1), 0.01, max - min);
    const ticks = Math.min(60, Math.floor((max - min) / step + 1e-6));
    const minor = Math.round(clamp(num(p, "minor", 0), 0, 9));
    const every = Math.max(1, Math.round(num(p, "every", 1)));
    const W = 420;
    const x0 = 20;
    const x1 = W - 40;
    const X = (v: number) => x0 + ((v - min) / (ticks * step)) * (x1 - x0);
    const y = 34;
    let body = arrowDefs(color) + line([8, y], [W - 10, y], 'stroke-width="1.8" marker-end="url(#a)"');
    for (let k = 0; k <= ticks; k++) {
      const v = min + k * step;
      body += line([X(v), y - 7], [X(v), y + 7], 'stroke-width="1.6"');
      if (bool(p, "numbers") && k % every === 0) body += text(X(v), y + 26, fmt(v), { size: 12, anchor: "middle", fill: color });
      if (k < ticks) for (let m = 1; m <= minor; m++) body += line([X(v + (m * step) / (minor + 1)), y - 3.5], [X(v + (m * step) / (minor + 1)), y + 3.5], 'stroke-width="1"');
    }
    for (const mk of parseMarks(str(p, "points"))) {
      if (mk.v < min || mk.v > min + ticks * step) continue;
      body += dot([X(mk.v), y], 3.6, color) + text(X(mk.v), y - 13, mk.name, { size: 14, anchor: "middle", bold: true, fill: color });
    }
    return svg(W, 72, body, color);
  },
};
