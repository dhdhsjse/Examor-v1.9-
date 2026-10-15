import type { Group } from "@/app/_features/core/types";
import { toolArabicIrabTable } from "@/app/_features/tools/tool-arabic-irab-table";
import { toolArabicPoetry } from "@/app/_features/tools/tool-arabic-poetry";
import { toolArabicTashkeel } from "@/app/_features/tools/tool-arabic-tashkeel";
import { toolArabicText } from "@/app/_features/tools/tool-arabic-text";

export const arabicGroup: Group = {
  id: "group.arabic",
  order: 20,
  when: (ctx) => ctx.shell.subject === "Arabic",
  label: (t) => t("{subject} tools", { subject: t("Arabic") }),
  className: "grid grid-cols-2 gap-2",
  features: [toolArabicText, toolArabicTashkeel, toolArabicPoetry, toolArabicIrabTable],
};
