import { arrowDefs, bool, clamp, ink, line, str, svg, text } from "./svg";
import type { FigureDef } from "./types";

const BOX = 104;
const GAP = 44;

// Living things linked by "is eaten by" arrows. Read from right to left in Arabic.
export const foodChainFigure: FigureDef = {
  id: "food-chain",
  name: "Food chain",
  hint: "Separate the living things with commas.",
  params: [
    { key: "items", label: "Living things", kind: "text", placeholder: "Herbe, Lapin, Renard" },
    { key: "empty", label: "Empty boxes (the student fills them)", kind: "bool" },
  ],
  defaults: (lang) => ({ items: lang === "ar" ? "عشب، جرادة، ضفدع، أفعى" : "Herbe, Sauterelle, Grenouille, Serpent", empty: false }),
  build: (p, lang) => {
    const color = ink(p);
    const items = str(p, "items")
      .split(/[,،;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
    const n = clamp(items.length, 2, 6);
    const rtl = lang === "ar";
    const W = n * BOX + (n - 1) * GAP + 8;
    let body = arrowDefs(color);
    for (let i = 0; i < n; i++) {
      const k = rtl ? n - 1 - i : i; // position from the left
      const x = 4 + k * (BOX + GAP);
      body += `<rect x="${x}" y="16" width="${BOX}" height="48" rx="8" fill="#fff"/>`;
      const name = items[i] ?? "";
      if (!bool(p, "empty") && name) body += text(x + BOX / 2, 45, name, { size: clamp(Math.floor((BOX * 1.75) / Math.max(1, name.length)), 10, 15), anchor: "middle", fill: color });
      if (i < n - 1) {
        const from = rtl ? x - 2 : x + BOX + 2;
        const to = rtl ? x - GAP + 6 : x + BOX + GAP - 6;
        body += line([from, 40], [to, 40], 'marker-end="url(#a)"');
      }
    }
    return svg(W, 80, body, color);
  },
};
