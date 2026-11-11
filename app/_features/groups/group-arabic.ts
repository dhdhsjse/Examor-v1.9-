import type { Group } from "@/app/_features/core/types";
import { toolArabicIrabTable } from "@/app/_features/tools/tool-arabic-irab-table";
import { toolArabicPoetry } from "@/app/_features/tools/tool-arabic-poetry";

export const arabicGroup: Group = {
  id: "group.arabic",
  order: 20,
  when: (ctx) => ctx.shell.subject === "Arabic",
  label: (t) => t("{subject} tools", { subject: t("Arabic") }),
  className: "grid grid-cols-2 gap-1.5",
  features: [toolArabicPoetry, toolArabicIrabTable],
};
