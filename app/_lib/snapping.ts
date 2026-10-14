import { PAGE_HEIGHT, PAGE_MARGIN, PAGE_WIDTH } from "./a4";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

// A pink alignment line shown while dragging. axis "x" = vertical line.
export interface Guide {
  axis: "x" | "y";
  pos: number;
}

type Axis = Guide["axis"];

// Start, middle and end of a box along one axis.
function edges(b: Box, axis: Axis): number[] {
  return axis === "x"
    ? [b.x, b.x + b.width / 2, b.x + b.width]
    : [b.y, b.y + b.height / 2, b.y + b.height];
}

// Page lines a block can snap to: both margins and the center.
function pageLines(axis: Axis): number[] {
  const size = axis === "x" ? PAGE_WIDTH : PAGE_HEIGHT;
  return [PAGE_MARGIN, size / 2, size - PAGE_MARGIN];
}

// Find the smallest nudge (within `threshold`) that aligns the box on one axis.
function snapAxis(box: Box, others: Box[], axis: Axis, threshold: number) {
  const targets = [...pageLines(axis), ...others.flatMap((o) => edges(o, axis))];
  let best: number | null = null;

  for (const e of edges(box, axis)) {
    for (const t of targets) {
      const d = t - e;
      if (Math.abs(d) <= threshold && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    }
  }
  if (best === null) return { offset: 0, lines: [] as number[] };

  // Every line the box touches after the nudge gets drawn.
  const moved = edges(box, axis).map((e) => e + best);
  const lines = [...new Set(targets.filter((t) => moved.some((m) => Math.abs(m - t) < 0.5)))];
  return { offset: best, lines };
}

// Snap a dragged box to the page and to other blocks. Returns the new position + guides.
export function snapBox(box: Box, others: Box[], threshold: number) {
  const sx = snapAxis(box, others, "x", threshold);
  const sy = snapAxis(box, others, "y", threshold);
  const guides: Guide[] = [
    ...sx.lines.map((pos) => ({ axis: "x" as const, pos })),
    ...sy.lines.map((pos) => ({ axis: "y" as const, pos })),
  ];
  return { x: box.x + sx.offset, y: box.y + sy.offset, guides };
}
