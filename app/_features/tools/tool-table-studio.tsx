import { TableProperties } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";
import type { ToolAction } from "@/app/_lib/tools";

const action: ToolAction = { kind: "table-studio" };

// Opens the Table Studio: a spreadsheet for the table of an exam (merged cells, looks, lines, number formats, formulas). The "Table" tile
// next to it puts a plain grid on the page; both give a table that the right panel can change.
export const toolTableStudio: Feature = {
  id: "tool.table-studio",
  kind: "tool",
  label: (t) => t("Table Studio"),
  icon: <TableProperties size={18} strokeWidth={1.7} />,
  tone: "amber",
  tags: ["table", "tableau", "spreadsheet", "excel", "grid", "grille", "formula", "formule", "cells", "cellules", "merge", "جدول", "خلايا", "معادلة"],
  dragPayload: action,
  run: (ctx) => ctx.shell.runTool(action),
};
