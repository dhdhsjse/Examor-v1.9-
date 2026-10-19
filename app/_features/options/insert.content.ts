import type { Option } from "@/app/_features/core/types";
import { toolInsertEquation } from "@/app/_features/tools/tool-insert-equation";
import { toolInsertHeading } from "@/app/_features/tools/tool-insert-heading";
import { toolInsertParagraph } from "@/app/_features/tools/tool-insert-paragraph";
import { toolInsertTable } from "@/app/_features/tools/tool-insert-table";
import { toolInsertTextbox } from "@/app/_features/tools/tool-insert-textbox";

export const insertContentOption: Option = {
  id: "option.insert.content",
  order: 20,
  label: (t) => t("Content"),
  features: [toolInsertHeading, toolInsertParagraph, toolInsertTextbox, toolInsertEquation, toolInsertTable],
};
