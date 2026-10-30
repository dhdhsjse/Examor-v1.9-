import type { Option } from "@/app/_features/core/types";
import { toolInsertEquation } from "@/app/_features/tools/tool-insert-equation";
import { toolInsertParagraph } from "@/app/_features/tools/tool-insert-paragraph";
import { toolInsertTable } from "@/app/_features/tools/tool-insert-table";
import { toolTableStudio } from "@/app/_features/tools/tool-table-studio";
import { inspectorInsertShapes } from "@/app/_features/inspectors/inspector-insert-shapes";
import { toolInsertTextbox } from "@/app/_features/tools/tool-insert-textbox";

export const insertContentOption: Option = {
  id: "option.insert.content",
  order: 20,
  label: (t) => t("Content"),
  features: [toolInsertParagraph, toolInsertTextbox, inspectorInsertShapes, toolInsertEquation, toolInsertTable, toolTableStudio],
};
