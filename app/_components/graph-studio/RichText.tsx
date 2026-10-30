"use client";

import type { ComponentProps } from "react";
import { Shape } from "react-konva";
import { SCRIPT_SIZE, SUB_SHIFT, SUP_SHIFT, type TextRun } from "@/app/_lib/graph/richLabel";

const FONT = "Arial, Helvetica, sans-serif";

let scratch: CanvasRenderingContext2D | null = null;
const fontOf = (px: number, bold?: boolean, italic?: boolean) => `${italic ? "italic " : ""}${bold ? "bold " : ""}${px}px ${FONT}`;

/** How wide the runs are on the canvas at this size (scripts at their own, smaller size). */
export function measureRuns(runs: TextRun[], size: number, bold?: boolean, italic?: boolean): number {
  scratch ??= document.createElement("canvas").getContext("2d");
  if (!scratch) return runs.reduce((w, r) => w + r.text.length * size * 0.6, 0);
  const ctx = scratch;
  return runs.reduce((w, r) => {
    ctx.font = fontOf(r.script ? size * SCRIPT_SIZE : size, bold, italic);
    return w + ctx.measureText(r.text).width;
  }, 0);
}

type Props = Omit<ComponentProps<typeof Shape>, "sceneFunc" | "hitFunc" | "fill" | "stroke"> & {
  runs: TextRun[];
  /** size of the text around the scripts, in px */
  size: number;
  /** where (x, y) is along the text: its start, middle or end */
  align: "start" | "middle" | "end";
  bold?: boolean;
  italic?: boolean;
  color: string;
  /** the white line round the letters that keeps them readable over the grid */
  halo?: { color: string; width: number };
};

// A text with sub- and superscripts. Konva's Text has one font and one baseline, so this draws the runs itself, one after the
// other, as the picture for the page (an SVG with tspans) lays them out. (x, y) is the middle of the height at the anchor.
export default function RichText({ runs, size, align, bold, italic, color, halo = { color: "#ffffff", width: 3 }, ...shape }: Props) {
  const left = (width: number) => (align === "start" ? 0 : align === "middle" ? -width / 2 : -width);
  return (
    <Shape
      {...shape}
      sceneFunc={(context) => {
        const g = context._context;
        const x0 = left(measureRuns(runs, size, bold, italic));
        g.save();
        g.textBaseline = "middle";
        g.lineJoin = "round";
        for (const pass of ["halo", "text"] as const) {
          let x = x0;
          for (const r of runs) {
            g.font = fontOf(r.script ? size * SCRIPT_SIZE : size, bold, italic);
            const y = (r.script === "sub" ? SUB_SHIFT : r.script === "sup" ? SUP_SHIFT : 0) * size;
            if (pass === "halo") {
              g.lineWidth = halo.width;
              g.strokeStyle = halo.color;
              g.strokeText(r.text, x, y);
            } else {
              g.fillStyle = color;
              g.fillText(r.text, x, y);
            }
            x += g.measureText(r.text).width;
          }
        }
        g.restore();
      }}
      hitFunc={(context, node) => {
        const width = measureRuns(runs, size, bold, italic);
        context.beginPath();
        context.rect(left(width), -size, width, 2 * size);
        context.closePath();
        context.fillStrokeShape(node);
      }}
    />
  );
}
