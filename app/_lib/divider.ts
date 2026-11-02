// The separating line (DividerBlock): its looks, its size, and what to draw for each look, as simple marks (lines, dots, a wave, a
// diamond, a text) so the page (Konva) and the previews of the Properties panel (SVG) draw exactly the same thing.

import type { DividerBlock, DividerStyle, Lang } from "./types";

export const DIVIDER_SPACE = 8;
export const DIVIDER_COLOR = "#374151";
export const DIVIDER_LABEL_SIZE = 13;

export const DIVIDER_STYLES: { id: DividerStyle; label: string }[] = [
  { id: "solid", label: "Line" },
  { id: "dashed", label: "Dashed" },
  { id: "dotted", label: "Dotted" },
  { id: "double", label: "Double" },
  { id: "thick", label: "Thick" },
  { id: "thickThin", label: "Thick and thin" },
  { id: "fade", label: "Faded ends" },
  { id: "dots", label: "Dots" },
  { id: "wave", label: "Wave" },
  { id: "ornament", label: "Ornament" },
  { id: "label", label: "With a text" },
  { id: "scissors", label: "Cut here" },
];

const OWN_THICKNESS: Record<DividerStyle, number> = {
  solid: 1.5,
  dashed: 1.5,
  dotted: 2.5,
  double: 1.2,
  thick: 4,
  thickThin: 3,
  fade: 2,
  dots: 4,
  wave: 1.6,
  ornament: 1.2,
  label: 1.2,
  scissors: 1.2,
};

export const dividerThickness = (b: Pick<DividerBlock, "style" | "thickness">) => b.thickness ?? OWN_THICKNESS[b.style];
export const dividerSpace = (b: Pick<DividerBlock, "space">) => b.space ?? DIVIDER_SPACE;
export const dividerColor = (b: Pick<DividerBlock, "color">) => b.color ?? DIVIDER_COLOR;
export const defaultDividerLabel = (lang: Lang) => (lang === "ar" ? "الجزء الثاني" : "Deuxième partie");

// The height of the marks themselves (without the room above and below).
function inkHeight(b: Pick<DividerBlock, "style" | "thickness">): number {
  const t = dividerThickness(b);
  switch (b.style) {
    case "double":
      return t * 2 + 3;
    case "thickThin":
      return t + 4;
    case "wave":
      return 8 + t;
    case "ornament":
      return 14;
    case "label":
      return DIVIDER_LABEL_SIZE * 1.4;
    case "scissors":
      return 16;
    default:
      return Math.max(t, 1);
  }
}

export const dividerHeight = (b: Pick<DividerBlock, "style" | "thickness" | "space">) => Math.round(inkHeight(b) + dividerSpace(b) * 2);

export type DividerMark =
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; width: number; dash?: number[]; round?: boolean }
  | { kind: "fade"; x: number; y: number; w: number; h: number }
  | { kind: "dot"; x: number; y: number; r: number }
  | { kind: "path"; points: number[]; width: number }
  | { kind: "diamond"; x: number; y: number; r: number }
  | { kind: "text"; x: number; y: number; text: string; size: number; anchor: "middle" | "start" };

/**
 * What to draw for a divider `w` wide and `h` tall. `textWidth` measures a text of the "label" style at its size (the page measures
 * with its fonts; a preview guesses).
 */
export function dividerMarks(b: Pick<DividerBlock, "style" | "thickness" | "label">, w: number, h: number, textWidth: (text: string, size: number) => number): DividerMark[] {
  const t = dividerThickness(b);
  const y = h / 2;
  const line = (x1: number, x2: number, at = y, width = t, dash?: number[], round?: boolean): DividerMark => ({ kind: "line", x1, y1: at, x2, y2: at, width, dash, round });
  switch (b.style) {
    case "solid":
    case "thick":
      return [line(0, w)];
    case "dashed":
      return [line(0, w, y, t, [t * 5, t * 3.5])];
    case "dotted":
      return [line(t / 2, w - t / 2, y, t, [0.01, t * 2.6], true)];
    case "double":
      return [line(0, w, y - (t + 3) / 2), line(0, w, y + (t + 3) / 2)];
    case "thickThin":
      return [line(0, w, y - 2, t), line(0, w, y + (t + 4) / 2 - 0.5, 1)];
    case "fade":
      return [{ kind: "fade", x: 0, y: y - t / 2, w, h: t }];
    case "dots": {
      const gap = t * 3.2;
      const n = Math.max(1, Math.floor((w - t) / gap) + 1);
      const start = (w - (n - 1) * gap) / 2;
      return Array.from({ length: n }, (_, i) => ({ kind: "dot" as const, x: start + i * gap, y, r: t / 2 }));
    }
    case "wave": {
      const amp = 4;
      const period = 16;
      const points: number[] = [];
      for (let x = 0; x <= w + 0.01; x += 2) points.push(x, y + Math.sin((x / period) * Math.PI * 2) * amp);
      return [{ kind: "path", points, width: t }];
    }
    case "ornament": {
      const r = 5;
      const gap = 10;
      return [line(0, w / 2 - r - gap), { kind: "diamond", x: w / 2, y, r }, line(w / 2 + r + gap, w), { kind: "dot", x: w / 2 - r - gap / 2, y, r: 1.4 }, { kind: "dot", x: w / 2 + r + gap / 2, y, r: 1.4 }];
    }
    case "label": {
      const text = (b.label ?? "").trim();
      if (!text) return [line(0, w)];
      const size = DIVIDER_LABEL_SIZE;
      const tw = Math.min(textWidth(text, size), w - 40);
      const pad = 10;
      return [line(0, w / 2 - tw / 2 - pad), { kind: "text", x: w / 2, y, text, size, anchor: "middle" }, line(w / 2 + tw / 2 + pad, w)];
    }
    case "scissors":
      return [{ kind: "text", x: 0, y, text: "✂", size: 15, anchor: "start" }, line(22, w, y, t, [6, 4])];
  }
}
