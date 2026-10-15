import type { Group } from "@/app/_features/core/types";
import { toolFrenchConjugation } from "@/app/_features/tools/tool-french-conjugation";
import { toolFrenchDictation } from "@/app/_features/tools/tool-french-dictation";
import { toolFrenchGrammar } from "@/app/_features/tools/tool-french-grammar";
import { toolFrenchReadingText } from "@/app/_features/tools/tool-french-reading-text";

export const frenchGroup: Group = {
  id: "group.french",
  order: 20,
  when: (ctx) => ctx.shell.subject === "French",
  label: (t) => t("{subject} tools", { subject: t("French") }),
  className: "grid grid-cols-2 gap-2",
  features: [toolFrenchConjugation, toolFrenchDictation, toolFrenchReadingText, toolFrenchGrammar],
};
