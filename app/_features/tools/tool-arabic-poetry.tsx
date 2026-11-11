import { VerseIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

// A verse: two hemistichs side by side, صدر (first, on the right) and عجز (second, on the left). A table without borders, one row and
// two columns, each with a dotted line under it, and each cell written in on its own.
const line = { dash: "dotted" as const };
const hemistich = { bB: true, lB: line };
const action: ToolAction = {
  kind: "block",
  type: "table",
  preset: {
    cells: [["", ""]],
    header: false,
    borders: "none",
    verse: true,
    cellStyles: { "0,0": hemistich, "0,1": hemistich },
  },
};

export const toolArabicPoetry: Feature = {
  id: "tool.arabic.poetry",
  kind: "tool",
  label: "Poetry verse",
  icon: <VerseIcon />,
  tone: "emerald",
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
