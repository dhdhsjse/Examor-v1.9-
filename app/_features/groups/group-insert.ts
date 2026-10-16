import type { Group } from "@/app/_features/core/types";
import { toolInsertDiagram } from "@/app/_features/tools/tool-insert-diagram";
import { toolInsertEquation } from "@/app/_features/tools/tool-insert-equation";
import { toolInsertGraph } from "@/app/_features/tools/tool-insert-graph";
import { toolInsertHeader } from "@/app/_features/tools/tool-insert-header";
import { toolInsertHeading } from "@/app/_features/tools/tool-insert-heading";
import { toolInsertImage } from "@/app/_features/tools/tool-insert-image";
import { toolInsertParagraph } from "@/app/_features/tools/tool-insert-paragraph";
import { toolInsertTable } from "@/app/_features/tools/tool-insert-table";

export const insertGroup: Group = {
  id: "group.insert",
  order: 40,
  label: (t) => t("Insert"),
  className: "grid grid-cols-2 gap-2",
  features: [
    toolInsertHeading,
    toolInsertParagraph,
    toolInsertEquation,
    toolInsertTable,
    toolInsertGraph,
    toolInsertImage,
    toolInsertDiagram,
    toolInsertHeader,
  ],
};
