import type { Feature } from "@/app/_features/core/types";

// A table with a pen over it
function DrawTableIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6" />
      <path d="M3 10h8M10 10v11M10 15h11" />
      <path d="M18.4 2.6a1.9 1.9 0 0 1 2.7 2.7L15 11.4l-3.4.9.9-3.4z" />
    </svg>
  );
}

// Draw a table freely on the page, like with a pen: a box on the paper is a table of one cell, lines drawn inside it cut its cells. The
// floating bar of the tables (workspace/TableDrawBar) has the pen, horizontal and vertical lines, the eraser, Select cells, Merge and Split.
// What it makes is an ordinary table: the right panel and the Table Studio change it.
export const toolDrawTable: Feature = {
  id: "tool.draw-table",
  kind: "tool",
  label: (t) => t("Free table"),
  icon: <DrawTableIcon />,
  tone: "amber",
  tags: ["table", "tableau", "draw", "dessiner", "free", "libre", "pen", "stylo", "cells", "cellules", "merge", "fusionner", "split", "جدول", "رسم"],
  checked: (ctx) => ctx.shell.canvasTool === "table",
  run: (ctx) => ctx.shell.setCanvasTool(ctx.shell.canvasTool === "table" ? "select" : "table"),
};
