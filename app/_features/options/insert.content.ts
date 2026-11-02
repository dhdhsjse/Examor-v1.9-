import type { Option } from "@/app/_features/core/types";
import { toolInsertEquation } from "@/app/_features/tools/tool-insert-equation";
import { toolInsertTable } from "@/app/_features/tools/tool-insert-table";
import { toolTableStudio } from "@/app/_features/tools/tool-table-studio";

export const insertContentOption: Option = {
  id: "option.insert.content",
  order: 20,
  label: (t) => t("Content"),
  features: [toolInsertEquation, toolInsertTable, toolTableStudio],
};
